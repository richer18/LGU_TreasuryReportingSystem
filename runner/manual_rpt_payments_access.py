#!/usr/bin/env python3
"""Access-backed manual RPT payment store.

This keeps manual duplicate/accepted RPT payments outside the read-only iTax Firebird DB.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pyodbc

DRIVER = "Microsoft Access Driver (*.mdb, *.accdb)"
TABLE = "manual_rpt_payments"

TEXT_FIELDS = {
    "td_no": 80,
    "paid_by": 180,
    "taxpayer_name": 180,
    "period_covered": 80,
    "pin": 80,
    "receipt_no": 80,
    "td_arp_no": 80,
    "barangay_name": 120,
    "property_classification": 120,
    "property_kind": 120,
    "collector": 120,
    "payment_status_ct": 40,
    "booking_reference": 120,
    "status": 40,
}

MONEY_FIELDS = [
    "basic_current_gross",
    "basic_discount",
    "basic_prior_years",
    "basic_penalty_current_year",
    "basic_penalty_previous_years",
    "basic_penalty_prior_years",
    "basic_gross_total",
    "basic_net_total",
    "sef_current_gross",
    "sef_discount",
    "sef_prior_years",
    "sef_penalty_current_year",
    "sef_penalty_previous_years",
    "sef_penalty_prior_years",
    "sef_gross_total",
    "sef_net_total",
    "grand_gross_total",
    "grand_net_total",
    "share_25_percent",
    "payment_total_amount",
]

BOOL_FIELDS = ["is_cancelled", "is_void", "include_in_report"]

FIELDS = [
    "td_no",
    "payment_date",
    "paid_by",
    "taxpayer_name",
    "period_covered",
    "pin",
    "receipt_no",
    "td_arp_no",
    "barangay_name",
    *MONEY_FIELDS,
    "property_classification",
    "property_kind",
    "collector",
    "payment_status_ct",
    "is_cancelled",
    "payment_total_amount",
    "booking_reference",
    "is_void",
    "include_in_report",
    "status",
    "remarks",
    "created_by",
]


def default_db_path() -> Path:
    env_path = os.environ.get("MANUAL_RPT_ACCESS_DB")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parents[1] / "RPT_MANUAL_PAYMENTS" / "manual_rpt_payments.accdb"


def emit(payload: dict, code: int = 0) -> None:
    print(json.dumps(payload, ensure_ascii=False, default=str))
    raise SystemExit(code)


def create_access_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return

    ps = f"""
