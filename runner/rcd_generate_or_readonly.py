import argparse
import json
import sys
from collections import Counter
from datetime import date, datetime
from decimal import Decimal

from firebird_probe import connect, connection_mode, resolve_db_path, resolve_odbc_dsn

COLLECTOR_ALIASES = {
    "iris": "angelique",
    "iris arbolado": "angelique",
    "angelique iris": "angelique",
    "flora my": "flora",
    "f lora my": "flora",
    "emily": "emily",
    "emily credo": "emily",
    "emily e credo": "emily",
    "emily e. credo": "emily",
}
CANCEL_STATUS_CODES = {"CNL", "CAN", "CNC", "CANCEL", "CANCELLED", "VOID", "VOI"}


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


def normalize_form(value):
    raw = (value or "").strip()
    compact = raw.upper().replace(" ", "")
    if compact == "AF51":
        return "AF 51"
    if compact == "AF56":
        return "AF 56"
    if compact in {"CTC", "COMMTAX", "COMMTAX.", "COMMUNITYTAXCERTIFICATE"}:
        return "Comm Tax."
    if compact in {"RPTSEF", "SEF"}:
        return "RPT SEF"
    if compact == "RPT":
        return "RPT"
    return raw or "UNSPECIFIED"


def is_cancelled(row):
    status_code = (row.get("status_ct") or "").strip().upper()
    status_description = (row.get("status_description") or "").strip().upper()
    void_bv = int(row.get("void_bv") or 0)
    return void_bv == 1 or status_code in CANCEL_STATUS_CODES or "VOID" in status_description or "CANCEL" in status_description


def collection_status(row):
    if is_cancelled(row):
        status_description = (row.get("status_description") or "").strip().upper()
        if "VOID" in status_description or (row.get("status_ct") or "").strip().upper() in {"VOID", "VOI"}:
            return "Void"
        return "Cancelled"
    return "Paid"


def as_receipt_number(value):
    text = str(value or "").strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    return int(digits) if digits else None


def expected_receipt_numbers(receipt_from, receipt_to):
    start = as_receipt_number(receipt_from)
    end = as_receipt_number(receipt_to or receipt_from)
    if start is None or end is None or end < start:
        return []
    width = max(len(str(receipt_from or "")), len(str(receipt_to or receipt_from or "")))
    return [str(number).zfill(width) for number in range(start, end + 1)]


def receipt_label(row):
    receipt = str(row.get("receipt_no") or "").strip()
    numeric = row.get("receipt_numeric")
    if numeric is None:
        return receipt
    width = len(receipt) if receipt else len(str(numeric))
    return str(numeric).zfill(width)


def compact_receipt_list(values, limit=8):
    cleaned = [str(value) for value in values if str(value or "").strip()]
    if not cleaned:
        return ""
    visible = cleaned[:limit]
    suffix = f" (+{len(cleaned) - limit} more)" if len(cleaned) > limit else ""
    return ", ".join(visible) + suffix


def validation_message(status, expected_count, fdb_count, collector_amount, fdb_amount, difference, receipt_from, receipt_to, matches, coverage_matches=None):
    details = []
    expected = expected_receipt_numbers(receipt_from, receipt_to)
    coverage_matches = coverage_matches if coverage_matches is not None else matches
    matched_labels = [receipt_label(row) for row in matches]
    covered_labels = [receipt_label(row) for row in coverage_matches]
    matched_numbers = [as_receipt_number(label) for label in matched_labels]
    covered_numbers = [as_receipt_number(label) for label in covered_labels]
    expected_numbers = [as_receipt_number(label) for label in expected]

    if status == "Not found":
        details.append(f"No .FDB receipt found for OR {receipt_from} to {receipt_to}.")
    elif expected_count and fdb_count != expected_count:
        covered_number_set = set(covered_numbers)
        missing = [label for label, number in zip(expected, expected_numbers) if number not in covered_number_set]
        duplicate_counts = Counter(number for number in matched_numbers if number is not None)
        duplicates = []
        for number, count in duplicate_counts.items():
            if count > 1:
                sample = next((label for label in matched_labels if as_receipt_number(label) == number), str(number))
                duplicates.append(f"{sample} x{count}")

        if missing:
            details.append(f"Missing in .FDB: {compact_receipt_list(missing)}")
        if duplicates:
            details.append(f"Duplicate/extra in .FDB: {compact_receipt_list(duplicates)}")
        if not missing and not duplicates:
            details.append(f"Receipts encoded {expected_count}, .FDB {fdb_count}.")

    if abs(difference) >= 0.01:
        direction = "over" if difference > 0 else "short"
        details.append(f"Amount {direction} by PHP {abs(difference):,.2f} (encoded PHP {collector_amount:,.2f}, .FDB PHP {fdb_amount:,.2f}).")

    if status == "Mixed":
        statuses = sorted(set(row.get("collection_status") or "Paid" for row in matches))
        details.append("Mixed receipt statuses: " + ", ".join(statuses))

    return " | ".join(details) if details else "Matched"


