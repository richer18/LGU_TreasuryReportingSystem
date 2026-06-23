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

from report_preview_readonly import SUMMARY_COLUMNS, build_report, scalar

USER_PROFILE = os.environ.get("USERPROFILE") or r"C:\Users\LIFT-LAPTOP"
USER_SITE = Path(USER_PROFILE) / "AppData" / "Roaming" / "Python" / "Python314" / "site-packages"
if USER_SITE.exists() and str(USER_SITE) not in sys.path:
    sys.path.append(str(USER_SITE))

try:
    from openpyxl import load_workbook
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

PARENT_COLLECTION_RUNNER = Path(__file__).resolve().parents[2] / "run_collection_query.py"
PARENT_DELEGATED_REPORTS = {25, 26, 27, 28, 29, 30, 31, 32, 33}


def excel_value(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def safe_filename(value):
    clean = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())
    return clean.strip("._") or "report"


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


def delegated_parent_export(report_number, date_from, date_to, output_dir):
    if not PARENT_COLLECTION_RUNNER.exists():
        raise FileNotFoundError(f"Parent collection runner was not found: {PARENT_COLLECTION_RUNNER}")

    command = [
        sys.executable,
        str(PARENT_COLLECTION_RUNNER),
        str(report_number),
        date_from,
        date_to,
        "--user",
        os.environ.get("FIREBIRD_USER", "SYSDBA"),
        "--password",
        os.environ.get("FIREBIRD_PASSWORD", "masterkey"),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=180, check=False)
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
    args = parser.parse_args()

    try:
        if args.report_number in PARENT_DELEGATED_REPORTS:
            output_path, row_count = delegated_parent_export(
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
