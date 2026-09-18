#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pyodbc

DRIVER = "Microsoft Access Driver (*.mdb, *.accdb)"
TICKETS = "CITATION_TICKETS"
VIOLATIONS = "CITATION_VIOLATIONS"


def db_path() -> Path:
    # Configure the Access database path through CITATION_TICKETS_ACCESS_DB in Laravel config/.env.
    configured = os.environ.get("CITATION_TICKETS_ACCESS_DB")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[1] / "backend" / "database" / "citation_tickets" / "Zamboanguita_CitationTickets.accdb"


def emit(payload: dict, code: int = 0) -> None:
    print(json.dumps(payload, ensure_ascii=False, default=str))
    raise SystemExit(code)


def connect():
    path = db_path()
    if not path.exists():
        raise RuntimeError(f"Citation Tickets Access database was not found: {path}")
    return pyodbc.connect(f"DRIVER={{{DRIVER}}};DBQ={path};", autocommit=False)


def clean(value) -> str | None:
    value = "" if value is None else str(value).strip()
    return value or None


def money(value) -> float:
    if value in (None, ""):
        return 0.0
    try:
        amount = Decimal(str(value).replace(",", ""))
    except (InvalidOperation, ValueError):
        raise ValueError("Amount Due must be greater than or equal to zero.")
    if amount < 0:
        raise ValueError("Amount Due must be greater than or equal to zero.")
    return float(amount)


def date_value(value, field: str, required: bool = False):
    value = clean(value)
    if not value:
        if required:
            raise ValueError(f"{field} is required.")
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            pass
    raise ValueError(f"{field} must be a valid date.")


def time_value(value):
    value = clean(value)
    if not value:
        return None
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p"):
        try:
            parsed = datetime.strptime(value, fmt)
            return datetime(1899, 12, 30, parsed.hour, parsed.minute, parsed.second)
        except ValueError:
            pass
    raise ValueError("Incident Time must be a valid time.")


def require_text(payload: dict, key: str, label: str) -> str:
    value = clean(payload.get(key))
    if not value:
        raise ValueError(f"{label} is required.")
    return value


def normalize_payload(payload: dict) -> dict:
    violations = payload.get("violations") or []
    if isinstance(violations, str):
        violations = [violations]
    violations = [str(item).strip() for item in violations if str(item).strip()]

    data = {
        "ticket_no": require_text(payload, "ticket_no", "Ticket No."),
        "citation_date": date_value(payload.get("citation_date"), "Citation Date", True),
        "incident_time": time_value(payload.get("incident_time")),
        "first_name": require_text(payload, "first_name", "First Name"),
        "middle_name": clean(payload.get("middle_name")),
        "last_name": require_text(payload, "last_name", "Last Name"),
        "driver_address": require_text(payload, "driver_address", "Driver Address"),
        "license_type": clean(payload.get("license_type")),
        "dl_no": clean(payload.get("dl_no")),
        "dl_expiry_date": date_value(payload.get("dl_expiry_date"), "DL Expiry Date"),
        "plate_no": clean(payload.get("plate_no")),
        "mvrr_no": clean(payload.get("mvrr_no")),
        "or_no": clean(payload.get("or_no")),
        "vehicle_type": clean(payload.get("vehicle_type")),
        "color": clean(payload.get("color")),
        "make": clean(payload.get("make")),
        "owner_name": clean(payload.get("owner_name")),
        "owner_address": clean(payload.get("owner_address")),
        "place": require_text(payload, "place", "Place of Violation"),
        "traffic_officer": require_text(payload, "traffic_officer", "Traffic Officer"),
        "amount": money(payload.get("amount")),
        "remarks": clean(payload.get("remarks")),
        "violations": violations,
        "other_violation": clean(payload.get("other_violation")),
    }
    if not data["violations"]:
        raise ValueError("At least one violation is required.")
    if "Others" in data["violations"] and not data["other_violation"]:
        raise ValueError("Other Violation is required when Others is selected.")
    return data


def row_to_dict(row, columns):
    item = {}
    for index, column in enumerate(columns):
        value = row[index]
        if isinstance(value, datetime):
            if column in {"citation_date", "dl_expiry_date", "created_at", "updated_at"}:
                value = value.strftime("%Y-%m-%d")
            elif column == "incident_time":
                value = value.strftime("%H:%M")
        item[column] = value
    return item


