import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from firebird_probe import connect
from report_preview_readonly import PAID_PAYMENT_SQL, SUMMARY_COLUMNS, build_report, classify_summary_source, scalar

USER_PROFILE = os.environ.get("USERPROFILE") or r"C:\Users\LIFT-LAPTOP"
USER_SITE_CANDIDATES = [
    Path(USER_PROFILE) / "AppData" / "Roaming" / "Python" / f"Python{sys.version_info.major}{sys.version_info.minor}" / "site-packages",
    Path(USER_PROFILE) / "AppData" / "Roaming" / "Python" / "Python314" / "site-packages",
    Path(USER_PROFILE) / "AppData" / "Roaming" / "Python" / "Python313" / "site-packages",
    Path(USER_PROFILE) / "AppData" / "Roaming" / "Python" / "Python312" / "site-packages",
]
for USER_SITE in USER_SITE_CANDIDATES:
    if USER_SITE.exists() and str(USER_SITE) not in sys.path:
        sys.path.append(str(USER_SITE))

try:
    from openpyxl import Workbook, load_workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
except ModuleNotFoundError as exc:
    print(json.dumps({
        "ok": False,
        "mode": "read_only_excel_export",
        "error": str(exc),
        "error_type": exc.__class__.__name__,
        "python_executable": sys.executable,
        "python_path": sys.path,
        "pythonhome": os.environ.get("PYTHONHOME"),
        "pythonpath": os.environ.get("PYTHONPATH"),
    }))
    raise SystemExit(1)


TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "template"
TEMPLATE_MAP = {
    21: "summary_of_collection_template.xlsx",
    22: "summary_of_collection_template_no_rpt.xlsx",
    23: "summary_of_collection_template_rpt.xlsx",
}

RECEIPT_EXCEPTION_REPORTS = {35: "canceled-void", 36: "not-remitted"}
OFFICIAL_BREAKDOWN_REPORT = 37
OFFICIAL_CATEGORY_ORDER = [
    "Tax on Business",
    "Receipts from Economic Enterprises",
    "Regulatory Fees",
    "Service/User Charges",
]
OFFICIAL_CATEGORY_SOURCES = {
    "Tax on Business": {
        "Manufacturing",
        "Distributor",
        "Retailing",
        "Banks & Other Financial Int.",
        "Other Business Tax",
    },
    "Regulatory Fees": {
        "Mayor's Permit",
        "Weights & Measures",
        "Tricycle Permit Fee",
        "Occupation Tax",
        "Cert. of Ownership",
        "Cert. of Transfer",
        "Sand & Gravel",
        "Fines & Penalties",
        "Docking and Mooring Fee",
        "Fishing Permit Fee",
        "Miscellaneous",
    },
    "Receipts from Economic Enterprises": {
        "Water Fee",
        "Water Fees",
        "Market Stall Fee",
        "Cash Tickets",
        "SlaughterHouse Fee",
        "Slaughterhouse Fee",
        "Rental of Equipment",
        "Rent of Equipment",
        "Cockpit Share",
        "Sultadas",
        "Diving Fee",
    },
    "Service/User Charges": {
        "Registration of Birth",
        "Marriage Fee",
        "Marriage Fees",
        "Burial Fee",
        "Burial Fees",
        "Correction of Entry",
        "Sale of Agri. Prod.",
        "Sale of Acct. Forms",
        "Sale of Acc. Forms",
        "Doc Stamp Tax",
        "Secretaries Fees",
        "Secretary Fees",
        "Med./Lab. Fees",
        "Garbage Fees",
    },
}
RECEIPT_EXCEPTION_DEFINITIONS = {
    35: {
        "title": "Canceled / Void Receipts Report",
        "headers": [
            "OR Date",
            "OR Number",
            "Taxpayer Name",
            "Amount",
            "Fund Type",
            "Transaction Type",
            "Collector / Cashier",
            "Status",
            "Status Code",
            "Void Flag",
            "Remarks",
            "Transaction Date",
            "User ID",
        ],
        "fields": [
            "or_date",
            "or_number",
            "taxpayer_name",
            "amount",
            "fund_type",
            "transaction_type",
            "collector_cashier",
            "status",
            "status_code",
            "void_flag",
            "remarks",
            "transaction_date",
            "user_id",
        ],
    },
    36: {
        "title": "Receipts Not Remitted Report",
        "headers": [
            "OR Date",
            "OR Number",
            "Taxpayer Name",
            "Amount",
            "Fund Type",
            "Transaction Type",
            "Collector / Cashier",
            "Transaction Date",
            "RCD Number",
            "RCD Date",
            "RCD Status",
            "Days Unremitted",
            "Remarks",
        ],
        "fields": [
            "or_date",
            "or_number",
            "taxpayer_name",
            "amount",
            "fund_type",
            "transaction_type",
            "collector_cashier",
            "transaction_date",
            "rcd_number",
            "rcd_date",
            "rcd_status",
            "days_unremitted",
            "remarks",
        ],
    },
}

