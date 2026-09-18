import argparse
import json
from datetime import date, datetime
from decimal import Decimal

from firebird_probe import connect, resolve_db_path
from payment_deduplication import reportable_payment_filter


WATER_SOURCE_IDS = {"815", "817", "819", "821", "827"}
WATER_SOURCE_CODES = {"WTR", "IWO"}
CANCELLED_STATUS_CODES = {"CNL", "CAN", "CNC", "CANCEL", "CANCELLED", "VOID", "VOI"}

COLLECTOR_ALIASES = {
    "flora my ferrer": "flora",
    "flora my d ferrer": "flora",
    "flora my d. ferrer": "flora",
    "agnes ello": "agnes",
    "agnes b ello": "agnes",
    "agnes b. ello": "agnes",
    "ricardo enopia": "ricardo",
    "ricardo t enopia": "ricardo",
    "ricardo t. enopia": "ricardo",
    "emily credo": "emily",
    "emily e credo": "emily",
    "emily e. credo": "emily",
    "angelique iris rafales": "angelique",
    "angelique iris a rafales": "angelique",
    "angelique iris a. rafales": "angelique",
    "iris": "angelique",
    "gtz": "gtz",
}


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


def normalize_collector(value):
    collector = (value or "").strip()
    if not collector:
        return ""
    return COLLECTOR_ALIASES.get(collector.lower(), collector)


def paid_filter(alias="p"):
    return reportable_payment_filter(alias)


def water_filter():
    source_ids = ", ".join(f"'{source_id}'" for source_id in WATER_SOURCE_IDS)
    source_codes = ", ".join(f"'{code}'" for code in WATER_SOURCE_CODES)
    return (
        "AND ("
        f"TRIM(pd.ITAXTYPE_CT) IN ({source_codes}) "
        f"OR CAST(pd.SOURCEID AS VARCHAR(30)) IN ({source_ids})"
        ")"
    )


def base_sql(extra_where=""):
    return f"""
        SELECT
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS PAYMENT_DATE,
            TRIM(p.RECEIPTNO) AS RECEIPT_NO,
            COALESCE(NULLIF(TRIM(p.PAIDBY), ''), '-') AS TAXPAYER,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), '-') AS COLLECTOR,
            COALESCE(NULLIF(TRIM(p.USERID), ''), '-') AS USER_ID,
            COALESCE(NULLIF(TRIM(p.LOCAL_TIN), ''), '') AS LOCAL_TIN,
            pd.PAYMENTDETAIL_ID,
            TRIM(pd.ITAXTYPE_CT) AS SOURCE_CODE,
            pd.SOURCEID AS SOURCE_ID,
            TRIM(pd.SOURCE_CT) AS SOURCE_CT,
            COALESCE(NULLIF(TRIM(opr.DESCRIPTION), ''), NULLIF(TRIM(it.DESCRIPTION), ''), 'Water Payment') AS DESCRIPTION,
            pd.AMOUNTPAID AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTDETAIL pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN T_ITAXTYPE it ON it.CODE = pd.ITAXTYPE_CT
        LEFT JOIN T_OTHERPAYMENTRATE opr ON opr.OPRATE_ID = pd.SOURCEID
        LEFT JOIN T_STATUS st ON st.CODE = p.STATUS_CT
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {paid_filter("p")}
          {water_filter()}
          {extra_where}
    """


def date_params(args):
    return [args.date_from, args.date_to]


