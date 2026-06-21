import argparse
import json
from datetime import date, datetime
from decimal import Decimal

from firebird_probe import connect


SUMMARY_COLUMNS = [
    "source",
    "total_collections",
    "national",
    "provincial_general_fund",
    "provincial_sef",
    "provincial_total",
    "municipal_general_fund",
    "municipal_sef",
    "municipal_trust_fund",
    "municipal_total",
    "barangay_share",
    "fisheries",
]

NO_RPT_ORDER = [
    "Manufacturing",
    "Distributor",
    "Retailing",
    "Banks & Other Financial Int.",
    "Other Business Tax",
    "Sand & Gravel",
    "Fines & Penalties",
    "Mayor's Permit",
    "Weights & Measures",
    "Tricycle Permit Fee",
    "Occupation Tax",
    "Cert. of Ownership",
    "Cert. of Transfer",
    "Cockpit Share",
    "Docking and Mooring Fee",
    "Sultadas",
    "Miscellaneous",
    "Registration of Birth",
    "Marriage Fees",
    "Burial Fees",
    "Correction of Entry",
    "Fishing Permit Fee",
    "Sale of Agri. Prod.",
    "Sale of Acc. Forms",
    "Water Fees",
    "Market Stall Fee",
    "Cash Tickets",
    "Slaughterhouse Fee",
    "Rent of Equipment",
    "Doc Stamp Tax",
    "Secretary Fees",
    "Med./Lab. Fees",
    "Garbage Fees",
    "Cutting Tree",
    "Community Tax",
    "Building Permit Fee",
    "Electrical Permit Fee",
    "Zoning Fee",
    "Livestock",
    "Diving Fee",
]

PAID_PAYMENT_SQL = """
          AND COALESCE(p.VOID_BV, 0) = 0
          AND COALESCE(TRIM(p.STATUS_CT), '') NOT IN ('CNL', 'CAN', 'CNC', 'CANCEL', 'CANCELLED', 'VOID', 'VOI')
"""


def scalar(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, str):
        return value.strip()
    return value


def normalize_source_name(name):
    aliases = {
        "Marriage Fees": "Marriage Fee",
        "Burial Fees": "Burial Fee",
        "Sale of Acc. Forms": "Sale of Acct. Forms",
        "Water Fees": "Water Fee",
        "Slaughterhouse Fee": "SlaughterHouse Fee",
        "Rent of Equipment": "Rental of Equipment",
        "Secretary Fees": "Secretaries Fees",
        "Community Tax": "Com Tax Cert.",
    }
    return aliases.get(name, name)


def classify_summary_source(itaxtype, source_id, source_ct):
    code = (itaxtype or "").strip()
    source_ct = (source_ct or "").strip()
    try:
        source_id = int(source_id) if source_id is not None else None
    except (TypeError, ValueError):
        source_id = None

    if source_ct in ("CTCI", "CTCC") or code == "CTC":
        return "Community Tax"
    if code == "MAS":
        return "Manufacturing"
    if code == "WHO":
        return "Distributor"
    if code == "RET":
        return "Retailing"
    if code == "BFI":
        return "Banks & Other Financial Int."
    if code in ("OBT", "CIC", "PED", "EMD") and source_id not in (807, 808):
        return "Other Business Tax"
    if code in ("TSG", "TSB"):
        return "Sand & Gravel"
    if code == "FPT":
        return "Fines & Penalties"
    if code == "MP":
        return "Mayor's Permit"
    if code == "FWM":
        return "Weights & Measures"
    if code in ("TOP", "MTO", "FLF"):
        return "Tricycle Permit Fee"
    if code == "OCC":
        return "Occupation Tax"
    if code == "COO":
        return "Cert. of Ownership"
    if code == "COT":
        return "Cert. of Transfer"
    if code == "CS":
        return "Cockpit Share"
    if code == "FRF" and source_id in (580, 639):
        return "Docking and Mooring Fee"
    if code in ("ST", "ATM"):
        return "Sultadas"
    if code in ("IM", "OPF", "SBF") or source_id in (807, 808):
        return "Miscellaneous"
    if code == "RB":
        return "Registration of Birth"
    if code == "RM":
        return "Marriage Fees"
    if code == "BF":
        return "Burial Fees"
    if code == "CE":
        return "Correction of Entry"
    if code in ("FRF", "IF"):
        return "Fishing Permit Fee"
    if code == "IAP":
        return "Sale of Agri. Prod."
    if code == "IAF":
        return "Sale of Acc. Forms"
    if code in ("WTR", "IWO"):
        return "Water Fees"
    if code in ("RFM", "MSF"):
        return "Market Stall Fee"
    if code in ("SPF", "RFS"):
        return "Slaughterhouse Fee"
    if code in ("RFR", "IPG", "ICO"):
        return "Rent of Equipment"
    if code == "SF" and source_id == 810:
        return "Doc Stamp Tax"
    if code in ("SF", "PCL", "HEC", "OCL"):
        return "Secretary Fees"
    if code == "MDL":
        return "Med./Lab. Fees"
    if code == "GCF":
        return "Garbage Fees"
    if code in ("PFB", "BUF", "INS"):
        return "Building Permit Fee"
    if code == "EP":
        return "Electrical Permit Fee"
    if code == "ZLC":
        return "Zoning Fee"
    if code == "IFL":
        return "Livestock"
    if code == "IFD":
        return "Diving Fee"
    return None