def list_tickets() -> list[dict]:
    sql = f"""
        SELECT
            t.CitationID,
            t.TicketNo,
            t.CitationDate,
            t.IncidentTime,
            t.FirstName,
            t.MiddleName,
            t.LastName,
            t.DriverAddress,
            t.LicenseType,
            t.DLNo,
            t.DLExpiryDate,
            t.PlateNo,
            t.MVRRNo,
            t.VehicleORNo,
            t.VehicleType,
            t.VehicleColor,
            t.VehicleMake,
            t.OwnerName,
            t.OwnerAddress,
            t.PlaceOfViolation,
            t.TrafficOfficer,
            t.AmountDue,
            t.CitationStatus,
            t.PaymentStatus,
            t.ClearanceStatus,
            t.ReconciliationStatus,
            t.Remarks,
            t.CreatedAt,
            t.UpdatedAt
        FROM {TICKETS} AS t
        ORDER BY t.CitationDate DESC, t.CitationID DESC
    """
    columns = [
        "id", "ticket_no", "citation_date", "incident_time", "first_name", "middle_name", "last_name",
        "driver_address", "license_type", "dl_no", "dl_expiry_date", "plate_no", "mvrr_no", "or_no",
        "vehicle_type", "color", "make", "owner_name", "owner_address", "place", "traffic_officer",
        "amount", "status", "payment_status", "clearance_status", "reconciliation_status", "remarks",
        "created_at", "updated_at",
    ]
    with connect() as conn:
        cur = conn.cursor()
        rows = [row_to_dict(row, columns) for row in cur.execute(sql).fetchall()]
        if rows:
            ids = [row["id"] for row in rows]
            placeholders = ",".join("?" for _ in ids)
            violation_rows = cur.execute(
                f"SELECT CitationID, ViolationName, OtherViolation, Amount FROM {VIOLATIONS} WHERE CitationID IN ({placeholders}) ORDER BY CitationViolationID",
                ids,
            ).fetchall()
            by_id: dict[int, list[str]] = {}
            other_by_id: dict[int, str] = {}
            for citation_id, name, other, _amount in violation_rows:
                by_id.setdefault(citation_id, []).append(str(name or ""))
                if str(name or "") == "Others" and other:
                    other_by_id[citation_id] = str(other)
            for row in rows:
                row["violations"] = by_id.get(row["id"], [])
                row["other_violation"] = other_by_id.get(row["id"], "")
    return rows


def store_ticket(payload: dict) -> dict:
    data = normalize_payload(payload)
    now = datetime.now()

    with connect() as conn:
        cur = conn.cursor()
        try:
            duplicate = cur.execute(f"SELECT CitationID FROM {TICKETS} WHERE TicketNo = ?", data["ticket_no"]).fetchone()
            if duplicate:
                conn.rollback()
                emit({"ok": False, "duplicate": True, "error": "Citation Ticket No. already exists."}, 2)

            ticket_columns = [
                "TicketNo", "CitationDate", "IncidentTime", "FirstName", "MiddleName", "LastName",
                "DriverAddress", "LicenseType", "DLNo", "DLExpiryDate", "PlateNo", "MVRRNo",
                "VehicleORNo", "VehicleType", "VehicleColor", "VehicleMake", "OwnerName", "OwnerAddress",
                "PlaceOfViolation", "TrafficOfficer", "AmountDue", "CitationStatus", "PaymentStatus",
                "ClearanceStatus", "ReconciliationStatus", "Remarks", "CreatedAt", "UpdatedAt",
            ]
            values = [
                data["ticket_no"], data["citation_date"], data["incident_time"], data["first_name"],
                data["middle_name"], data["last_name"], data["driver_address"], data["license_type"],
                data["dl_no"], data["dl_expiry_date"], data["plate_no"], data["mvrr_no"], data["or_no"],
                data["vehicle_type"], data["color"], data["make"], data["owner_name"], data["owner_address"],
                data["place"], data["traffic_officer"], data["amount"], "Recorded", "Unpaid",
                "Not Cleared", "Pending", data["remarks"], now, now,
            ]
            quoted = ", ".join(f"[{column}]" for column in ticket_columns)
            placeholders = ", ".join("?" for _ in ticket_columns)
            cur.execute(f"INSERT INTO {TICKETS} ({quoted}) VALUES ({placeholders})", values)
            citation_id = int(cur.execute("SELECT @@IDENTITY").fetchone()[0])

            for violation in data["violations"]:
                cur.execute(
                    f"INSERT INTO {VIOLATIONS} ([CitationID], [ViolationName], [OtherViolation], [Amount], [CreatedAt]) VALUES (?, ?, ?, ?, ?)",
                    citation_id,
                    violation,
                    data["other_violation"] if violation == "Others" else None,
                    data["amount"],
                    now,
                )

            conn.commit()
        except SystemExit:
            raise
        except Exception:
            conn.rollback()
            raise

    return {"citation_id": citation_id, "ticket_no": data["ticket_no"]}


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list")
    store = sub.add_parser("store")
    store.add_argument("--payload-file", required=True)
    args = parser.parse_args()

    try:
        if args.command == "list":
            emit({"ok": True, "data": list_tickets()})
        if args.command == "store":
            payload = json.loads(Path(args.payload_file).read_text(encoding="utf-8"))
            emit({"ok": True, "data": store_ticket(payload)})
    except SystemExit:
        raise
    except Exception as exc:
        emit({"ok": False, "error": str(exc)}, 1)


if __name__ == "__main__":
    main()
