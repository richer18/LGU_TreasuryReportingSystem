import argparse
import calendar
import json
import os
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace

from firebird_probe import connect

try:
    import receipt_exceptions_readonly as receipt_exceptions
except Exception:
    receipt_exceptions = None


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ACCESS_DB = PROJECT_ROOT / "backend" / "database" / "rcd" / "rcd_remittance.accdb"
ACCESS_DRIVER = "Microsoft Access Driver (*.mdb, *.accdb)"

FINAL_RCD_STATUSES = {"remitted to aco", "received by aco", "posted", "completed"}
PENDING_RCD_STATUSES = {"draft", "saved", "for remittance", "ready for remittance", "with variance"}
COLLECTOR_ALIASES = {
    "angelique": ["angelique", "iris", "angelique iris", "angelique iris rafales"],
    "flora": ["flora", "flora my", "flora my ferrer"],
    "agnes": ["agnes", "agnes ello"],
    "ricardo": ["ricardo", "ricardo enopia"],
    "emily": ["emily", "emily credo"],
}


for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")


def emit(payload, code=0):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True, default=str))
    raise SystemExit(code)


def money(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def clean_text(value):
    return str(value or "").strip()


def month_bounds(year, month):
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def day_key(value):
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = clean_text(value)
    return text[:10] if text else ""


def row_dict(cursor, row):
    return {cursor.description[index][0].lower(): row[index] for index in range(len(cursor.description))}


def collector_values(collector):
    collector = clean_text(collector).lower()
    if not collector:
        return []
    return sorted({collector, *COLLECTOR_ALIASES.get(collector, [])})


def build_days(year, month):
    _, last = month_bounds(year, month)
    return {
        date(year, month, day).isoformat(): {
            "date": date(year, month, day).isoformat(),
            "collection": {"amount": 0.0, "transaction_count": 0, "collectors": []},
            "rcd": {"count": 0, "statuses": [], "items": []},
            "exceptions": {"canceled_void_count": 0, "not_remitted_count": 0},
        }
        for day in range(1, last.day + 1)
    }


def payment_validity_filter():
    return """
        COALESCE(p.VOID_BV, 0) = 0
        AND UPPER(TRIM(COALESCE(p.STATUS_CT, ''))) NOT IN ('VOID', 'VOI', 'CNL', 'CAN', 'CNC', 'CANCEL', 'CANCELLED')
        AND UPPER(TRIM(COALESCE(st.DESCRIPTION, ''))) NOT LIKE '%CANCEL%'
        AND UPPER(TRIM(COALESCE(st.DESCRIPTION, ''))) NOT LIKE '%VOID%'
    """


def load_collections(days, args, date_from, date_to, warnings):
    try:
        connection = connect()
        cursor = connection.cursor()
        filters = [
            "p.PAYMENTDATE >= CAST(? AS DATE)",
            "p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))",
            payment_validity_filter(),
        ]
        params = [date_from.isoformat(), date_to.isoformat()]
        collector_filters = collector_values(args.collector)

        if collector_filters:
            placeholders = ", ".join("?" for _ in collector_filters)
            filters.append(
                "LOWER(TRIM(COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED'))) "
                f"IN ({placeholders})"
            )
            params.extend(collector_filters)

        cursor.execute(
            f"""
            SELECT
                CAST(p.PAYMENTDATE AS DATE) AS collection_date,
                COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS collector,
                COUNT(*) AS receipt_count,
                SUM(COALESCE(p.AMOUNT, 0)) AS total_amount
            FROM PAYMENT p
            LEFT JOIN T_STATUS st ON st.CODE = p.STATUS_CT
            WHERE {' AND '.join(filters)}
            GROUP BY CAST(p.PAYMENTDATE AS DATE), COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED')
            ORDER BY CAST(p.PAYMENTDATE AS DATE)
            """,
            params,
        )

        for raw in cursor.fetchall():
            row = row_dict(cursor, raw)
            key = day_key(row.get("collection_date"))
            if key not in days:
                continue
            collector = clean_text(row.get("collector")) or "UNSPECIFIED"
            amount = round(money(row.get("total_amount")), 2)
            receipt_count = int(row.get("receipt_count") or 0)
            days[key]["collection"]["amount"] = round(days[key]["collection"]["amount"] + amount, 2)
            days[key]["collection"]["transaction_count"] += receipt_count
            days[key]["collection"]["collectors"].append(
                {"collector": collector, "amount": amount, "transaction_count": receipt_count}
            )
        connection.close()
    except Exception as exc:
        warnings.append(f"Firebird collection summary unavailable: {exc}")


def load_rcd(days, args, date_from, date_to, warnings):
    if (os.environ.get("RCD_CALENDAR_SOURCE") or "").strip().lower() == "mysql":
        return

    db_path = Path(os.environ.get("RCD_ACCESS_DB") or DEFAULT_ACCESS_DB).resolve()
    if not db_path.exists():
        warnings.append(f"AccessDB file was not found: {db_path}. RCD calendar markers skipped.")
        return

    try:
        import pyodbc
    except ImportError as exc:
        warnings.append(f"pyodbc is not installed. RCD calendar markers skipped: {exc}")
        return

    try:
        conn = pyodbc.connect(f"DRIVER={{{ACCESS_DRIVER}}};DBQ={db_path};", readonly=True)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT b.id, b.report_no, b.report_date, b.collector, b.status, b.saved_total,
                   b.receipt_no_from, b.receipt_no_to, b.amount_remitted, b.amount_received,
                   b.remitted_to_aco_at, b.received_by_aco_at,
                   COUNT(l.id) AS line_count,
                   SUM(l.receipt_count) AS receipt_count
            FROM rcd_batches AS b
            LEFT JOIN rcd_collection_lines AS l ON l.batch_id = b.id
            WHERE b.report_date >= ?
              AND b.report_date <= ?
            GROUP BY b.id, b.report_no, b.report_date, b.collector, b.status, b.saved_total,
                     b.receipt_no_from, b.receipt_no_to, b.amount_remitted, b.amount_received,
                     b.remitted_to_aco_at, b.received_by_aco_at
            ORDER BY b.report_date
            """,
            date_from.isoformat(),
            date_to.isoformat(),
        )

        wanted_collectors = collector_values(args.collector)
        for raw in cursor.fetchall():
            row = row_dict(cursor, raw)
            collector = clean_text(row.get("collector"))
            if wanted_collectors and collector.lower() not in wanted_collectors:
                continue
            key = day_key(row.get("report_date"))
            if key not in days:
                continue
            status = clean_text(row.get("status")) or "-"
            days[key]["rcd"]["count"] += 1
            if status not in days[key]["rcd"]["statuses"]:
                days[key]["rcd"]["statuses"].append(status)
            days[key]["rcd"]["items"].append(
                {
                    "report_no": clean_text(row.get("report_no")) or "-",
                    "collector": collector or "-",
                    "status": status,
                    "total": round(money(row.get("saved_total")), 2),
                    "receipt_count": int(row.get("receipt_count") or 0),
                    "receipt_from": clean_text(row.get("receipt_no_from")),
                    "receipt_to": clean_text(row.get("receipt_no_to")),
                    "amount_remitted": round(money(row.get("amount_remitted")), 2),
                    "amount_received": round(money(row.get("amount_received")), 2),
                    "remitted_to_aco_at": clean_text(row.get("remitted_to_aco_at")),
                    "received_by_aco_at": clean_text(row.get("received_by_aco_at")),
                }
            )
        conn.close()
    except Exception as exc:
        warnings.append(f"RCD calendar markers unavailable: {exc}")


def exception_args(report, date_from, date_to, collector):
    return SimpleNamespace(
        report=report,
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        fund_type="",
        collector=collector or "",
        status="",
        transaction_type="",
        or_number="",
        taxpayer="",
        page=1,
        limit=500,
    )


def load_exceptions(days, args, date_from, date_to, warnings):
    if receipt_exceptions is None:
        warnings.append("Receipt exception logic could not be imported. Exception markers skipped.")
        return

    try:
        canceled_rows, canceled_warnings = receipt_exceptions.canceled_void_report(
            exception_args("canceled-void", date_from, date_to, args.collector)
        )
        warnings.extend(canceled_warnings)
        for row in canceled_rows:
            key = day_key(row.get("or_date"))
            if key in days:
                days[key]["exceptions"]["canceled_void_count"] += 1
    except Exception as exc:
        warnings.append(f"Canceled/Void exception markers unavailable: {exc}")

    try:
        not_remitted_rows, not_remitted_warnings = receipt_exceptions.not_remitted_report(
            exception_args("not-remitted", date_from, date_to, args.collector)
        )
        warnings.extend(not_remitted_warnings)
        for row in not_remitted_rows:
            key = day_key(row.get("or_date"))
            if key in days:
                days[key]["exceptions"]["not_remitted_count"] += 1
    except Exception as exc:
        warnings.append(f"Not-remitted exception markers unavailable: {exc}")


def summarize(days):
    today_key = date.today().isoformat()
    month_collection = round(sum(day["collection"]["amount"] for day in days.values()), 2)
    today_collection = round(days.get(today_key, {}).get("collection", {}).get("amount", 0), 2)
    pending_remittance_count = 0
    receipt_exceptions_count = 0

    for day in days.values():
        for status in day["rcd"]["statuses"]:
            if status.lower() in PENDING_RCD_STATUSES:
                pending_remittance_count += 1
        receipt_exceptions_count += day["exceptions"]["canceled_void_count"] + day["exceptions"]["not_remitted_count"]

    return {
        "today_collection": today_collection,
        "month_collection": month_collection,
        "pending_remittance_count": pending_remittance_count,
        "receipt_exceptions_count": receipt_exceptions_count,
    }


def main():
    parser = argparse.ArgumentParser(description="Read-only Treasury calendar monthly summary.")
    parser.add_argument("action", choices=["summary"])
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True)
    parser.add_argument("--role", default="")
    parser.add_argument("--collector", default="")
    parser.add_argument("--limited", action="store_true")
    args = parser.parse_args()

    if args.month < 1 or args.month > 12:
        emit({"ok": False, "error": "Month must be from 1 to 12."}, 1)

    date_from, date_to = month_bounds(args.year, args.month)
    days = build_days(args.year, args.month)
    warnings = []

    if args.limited:
        warnings.append("Collector mapping is not configured for this account.")
    else:
        load_collections(days, args, date_from, date_to, warnings)
        load_rcd(days, args, date_from, date_to, warnings)
        load_exceptions(days, args, date_from, date_to, warnings)

    payload = {
        "ok": True,
        "year": args.year,
        "month": args.month,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "role": args.role,
        "collector": args.collector,
        "summary": summarize(days),
        "days": list(days.values()),
        "warnings": warnings,
    }
    emit(payload)


if __name__ == "__main__":
    main()
