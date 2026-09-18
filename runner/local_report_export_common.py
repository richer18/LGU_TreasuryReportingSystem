import argparse
import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = PROJECT_ROOT / "template"
BUSINESS_PERMIT_DIR = PROJECT_ROOT / "BUSINESS_PERMIT_REPORT"


def excel_value(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def json_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def period_label(date_from, date_to):
    start = datetime.strptime(date_from, "%Y-%m-%d")
    end = datetime.strptime(date_to, "%Y-%m-%d")
    start_label = f"{start.strftime('%B')} {start.day}, {start.year}"
    end_label = f"{end.strftime('%B')} {end.day}, {end.year}"
    return start_label if date_from == date_to else f"{start_label} to {end_label}"


def output_path(output_dir, report_number, date_from, date_to):
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"report_{report_number}_{date_from}_to_{date_to}.xlsx"


def save_workbook(workbook, path):
    try:
        workbook.save(path)
        return path
    except PermissionError:
        suffix = datetime.now().strftime("%Y%m%d_%H%M%S")
        fallback = path.with_name(f"{path.stem}_{suffix}{path.suffix}")
        workbook.save(fallback)
        return fallback


def run_cli(report_number, export_function):
    parser = argparse.ArgumentParser(description=f"Read-only local exporter for Report {report_number}.")
    parser.add_argument("--date-from", required=True)
    parser.add_argument("--date-to", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    try:
        path, row_count = export_function(args.date_from, args.date_to, args.output_dir)
        payload = {
            "ok": True,
            "mode": "read_only_excel_export",
            "report_number": report_number,
            "date_from": args.date_from,
            "date_to": args.date_to,
            "row_count": row_count,
            "path": str(path),
            "filename": path.name,
        }
        print(json.dumps(payload, default=json_value))
        return 0
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "mode": "read_only_excel_export",
            "report_number": report_number,
            "error": str(exc),
            "error_type": exc.__class__.__name__,
        }))
        return 1