PARENT_DELEGATED_REPORTS = set(range(1, 21)) | {25, 26, 27, 28, 29, 30, 31, 32, 33, 34}


def parent_runner_candidates():
    this_file = Path(__file__).resolve()
    lgu_root = this_file.parents[1]
    desktop_root = this_file.parents[2]
    user_home = Path(USER_PROFILE)
    configured = os.environ.get("ESRE_PARENT_RUNNER")

    candidates = []
    if configured:
        candidates.append(Path(configured))

    candidates.extend([
        desktop_root / "ESRE_REPORT" / "run_collection_query.py",
        lgu_root.parent / "ESRE_REPORT" / "run_collection_query.py",
        user_home / "OneDrive" / "Desktop" / "ESRE_REPORT" / "run_collection_query.py",
        user_home / "Desktop" / "ESRE_REPORT" / "run_collection_query.py",
        desktop_root / "run_collection_query.py",
    ])

    unique = []
    seen = set()
    for candidate in candidates:
        resolved = str(candidate)
        if resolved not in seen:
            unique.append(candidate)
            seen.add(resolved)
    return unique


def resolve_parent_collection_runner():
    candidates = parent_runner_candidates()
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


PARENT_COLLECTION_RUNNER = resolve_parent_collection_runner()


def excel_value(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def safe_filename(value):
    clean = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())
    return clean.strip("._") or "report"


def official_category_for_source(source_name):
    for category, sources in OFFICIAL_CATEGORY_SOURCES.items():
        if source_name in sources:
            return category
    return None


def period_label(date_from, date_to):
    try:
        start_date = datetime.strptime(date_from, "%Y-%m-%d")
        end_date = datetime.strptime(date_to, "%Y-%m-%d")
        start_label = f"{start_date.strftime('%B')} {start_date.day}, {start_date.year}"
        end_label = f"{end_date.strftime('%B')} {end_date.day}, {end_date.year}"
        return start_label if date_from == date_to else f"{start_label} to {end_label}"
    except ValueError:
        return f"{date_from} to {date_to}"


def adjusted_rpt_amount(case_type, amount):
    amount = amount or Decimal("0")
    if (case_type or "").strip() == "DED":
        return -abs(amount)
    return amount


