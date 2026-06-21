import argparse
import json
import os
from datetime import date, datetime
from decimal import Decimal

import fdb

from firebird_probe import DEFAULT_CLIENT_PATH, connect, resolve_db_path


def scalar(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, str):
        return value.strip()
    return value


def rows(cursor):
    names = [column[0].strip().lower() for column in cursor.description]
    return [{name: scalar(value) for name, value in zip(names, row)} for row in cursor.fetchall()]


def collection_status(row):
    status_code = (row.get("status_ct") or "").strip().upper()
    status_description = (row.get("status_description") or "").strip().upper()
    is_void = int(row.get("void_bv") or 0) == 1

    if is_void or "VOID" in status_description:
        return "Void"
    if status_code in {"CAN", "CNC", "CNL", "CANCEL", "CANCELLED"} or "CANCEL" in status_description:
        return "Cancelled"
    return "Paid"


def attach_status(items):
    for item in items:
        item["collection_status"] = collection_status(item)
    return items


def payment_header_rows(cursor, where_sql, params, limit):
    cursor.execute(
        f"""
        SELECT FIRST ?
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS collection_date,
            TRIM(p.RECEIPTNO) AS receipt_no,
            TRIM(p.PAIDBY) AS taxpayer,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS assigned_collector,
            TRIM(p.USERID) AS user_id,
            TRIM(p.AFTYPE) AS receipt_type,
            TRIM(p.RCDNUMBER) AS rcd_number,
            TRIM(p.PAYGROUP_CT) AS paygroup,
            p.AMOUNT AS header_amount,
            COALESCE(p.VOID_BV, 0) AS void_bv,
            TRIM(p.STATUS_CT) AS status_ct,
            COALESCE(TRIM(st.DESCRIPTION), TRIM(p.STATUS_CT), '') AS status_description
        FROM PAYMENT p
        LEFT JOIN T_STATUS st ON st.CODE = p.STATUS_CT
        WHERE {where_sql}
        ORDER BY CAST(p.PAYMENTDATE AS DATE) DESC, TRIM(p.RECEIPTNO)
        """,
        [limit, *params],
    )
    return attach_status(rows(cursor))


def attach_detail_totals(cursor, items):
    for item in items:
        cursor.execute(
            """
            SELECT COUNT(pd.PAYMENTDETAIL_ID), COALESCE(SUM(pd.AMOUNTPAID), 0)
            FROM PAYMENTDETAIL pd
            WHERE pd.PAYMENT_ID = ?
            """,
            [item["payment_id"]],
        )
        line_count, total_amount = cursor.fetchone()
        item["line_count"] = int(line_count or 0)
        item["total_amount"] = scalar(total_amount or 0)
    return items


def search_receipts(cursor, args):
    search_text = (args.receipt_no or "").strip()
    if not search_text:
        return []

    # Fast path: exact OR lookup uses IDX_PAYMENT_RECEIPTNO and avoids scanning PAYMENTDETAIL.
    result = payment_header_rows(cursor, "p.RECEIPTNO = ?", [search_text], args.limit)
    if not result:
        result = payment_header_rows(cursor, "TRIM(p.RECEIPTNO) = ?", [search_text], args.limit)
    if not result:
        result = payment_header_rows(cursor, "p.RECEIPTNO STARTING WITH ?", [search_text], args.limit)
    if not result and len(search_text) >= 4:
        result = payment_header_rows(cursor, "UPPER(TRIM(p.RECEIPTNO)) CONTAINING UPPER(?)", [search_text], args.limit)

    return attach_detail_totals(cursor, result)