def form_type(row, fund):
    aftype = (row.get("receipt_type") or "").strip()
    paygroup = (row.get("paygroup") or "").strip()
    return normalize_form(aftype or paygroup)


def amount_for_row(row):
    if is_cancelled(row):
        return 0.0
    return float(row.get("fdb_amount") or row.get("header_amount") or 0)


def receipt_in_range(row, receipt_from, receipt_to):
    value = row.get("receipt_numeric")
    start = as_receipt_number(receipt_from)
    end = as_receipt_number(receipt_to)
    if value is None or start is None or end is None:
        return str(row.get("receipt_no") or "").strip() in {str(receipt_from or "").strip(), str(receipt_to or "").strip()}
    return start <= value <= end


def fetch_payments(cursor, fund, collection_date, collector):
    collector = normalize_collector(collector)
    if fund == "100_GF":
        fund_sql = ""
    elif fund == "200_SEF":
        fund_sql = """
          AND TRIM(p.PAYGROUP_CT) = 'RPT'
          AND EXISTS (
              SELECT 1
              FROM PAYMENTCLASSDETAIL pcd_sef
              WHERE pcd_sef.PAYMENT_ID = p.PAYMENT_ID
                AND TRIM(pcd_sef.ITAXTYPE_CT) = 'SEF'
                AND COALESCE(pcd_sef.CANCELLED_BV, 0) = 0
          )
        """
    else:
        raise ValueError("fund must be 100_GF or 200_SEF")

    sql = f"""
        SELECT
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS collection_date,
            TRIM(p.RECEIPTNO) AS receipt_no,
            TRIM(p.PAIDBY) AS taxpayer,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS collector,
            TRIM(p.USERID) AS user_id,
            TRIM(p.AFTYPE) AS receipt_type,
            TRIM(p.RCDNUMBER) AS rcd_number,
            TRIM(p.PAYGROUP_CT) AS paygroup,
            CASE
                WHEN TRIM(p.PAYGROUP_CT) = 'RPT' AND ? = '100_GF' THEN COALESCE(bsc_totals.bsc_total, 0)
                WHEN TRIM(p.PAYGROUP_CT) = 'RPT' AND ? = '200_SEF' THEN COALESCE(sef_totals.sef_total, 0)
                ELSE COALESCE(detail_totals.detail_total, p.AMOUNT, 0)
            END AS fdb_amount,
            p.AMOUNT AS header_amount,
            COALESCE(p.VOID_BV, 0) AS void_bv,
            TRIM(p.STATUS_CT) AS status_ct,
            COALESCE(TRIM(st.DESCRIPTION), TRIM(p.STATUS_CT), '') AS status_description
        FROM PAYMENT p
        LEFT JOIN (
            SELECT PAYMENT_ID, SUM(AMOUNTPAID) AS detail_total
            FROM PAYMENTDETAIL
            GROUP BY PAYMENT_ID
        ) detail_totals ON detail_totals.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN (
            SELECT PAYMENT_ID, SUM(AMOUNT) AS bsc_total
            FROM PAYMENTCLASSDETAIL
            WHERE TRIM(ITAXTYPE_CT) = 'BSC'
              AND COALESCE(CANCELLED_BV, 0) = 0
            GROUP BY PAYMENT_ID
        ) bsc_totals ON bsc_totals.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN (
            SELECT PAYMENT_ID, SUM(AMOUNT) AS sef_total
            FROM PAYMENTCLASSDETAIL
            WHERE TRIM(ITAXTYPE_CT) = 'SEF'
              AND COALESCE(CANCELLED_BV, 0) = 0
            GROUP BY PAYMENT_ID
        ) sef_totals ON sef_totals.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN T_STATUS st ON st.CODE = p.STATUS_CT
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          AND UPPER(COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED')) = UPPER(?)
          {fund_sql}
        ORDER BY TRIM(p.AFTYPE), TRIM(p.RECEIPTNO), p.PAYMENT_ID
    """
    cursor.execute(sql, [fund, fund, collection_date, collection_date, collector])
    result = rows(cursor)
    for row in result:
        row["form_type"] = form_type(row, fund)
        row["collection_status"] = collection_status(row)
        row["amount_for_rcd"] = amount_for_row(row)
        row["receipt_numeric"] = as_receipt_number(row.get("receipt_no"))
    return result