def official_breakdown_data(date_from, date_to):
    category_totals = {category: Decimal("0") for category in OFFICIAL_CATEGORY_ORDER}
    detail_rows = []

    non_rpt_sql = f"""
        SELECT
            CAST(p.PAYMENTDATE AS DATE) AS OR_DATE,
            TRIM(p.RECEIPTNO) AS OR_NUMBER,
            TRIM(p.PAIDBY) AS TAXPAYER_NAME,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS COLLECTOR_CASHIER,
            p.PAYMENTDATE AS TRANSACTION_DATE,
            TRIM(p.PAYGROUP_CT) AS FUND_TYPE,
            TRIM(pd.ITAXTYPE_CT) AS SOURCE_CODE,
            pd.SOURCEID AS SOURCE_ID,
            TRIM(pd.SOURCE_CT) AS SOURCE_CT,
            COALESCE(TRIM(it.DESCRIPTION), TRIM(pd.ITAXTYPE_CT), '') AS SOURCE_DESCRIPTION,
            TRIM(opr.DESCRIPTION) AS CHILD_DESCRIPTION,
            pd.AMOUNTPAID AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTDETAIL pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN T_ITAXTYPE it ON it.CODE = pd.ITAXTYPE_CT
        LEFT JOIN T_OTHERPAYMENTRATE opr ON opr.OPRATE_ID = pd.SOURCEID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {PAID_PAYMENT_SQL}
          AND COALESCE(TRIM(p.PAYGROUP_CT), '') <> 'RPT'
        ORDER BY CAST(p.PAYMENTDATE AS DATE), TRIM(p.RECEIPTNO), p.PAYMENT_ID, pd.RECEIPTITEMORDER
    """
    rpt_sql = f"""
        SELECT
            CAST(p.PAYMENTDATE AS DATE) AS OR_DATE,
            TRIM(p.RECEIPTNO) AS OR_NUMBER,
            TRIM(p.PAIDBY) AS TAXPAYER_NAME,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS COLLECTOR_CASHIER,
            p.PAYMENTDATE AS TRANSACTION_DATE,
            COALESCE(NULLIF(TRIM(p.PAYGROUP_CT), ''), 'RPT') AS FUND_TYPE,
            TRIM(pcd.ITAXTYPE_CT) AS TAX_TYPE,
            TRIM(pcd.CASETYPE_CT) AS CASE_TYPE,
            SUM(pcd.AMOUNT) AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTCLASSDETAIL pcd ON pcd.PAYMENT_ID = p.PAYMENT_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          AND COALESCE(TRIM(p.PAYGROUP_CT), '') = 'RPT'
          {PAID_PAYMENT_SQL}
          AND COALESCE(pcd.CANCELLED_BV, 0) = 0
          AND TRIM(pcd.ITAXTYPE_CT) IN ('BSC', 'SEF')
        GROUP BY CAST(p.PAYMENTDATE AS DATE), TRIM(p.RECEIPTNO), TRIM(p.PAIDBY),
                 COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED'),
                 p.PAYMENTDATE, COALESCE(NULLIF(TRIM(p.PAYGROUP_CT), ''), 'RPT'),
                 TRIM(pcd.ITAXTYPE_CT), TRIM(pcd.CASETYPE_CT)
        ORDER BY CAST(p.PAYMENTDATE AS DATE), TRIM(p.RECEIPTNO)
    """

    rpt_gf = Decimal("0")
    rpt_sf = Decimal("0")
    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(non_rpt_sql, (date_from, date_to))
        for row in cursor.fetchall():
            (
                or_date,
                or_number,
                taxpayer_name,
                collector_cashier,
                transaction_date,
                fund_type,
                source_code,
                source_id,
                source_ct,
                source_description,
                child_description,
                amount,
            ) = row
            source_name = classify_summary_source(source_code, source_id, source_ct)
            category = official_category_for_source(source_name)
            if not category:
                continue

            amount = amount or Decimal("0")
            category_totals[category] += amount
            detail_rows.append({
                "or_date": or_date,
                "or_number": or_number,
                "taxpayer_name": taxpayer_name,
                "category": category,
                "source": source_name,
                "amount": amount,
                "fund_type": fund_type or "General Fund",
                "collector_cashier": collector_cashier,
                "transaction_date": transaction_date,
                "remarks": child_description or source_description or source_name,
            })

        cursor.execute(rpt_sql, (date_from, date_to))
        for row in cursor.fetchall():
            (
                or_date,
                or_number,
                taxpayer_name,
                collector_cashier,
                transaction_date,
                fund_type,
                tax_type,
                case_type,
                amount,
            ) = row
            net_amount = adjusted_rpt_amount(case_type, amount)
            if tax_type == "BSC":
                share = net_amount * Decimal("0.40")
                rpt_gf += share
                category = "RPT GF - Municipal Basic Share 40%"
            elif tax_type == "SEF":
                share = net_amount * Decimal("0.50")
                rpt_sf += share
                category = "RPT SF - Municipal SEF Share 50%"
            else:
                continue

            detail_rows.append({
                "or_date": or_date,
                "or_number": or_number,
                "taxpayer_name": taxpayer_name,
                "category": category,
                "source": tax_type,
                "amount": share,
                "fund_type": fund_type or "RPT",
                "collector_cashier": collector_cashier,
                "transaction_date": transaction_date,
                "remarks": f"Municipal share from {tax_type}; DED lines subtracted before share",
            })
        connection.rollback()
    finally:
        connection.close()

    rpt_municipal = rpt_gf + rpt_sf
    grand_total = sum(category_totals.values(), Decimal("0")) + rpt_municipal

    summary_rows = [
        {
            "category": category,
            "amount": category_totals[category],
            "remarks": "Paid non-RPT PAYMENTDETAIL lines grouped by existing source category mapping",
            "is_breakdown": False,
        }
        for category in OFFICIAL_CATEGORY_ORDER
    ]
    summary_rows.extend([
        {
            "category": "Real Property Tax only Municipal Sharing",
            "amount": rpt_municipal,
            "remarks": "Subtotal only: RPT GF municipal share + RPT SF municipal share",
            "is_breakdown": False,
        },
        {
            "category": "RPT GF - Municipal Basic Share 40%",
            "amount": rpt_gf,
            "remarks": "Breakdown only; not added separately to Grand Total",
            "is_breakdown": True,
        },
        {
            "category": "RPT SF - Municipal SEF Share 50%",
            "amount": rpt_sf,
            "remarks": "Breakdown only; not added separately to Grand Total",
            "is_breakdown": True,
        },
        {
            "category": "Grand Total",
            "amount": grand_total,
            "remarks": "Main categories 1-4 + Real Property Tax only Municipal Sharing",
            "is_total": True,
        },
    ])

    return summary_rows, detail_rows, {
        "rpt_gf": rpt_gf,
        "rpt_sf": rpt_sf,
        "rpt_municipal": rpt_municipal,
        "grand_total": grand_total,
    }