def receipt_details(cursor, args):
    cursor.execute(
        """
        SELECT
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS collection_date,
            TRIM(p.RECEIPTNO) AS receipt_no,
            TRIM(p.PAIDBY) AS taxpayer,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS assigned_collector,
            TRIM(p.USERID) AS user_id,
            TRIM(p.AFTYPE) AS receipt_type,
            TRIM(p.RCDNUMBER) AS rcd_number,
            TRIM(p.PAYGROUP_CT) AS paygroup,
            p.AMOUNT AS header_amount,
            COALESCE(p.VOID_BV, 0) AS void_bv,
            TRIM(p.STATUS_CT) AS status_ct,
            COALESCE(TRIM(st.DESCRIPTION), TRIM(p.STATUS_CT), '') AS status_description
        FROM PAYMENT p
        LEFT JOIN T_STATUS st ON st.CODE = p.STATUS_CT
        WHERE p.PAYMENT_ID = ?
        """,
        [args.payment_id],
    )
    header_rows = attach_status(rows(cursor))
    if not header_rows:
        return None

    cursor.execute(
        """
        SELECT
            pd.PAYMENTDETAIL_ID,
            TRIM(pd.ITAXTYPE_CT) AS source_code,
            COALESCE(TRIM(it.DESCRIPTION), TRIM(pd.ITAXTYPE_CT), 'UNSPECIFIED') AS source_description,
            TRIM(opr.DESCRIPTION) AS child_description,
            pd.SOURCEID AS source_id,
            TRIM(pd.SOURCE_CT) AS source_ct,
            TRIM(pd.FUNDTYPE_CT) AS fund_type,
            TRIM(pd.STATUS_CT) AS detail_status,
            pd.AMOUNTPAID AS amount
        FROM PAYMENTDETAIL pd
        LEFT JOIN T_ITAXTYPE it ON it.CODE = pd.ITAXTYPE_CT
        LEFT JOIN T_OTHERPAYMENTRATE opr ON opr.OPRATE_ID = pd.SOURCEID
        WHERE pd.PAYMENT_ID = ?
        ORDER BY pd.RECEIPTITEMORDER, pd.PAYMENTDETAIL_ID
        """,
        [args.payment_id],
    )
    details = rows(cursor)
    header = header_rows[0]
    header["details"] = details
    header["line_count"] = len(details)
    header["total_amount"] = sum(float(item.get("amount") or 0) for item in details)
    return header


def write_connection():
    return fdb.connect(
        dsn=resolve_db_path(),
        user=os.environ.get("FIREBIRD_USER", "SYSDBA"),
        password=os.environ.get("FIREBIRD_PASSWORD", "masterkey"),
        charset=os.environ.get("FIREBIRD_CHARSET", "UTF8"),
        fb_library_name=os.environ.get("FIREBIRD_CLIENT_LIBRARY", DEFAULT_CLIENT_PATH),
    )


def update_receipt(args):
    if os.environ.get("FIREBIRD_ALLOW_RECEIPT_UPDATE") != "1":
        return {
            "updated": False,
            "write_enabled": False,
            "message": "Receipt updates are disabled. Set FIREBIRD_ALLOW_RECEIPT_UPDATE=1 only after Treasurer approval.",
        }

    receipt_no = (args.new_receipt_no or "").strip()
    collector = (args.assigned_collector or "").strip()
    if not receipt_no or not collector:
        raise ValueError("assigned_collector and new_receipt_no are required for update")

    connection = write_connection()
    cursor = connection.cursor()
    cursor.execute(
        """
        UPDATE PAYMENT
        SET COLLECTOR = ?, RECEIPTNO = ?
        WHERE PAYMENT_ID = ?
        """,
        [collector, receipt_no, args.payment_id],
    )
    updated_count = cursor.rowcount
    connection.commit()
    connection.close()

    return {
        "updated": updated_count > 0,
        "write_enabled": True,
        "payment_id": args.payment_id,
        "assigned_collector": collector,
        "receipt_no": receipt_no,
    }


def main():
    parser = argparse.ArgumentParser(description="Search and restricted receipt maintenance.")
    subparsers = parser.add_subparsers(dest="action", required=True)

    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("--receipt-no", required=True)
    search_parser.add_argument("--limit", type=int, default=25)

    detail_parser = subparsers.add_parser("detail")
    detail_parser.add_argument("--payment-id", required=True)

    update_parser = subparsers.add_parser("update")
    update_parser.add_argument("--payment-id", required=True)
    update_parser.add_argument("--assigned-collector", required=True)
    update_parser.add_argument("--new-receipt-no", required=True)

    args = parser.parse_args()
    payload = {
        "ok": False,
        "mode": "receipt_search",
        "database": resolve_db_path(),
        "action": args.action,
    }

    try:
        if args.action == "update":
            payload["data"] = update_receipt(args)
        else:
            connection = connect()
            cursor = connection.cursor()
            payload["data"] = search_receipts(cursor, args) if args.action == "search" else receipt_details(cursor, args)
            connection.close()
        payload["ok"] = True
    except Exception as exc:
        payload.update(
            {
                "ok": False,
                "error": str(exc),
                "error_type": exc.__class__.__name__,
            }
        )

    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