def group_or_lines(payments):
    sorted_rows = sorted(
        payments,
        key=lambda row: (
            row.get("form_type") or "",
            row.get("receipt_numeric") is None,
            row.get("receipt_numeric") or 0,
            str(row.get("receipt_no") or ""),
        ),
    )
    groups = []

    for row in sorted_rows:
        form = row.get("form_type") or "UNSPECIFIED"
        receipt = str(row.get("receipt_no") or "").strip()
        receipt_num = row.get("receipt_numeric")
        status = row.get("collection_status") or "Paid"
        amount = float(row.get("amount_for_rcd") or 0)

        should_start = True
        if groups:
            current = groups[-1]
            should_start = not (
                current["form_type"] == form
                and receipt_num is not None
                and current.get("last_numeric") is not None
                and receipt_num == current["last_numeric"] + 1
            )

        if should_start:
            groups.append({
                "form_type": form,
                "receipt_from": receipt,
                "receipt_to": receipt,
                "receipt_count": 1 if receipt else 0,
                "collector_amount": amount,
                "fdb_amount": amount,
                "payment_ids": [row.get("payment_id")],
                "statuses": [status],
                "last_numeric": receipt_num,
            })
            continue

        current = groups[-1]
        current["receipt_to"] = receipt
        current["receipt_count"] += 1
        current["collector_amount"] += amount
        current["fdb_amount"] += amount
        current["payment_ids"].append(row.get("payment_id"))
        current["statuses"].append(status)
        current["last_numeric"] = receipt_num

    return finalize_groups(groups)


def finalize_groups(groups):
    output = []
    for index, group in enumerate(groups, start=1):
        statuses = sorted(set(group.pop("statuses", [])))
        group.pop("last_numeric", None)
        group["id"] = group.get("id") or f"rcd-line-{index}"
        group["collector_amount"] = round(float(group["collector_amount"]), 2)
        group["fdb_amount"] = round(float(group["fdb_amount"]), 2)
        group["difference"] = round(float(group["collector_amount"]) - float(group["fdb_amount"]), 2)
        group["validation_status"] = statuses[0] if len(statuses) == 1 else "Mixed"
        output.append(group)
    return output