def write_official_breakdown_workbook(date_from, date_to, output_dir):
    summary_rows, detail_rows, totals = official_breakdown_data(date_from, date_to)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Summary"

    title_fill = PatternFill("solid", fgColor="0554F2")
    header_fill = PatternFill("solid", fgColor="EAF2FF")
    total_fill = PatternFill("solid", fgColor="EAF7EA")
    breakdown_fill = PatternFill("solid", fgColor="F8FAFC")

    sheet.merge_cells("A1:D1")
    sheet["A1"] = "OFFICIAL REPORT BREAKDOWN"
    sheet["A1"].font = Font(bold=True, color="FFFFFF", size=14)
    sheet["A1"].fill = title_fill
    sheet["A1"].alignment = Alignment(horizontal="center")
    sheet.merge_cells("A2:D2")
    sheet["A2"] = "CATEGORY BREAKDOWN"
    sheet["A2"].font = Font(bold=True, size=12)
    sheet["A2"].alignment = Alignment(horizontal="center")
    sheet.merge_cells("A3:D3")
    sheet["A3"] = f"Period: {period_label(date_from, date_to)}"
    sheet["A3"].alignment = Alignment(horizontal="center")

    headers = ["Category", "Amount", "Percentage of Total", "Remarks / Basis"]
    header_row = 5
    for column_index, header in enumerate(headers, start=1):
        cell = sheet.cell(header_row, column_index)
        cell.value = header
        cell.font = Font(bold=True)
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    grand_total = totals["grand_total"]
    for row_index, row in enumerate(summary_rows, start=header_row + 1):
        sheet.cell(row_index, 1).value = row["category"]
        sheet.cell(row_index, 2).value = excel_value(row["amount"])
        sheet.cell(row_index, 3).value = float((row["amount"] / grand_total) if grand_total else 0)
        sheet.cell(row_index, 4).value = row["remarks"]
        sheet.cell(row_index, 2).number_format = "#,##0.00"
        sheet.cell(row_index, 3).number_format = "0.00%"

        if row.get("is_breakdown"):
            sheet.cell(row_index, 1).value = "  " + row["category"]
            for column_index in range(1, 5):
                sheet.cell(row_index, column_index).fill = breakdown_fill
                sheet.cell(row_index, column_index).font = Font(italic=True)
        if row.get("is_total"):
            for column_index in range(1, 5):
                sheet.cell(row_index, column_index).fill = total_fill
                sheet.cell(row_index, column_index).font = Font(bold=True)

    detail_sheet = workbook.create_sheet("Details")
    detail_headers = [
        "OR Date",
        "OR Number",
        "Taxpayer Name",
        "Category",
        "Source / Revenue Code",
        "Amount",
        "Fund Type",
        "Collector / Cashier",
        "Transaction Date",
        "Remarks",
    ]
    for column_index, header in enumerate(detail_headers, start=1):
        cell = detail_sheet.cell(1, column_index)
        cell.value = header
        cell.font = Font(bold=True)
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for row_index, row in enumerate(detail_rows, start=2):
        detail_sheet.cell(row_index, 1).value = excel_value(row["or_date"])
        detail_sheet.cell(row_index, 2).value = row["or_number"]
        detail_sheet.cell(row_index, 3).value = row["taxpayer_name"]
        detail_sheet.cell(row_index, 4).value = row["category"]
        detail_sheet.cell(row_index, 5).value = row["source"]
        detail_sheet.cell(row_index, 6).value = excel_value(row["amount"])
        detail_sheet.cell(row_index, 7).value = row["fund_type"]
        detail_sheet.cell(row_index, 8).value = row["collector_cashier"]
        detail_sheet.cell(row_index, 9).value = excel_value(row["transaction_date"])
        detail_sheet.cell(row_index, 10).value = row["remarks"]
        detail_sheet.cell(row_index, 6).number_format = "#,##0.00"

    for target_sheet in (sheet, detail_sheet):
        for column_index, column in enumerate(target_sheet.columns, start=1):
            max_length = max(len(str(cell.value or "")) for cell in column)
            target_sheet.column_dimensions[get_column_letter(column_index)].width = min(max(max_length + 2, 12), 52)

    sheet.freeze_panes = "A6"
    detail_sheet.freeze_panes = "A2"

    output_dir.mkdir(parents=True, exist_ok=True)
    output_name = safe_filename(f"report_37_official_report_breakdown_{date_from}_to_{date_to}.xlsx")
    output_path = output_dir / output_name
    workbook.save(output_path)

    return output_path, len(detail_rows), totals