def empty_summary_row(source):
    return {
        "source": normalize_source_name(source),
        "total_collections": Decimal("0"),
        "national": Decimal("0"),
        "provincial_general_fund": Decimal("0"),
        "provincial_sef": Decimal("0"),
        "provincial_total": Decimal("0"),
        "municipal_general_fund": Decimal("0"),
        "municipal_sef": Decimal("0"),
        "municipal_trust_fund": Decimal("0"),
        "municipal_total": Decimal("0"),
        "barangay_share": Decimal("0"),
        "fisheries": Decimal("0"),
    }


def split_summary_amount(name, amount):
    amount = amount or Decimal("0")
    row = empty_summary_row(name)

    if name == "Cockpit Share":
        row["total_collections"] = amount
        row["provincial_general_fund"] = amount * Decimal("0.50")
        row["provincial_total"] = row["provincial_general_fund"]
        row["municipal_general_fund"] = amount * Decimal("0.50")
        row["municipal_total"] = row["municipal_general_fund"]
    elif name == "Building Permit Fee":
        row["total_collections"] = amount
        row["national"] = amount * Decimal("0.05")
        row["municipal_general_fund"] = amount * Decimal("0.80")
        row["municipal_trust_fund"] = amount * Decimal("0.15")
        row["municipal_total"] = row["municipal_general_fund"] + row["municipal_trust_fund"]
    elif name == "Livestock":
        row["total_collections"] = amount
        row["national"] = amount * Decimal("0.20")
        row["municipal_general_fund"] = amount * Decimal("0.80")
        row["municipal_total"] = row["municipal_general_fund"]
    elif name == "Diving Fee":
        row["total_collections"] = amount
        row["municipal_general_fund"] = amount * Decimal("0.40")
        row["municipal_total"] = row["municipal_general_fund"]
        row["barangay_share"] = amount * Decimal("0.30")
        row["fisheries"] = amount * Decimal("0.30")
    else:
        row["total_collections"] = amount
        row["municipal_general_fund"] = amount
        row["municipal_total"] = amount

    return row


def fetch_no_rpt_summary(date_from, date_to):
    amounts = {name: Decimal("0") for name in NO_RPT_ORDER}
    sql = f"""
        SELECT
            pd.ITAXTYPE_CT,
            pd.SOURCEID,
            pd.SOURCE_CT,
            SUM(pd.AMOUNTPAID) AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTDETAIL pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {PAID_PAYMENT_SQL}
          AND COALESCE(p.PAYGROUP_CT, '') <> 'RPT'
        GROUP BY pd.ITAXTYPE_CT, pd.SOURCEID, pd.SOURCE_CT
    """

    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(sql, (date_from, date_to))
        for itaxtype, source_id, source_ct, amount in cursor.fetchall():
            source = classify_summary_source(itaxtype, source_id, source_ct)
            if source:
                amounts[source] = amounts.get(source, Decimal("0")) + (amount or Decimal("0"))
        connection.rollback()
    finally:
        connection.close()

    return [split_summary_amount(name, amounts.get(name, Decimal("0"))) for name in NO_RPT_ORDER]