def validate_lines(input_lines, payments):
    output = []
    for index, line in enumerate(input_lines, start=1):
        receipt_from = str(line.get("receipt_from") or "").strip()
        receipt_to = str(line.get("receipt_to") or receipt_from).strip()
        form = normalize_form(line.get("form_type"))
        collector_amount = float(line.get("collector_amount") or 0)
        expected_count = max(as_receipt_number(receipt_to) - as_receipt_number(receipt_from) + 1, 0) if as_receipt_number(receipt_from) and as_receipt_number(receipt_to) else 0

        coverage_matches = [
            row for row in payments
            if normalize_form(row.get("form_type")) == form and receipt_in_range(row, receipt_from, receipt_to)
        ]
        matches = [row for row in coverage_matches if (row.get("collection_status") or "Paid") == "Paid"]
        fdb_amount = round(sum(float(row.get("amount_for_rcd") or 0) for row in matches), 2)

        covered_numbers = {as_receipt_number(receipt_label(row)) for row in coverage_matches}
        expected_numbers = [as_receipt_number(label) for label in expected_receipt_numbers(receipt_from, receipt_to)]
        covered_expected_count = sum(1 for number in expected_numbers if number in covered_numbers)
        fdb_count = covered_expected_count or len(matches)

        paid_numbers = [as_receipt_number(receipt_label(row)) for row in matches]
        duplicate_counts = Counter(number for number in paid_numbers if number is not None)
        has_paid_duplicates = any(count > 1 for count in duplicate_counts.values())
        has_uncovered_missing = bool(expected_count and covered_expected_count != expected_count)
        statuses = sorted(set(row.get("collection_status") or "Paid" for row in matches))
        difference = round(collector_amount - fdb_amount, 2)

        if not coverage_matches:
            status = "Not found"
        elif has_uncovered_missing or has_paid_duplicates:
            status = "Receipt mismatch"
        elif abs(difference) >= 0.01:
            status = "Amount mismatch"
        elif len(statuses) > 1:
            status = "Mixed"
        else:
            status = statuses[0] if statuses else "Paid"

        output.append({
            "id": line.get("id") or f"manual-line-{index}",
            "form_type": form,
            "receipt_from": receipt_from,
            "receipt_to": receipt_to,
            "receipt_count": expected_count or fdb_count,
            "fdb_receipt_count": fdb_count,
            "collector_amount": round(collector_amount, 2),
            "fdb_amount": fdb_amount,
            "difference": difference,
            "payment_ids": [row.get("payment_id") for row in matches],
            "receipt_numbers": [receipt_label(row) for row in matches],
            "validation_message": validation_message(status, expected_count, fdb_count, collector_amount, fdb_amount, difference, receipt_from, receipt_to, matches, coverage_matches),
            "validation_status": status,
        })
    return output


def main():
    parser = argparse.ArgumentParser(description="Generate or validate read-only RCD OR lines from Firebird .FDB.")
    parser.add_argument("--fund", required=True, choices=["100_GF", "200_SEF"])
    parser.add_argument("--collection-date", required=True)
    parser.add_argument("--collector", required=True)
    parser.add_argument("--lines", default="[]", help="JSON encoded collector-entered lines to validate.")
    args = parser.parse_args()

    payload = {
        "ok": False,
        "mode": "read_only_rcd_generate_or",
        "connection": connection_mode(),
        "database": resolve_odbc_dsn() if connection_mode() == "odbc" else resolve_db_path(),
        "fund": args.fund,
        "collection_date": args.collection_date,
        "collector": args.collector,
        "normalized_collector": normalize_collector(args.collector),
        "rows": [],
        "summary": {"receipt_count": 0, "total_amount": 0.0},
    }

    try:
        input_lines = json.loads(args.lines or "[]")
        connection = connect()
        cursor = connection.cursor()
        payments = fetch_payments(cursor, args.fund, args.collection_date, args.collector)
        paid_payments = [row for row in payments if (row.get('collection_status') or 'Paid') == 'Paid']
        lines = validate_lines(input_lines, payments) if input_lines else group_or_lines(paid_payments)
        payload.update({
            "ok": True,
            "payment_count": len(paid_payments),
            "all_payment_count": len(payments),
            "rows": lines,
            "summary": {
                "receipt_count": sum(int(line.get("receipt_count") or 0) for line in lines),
                "fdb_receipt_count": sum(int(line.get("fdb_receipt_count") or line.get("receipt_count") or 0) for line in lines),
                "total_amount": round(sum(float(line.get("fdb_amount") or 0) for line in lines), 2),
                "collector_amount": round(sum(float(line.get("collector_amount") or 0) for line in lines), 2),
            },
        })
        connection.rollback()
        connection.close()
    except Exception as exc:
        payload.update({"ok": False, "error": str(exc)})

    print(json.dumps(payload, default=str))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