def summary_excel_row(row):
    if row.get("section"):
        return [row.get("source", "")] + [""] * (len(SUMMARY_COLUMNS) - 1)

    return [row.get(column, "") for column in SUMMARY_COLUMNS]


def write_summary_workbook(report_number, payload, date_from, date_to, output_dir):
    template_name = TEMPLATE_MAP[report_number]
    template_path = TEMPLATE_DIR / template_name

    if not template_path.exists():
        raise FileNotFoundError(f"Template file was not found: {template_path}")

    workbook = load_workbook(template_path)
    sheet = workbook.active

    try:
        start_date = datetime.strptime(date_from, "%Y-%m-%d")
        end_date = datetime.strptime(date_to, "%Y-%m-%d")
        month_label = f"Month of {start_date.strftime('%B %Y')}"
        if start_date.month != end_date.month or start_date.year != end_date.year:
            month_label = f"{start_date.strftime('%B %d, %Y')} to {end_date.strftime('%B %d, %Y')}"
        sheet["A4"] = month_label
    except ValueError:
        sheet["A4"] = f"{date_from} to {date_to}"

    start_row = 8
    body_rows = [summary_excel_row(row) for row in payload["rows"]]

    for index, row_values in enumerate(body_rows):
        excel_row = start_row + index
        for col_index, value in enumerate(row_values[:12], start=1):
            sheet.cell(excel_row, col_index).value = excel_value(value)

    workbook.calculation.fullCalcOnLoad = True
    workbook.calculation.forceFullCalc = True

    output_dir.mkdir(parents=True, exist_ok=True)
    output_name = safe_filename(f"report_{report_number}_{date_from}_to_{date_to}.xlsx")
    output_path = output_dir / output_name
    workbook.save(output_path)

    return output_path, len(body_rows)