$ErrorActionPreference = 'Stop'
$path = '{str(path).replace(chr(39), chr(39) + chr(39))}'
$folder = Split-Path -Parent $path
if (-not (Test-Path -LiteralPath $folder)) {{ New-Item -ItemType Directory -Path $folder | Out-Null }}
$cat = New-Object -ComObject ADOX.Catalog
$cat.Create("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$path;") | Out-Null
"""
    completed = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if completed.returncode != 0 or not path.exists():
        raise RuntimeError((completed.stderr or completed.stdout or "Unable to create Access database file.").strip())


def connect(path: Path):
    create_access_file(path)
    return pyodbc.connect(f"DRIVER={{{DRIVER}}};DBQ={path};", autocommit=True)


def table_exists(cur) -> bool:
    return any(str(row.table_name).lower() == TABLE.lower() for row in cur.tables(table=TABLE, tableType="TABLE"))


def existing_columns(cur) -> set[str]:
    return {str(row.column_name).lower() for row in cur.columns(table=TABLE)}


def safe_execute(cur, sql: str) -> None:
    try:
        cur.execute(sql)
    except pyodbc.Error as exc:
        text = str(exc).lower()
        if "already exists" not in text and "already has an index" not in text and "duplicate" not in text:
            raise


def column_sql(name: str) -> str:
    if name == "payment_date" or name in {"created_at", "updated_at"}:
        return f"[{name}] DATETIME"
    if name in MONEY_FIELDS:
        return f"[{name}] DOUBLE"
    if name in BOOL_FIELDS:
        return f"[{name}] YESNO"
    if name == "remarks":
        return "[remarks] MEMO"
    if name == "created_by":
        return "[created_by] INTEGER"
    return f"[{name}] TEXT({TEXT_FIELDS.get(name, 120)})"


def ensure_schema(path: Path) -> None:
    with connect(path) as conn:
        cur = conn.cursor()
        if not table_exists(cur):
            columns = ["[id] COUNTER PRIMARY KEY"] + [column_sql(field) for field in FIELDS] + [column_sql("created_at"), column_sql("updated_at")]
            cur.execute(f"CREATE TABLE {TABLE} ({', '.join(columns)})")
        else:
            present = existing_columns(cur)
            for field in FIELDS + ["created_at", "updated_at"]:
                if field.lower() not in present:
                    safe_execute(cur, f"ALTER TABLE {TABLE} ADD COLUMN {column_sql(field)}")
        safe_execute(cur, f"CREATE INDEX idx_manual_rpt_td_no ON {TABLE} (td_no)")
        safe_execute(cur, f"CREATE INDEX idx_manual_rpt_payment_date ON {TABLE} (payment_date)")
        safe_execute(cur, f"CREATE INDEX idx_manual_rpt_receipt_no ON {TABLE} (receipt_no)")


def to_money(value) -> float:
    if value in (None, ""):
        return 0.0
    try:
        return float(Decimal(str(value).replace(",", "")))
    except (InvalidOperation, ValueError):
        return 0.0


def to_bool(value, default=False) -> bool:
    if value in (None, ""):
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on", "included"}


def normalize_date(value: str) -> datetime:
    value = str(value or "").strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            pass
    raise ValueError("payment_date must be a valid date")


def first_value(payload: dict, *keys, default=None):
    for key in keys:
        value = payload.get(key)
        if value is not None and str(value).strip() != "":
            return value
    return default


def normalize_payload(payload: dict) -> dict:
    data = {field: payload.get(field) for field in FIELDS}

    data["td_no"] = str(first_value(payload, "td_no", "td_arp_no", default="")).strip().upper()
    data["payment_date"] = normalize_date(payload.get("payment_date"))
    data["paid_by"] = str(payload.get("paid_by") or "").strip()
    data["taxpayer_name"] = str(first_value(payload, "taxpayer_name", "declared_owner", default="")).strip() or None
    data["period_covered"] = str(first_value(payload, "period_covered", "tax_year", default="")).strip() or None
    data["td_arp_no"] = str(first_value(payload, "td_arp_no", "td_no", default=data["td_no"])).strip().upper()

    if not data["td_no"]:
        raise ValueError("td_no is required")
    if not data["paid_by"]:
        raise ValueError("paid_by is required")

    for field in MONEY_FIELDS:
        data[field] = to_money(payload.get(field))

    if not any(data[field] for field in MONEY_FIELDS):
        data["basic_net_total"] = to_money(payload.get("basic_tax"))
        data["basic_gross_total"] = data["basic_net_total"]
        data["basic_penalty_current_year"] = to_money(payload.get("basic_penalty"))
        data["sef_net_total"] = to_money(payload.get("sef_tax"))
        data["sef_gross_total"] = data["sef_net_total"]
        data["sef_penalty_current_year"] = to_money(payload.get("sef_penalty"))

    basic_penalties = data["basic_penalty_current_year"] + data["basic_penalty_previous_years"] + data["basic_penalty_prior_years"]
    sef_penalties = data["sef_penalty_current_year"] + data["sef_penalty_previous_years"] + data["sef_penalty_prior_years"]
    if data["basic_gross_total"] <= 0:
        data["basic_gross_total"] = data["basic_current_gross"] + data["basic_prior_years"] + basic_penalties
    if data["basic_net_total"] <= 0:
        data["basic_net_total"] = max(data["basic_gross_total"] - data["basic_discount"], 0)
    if data["sef_gross_total"] <= 0:
        data["sef_gross_total"] = data["sef_current_gross"] + data["sef_prior_years"] + sef_penalties
    if data["sef_net_total"] <= 0:
        data["sef_net_total"] = max(data["sef_gross_total"] - data["sef_discount"], 0)
    if data["grand_gross_total"] <= 0:
        data["grand_gross_total"] = data["basic_gross_total"] + data["sef_gross_total"]
    if data["grand_net_total"] <= 0:
        data["grand_net_total"] = data["basic_net_total"] + data["sef_net_total"]
    if data["payment_total_amount"] <= 0:
        data["payment_total_amount"] = to_money(payload.get("total_amount")) or data["grand_net_total"]
    if data["share_25_percent"] <= 0:
        data["share_25_percent"] = round(data["basic_net_total"] * 0.25, 2)

    for field in TEXT_FIELDS:
        if field in {"td_no", "paid_by"}:
            continue
        value = data.get(field)
        data[field] = None if value is None or str(value).strip() == "" else str(value).strip()
    data["is_cancelled"] = to_bool(payload.get("is_cancelled"), False)
    data["is_void"] = to_bool(payload.get("is_void"), False)
    data["include_in_report"] = to_bool(payload.get("include_in_report"), True)
    data["status"] = str(data.get("status") or "Manual").strip() or "Manual"
    value = payload.get("remarks")
    data["remarks"] = None if value is None or str(value).strip() == "" else str(value).strip()
    data["created_by"] = int(data["created_by"]) if str(data.get("created_by") or "").isdigit() else None
    return data


def row_to_dict(row) -> dict:
    cols = [column[0] for column in row.cursor_description]
    data = {str(key).lower(): value for key, value in zip(cols, row)}
    payment_date = data.get("payment_date")
    if hasattr(payment_date, "strftime"):
        payment_date = payment_date.strftime("%Y-%m-%d")
    manual_id = int(data.get("id") or 0)
    basic_penalty = to_money(data.get("basic_penalty_current_year")) + to_money(data.get("basic_penalty_previous_years")) + to_money(data.get("basic_penalty_prior_years"))
    sef_penalty = to_money(data.get("sef_penalty_current_year")) + to_money(data.get("sef_penalty_previous_years")) + to_money(data.get("sef_penalty_prior_years"))
    total_amount = to_money(data.get("payment_total_amount")) or to_money(data.get("grand_net_total"))
    return {
        "manual_id": manual_id,
        "source": "manual",
        "payment_id": f"manual-{manual_id}",
        "taxtrans_id": f"manual-{manual_id}",
        "payment_date": payment_date,
        "td_no": data.get("td_no"),
        "td_no_for_gr": data.get("td_arp_no") or data.get("td_no"),
        "td_arp_no": data.get("td_arp_no") or data.get("td_no"),
        "declared_owner": data.get("taxpayer_name") or data.get("declared_owner"),
        "taxpayer_name": data.get("taxpayer_name") or data.get("declared_owner"),
        "paid_by": data.get("paid_by"),
        "receipt_no": data.get("receipt_no"),
        "taxyear": data.get("period_covered") or data.get("tax_year"),
        "period_covered": data.get("period_covered") or data.get("tax_year"),
        "pin": data.get("pin"),
        "barangay_name": data.get("barangay_name"),
        "basic_current_gross": to_money(data.get("basic_current_gross")),
        "basic_discount": to_money(data.get("basic_discount")),
        "basic_prior_years": to_money(data.get("basic_prior_years")),
        "basic_penalty_current_year": to_money(data.get("basic_penalty_current_year")),
        "basic_penalty_previous_years": to_money(data.get("basic_penalty_previous_years")),
        "basic_penalty_prior_years": to_money(data.get("basic_penalty_prior_years")),
        "basic_gross_total": to_money(data.get("basic_gross_total")),
        "basic_net_total": to_money(data.get("basic_net_total")),
        "sef_current_gross": to_money(data.get("sef_current_gross")),
        "sef_discount": to_money(data.get("sef_discount")),
        "sef_prior_years": to_money(data.get("sef_prior_years")),
        "sef_penalty_current_year": to_money(data.get("sef_penalty_current_year")),
        "sef_penalty_previous_years": to_money(data.get("sef_penalty_previous_years")),
        "sef_penalty_prior_years": to_money(data.get("sef_penalty_prior_years")),
        "sef_gross_total": to_money(data.get("sef_gross_total")),
        "sef_net_total": to_money(data.get("sef_net_total")),
        "grand_gross_total": to_money(data.get("grand_gross_total")),
        "grand_net_total": to_money(data.get("grand_net_total")),
        "share_25_percent": to_money(data.get("share_25_percent")),
        "property_classification": data.get("property_classification"),
        "property_kind": data.get("property_kind"),
        "collector": data.get("collector"),
        "payment_status_ct": data.get("payment_status_ct"),
        "is_cancelled": bool(data.get("is_cancelled")),
        "payment_total_amount": total_amount,
        "booking_reference": data.get("booking_reference"),
        "is_void": bool(data.get("is_void")),
        "include_in_report": bool(data.get("include_in_report")),
        "basic_tax": to_money(data.get("basic_net_total") or data.get("basic_tax")),
        "basic_penalty": basic_penalty or to_money(data.get("basic_penalty")),
        "sef_tax": to_money(data.get("sef_net_total") or data.get("sef_tax")),
        "sef_penalty": sef_penalty or to_money(data.get("sef_penalty")),
        "total_amount": total_amount,
        "rcd_number": data.get("booking_reference") or data.get("rcd_number"),
        "remarks": data.get("remarks"),
    }


def list_rows(path: Path, td_no: str | None = None, date_from: str | None = None, date_to: str | None = None, limit: int = 500) -> list[dict]:
    ensure_schema(path)
    sql = f"SELECT TOP {int(limit)} * FROM {TABLE}"
    clauses = []
    params = []
    if td_no:
        clauses.append("td_no = ?")
        params.append(str(td_no).strip().upper())
    if date_from:
        clauses.append("payment_date >= ?")
        params.append(normalize_date(date_from))
    if date_to:
        clauses.append("payment_date < ?")
        end = normalize_date(date_to)
        params.append(end.replace(hour=23, minute=59, second=59))
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY payment_date DESC, id DESC"
    with connect(path) as conn:
        cur = conn.cursor()
        return [row_to_dict(row) for row in cur.execute(sql, params).fetchall()]


def store_row(path: Path, payload: dict) -> dict:
    ensure_schema(path)
    data = normalize_payload(payload)
    now = datetime.now()
    columns = FIELDS + ["created_at", "updated_at"]
    values = [data.get(field) for field in FIELDS] + [now, now]
    placeholders = ", ".join("?" for _ in columns)
    wrapped_columns = ", ".join(f"[{column}]" for column in columns)
    with connect(path) as conn:
        cur = conn.cursor()
        cur.execute(f"INSERT INTO {TABLE} ({wrapped_columns}) VALUES ({placeholders})", values)
        manual_id = int(cur.execute("SELECT @@IDENTITY AS new_id").fetchone()[0])
        row = cur.execute(f"SELECT * FROM {TABLE} WHERE id = ?", manual_id).fetchone()
        return row_to_dict(row)


def delete_row(path: Path, manual_id: int) -> bool:
    ensure_schema(path)
    with connect(path) as conn:
        cur = conn.cursor()
        existing = cur.execute(f"SELECT id FROM {TABLE} WHERE id = ?", int(manual_id)).fetchone()
        if not existing:
            return False
        cur.execute(f"DELETE FROM {TABLE} WHERE id = ?", int(manual_id))
        return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Access-backed manual RPT payment records")
    parser.add_argument("action", choices=["ensure", "list", "store", "delete"])
    parser.add_argument("--db", default=str(default_db_path()))
    parser.add_argument("--td-no")
    parser.add_argument("--date-from")
    parser.add_argument("--date-to")
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--payload-file")
    parser.add_argument("--id", type=int)
    args = parser.parse_args()
    path = Path(args.db)

    try:
        if args.action == "ensure":
            ensure_schema(path)
            emit({"ok": True, "db": str(path), "table": TABLE})
        if args.action == "list":
            emit({"ok": True, "db": str(path), "data": list_rows(path, args.td_no, args.date_from, args.date_to, args.limit)})
        if args.action == "store":
            if not args.payload_file:
                raise ValueError("--payload-file is required")
            payload = json.loads(Path(args.payload_file).read_text(encoding="utf-8"))
            emit({"ok": True, "db": str(path), "data": store_row(path, payload)})
        if args.action == "delete":
            if not args.id:
                raise ValueError("--id is required")
            deleted = delete_row(path, args.id)
            emit({"ok": deleted, "db": str(path), "deleted": deleted}, 0 if deleted else 1)
    except Exception as exc:
        emit({"ok": False, "error": str(exc), "db": str(path)}, 1)


if __name__ == "__main__":
    main()