def fetch_rpt_buckets(date_from, date_to):
    sql = f"""
        SELECT
            pcd.PROPERTYKIND_CT,
            pcd.ITAXTYPE_CT,
            pcd.CASETYPE_CT,
            pcd.TAXYEAR,
            SUM(pcd.AMOUNT) AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTCLASSDETAIL pcd ON pcd.PAYMENT_ID = p.PAYMENT_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          AND p.PAYGROUP_CT = 'RPT'
          {PAID_PAYMENT_SQL}
          AND COALESCE(pcd.CANCELLED_BV, 0) = 0
        GROUP BY pcd.PROPERTYKIND_CT, pcd.ITAXTYPE_CT, pcd.CASETYPE_CT, pcd.TAXYEAR
    """

    entries = []
    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(sql, (date_from, date_to))
        for propkind, itaxtype, casetype, taxyear, amount in cursor.fetchall():
            entries.append({
                "property_group": "Land" if (propkind or "").strip() == "L" else "Bldg.",
                "tax_type": (itaxtype or "").strip(),
                "case_type": (casetype or "").strip(),
                "taxyear": taxyear,
                "amount": amount or Decimal("0"),
            })
        connection.rollback()
    finally:
        connection.close()

    current_taxyear = max((entry["taxyear"] for entry in entries if entry["taxyear"] is not None), default=None)
    buckets = {}

    for entry in entries:
        if entry["case_type"] == "PEN":
            line = "Penalties"
        elif entry["taxyear"] == current_taxyear:
            line = "Current Year"
        else:
            line = "Previous Years"

        key = (entry["property_group"], entry["tax_type"], line)
        buckets[key] = buckets.get(key, Decimal("0")) + entry["amount"]

    return buckets


def rpt_summary_row(label, amount, tax_type):
    row = empty_summary_row(label)
    amount = amount or Decimal("0")
    row["total_collections"] = amount

    if tax_type == "BSC":
        row["provincial_general_fund"] = amount * Decimal("0.35")
        row["provincial_total"] = row["provincial_general_fund"]
        row["municipal_general_fund"] = amount * Decimal("0.40")
        row["municipal_total"] = row["municipal_general_fund"]
        row["barangay_share"] = amount * Decimal("0.25")
    else:
        row["provincial_sef"] = amount * Decimal("0.50")
        row["provincial_total"] = row["provincial_sef"]
        row["municipal_sef"] = amount * Decimal("0.50")
        row["municipal_total"] = row["municipal_sef"]

    return row


def fetch_rpt_summary(date_from, date_to):
    buckets = fetch_rpt_buckets(date_from, date_to)
    layout = [
        ("Real Property Tax - Basic/Land", None, None),
        ("Current Year", "Land", "BSC"),
        ("Previous Years", "Land", "BSC"),
        ("Penalties", "Land", "BSC"),
        ("Real Property Tax - SEF/Land", None, None),
        ("Current Year", "Land", "SEF"),
        ("Previous Years", "Land", "SEF"),
        ("Penalties", "Land", "SEF"),
        ("Real Property Tax - Basic/Bldg.", None, None),
        ("Current Year", "Bldg.", "BSC"),
        ("Previous Years", "Bldg.", "BSC"),
        ("Penalties", "Bldg.", "BSC"),
        ("Real Property Tax - SEF/Bldg.", None, None),
        ("Current Year", "Bldg.", "SEF"),
        ("Previous Years", "Bldg.", "SEF"),
        ("Penalties", "Bldg.", "SEF"),
    ]
    rows = []

    for label, group, tax_type in layout:
        if group is None:
            rows.append({"source": label, "section": True})
        else:
            rows.append(rpt_summary_row(label, buckets.get((group, tax_type, label), Decimal("0")), tax_type))

    return rows


