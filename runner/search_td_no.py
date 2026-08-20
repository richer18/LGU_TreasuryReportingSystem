import argparse
import json
from datetime import date, datetime
from decimal import Decimal

from firebird_probe import connect, connection_mode, resolve_db_path, resolve_odbc_dsn


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


def search_td_no(cursor, td_no, limit):
    search_text = (td_no or "").strip()
    if not search_text:
        return []

    exact = search_text.upper()
    contains = f"%{exact}%"
    cursor.execute(
        """
        SELECT FIRST ?
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS PAYMENT_DATE,
            TRIM(p.RECEIPTNO) AS RECEIPT_NO,
            COALESCE(NULLIF(TRIM(p.PAIDBY), ''), '-') AS PAID_BY,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), NULLIF(TRIM(p.USERID), ''), '-') AS COLLECTOR,
            TRIM(p.RCDNUMBER) AS RCD_NUMBER,
            TRIM(p.STATUS_CT) AS STATUS_CODE,
            COALESCE(p.VOID_BV, 0) AS VOID_BV,
            ra.TAXTRANS_ID,
            TRIM(ra.TDNO) AS TD_NO,
            TRIM(ra.TDNOFORGR) AS TD_NO_FOR_GR,
            COALESCE(
                (SELECT FIRST 1 TRIM(owner.OWNERNAME)
                 FROM PROPERTYOWNER po
                 JOIN TAXPAYER owner ON owner.LOCAL_TIN = po.LOCAL_TIN
                 WHERE po.PROP_ID = prop.PROP_ID
                 ORDER BY po.VALIDUNTIL DESC),
                '-'
            ) AS DECLARED_OWNER,
            COALESCE(NULLIF(TRIM(prop.LOTNO), ''), TRIM(prop.CADASTRALLOTNO), '-') AS LOT_NO,
            TRIM(prop.BARANGAY_CT) AS BARANGAY_CODE,
            pcd.TAXYEAR,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'BSC' AND pcd.CASETYPE_CT = 'REG' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS BASIC_TAX,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'BSC' AND pcd.CASETYPE_CT = 'PEN' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS BASIC_PENALTY,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'SEF' AND pcd.CASETYPE_CT = 'REG' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS SEF_TAX,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'SEF' AND pcd.CASETYPE_CT = 'PEN' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS SEF_PENALTY,
            SUM(COALESCE(pcd.AMOUNT, 0)) AS TOTAL_AMOUNT
        FROM PAYMENTCLASSDETAIL pcd
        JOIN PAYMENT p ON p.PAYMENT_ID = pcd.PAYMENT_ID
        JOIN RPTASSESSMENT ra ON ra.TAXTRANS_ID = pcd.TAXTRANS_ID
        LEFT JOIN PROPERTY prop ON prop.PROP_ID = ra.PROP_ID
        WHERE COALESCE(pcd.CANCELLED_BV, 0) = 0
          AND COALESCE(p.VOID_BV, 0) = 0
          AND COALESCE(TRIM(p.STATUS_CT), '') NOT IN ('CAN', 'CNC', 'CNL', 'CANCEL', 'CANCELLED', 'VOID', 'VOI')
          AND UPPER(COALESCE(TRIM(p.PAYGROUP_CT), '')) = 'RPT'
          AND (
              UPPER(TRIM(ra.TDNO)) = ?
              OR UPPER(TRIM(ra.TDNOFORGR)) = ?
              OR UPPER(TRIM(ra.TDNO)) LIKE ?
              OR UPPER(TRIM(ra.TDNOFORGR)) LIKE ?
          )
        GROUP BY
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE),
            TRIM(p.RECEIPTNO),
            COALESCE(NULLIF(TRIM(p.PAIDBY), ''), '-'),
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), NULLIF(TRIM(p.USERID), ''), '-'),
            TRIM(p.RCDNUMBER),
            TRIM(p.STATUS_CT),
            COALESCE(p.VOID_BV, 0),
            ra.TAXTRANS_ID,
            TRIM(ra.TDNO),
            TRIM(ra.TDNOFORGR),
            prop.PROP_ID,
            COALESCE(NULLIF(TRIM(prop.LOTNO), ''), TRIM(prop.CADASTRALLOTNO), '-'),
            TRIM(prop.BARANGAY_CT),
            pcd.TAXYEAR
        ORDER BY CAST(p.PAYMENTDATE AS DATE) DESC, TRIM(p.RECEIPTNO) DESC, pcd.TAXYEAR DESC
        """,
        [limit, exact, exact, contains, contains],
    )

    result = rows(cursor)
    for item in result:
        item["collection_status"] = "Paid"
    return result


def summarize(items):
    payors = sorted({str(item.get("paid_by") or "-").strip() for item in items if str(item.get("paid_by") or "").strip()})
    receipts = sorted({str(item.get("receipt_no") or "-").strip() for item in items if str(item.get("receipt_no") or "").strip()})
    total = sum(float(item.get("total_amount") or 0) for item in items)
    return {"row_count": len(items), "receipt_count": len(receipts), "total_amount": round(total, 2), "payors": payors, "multiple_payors": len(payors) > 1}


def main():
    parser = argparse.ArgumentParser(description="Search RPT payment history by Tax Declaration number.")
    parser.add_argument("--td-no", required=True)
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    payload = {"ok": False, "mode": "search_td_no", "database": resolve_odbc_dsn() if connection_mode() == "odbc" else resolve_db_path(), "connection": connection_mode(), "td_no": args.td_no}
    try:
        connection = connect()
        cursor = connection.cursor()
        data = search_td_no(cursor, args.td_no, max(1, min(args.limit, 500)))
        connection.close()
        payload["data"] = data
        payload["summary"] = summarize(data)
        payload["ok"] = True
    except Exception as exc:
        payload.update({"ok": False, "error": str(exc), "error_type": exc.__class__.__name__})
    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