def fetch_lines(cursor, args):
    filters = []
    params = date_params(args)

    if args.payment_id:
        filters.append("AND p.PAYMENT_ID = ?")
        params.append(args.payment_id)
    if args.receipt_no:
        filters.append("AND TRIM(p.RECEIPTNO) = ?")
        params.append(args.receipt_no.strip())
    if args.collector:
        filters.append("AND UPPER(COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), '')) = ?")
        params.append(normalize_collector(args.collector).upper())
    if args.search:
        like = f"%{args.search.strip().upper()}%"
        filters.append(
            "AND (UPPER(TRIM(p.PAIDBY)) LIKE ? OR UPPER(TRIM(p.RECEIPTNO)) LIKE ? "
            "OR UPPER(TRIM(p.COLLECTOR)) LIKE ? OR UPPER(TRIM(p.USERID)) LIKE ? "
            "OR UPPER(TRIM(p.LOCAL_TIN)) LIKE ? OR UPPER(TRIM(opr.DESCRIPTION)) LIKE ? "
            "OR UPPER(TRIM(it.DESCRIPTION)) LIKE ?)"
        )
        params.extend([like] * 7)

    cursor.execute(
        base_sql("\n          ".join(filters))
        + "\nORDER BY CAST(p.PAYMENTDATE AS DATE) DESC, TRIM(p.RECEIPTNO) DESC, p.PAYMENT_ID DESC, pd.RECEIPTITEMORDER",
        params,
    )

    normalized = []
    for row in rows(cursor):
        row["collector"] = normalize_collector(row.get("collector")) or row.get("collector") or "-"
        normalized.append(row)
    return normalized


def group_receipts(lines):
    grouped = {}
    for line in lines:
        key = str(line.get("payment_id") or line.get("receipt_no") or "")
        if key not in grouped:
            grouped[key] = {
                "paymentId": line.get("payment_id"),
                "paymentDate": line.get("payment_date"),
                "receiptNo": line.get("receipt_no") or "-",
                "taxpayer": line.get("taxpayer") or "-",
                "collector": line.get("collector") or "-",
                "userId": line.get("user_id") or "-",
                "localTin": line.get("local_tin") or "",
                "amount": 0.0,
                "lineItemCount": 0,
            }
        grouped[key]["amount"] += float(line.get("amount") or 0)
        grouped[key]["lineItemCount"] += 1
    for item in grouped.values():
        item["amount"] = round(item["amount"], 2)
    return list(grouped.values())


def summary(receipts, lines):
    source_line_count = {}
    for line in lines:
        source_id = str(line.get("source_id") or "")
        source_line_count[source_id] = source_line_count.get(source_id, 0) + 1

    return {
        "totalCollections": round(sum(float(item.get("amount") or 0) for item in receipts), 2),
        "allPayments": len(lines),
        "receipts": len(receipts),
        "meterPayments": source_line_count.get("821", 0),
        "penaltyPayments": source_line_count.get("827", 0),
    }