def receipt_exception_args(report_number, date_from, date_to):
    class Args:
        pass

    args = Args()
    args.report = RECEIPT_EXCEPTION_REPORTS[report_number]
    args.date_from = date_from
    args.date_to = date_to
    args.fund_type = ""
    args.collector = ""
    args.status = ""
    args.transaction_type = ""
    args.or_number = ""
    args.taxpayer = ""
    args.page = 1
    args.limit = 500
    return args


def receipt_exception_rows(report_number, date_from, date_to):
    from receipt_exceptions_readonly import canceled_void_report, not_remitted_report

    args = receipt_exception_args(report_number, date_from, date_to)
    if report_number == 35:
        rows, warnings = canceled_void_report(args)
    else:
        rows, warnings = not_remitted_report(args)
    return rows, warnings


def write_receipt_exception_workbook(report_number, date_from, date_to, output_dir):
    definition = RECEIPT_EXCEPTION_DEFINITIONS[report_number]
    rows, warnings = receipt_exception_rows(report_number, date_from, date_to)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = safe_filename(definition["title"])[:31]

    sheet["A1"] = definition["title"]
    sheet["A2"] = "Municipality of Zamboanguita"
    sheet["A3"] = f"Period: {date_from} to {date_to}"
    if warnings:
        sheet["A4"] = "Warnings: " + " | ".join(warnings)

    header_row = 6
    for column_index, header in enumerate(definition["headers"], start=1):
        cell = sheet.cell(header_row, column_index)
        cell.value = header
        cell.font = cell.font.copy(bold=True)

    for row_index, row in enumerate(rows, start=header_row + 1):
        for column_index, field in enumerate(definition["fields"], start=1):
            sheet.cell(row_index, column_index).value = excel_value(row.get(field, ""))

    amount_column = definition["fields"].index("amount") + 1
    for row_index in range(header_row + 1, header_row + len(rows) + 1):
        sheet.cell(row_index, amount_column).number_format = '#,##0.00'

    for column in sheet.columns:
        max_length = max(len(str(cell.value or "")) for cell in column)
        sheet.column_dimensions[column[0].column_letter].width = min(max(max_length + 2, 12), 45)

    output_dir.mkdir(parents=True, exist_ok=True)
    output_name = safe_filename(f"report_{report_number}_{date_from}_to_{date_to}_{definition['title']}.xlsx")
    output_path = output_dir / output_name
    workbook.save(output_path)

    return output_path, len(rows)


