import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path

from firebird_probe import connect


CANCEL_STATUS_CODES = {"VOID", "VOI", "CNL", "CAN", "CNC", "CANCEL", "CANCELLED"}
FINAL_RCD_STATUSES = {"remitted to aco", "received by aco", "posted", "completed"}
PENDING_RCD_STATUSES = {"draft", "saved", "for remittance", "ready for remittance", "with variance"}
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ACCESS_DB = PROJECT_ROOT / "backend" / "database" / "rcd" / "rcd_remittance.accdb"
ACCESS_DRIVER = "Microsoft Access Driver (*.mdb, *.accdb)"


for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")


def emit(payload, code=0):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True, default=str))
    raise SystemExit(code)


def month_start():
    today = date.today()
    return today.replace(day=1).isoformat()


def today():
    return date.today().isoformat()


def money(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def clean_text(value):
    return str(value or "").strip()


def upper_text(value):
    return clean_text(value).upper()


def normalize_or_number(value):
    original = clean_text(value)
    digits = re.sub(r"\D", "", original)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def normalize_status(value):
    return clean_text(value).lower()


def row_dict(cursor, row):
    return {cursor.description[index][0].lower(): row[index] for index in range(len(cursor.description))}


def payment_status_label(row):
    status_code = upper_text(row.get("status_code"))
    status_description = upper_text(row.get("status_description"))
    void_flag = int(row.get("void_flag") or 0)
    cancelled_lines = int(row.get("cancelled_class_lines") or 0)

    if void_flag == 1 or "VOID" in status_description or status_code in {"VOID", "VOI"}:
        return "Void"
    if status_code in CANCEL_STATUS_CODES or "CANCEL" in status_description:
        return "Cancelled"
    if cancelled_lines > 0:
        return "RPT Detail Cancelled"
    return status_description.title() if status_description else (status_code or "-")


def derive_fund_type(row):
    fund_type = upper_text(row.get("fund_type"))
    pay_group = upper_text(row.get("pay_group"))
    af_type = upper_text(row.get("af_type"))

    if pay_group == "RPT" or af_type == "AF56":
        return "RPT"
    if fund_type == "TF":
        return "Trust Fund"
    if "CTC" in pay_group or "COMMUNITY" in pay_group:
        return "Community Tax"
    if fund_type:
        return fund_type
    return pay_group or "-"


def derive_transaction_type(row):
    source_type = clean_text(row.get("source_type"))
    tax_type = clean_text(row.get("tax_type"))
    pay_group = clean_text(row.get("pay_group"))
    af_type = clean_text(row.get("af_type"))

    if pay_group.upper() == "RPT" or af_type.upper() == "AF56":
        return "Real Property Tax"
    return source_type or tax_type or pay_group or af_type or "-"


def base_payment_sql(cancelled_only=False):
    cancelled_filter = """
        (
            COALESCE(p.VOID_BV, 0) = 1
            OR UPPER(TRIM(COALESCE(p.STATUS_CT, ''))) IN ('VOID', 'VOI', 'CNL', 'CAN', 'CNC', 'CANCEL', 'CANCELLED')
            OR UPPER(TRIM(COALESCE(st.DESCRIPTION, ''))) LIKE '%CANCEL%'
            OR UPPER(TRIM(COALESCE(st.DESCRIPTION, ''))) LIKE '%VOID%'
            OR COALESCE(pcd.CANCELLED_CLASS_LINES, 0) > 0
        )
    """

    validity_filter = f"NOT {cancelled_filter}"

    where_parts = [
        "p.PAYMENTDATE >= CAST(? AS DATE)",
        "p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))",
    ]

    if cancelled_only:
        where_parts.append(cancelled_filter)
    else:
        where_parts.append(validity_filter)
        where_parts.append("(p.RCDNUMBER IS NULL OR TRIM(COALESCE(p.RCDNUMBER, '')) = '')")

    return f"""
        SELECT
            p.PAYMENT_ID AS PAYMENT_ID,
            p.PAYMENTDATE AS OR_DATE,
            p.RECEIPTNO AS OR_NUMBER,
            p.PAIDBY AS TAXPAYER_NAME,
            CASE
                WHEN UPPER(TRIM(COALESCE(p.PAYGROUP_CT, ''))) = 'RPT'
                  OR UPPER(TRIM(COALESCE(p.AFTYPE, ''))) = 'AF56'
                THEN COALESCE(pcd.CLASS_AMOUNT, pd.DETAIL_AMOUNT, p.AMOUNT, 0)
                ELSE COALESCE(pd.DETAIL_AMOUNT, pcd.CLASS_AMOUNT, p.AMOUNT, 0)
            END AS AMOUNT,
            p.PAYGROUP_CT AS PAY_GROUP,
            p.AFTYPE AS AF_TYPE,
            pd.FUNDTYPE_CT AS FUND_TYPE,
            pd.ITAXTYPE_CT AS TAX_TYPE,
            pd.SOURCE_CT AS SOURCE_TYPE,
            p.COLLECTOR AS COLLECTOR,
            p.STATUS_CT AS STATUS_CODE,
            st.DESCRIPTION AS STATUS_DESCRIPTION,
            COALESCE(p.VOID_BV, 0) AS VOID_FLAG,
            COALESCE(pcd.CANCELLED_CLASS_LINES, 0) AS CANCELLED_CLASS_LINES,
            p.REMARK AS REMARKS,
            p.TRANSDATE AS TRANSACTION_DATE,
            p.USERID AS USER_ID,
            p.RCDNUMBER AS RCD_NUMBER
        FROM PAYMENT p
        LEFT JOIN T_STATUS st ON st.CODE = p.STATUS_CT
        LEFT JOIN (
            SELECT
                PAYMENT_ID,
                SUM(COALESCE(AMOUNTPAID, 0)) AS DETAIL_AMOUNT,
                MIN(FUNDTYPE_CT) AS FUNDTYPE_CT,
                MIN(ITAXTYPE_CT) AS ITAXTYPE_CT,
                MIN(SOURCE_CT) AS SOURCE_CT
            FROM PAYMENTDETAIL
            GROUP BY PAYMENT_ID
        ) pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN (
            SELECT
                PAYMENT_ID,
                SUM(COALESCE(AMOUNT, 0)) AS CLASS_AMOUNT,
                SUM(CASE WHEN COALESCE(CANCELLED_BV, 0) = 1 THEN 1 ELSE 0 END) AS CANCELLED_CLASS_LINES
            FROM PAYMENTCLASSDETAIL
            GROUP BY PAYMENT_ID
        ) pcd ON pcd.PAYMENT_ID = p.PAYMENT_ID
        WHERE {' AND '.join(where_parts)}
        ORDER BY p.PAYMENTDATE DESC, p.RECEIPTNO DESC
    """


def passes_text_filter(value, expected):
    if not expected:
        return True
    return expected.lower() in clean_text(value).lower()


def apply_common_filters(rows, args):
    filtered = []
    for row in rows:
        if args.fund_type and args.fund_type.lower() not in row["fund_type"].lower():
            continue
        if args.collector and args.collector.lower() not in row["collector_cashier"].lower():
            continue
        if args.status and args.status.lower() not in row["status"].lower() and args.status.lower() not in row.get("rcd_status", "").lower():
            continue
        if args.transaction_type and args.transaction_type.lower() not in row["transaction_type"].lower():
            continue
        if args.or_number and args.or_number not in row["or_number"]:
            continue
        if not passes_text_filter(row["taxpayer_name"], args.taxpayer):
            continue
        filtered.append(row)
    return filtered


def fetch_firebird_rows(cancelled_only, args):
    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(base_payment_sql(cancelled_only=cancelled_only), [args.date_from, args.date_to])
        rows = []
        for raw in cursor.fetchall():
            source = row_dict(cursor, raw)
            rows.append(
                {
                    "payment_id": clean_text(source.get("payment_id")),
                    "or_date": clean_text(source.get("or_date")),
                    "or_number": clean_text(source.get("or_number")),
                    "taxpayer_name": clean_text(source.get("taxpayer_name")) or "-",
                    "amount": round(money(source.get("amount")), 2),
                    "fund_type": derive_fund_type(source),
                    "transaction_type": derive_transaction_type(source),
                    "collector_cashier": clean_text(source.get("collector")) or "-",
                    "status": payment_status_label(source),
                    "status_code": clean_text(source.get("status_code")) or "-",
                    "void_flag": int(source.get("void_flag") or 0),
                    "remarks": clean_text(source.get("remarks")) or "-",
                    "transaction_date": clean_text(source.get("transaction_date")),
                    "user_id": clean_text(source.get("user_id")) or "-",
                    "rcd_number": clean_text(source.get("rcd_number")),
                }
            )
        return rows
    finally:
        try:
            connection.close()
        except Exception:
            pass


def load_access_ranges():
    db_path = Path(os.environ.get("RCD_ACCESS_DB") or DEFAULT_ACCESS_DB).resolve()
    if not db_path.exists():
        return [], [f"AccessDB file was not found: {db_path}. Range matching skipped."]

    try:
        import pyodbc
    except ImportError as exc:
        return [], [f"pyodbc is not installed. AccessDB range matching skipped: {exc}"]

    warnings = []
    ranges = []
    try:
        conn = pyodbc.connect(f"DRIVER={{{ACCESS_DRIVER}}};DBQ={db_path};", readonly=True)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                b.id,
                b.report_no,
                b.report_date,
                b.collector,
                b.status,
                l.form_type,
                l.receipt_no_from,
                l.receipt_no_to
            FROM rcd_batches AS b
            INNER JOIN rcd_collection_lines AS l ON l.batch_id = b.id
            WHERE l.receipt_no_from IS NOT NULL
              AND l.receipt_no_to IS NOT NULL
            """
        )
        for raw in cursor.fetchall():
            row = row_dict(cursor, raw)
            start = normalize_or_number(row.get("receipt_no_from"))
            end = normalize_or_number(row.get("receipt_no_to"))
            if start is None or end is None:
                warnings.append(
                    f"Skipped non-numeric RCD range {row.get('receipt_no_from')} to {row.get('receipt_no_to')}."
                )
                continue
            ranges.append(
                {
                    "batch_id": clean_text(row.get("id")),
                    "report_no": clean_text(row.get("report_no")) or "-",
                    "report_date": clean_text(row.get("report_date")),
                    "collector": clean_text(row.get("collector")),
                    "status": clean_text(row.get("status")) or "-",
                    "form_type": clean_text(row.get("form_type")),
                    "start": min(start, end),
                    "end": max(start, end),
                    "display_from": clean_text(row.get("receipt_no_from")),
                    "display_to": clean_text(row.get("receipt_no_to")),
                }
            )
        conn.close()
    except Exception as exc:
        return [], [f"AccessDB range matching unavailable: {exc}"]

    return ranges, warnings


def match_range(or_number, ranges):
    numeric = normalize_or_number(or_number)
    if numeric is None:
        return None, "Unable to range-match"

    for item in ranges:
        if item["start"] <= numeric <= item["end"]:
            return item, ""
    return None, ""


def days_unremitted(or_date):
    try:
        value = datetime.fromisoformat(clean_text(or_date)[:10]).date()
    except ValueError:
        return "-"
    return max((date.today() - value).days, 0)


def canceled_void_report(args):
    rows = fetch_firebird_rows(cancelled_only=True, args=args)
    rows = apply_common_filters(rows, args)
    return rows, []


def not_remitted_report(args):
    source_rows = fetch_firebird_rows(cancelled_only=False, args=args)
    ranges, warnings = load_access_ranges()
    rows = []
    seen_statuses = set()

    for row in source_rows:
        match, range_error = match_range(row["or_number"], ranges)
        if range_error:
            row.update(
                {
                    "rcd_date": "",
                    "rcd_status": "Unable to range-match",
                    "days_unremitted": days_unremitted(row["or_date"]),
                    "remarks": "Unable to range-match OR number safely.",
                }
            )
            rows.append(row)
            continue

        if match:
            status_key = normalize_status(match["status"])
            seen_statuses.add(match["status"])
            if status_key in FINAL_RCD_STATUSES:
                continue

            row.update(
                {
                    "rcd_number": match["report_no"],
                    "rcd_date": match["report_date"],
                    "rcd_status": "Pending / Not Fully Remitted",
                    "days_unremitted": days_unremitted(row["or_date"]),
                    "remarks": f"Matched RCD range {match['display_from']} to {match['display_to']} with status {match['status']}.",
                }
            )
            rows.append(row)
            continue

        row.update(
            {
                "rcd_date": "",
                "rcd_status": "Not Remitted",
                "days_unremitted": days_unremitted(row["or_date"]),
                "remarks": "No PAYMENT.RCDNUMBER and no final RCD range match.",
            }
        )
        rows.append(row)

    rows = apply_common_filters(rows, args)
    if seen_statuses:
        warnings.append("AccessDB RCD statuses found: " + ", ".join(sorted(seen_statuses)))
    return rows, warnings


def paginate(rows, page, limit):
    page = max(int(page or 1), 1)
    limit = min(max(int(limit or 100), 1), 500)
    start = (page - 1) * limit
    return rows[start : start + limit], page, limit


def build_response(report, args, rows, warnings):
    total_count = len(rows)
    total_amount = round(sum(money(row.get("amount")) for row in rows), 2)
    page_rows, page, limit = paginate(rows, args.page, args.limit)
    payload = {
        "ok": True,
        "report": report,
        "date_from": args.date_from,
        "date_to": args.date_to,
        "page": page,
        "limit": limit,
        "total_count": total_count,
        "total_amount": total_amount,
        "returned_count": len(page_rows),
        "warnings": warnings,
        "data": page_rows,
    }
    if report == "not-remitted":
        payload["note"] = (
            "Not Remitted detection uses PAYMENT.RCDNUMBER plus RCD range matching. "
            "Exact per-OR remittance tracking can be improved later by populating rcd_entries."
        )
    return payload


def main():
    parser = argparse.ArgumentParser(description="Read-only receipt exceptions report.")
    parser.add_argument("report", choices=["canceled-void", "not-remitted"])
    parser.add_argument("--date-from", default=month_start())
    parser.add_argument("--date-to", default=today())
    parser.add_argument("--fund-type", default="")
    parser.add_argument("--collector", default="")
    parser.add_argument("--status", default="")
    parser.add_argument("--transaction-type", default="")
    parser.add_argument("--or-number", default="")
    parser.add_argument("--taxpayer", default="")
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()

    try:
        if args.report == "canceled-void":
            rows, warnings = canceled_void_report(args)
        else:
            rows, warnings = not_remitted_report(args)
        emit(build_response(args.report, args, rows, warnings))
    except Exception as exc:
        emit(
            {
                "ok": False,
                "report": args.report,
                "error": str(exc),
                "error_type": exc.__class__.__name__,
            },
            1,
        )


if __name__ == "__main__":
    main()