def fetch_rpt_sharing_summary(date_from, date_to):
    sql = f"""
        SELECT
            pcd.PROPERTYKIND_CT,
            pcd.CASETYPE_CT,
            pcd.TAXYEAR,
            SUM(pcd.AMOUNT) AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTCLASSDETAIL pcd ON pcd.PAYMENT_ID = p.PAYMENT_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          AND p.PAYGROUP_CT = 'RPT'
          {PAID_PAYMENT_SQL}
          AND COALESCE(pcd.CANCELLED_BV, 0) = 0
          AND pcd.ITAXTYPE_CT = 'BSC'
        GROUP BY pcd.PROPERTYKIND_CT, pcd.CASETYPE_CT, pcd.TAXYEAR
    """

    entries = []
    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(sql, (date_from, date_to))
        for property_kind, case_type, taxyear, amount in cursor.fetchall():
            entries.append({
                "property_group": "Land" if (property_kind or "").strip() == "L" else "Building",
                "case_type": (case_type or "").strip(),
                "taxyear": taxyear,
                "amount": amount or Decimal("0"),
            })
        connection.rollback()
    finally:
        connection.close()

    current_taxyear = max((entry["taxyear"] for entry in entries if entry["taxyear"] is not None), default=None)
    buckets = {
        "Land": {"Current": Decimal("0"), "Prior": Decimal("0"), "Penalties": Decimal("0")},
        "Building": {"Current": Decimal("0"), "Prior": Decimal("0"), "Penalties": Decimal("0")},
    }

    for entry in entries:
        group = entry["property_group"]
        amount = entry["amount"]

        if entry["case_type"] == "PEN":
            buckets[group]["Penalties"] += amount
        elif entry["case_type"] == "DED":
            buckets[group]["Current"] -= abs(amount)
        elif entry["taxyear"] == current_taxyear:
            buckets[group]["Current"] += amount
        else:
            buckets[group]["Prior"] += amount

    rows = []
    grand_total = Decimal("0")
    for group in ("Land", "Building"):
        group_total = Decimal("0")
        for category in ("Current", "Prior", "Penalties"):
            amount = buckets[group][category]
            group_total += amount
            rows.append({
                "property_group": group,
                "category": category,
                "bsc_amount": amount,
                "provincial_share_35": amount * Decimal("0.35"),
                "municipal_share_40": amount * Decimal("0.40"),
                "barangay_share_25": amount * Decimal("0.25"),
            })

        grand_total += group_total
        rows.append({
            "property_group": group,
            "category": "TOTAL",
            "bsc_amount": group_total,
            "provincial_share_35": group_total * Decimal("0.35"),
            "municipal_share_40": group_total * Decimal("0.40"),
            "barangay_share_25": group_total * Decimal("0.25"),
            "total": True,
        })

    rows.append({
        "property_group": "Land and Building",
        "category": "GRAND TOTAL",
        "bsc_amount": grand_total,
        "provincial_share_35": grand_total * Decimal("0.35"),
        "municipal_share_40": grand_total * Decimal("0.40"),
        "barangay_share_25": grand_total * Decimal("0.25"),
        "grand_total": True,
    })
    return rows


def add_totals(rows):
    totals = {column: Decimal("0") for column in SUMMARY_COLUMNS if column != "source"}

    for row in rows:
        if row.get("section"):
            continue
        for column in totals:
            totals[column] += Decimal(str(row.get(column, 0) or 0))

    total_row = {"source": "TOTAL", **totals, "total": True}
    return rows + [total_row]


def build_report(number, date_from, date_to):
    if number == 21:
        rows = fetch_no_rpt_summary(date_from, date_to) + fetch_rpt_summary(date_from, date_to)
    elif number == 22:
        rows = fetch_no_rpt_summary(date_from, date_to)
    elif number in (23, 24):
        rows = fetch_rpt_summary(date_from, date_to)
    elif number == 27:
        rows = fetch_rpt_sharing_summary(date_from, date_to)
        return {
            "ok": True,
            "mode": "read_only_report_preview",
            "report_number": number,
            "date_from": date_from,
            "date_to": date_to,
            "columns": [
                "property_group",
                "category",
                "bsc_amount",
                "provincial_share_35",
                "municipal_share_40",
                "barangay_share_25",
            ],
            "rows": rows,
        }
    else:
        raise ValueError(f"Report {number} preview is not connected to the Firebird runner yet.")

    return {
        "ok": True,
        "mode": "read_only_report_preview",
        "report_number": number,
        "date_from": date_from,
        "date_to": date_to,
        "columns": SUMMARY_COLUMNS,
        "rows": add_totals(rows),
    }


def main():
    parser = argparse.ArgumentParser(description="Read-only Firebird report preview runner.")
    parser.add_argument("report_number", type=int)
    parser.add_argument("--date-from", required=True)
    parser.add_argument("--date-to", required=True)
    args = parser.parse_args()

    try:
        payload = build_report(args.report_number, args.date_from, args.date_to)
        print(json.dumps(payload, default=scalar))
        return 0
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "mode": "read_only_report_preview",
            "error": str(exc),
            "error_type": exc.__class__.__name__,
        }))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