def delegated_parent_export(report_number, date_from, date_to, output_dir, collector=None):
    if not PARENT_COLLECTION_RUNNER.exists():
        searched = "; ".join(str(path) for path in parent_runner_candidates())
        raise FileNotFoundError(
            f"Parent collection runner was not found: {PARENT_COLLECTION_RUNNER}. Searched: {searched}"
        )

    command = [
        sys.executable,
        str(PARENT_COLLECTION_RUNNER),
        str(report_number),
        date_from,
        date_to,
        "--user",
        os.environ.get("FIREBIRD_USER", ""),
        "--password",
        os.environ.get("FIREBIRD_PASSWORD", ""),
    ]
    if collector:
        command.extend(["--collector", collector])
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
        cwd=str(PARENT_COLLECTION_RUNNER.parent),
    )
    output = "\n".join(part for part in (result.stdout, result.stderr) if part).strip()

    if result.returncode != 0:
        raise RuntimeError(output or f"Parent collection runner failed with exit code {result.returncode}.")

    match = re.search(r"Output file:\s*(.+)", output)
    if not match:
        raise RuntimeError(f"Parent collection runner did not return an output path. Output: {output}")

    source_path = Path(match.group(1).strip())
    if not source_path.exists():
        raise FileNotFoundError(f"Parent collection runner output was not found: {source_path}")

    rows_match = re.search(r"Rows exported:\s*(\d+)", output)
    row_count = int(rows_match.group(1)) if rows_match else 0

    output_dir.mkdir(parents=True, exist_ok=True)
    destination = output_dir / source_path.name
    if destination.exists():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        destination = destination.with_name(f"{destination.stem}_{timestamp}{destination.suffix}")

    shutil.copy2(source_path, destination)
    return destination, row_count


def main():
    parser = argparse.ArgumentParser(description="Read-only Firebird Excel report exporter.")
    parser.add_argument("report_number", type=int)
    parser.add_argument("--date-from", required=True)
    parser.add_argument("--date-to", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--collector", help="Optional collector filter for collector reports.")
    args = parser.parse_args()

    try:
        if args.report_number == OFFICIAL_BREAKDOWN_REPORT:
            output_path, row_count, totals = write_official_breakdown_workbook(
                args.date_from,
                args.date_to,
                Path(args.output_dir),
            )
            print(json.dumps({
                "ok": True,
                "mode": "read_only_excel_export",
                "report_number": args.report_number,
                "date_from": args.date_from,
                "date_to": args.date_to,
                "row_count": row_count,
                "rpt_gf": totals["rpt_gf"],
                "rpt_sf": totals["rpt_sf"],
                "rpt_municipal": totals["rpt_municipal"],
                "grand_total": totals["grand_total"],
                "path": str(output_path),
                "filename": output_path.name,
            }, default=scalar))
            return 0

        if args.report_number in RECEIPT_EXCEPTION_REPORTS:
            output_path, row_count = write_receipt_exception_workbook(
                args.report_number,
                args.date_from,
                args.date_to,
                Path(args.output_dir),
            )
            print(json.dumps({
                "ok": True,
                "mode": "read_only_excel_export",
                "report_number": args.report_number,
                "date_from": args.date_from,
                "date_to": args.date_to,
                "row_count": row_count,
                "path": str(output_path),
                "filename": output_path.name,
            }, default=scalar))
            return 0

        if args.report_number in PARENT_DELEGATED_REPORTS:
            output_path, row_count = delegated_parent_export(
                args.report_number,
                args.date_from,
                args.date_to,
                Path(args.output_dir),
                args.collector,
            )
            print(json.dumps({
                "ok": True,
                "mode": "read_only_excel_export",
                "report_number": args.report_number,
                "date_from": args.date_from,
                "date_to": args.date_to,
                "row_count": row_count,
                "path": str(output_path),
                "filename": output_path.name,
            }, default=scalar))
            return 0

        if args.report_number not in TEMPLATE_MAP:
            raise ValueError(f"Excel download for report {args.report_number} is not implemented yet.")

        payload = build_report(args.report_number, args.date_from, args.date_to)
        output_path, row_count = write_summary_workbook(
            args.report_number,
            payload,
            args.date_from,
            args.date_to,
            Path(args.output_dir),
        )

        print(json.dumps({
            "ok": True,
            "mode": "read_only_excel_export",
            "report_number": args.report_number,
            "date_from": args.date_from,
            "date_to": args.date_to,
            "row_count": row_count,
            "path": str(output_path),
            "filename": output_path.name,
        }, default=scalar))
        return 0
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "mode": "read_only_excel_export",
            "error": str(exc),
            "error_type": exc.__class__.__name__,
        }))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