def payments(cursor, args):
    lines = fetch_lines(cursor, args)
    receipts = group_receipts(lines)
    total = len(receipts)
    page = max(int(args.page or 1), 1)
    per_page = max(min(int(args.per_page or 10), 100), 5)
    offset = (page - 1) * per_page

    return {
        "data": receipts[offset : offset + per_page],
        "summary": summary(receipts, lines),
        "meta": {
            "current_page": page,
            "per_page": per_page,
            "total": total,
            "last_page": max((total + per_page - 1) // per_page, 1),
        },
    }


def receipts(cursor, args):
    return group_receipts(fetch_lines(cursor, args))[: max(min(args.limit, 5000), 1)]


def taxpayers(cursor, args):
    seen = {}
    for receipt in group_receipts(fetch_lines(cursor, args)):
        key = (receipt.get("localTin") or receipt.get("taxpayer") or "").strip().upper()
        if not key or key in seen:
            continue
        seen[key] = {
            "taxpayer": receipt.get("taxpayer") or "-",
            "localTin": receipt.get("localTin") or "",
            "latestPaymentDate": receipt.get("paymentDate"),
            "paymentId": receipt.get("paymentId"),
        }
    items = sorted(seen.values(), key=lambda item: ((item.get("taxpayer") or "").upper(), item.get("localTin") or ""))
    return items[: max(min(args.limit, 10000), 1)]


def taxpayer_payments(cursor, args):
    lines = fetch_lines(cursor, args)
    local_tin = (args.local_tin or "").strip().upper()
    taxpayer = (args.taxpayer or "").strip().upper()
    if local_tin:
        lines = [row for row in lines if (row.get("local_tin") or "").strip().upper() == local_tin]
    elif taxpayer:
        lines = [row for row in lines if (row.get("taxpayer") or "").strip().upper() == taxpayer]
    return [
        {
            "paymentId": row.get("payment_id"),
            "paymentDetailId": row.get("paymentdetail_id"),
            "paymentDate": row.get("payment_date"),
            "receiptNo": row.get("receipt_no"),
            "taxpayer": row.get("taxpayer"),
            "collector": row.get("collector"),
            "userId": row.get("user_id"),
            "localTin": row.get("local_tin"),
            "sourceCode": row.get("source_code"),
            "sourceId": row.get("source_id"),
            "sourceCt": row.get("source_ct"),
            "rateDescription": row.get("description"),
            "taxDescription": row.get("description"),
            "amount": round(float(row.get("amount") or 0), 2),
        }
        for row in lines[: max(min(args.limit, 500), 1)]
    ]


def payment_details(cursor, args):
    lines = fetch_lines(cursor, args)
    receipt_rows = group_receipts(lines)
    return receipt_rows[0] if receipt_rows else None


def daily(cursor, args):
    args.date_to = args.date_from
    receipt_rows = group_receipts(fetch_lines(cursor, args))
    collectors = {row.get("collector") for row in receipt_rows if row.get("collector")}
    return {
        "date": args.date_from,
        "rows": receipt_rows,
        "summary": {
            "receipts": len(receipt_rows),
            "collectors": len(collectors),
            "totalAmount": round(sum(float(row.get("amount") or 0) for row in receipt_rows), 2),
        },
    }


def billing(cursor, args):
    lines = fetch_lines(cursor, args)
    grouped = {}
    for line in lines:
        key = str(line.get("source_id") or line.get("source_code") or "water")
        item = grouped.setdefault(
            key,
            {
                "sourceId": line.get("source_id"),
                "description": line.get("description") or "Water Payment",
                "amount": 0.0,
                "paymentCount": 0,
                "receiptIds": set(),
            },
        )
        item["amount"] += float(line.get("amount") or 0)
        item["paymentCount"] += 1
        item["receiptIds"].add(line.get("payment_id"))
    out = []
    for item in grouped.values():
        item["receiptCount"] = len(item.pop("receiptIds"))
        item["amount"] = round(item["amount"], 2)
        out.append(item)
    out.sort(key=lambda item: item["amount"], reverse=True)
    return {
        "rows": out,
        "summary": {
            "categories": len(out),
            "paymentCount": sum(int(item["paymentCount"]) for item in out),
            "receiptCount": sum(int(item["receiptCount"]) for item in out),
            "totalAmount": round(sum(float(item["amount"]) for item in out), 2),
        },
    }


def run_report(report, cursor, args):
    if report == "payments":
        return payments(cursor, args)
    if report == "receipts":
        return receipts(cursor, args)
    if report == "taxpayers":
        return taxpayers(cursor, args)
    if report == "taxpayer-payments":
        return taxpayer_payments(cursor, args)
    if report == "payment-details":
        return payment_details(cursor, args)
    if report == "daily":
        return daily(cursor, args)
    if report == "billing":
        return billing(cursor, args)
    raise ValueError(f"Unsupported report: {report}")


def main():
    parser = argparse.ArgumentParser(description="Read-only Waterworks Firebird reports.")
    parser.add_argument("report", choices=["payments", "receipts", "taxpayers", "taxpayer-payments", "payment-details", "daily", "billing"])
    parser.add_argument("--date-from", required=True)
    parser.add_argument("--date-to", required=True)
    parser.add_argument("--collector")
    parser.add_argument("--search")
    parser.add_argument("--receipt-no")
    parser.add_argument("--payment-id")
    parser.add_argument("--taxpayer")
    parser.add_argument("--local-tin")
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--per-page", type=int, default=10)
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()

    payload = {
        "ok": False,
        "mode": "read_only_waterworks",
        "database": resolve_db_path(),
        "report": args.report,
    }

    try:
        connection = connect()
        cursor = connection.cursor()
        payload["data"] = run_report(args.report, cursor, args)
        payload["ok"] = True
        connection.close()
    except Exception as exc:
        payload.update({"ok": False, "error": str(exc), "error_type": exc.__class__.__name__})

    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

