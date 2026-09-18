import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_EVEN, ROUND_HALF_UP
from pathlib import Path

from firebird_probe import connect
from manual_rpt_payments_access import default_db_path as manual_rpt_db_path, list_rows as list_manual_rpt_rows
from payment_deduplication import reportable_payment_filter

APPDATA_SITE = os.environ.get("APPDATA")
USER_PROFILE = os.environ.get("USERPROFILE") or r"C:\Users\LIFT-LAPTOP"
USER_SITE_CANDIDATES = [
    Path(APPDATA_SITE) / "Python" / "Python314" / "site-packages" if APPDATA_SITE else None,
    Path(USER_PROFILE) / "AppData" / "Roaming" / "Python" / "Python314" / "site-packages",
]
for user_site in USER_SITE_CANDIDATES:
    if user_site and user_site.exists() and str(user_site) not in sys.path:
        sys.path.append(str(user_site))

BUSINESS_PERMIT_DIR = Path(__file__).resolve().parents[1] / "BUSINESS_PERMIT_REPORT"


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

PAID_PAYMENT_SQL = reportable_payment_filter("p")

BPLS_TAX_ON_BUSINESS_SOURCES = {
    "Manufacturing",
    "Distributor",
    "Retailing",
    "Banks & Other Financial Int.",
    "Other Business Tax",
    "Fines & Penalties",
}


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


MONEY_QUANT = Decimal("0.01")
MONEY_ROUNDING = ROUND_HALF_EVEN
RPT_MONEY_ROUNDING = ROUND_HALF_UP


def round_money(value):
    value = value or Decimal("0")
    return Decimal(value).quantize(MONEY_QUANT, rounding=MONEY_ROUNDING)


def rpt_round_money(value):
    value = value or Decimal("0")
    return Decimal(value).quantize(MONEY_QUANT, rounding=RPT_MONEY_ROUNDING)


def money_round(value):
    return round_money(value)


RPT_BASIC_PROVINCIAL_RATE = Decimal("0.35")
RPT_BASIC_MUNICIPAL_RATE = Decimal("0.40")
RPT_BASIC_BARANGAY_RATE = Decimal("0.25")
RPT_SEF_PROVINCIAL_RATE = Decimal("0.50")
RPT_SEF_MUNICIPAL_RATE = Decimal("0.50")

PROVINCIAL_CODING_ROWS = [
    {"label": "Land Residential", "code": "40102040-101-01-01", "source_row": 12},
    {"label": "Land Commercial", "code": "40102040-101-01-02", "source_row": 13},
    {"label": "Land Industrial", "code": "40102040-101-01-03", "source_row": 14},
    {"label": "Land Machinery", "code": "40102040-101-01-04", "source_row": None},
    {"label": "Land Agricultural", "code": "40102040-101-01-05", "source_row": 11},
    {"label": "Land Recreational", "code": "40102040-101-01-06", "source_row": None},
    {"label": "Land-TIMBER", "code": "", "source_row": None},
    {"label": "Building Residential", "code": "40102040-101-02-01", "source_row": 23},
    {"label": "Building Commercial", "code": "40102040-101-02-02", "source_row": 24},
    {"label": "Building Industrial", "code": "40102040-101-02-03", "source_row": 26},
    {"label": "Building Machinery", "code": "40102040-101-02-04", "source_row": 22},
    {"label": "Building Agricultural", "code": "40102040-101-02-05", "source_row": 25},
    {"label": "Building Recreational", "code": "40102040-101-02-06", "source_row": None},
]


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
    amount = money_round(amount)
    row = empty_summary_row(name)
    row["total_collections"] = amount

    if name == "Cockpit Share":
        row["provincial_general_fund"] = money_round(amount * Decimal("0.50"))
        row["provincial_total"] = row["provincial_general_fund"]
        row["municipal_general_fund"] = amount - row["provincial_total"]
        row["municipal_total"] = row["municipal_general_fund"]
    elif name == "Building Permit Fee":
        row["national"] = money_round(amount * Decimal("0.05"))
        row["municipal_general_fund"] = money_round(amount * Decimal("0.80"))
        row["municipal_trust_fund"] = amount - row["national"] - row["municipal_general_fund"]
        row["municipal_total"] = row["municipal_general_fund"] + row["municipal_trust_fund"]
    elif name == "Livestock":
        row["national"] = money_round(amount * Decimal("0.20"))
        row["municipal_general_fund"] = amount - row["national"]
        row["municipal_total"] = row["municipal_general_fund"]
    elif name == "Diving Fee":
        row["municipal_general_fund"] = money_round(amount * Decimal("0.40"))
        row["municipal_total"] = row["municipal_general_fund"]
        row["barangay_share"] = money_round(amount * Decimal("0.30"))
        row["fisheries"] = amount - row["municipal_total"] - row["barangay_share"]
    else:
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

    for row in fetch_tax_on_business_summary(date_from, date_to):
        category = row.get("category")
        if category in BPLS_TAX_ON_BUSINESS_SOURCES:
            amounts[category] = row.get("total", Decimal("0")) or Decimal("0")

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

    entries.extend(manual_rpt_bucket_entries(date_from, date_to))

    report_year = datetime.strptime(date_from, "%Y-%m-%d").year
    buckets = {}

    for entry in entries:
        taxyear = entry["taxyear"]
        if taxyear and taxyear > report_year:
            continue

        if entry["case_type"] == "PEN":
            line = "Penalties"
        elif taxyear == report_year:
            line = "Current Year"
        else:
            line = "Previous Years"

        key = (entry["property_group"], entry["tax_type"], line)
        buckets[key] = buckets.get(key, Decimal("0")) + entry["amount"]

    return buckets


def rpt_summary_row(label, amount, tax_type, sharing=None):
    row = empty_summary_row(label)
    amount = Decimal(amount or Decimal("0"))
    row["total_collections"] = money_round(amount)

    # RPT shares come from the Summary Report Sharing authority when provided.
    # This keeps Reports 21, 23, 27, and 28 on one Decimal calculation path.
    if sharing:
        for column in (
            "provincial_general_fund",
            "provincial_sef",
            "provincial_total",
            "municipal_general_fund",
            "municipal_sef",
            "municipal_total",
            "barangay_share",
        ):
            row[column] = sharing.get(column, Decimal("0"))
        return row

    if tax_type == "BSC":
        row["provincial_general_fund"] = money_round(amount * RPT_BASIC_PROVINCIAL_RATE)
        row["provincial_total"] = row["provincial_general_fund"]
        row["municipal_general_fund"] = money_round(amount * RPT_BASIC_MUNICIPAL_RATE)
        row["municipal_total"] = row["municipal_general_fund"]
        row["barangay_share"] = amount - row["provincial_total"] - row["municipal_total"]
    else:
        row["provincial_sef"] = money_round(amount * RPT_SEF_PROVINCIAL_RATE)
        row["provincial_total"] = row["provincial_sef"]
        row["municipal_sef"] = amount - row["provincial_total"]
        row["municipal_total"] = row["municipal_sef"]

    return row

def fetch_rpt_summary(date_from, date_to):
    authority = authoritative_rpt_sharing(date_from, date_to)
    summary = authority["summary"]
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
            continue

        sharing = summary.get((group, tax_type, label), {})
        rows.append(rpt_summary_row(label, sharing.get("collection", Decimal("0")), tax_type, sharing))

    return rows

def fetch_rpt_sharing_summary(date_from, date_to):
    authority = authoritative_rpt_sharing(date_from, date_to)
    summary = authority["summary"]
    rows = []
    grand_total = Decimal("0")

    for display_group, summary_group in (("Land", "Land"), ("Building", "Bldg.")):
        group_total = Decimal("0")
        for category in ("Current", "Prior", "Penalties"):
            label = "Current Year" if category == "Current" else "Previous Years" if category == "Prior" else "Penalties"
            data = summary.get((summary_group, "BSC", label), {})
            amount = data.get("collection", Decimal("0"))
            group_total += amount
            rows.append({
                "property_group": display_group,
                "category": category,
                "bsc_amount": amount,
                "provincial_share_35": data.get("provincial_general_fund", Decimal("0")),
                "municipal_share_40": data.get("municipal_general_fund", Decimal("0")),
                "barangay_share_25": data.get("barangay_share", Decimal("0")),
            })

        group_shares = {
            "provincial": sum(summary.get((summary_group, "BSC", label), {}).get("provincial_general_fund", Decimal("0")) for label in ("Current Year", "Previous Years", "Penalties")),
            "municipal": sum(summary.get((summary_group, "BSC", label), {}).get("municipal_general_fund", Decimal("0")) for label in ("Current Year", "Previous Years", "Penalties")),
            "barangay": sum(summary.get((summary_group, "BSC", label), {}).get("barangay_share", Decimal("0")) for label in ("Current Year", "Previous Years", "Penalties")),
        }
        grand_total += group_total
        rows.append({
            "property_group": display_group,
            "category": "TOTAL",
            "bsc_amount": group_total,
            "provincial_share_35": group_shares["provincial"],
            "municipal_share_40": group_shares["municipal"],
            "barangay_share_25": group_shares["barangay"],
            "total": True,
        })

    rows.append({
        "property_group": "Land and Building",
        "category": "GRAND TOTAL",
        "bsc_amount": grand_total,
        "provincial_share_35": authority["totals"]["provincial_gf"],
        "municipal_share_40": authority["totals"]["municipal_gf"],
        "barangay_share_25": authority["totals"]["barangay"],
        "grand_total": True,
    })
    return rows

def sharing_row_for_classification(property_kind, class_code):
    property_kind = (property_kind or "").strip()
    class_code = (class_code or "").strip()
    if property_kind == "L":
        if class_code == "A":
            return 11
        if class_code == "R":
            return 12
        if class_code == "C":
            return 13
        return 14

    if property_kind == "M":
        return 22
    if class_code == "R":
        return 23
    if class_code == "C":
        return 24
    if class_code == "A":
        return 25
    if class_code.upper().startswith("S"):
        return 26
    return 26


def fetch_summary_sharing_template_cells(date_from, date_to):
    sql = f"""
        SELECT
            pcd.PROPERTYKIND_CT,
            COALESCE(pcd.CLASSCODE_CT, ra.PREDOMCLASSCODE_CT) AS CLASSCODE_CT,
            pcd.ITAXTYPE_CT,
            pcd.CASETYPE_CT,
            pcd.TAXYEAR,
            SUM(pcd.AMOUNT) AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTCLASSDETAIL pcd ON pcd.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN RPTASSESSMENT ra ON ra.TAXTRANS_ID = pcd.TAXTRANS_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          AND p.PAYGROUP_CT = 'RPT'
          {PAID_PAYMENT_SQL}
          AND COALESCE(pcd.CANCELLED_BV, 0) = 0
        GROUP BY pcd.PROPERTYKIND_CT, COALESCE(pcd.CLASSCODE_CT, ra.PREDOMCLASSCODE_CT),
                 pcd.ITAXTYPE_CT, pcd.CASETYPE_CT, pcd.TAXYEAR
    """
    values = {}
    report_year = datetime.strptime(date_from, "%Y-%m-%d").year

    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(sql, (date_from, date_to))
        fetched_rows = cursor.fetchall()

        for property_kind, class_code, tax_type, case_type, taxyear, amount in fetched_rows:
            if taxyear and taxyear > report_year:
                continue

            row_index = sharing_row_for_classification(property_kind, class_code)
            tax_type = (tax_type or "").strip()
            case_type = (case_type or "").strip()
            if tax_type == "BSC":
                current_col, discount_col, prior_col, pen_current_col, pen_prior_col = 3, 4, 5, 6, 7
            elif tax_type == "SEF":
                current_col, discount_col, prior_col, pen_current_col, pen_prior_col = 10, 11, 12, 13, 14
            else:
                continue

            if case_type == "DED":
                col_index = discount_col
                value = abs(amount or Decimal("0"))
            elif case_type == "PEN":
                col_index = pen_current_col if taxyear == report_year else pen_prior_col
                value = amount or Decimal("0")
            else:
                col_index = current_col if taxyear == report_year else prior_col
                value = amount or Decimal("0")
            values[(row_index, col_index)] = values.get((row_index, col_index), Decimal("0")) + value
        connection.rollback()
    finally:
        connection.close()

    for cell_key, amount in manual_rpt_sharing_template_values(date_from, date_to).items():
        values[cell_key] = values.get(cell_key, Decimal("0")) + amount

    cells = []
    for row_index in (11, 12, 13, 14, 22, 23, 24, 25, 26):
        for col_index in (3, 4, 5, 6, 7, 10, 11, 12, 13, 14):
            cells.append({
                "row": row_index,
                "column": col_index,
                "value": values.get((row_index, col_index), Decimal("0")),
            })
    return cells


def add_full_daily_amount(daily, day, column_name, amount):
    if hasattr(day, "date"):
        day = day.date()
    if day not in daily:
        daily[day] = {
            "ctc": Decimal("0"),
            "rpt": Decimal("0"),
            "gf_tf": Decimal("0"),
        }
    daily[day][column_name] += amount or Decimal("0")


def fetch_full_report_collections(date_from, date_to):
    daily = {}
    ctc_sql = f"""
        SELECT
            CAST(p.PAYMENTDATE AS DATE) AS COLLECTION_DATE,
            SUM(pd.AMOUNTPAID) AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTDETAIL pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {PAID_PAYMENT_SQL}
          AND (pd.SOURCE_CT IN ('CTCI', 'CTCC') OR pd.ITAXTYPE_CT = 'CTC')
        GROUP BY CAST(p.PAYMENTDATE AS DATE)
    """
    rpt_sql = f"""
        SELECT
            CAST(p.PAYMENTDATE AS DATE) AS COLLECTION_DATE,
            SUM(pcd.AMOUNT) AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTCLASSDETAIL pcd ON pcd.PAYMENT_ID = p.PAYMENT_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          AND p.PAYGROUP_CT = 'RPT'
          {PAID_PAYMENT_SQL}
          AND COALESCE(pcd.CANCELLED_BV, 0) = 0
        GROUP BY CAST(p.PAYMENTDATE AS DATE)
    """
    gf_tf_sql = f"""
        SELECT
            CAST(p.PAYMENTDATE AS DATE) AS COLLECTION_DATE,
            SUM(pd.AMOUNTPAID) AS AMOUNT
        FROM PAYMENT p
        JOIN PAYMENTDETAIL pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {PAID_PAYMENT_SQL}
          AND COALESCE(p.PAYGROUP_CT, '') <> 'RPT'
          AND NOT (pd.SOURCE_CT IN ('CTCI', 'CTCC') OR pd.ITAXTYPE_CT = 'CTC')
        GROUP BY CAST(p.PAYMENTDATE AS DATE)
    """

    connection = connect()
    try:
        cursor = connection.cursor()
        for sql, column_name in ((ctc_sql, "ctc"), (rpt_sql, "rpt"), (gf_tf_sql, "gf_tf")):
            cursor.execute(sql, (date_from, date_to))
            for collection_date, amount in cursor.fetchall():
                add_full_daily_amount(daily, collection_date, column_name, amount)
        connection.rollback()
    finally:
        connection.close()

    for row in fetch_manual_rpt_rows(date_from, date_to):
        if not manual_rpt_row_is_reportable(row):
            continue
        payment_date = parse_excel_date(row.get("payment_date"))
        if payment_date:
            add_full_daily_amount(daily, payment_date, "rpt", manual_rpt_total(row))

    start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
    end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
    rows = []
    current = start_date
    while current <= end_date:
        amounts = daily.get(current, {"ctc": Decimal("0"), "rpt": Decimal("0"), "gf_tf": Decimal("0")})
        total = amounts["ctc"] + amounts["rpt"] + amounts["gf_tf"]
        rows.append({
            "date": current,
            "ctc": amounts["ctc"],
            "rpt": amounts["rpt"],
            "gf_tf": amounts["gf_tf"],
            "due_from": "",
            "rcd_total": total,
        })
        current += timedelta(days=1)
    return rows


def clean_text(value):
    if value is None:
        return ""
    return str(value).strip()


def decimal_value(value):
    if value in (None, ""):
        return Decimal("0")
    try:
        return Decimal(str(value).replace(",", ""))
    except Exception:
        return Decimal("0")




def fetch_manual_rpt_rows(date_from, date_to):
    try:
        return list_manual_rpt_rows(
            manual_rpt_db_path(),
            td_no=None,
            date_from=date_from,
            date_to=date_to,
            limit=50000,
        )
    except Exception:
        return []


def manual_rpt_row_is_reportable(row):
    return bool(row.get("include_in_report", True)) and not bool(row.get("is_cancelled")) and not bool(row.get("is_void"))


def manual_rpt_taxyear(row, report_year):
    text = clean_text(row.get("period_covered") or row.get("taxyear"))
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) >= 4:
        try:
            return int(digits[:4])
        except ValueError:
            pass
    return report_year


def manual_rpt_property_group(row, building_label="Bldg."):
    kind = clean_text(row.get("property_kind")).upper()
    if kind.startswith(("B", "IMPROV", "BUILD", "MACH")):
        return building_label
    return "Land"


def manual_rpt_property_kind_code(row):
    kind = clean_text(row.get("property_kind")).upper()
    if kind.startswith("MACH"):
        return "M"
    if kind.startswith(("B", "IMPROV", "BUILD")):
        return "B"
    return "L"


def manual_rpt_class_code(row):
    text = clean_text(row.get("property_classification")).upper()
    if text.startswith("A"):
        return "A"
    if text.startswith("R"):
        return "R"
    if text.startswith("C"):
        return "C"
    if text.startswith("S"):
        return "S"
    return ""


def manual_rpt_total(row):
    return (
        decimal_value(row.get("payment_total_amount"))
        or decimal_value(row.get("total_amount"))
        or decimal_value(row.get("grand_net_total"))
        or (
            decimal_value(row.get("basic_net_total"))
            + decimal_value(row.get("sef_net_total"))
        )
    )


def manual_rpt_bucket_entries(date_from, date_to):
    report_year = datetime.strptime(date_from, "%Y-%m-%d").year
    entries = []
    for row in fetch_manual_rpt_rows(date_from, date_to):
        if not manual_rpt_row_is_reportable(row):
            continue

        taxyear = manual_rpt_taxyear(row, report_year)
        group = manual_rpt_property_group(row)
        basic_current = max(decimal_value(row.get("basic_current_gross")) - decimal_value(row.get("basic_discount")), Decimal("0"))
        sef_current = max(decimal_value(row.get("sef_current_gross")) - decimal_value(row.get("sef_discount")), Decimal("0"))
        basic_prior = decimal_value(row.get("basic_prior_years"))
        sef_prior = decimal_value(row.get("sef_prior_years"))
        basic_penalty = (
            decimal_value(row.get("basic_penalty_current_year"))
            + decimal_value(row.get("basic_penalty_previous_years"))
            + decimal_value(row.get("basic_penalty_prior_years"))
        )
        sef_penalty = (
            decimal_value(row.get("sef_penalty_current_year"))
            + decimal_value(row.get("sef_penalty_previous_years"))
            + decimal_value(row.get("sef_penalty_prior_years"))
        )

        if basic_current:
            entries.append({"property_group": group, "tax_type": "BSC", "case_type": "REG", "taxyear": report_year, "amount": basic_current})
        if basic_prior:
            entries.append({"property_group": group, "tax_type": "BSC", "case_type": "REG", "taxyear": taxyear if taxyear != report_year else report_year - 1, "amount": basic_prior})
        if basic_penalty:
            entries.append({"property_group": group, "tax_type": "BSC", "case_type": "PEN", "taxyear": taxyear, "amount": basic_penalty})
        if sef_current:
            entries.append({"property_group": group, "tax_type": "SEF", "case_type": "REG", "taxyear": report_year, "amount": sef_current})
        if sef_prior:
            entries.append({"property_group": group, "tax_type": "SEF", "case_type": "REG", "taxyear": taxyear if taxyear != report_year else report_year - 1, "amount": sef_prior})
        if sef_penalty:
            entries.append({"property_group": group, "tax_type": "SEF", "case_type": "PEN", "taxyear": taxyear, "amount": sef_penalty})
    return entries


def manual_rpt_sharing_entries(date_from, date_to):
    entries = []
    for entry in manual_rpt_bucket_entries(date_from, date_to):
        if entry.get("tax_type") != "BSC":
            continue
        entries.append({
            "property_group": "Land" if entry.get("property_group") == "Land" else "Building",
            "case_type": entry.get("case_type"),
            "taxyear": entry.get("taxyear"),
            "amount": entry.get("amount") or Decimal("0"),
        })
    return entries


def add_manual_rpt_template_value(values, row_index, col_index, amount):
    amount = decimal_value(amount)
    if amount:
        values[(row_index, col_index)] = values.get((row_index, col_index), Decimal("0")) + amount


def manual_rpt_sharing_template_values(date_from, date_to):
    report_year = datetime.strptime(date_from, "%Y-%m-%d").year
    values = {}
    for row in fetch_manual_rpt_rows(date_from, date_to):
        if not manual_rpt_row_is_reportable(row):
            continue

        row_index = sharing_row_for_classification(manual_rpt_property_kind_code(row), manual_rpt_class_code(row))
        taxyear = manual_rpt_taxyear(row, report_year)
        basic_penalty_current = decimal_value(row.get("basic_penalty_current_year"))
        basic_penalty_prior = decimal_value(row.get("basic_penalty_previous_years")) + decimal_value(row.get("basic_penalty_prior_years"))
        sef_penalty_current = decimal_value(row.get("sef_penalty_current_year"))
        sef_penalty_prior = decimal_value(row.get("sef_penalty_previous_years")) + decimal_value(row.get("sef_penalty_prior_years"))

        add_manual_rpt_template_value(values, row_index, 3 if taxyear == report_year else 5, row.get("basic_current_gross"))
        add_manual_rpt_template_value(values, row_index, 4, row.get("basic_discount"))
        add_manual_rpt_template_value(values, row_index, 5, row.get("basic_prior_years"))
        add_manual_rpt_template_value(values, row_index, 6, basic_penalty_current)
        add_manual_rpt_template_value(values, row_index, 7, basic_penalty_prior)

        add_manual_rpt_template_value(values, row_index, 10 if taxyear == report_year else 12, row.get("sef_current_gross"))
        add_manual_rpt_template_value(values, row_index, 11, row.get("sef_discount"))
        add_manual_rpt_template_value(values, row_index, 12, row.get("sef_prior_years"))
        add_manual_rpt_template_value(values, row_index, 13, sef_penalty_current)
        add_manual_rpt_template_value(values, row_index, 14, sef_penalty_prior)
    return values



def authoritative_cell_lookup(cells):
    return {
        (int(cell["row"]), int(cell["column"])): Decimal(str(cell.get("value") or "0"))
        for cell in cells
    }


def sum_cells(lookup, rows, columns):
    return sum((lookup.get((row_index, column_index), Decimal("0")) for row_index in rows for column_index in columns), Decimal("0"))


def source_row_group(row_index):
    if row_index in (11, 12, 13, 14):
        return "Land"
    if row_index in (22, 23, 24, 25, 26):
        return "Bldg."
    return None


def group_display_name(group):
    return "Building" if group == "Bldg." else group


def combine_share_lines(lines):
    keys = (
        "collection",
        "provincial_general_fund",
        "provincial_sef",
        "provincial_total",
        "municipal_general_fund",
        "municipal_sef",
        "municipal_total",
        "barangay_share",
        "raw_collection",
        "raw_provincial_general_fund",
        "raw_provincial_sef",
        "raw_provincial_total",
        "raw_municipal_general_fund",
        "raw_municipal_sef",
        "raw_municipal_total",
        "raw_barangay_share",
    )
    return {
        key: sum((line.get(key, Decimal("0")) for line in lines), Decimal("0"))
        for key in keys
    }


def authoritative_share_line(collection, tax_type):
    raw_collection = Decimal(collection or Decimal("0"))
    collection = rpt_round_money(raw_collection)

    if tax_type == "BSC":
        raw_provincial = raw_collection * RPT_BASIC_PROVINCIAL_RATE
        raw_municipal = raw_collection * RPT_BASIC_MUNICIPAL_RATE
        raw_barangay = raw_collection * RPT_BASIC_BARANGAY_RATE
        provincial = rpt_round_money(raw_provincial)
        municipal = rpt_round_money(raw_municipal)
        barangay = rpt_round_money(raw_barangay)
        return {
            "collection": collection,
            "provincial_general_fund": provincial,
            "provincial_sef": Decimal("0"),
            "provincial_total": provincial,
            "municipal_general_fund": municipal,
            "municipal_sef": Decimal("0"),
            "municipal_total": municipal,
            "barangay_share": barangay,
            "raw_collection": raw_collection,
            "raw_provincial_general_fund": raw_provincial,
            "raw_provincial_sef": Decimal("0"),
            "raw_provincial_total": raw_provincial,
            "raw_municipal_general_fund": raw_municipal,
            "raw_municipal_sef": Decimal("0"),
            "raw_municipal_total": raw_municipal,
            "raw_barangay_share": raw_barangay,
        }

    raw_provincial = raw_collection * RPT_SEF_PROVINCIAL_RATE
    raw_municipal = raw_collection * RPT_SEF_MUNICIPAL_RATE
    provincial = rpt_round_money(raw_provincial)
    municipal = rpt_round_money(raw_municipal)
    return {
        "collection": collection,
        "provincial_general_fund": Decimal("0"),
        "provincial_sef": provincial,
        "provincial_total": provincial,
        "municipal_general_fund": Decimal("0"),
        "municipal_sef": municipal,
        "municipal_total": municipal,
        "barangay_share": Decimal("0"),
        "raw_collection": raw_collection,
        "raw_provincial_general_fund": Decimal("0"),
        "raw_provincial_sef": raw_provincial,
        "raw_provincial_total": raw_provincial,
        "raw_municipal_general_fund": Decimal("0"),
        "raw_municipal_sef": raw_municipal,
        "raw_municipal_total": raw_municipal,
        "raw_barangay_share": Decimal("0"),
    }


FIELD_SPECS = {
    "BSC": {
        "current": ("Current Year", (3,), (4,)),
        "prior": ("Previous Years", (5,), ()),
        "penalty_current": ("Penalties", (6,), ()),
        "penalty_prior": ("Penalties", (7,), ()),
    },
    "SEF": {
        "current": ("Current Year", (10,), (11,)),
        "prior": ("Previous Years", (12,), ()),
        "penalty_current": ("Penalties", (13,), ()),
        "penalty_prior": ("Penalties", (14,), ()),
    },
}


def build_authoritative_rpt_sharing_from_cells(cells):
    lookup = authoritative_cell_lookup(cells)
    group_rows = {
        "Land": (11, 12, 13, 14),
        "Bldg.": (22, 23, 24, 25, 26),
    }
    row_field_summary = {}
    field_summary = {}
    summary = {}

    for group, rows in group_rows.items():
        for tax_type, fields in FIELD_SPECS.items():
            for field, (_label, add_columns, subtract_columns) in fields.items():
                row_lines = []
                for row_index in rows:
                    collection = sum_cells(lookup, (row_index,), add_columns) - sum_cells(lookup, (row_index,), subtract_columns)
                    line = authoritative_share_line(collection, tax_type)
                    row_field_summary[(row_index, tax_type, field)] = line
                    row_lines.append(line)
                field_summary[(group, tax_type, field)] = combine_share_lines(row_lines)

            summary[(group, tax_type, "Current Year")] = field_summary[(group, tax_type, "current")]
            summary[(group, tax_type, "Previous Years")] = field_summary[(group, tax_type, "prior")]
            summary[(group, tax_type, "Penalties")] = combine_share_lines([
                field_summary[(group, tax_type, "penalty_current")],
                field_summary[(group, tax_type, "penalty_prior")],
            ])

    return {
        "template_cells": cells,
        "summary": summary,
        "field_summary": field_summary,
        "row_field_summary": row_field_summary,
        "totals": {
            "provincial_gf": sum((data["provincial_general_fund"] for (group, tax_type, label), data in summary.items() if tax_type == "BSC"), Decimal("0")),
            "provincial_sef": sum((data["provincial_sef"] for (group, tax_type, label), data in summary.items() if tax_type == "SEF"), Decimal("0")),
            "municipal_gf": sum((data["municipal_general_fund"] for (group, tax_type, label), data in summary.items() if tax_type == "BSC"), Decimal("0")),
            "municipal_sef": sum((data["municipal_sef"] for (group, tax_type, label), data in summary.items() if tax_type == "SEF"), Decimal("0")),
            "barangay": sum((data["barangay_share"] for (group, tax_type, label), data in summary.items() if tax_type == "BSC"), Decimal("0")),
        },
    }


def authoritative_rpt_sharing(date_from, date_to):
    return build_authoritative_rpt_sharing_from_cells(fetch_summary_sharing_template_cells(date_from, date_to))


def allocation_remainder(raw_value, displayed_value):
    return raw_value - displayed_value


def allocate_display_amounts(raw_values, authoritative_total):
    displayed = {key: round_money(value) for key, value in raw_values.items()}
    residual = round_money(authoritative_total - sum(displayed.values(), Decimal("0")))
    centavos = int((residual / MONEY_QUANT).to_integral_value())
    if centavos == 0:
        return displayed

    candidates = [
        key for key, value in raw_values.items()
        if value != 0 or displayed.get(key, Decimal("0")) != 0
    ] or list(raw_values.keys())

    if centavos > 0:
        ordered = sorted(candidates, key=lambda key: (allocation_remainder(raw_values[key], displayed[key]), str(key)), reverse=True)
        step = MONEY_QUANT
    else:
        ordered = sorted(candidates, key=lambda key: (allocation_remainder(raw_values[key], displayed[key]), str(key)))
        step = -MONEY_QUANT

    for index in range(abs(centavos)):
        key = ordered[index % len(ordered)]
        displayed[key] += step

    return displayed


def raw_coding_amount(lookup, source_row, field, is_gf):
    if not source_row:
        return Decimal("0")
    columns = FIELD_SPECS["BSC" if is_gf else "SEF"][field]
    _label, add_columns, subtract_columns = columns
    amount = sum((lookup.get((source_row, column), Decimal("0")) for column in add_columns), Decimal("0"))
    amount -= sum((lookup.get((source_row, column), Decimal("0")) for column in subtract_columns), Decimal("0"))
    rate = RPT_BASIC_PROVINCIAL_RATE if is_gf else RPT_SEF_PROVINCIAL_RATE
    return amount * rate


def build_provincial_coding_sheet(authority, sheet_name):
    is_gf = sheet_name == "GF"
    tax_type = "BSC" if is_gf else "SEF"
    share_column = "provincial_general_fund" if is_gf else "provincial_sef"
    fields = ("current", "prior", "penalty_current", "penalty_prior")
    allocated_by_field = {field: {} for field in fields}

    for field in fields:
        for index, item in enumerate(PROVINCIAL_CODING_ROWS):
            source_row = item["source_row"]
            line = authority["row_field_summary"].get((source_row, tax_type, field), {})
            allocated_by_field[field][index] = line.get(share_column, Decimal("0"))

    rows = []
    totals = {field: Decimal("0") for field in fields}
    for index, item in enumerate(PROVINCIAL_CODING_ROWS):
        code = item["code"]
        penalty_code = code.replace("-101-", "-102-") if code else ""
        values = {field: allocated_by_field[field][index] for field in fields}
        for field in fields:
            totals[field] += values[field]
        rows.append([
            item["label"],
            code,
            values["current"],
            code,
            values["prior"],
            penalty_code,
            values["penalty_current"],
            penalty_code,
            values["penalty_prior"],
        ])

    total_remittance = sum(totals.values(), Decimal("0"))
    return {
        "fundTitle": "GENERAL FUND" if is_gf else "SEF",
        "sheet": sheet_name,
        "rows": rows,
        "subtotal": ["SUB TOTAL", "", totals["current"], "", totals["prior"], "", totals["penalty_current"], "", totals["penalty_prior"]],
        "totalRemittance": ["TOTAL REMITTANCE GF" if is_gf else "TOTAL REMITTANCE SEF", "", "", "", "", "", "", "", total_remittance],
        "total": total_remittance,
        "bucketTotals": [
            {
                "property_group": group_display_name(group),
                "field": field,
                "amount": authority["field_summary"][(group, tax_type, field)][share_column],
            }
            for group in ("Land", "Bldg.")
            for field in fields
        ],
    }


def build_provincial_coding_preview(date_from, date_to):
    authority = authoritative_rpt_sharing(date_from, date_to)
    gf_sheet = build_provincial_coding_sheet(authority, "GF")
    sef_sheet = build_provincial_coding_sheet(authority, "SEF")
    return {
        "sheets": [
            gf_sheet,
            sef_sheet,
        ],
        "totals": {
            "provincial_gf": gf_sheet["total"],
            "provincial_sef": sef_sheet["total"],
        },
    }


def build_provincial_coding_workbook_rows(date_from, date_to):
    coding = build_provincial_coding_preview(date_from, date_to)
    rows = [["SHEET", "ROW", "COLUMN", "VALUE"]]
    for sheet in coding["sheets"]:
        sheet_name = sheet["sheet"]
        for target_row, row in enumerate(sheet["rows"], start=9):
            for target_column, value_index in zip((3, 5, 7, 9), (2, 4, 6, 8)):
                rows.append([sheet_name, target_row, target_column, row[value_index]])
    return rows


def build_sharing_panel_rows(authority, tax_type):
    share_columns = (
        ("provincial_share", "provincial_general_fund" if tax_type == "BSC" else "provincial_sef"),
        ("municipal_share", "municipal_general_fund" if tax_type == "BSC" else "municipal_sef"),
    )
    if tax_type == "BSC":
        share_columns = share_columns + (("barangay_share", "barangay_share"),)

    rows = []
    fields = (
        ("Current", "current"),
        ("Prior", "prior"),
        ("Current-Year Penalty", "penalty_current"),
        ("Prior-Year Penalty", "penalty_prior"),
    )
    for display_group, group in (("Land", "Land"), ("Building", "Bldg.")):
        for label, field in fields:
            data = authority["field_summary"][(group, tax_type, field)]
            row = {
                "property_group": display_group,
                "category": label,
                "amount": data["collection"],
            }
            for output_key, data_key in share_columns:
                row[output_key] = data[data_key]
            rows.append(row)

        total = combine_share_lines([authority["field_summary"][(group, tax_type, field)] for _label, field in fields])
        row = {
            "property_group": display_group,
            "category": "TOTAL",
            "amount": total["collection"],
            "total": True,
        }
        for output_key, data_key in share_columns:
            row[output_key] = total[data_key]
        rows.append(row)

    grand = combine_share_lines(list(authority["field_summary"].values()))
    row = {
        "property_group": "Land and Building",
        "category": "GRAND TOTAL",
        "amount": sum((data["collection"] for (group, row_tax_type, field), data in authority["field_summary"].items() if row_tax_type == tax_type), Decimal("0")),
        "grand_total": True,
    }
    for output_key, data_key in share_columns:
        row[output_key] = sum((data[data_key] for (group, row_tax_type, field), data in authority["field_summary"].items() if row_tax_type == tax_type), Decimal("0"))
    rows.append(row)
    return rows

def find_business_permit_workbook(pattern):
    matches = sorted(BUSINESS_PERMIT_DIR.glob(pattern))
    if not matches:
        raise FileNotFoundError(f"Business permit workbook was not found: {BUSINESS_PERMIT_DIR / pattern}")
    return matches[-1]


def parse_excel_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        from openpyxl.utils.datetime import from_excel
        return from_excel(value).date()
    text = clean_text(value)
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%B %d, %Y", "%d-%b-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def load_sheet_records(path):
    from openpyxl import load_workbook
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    headers = [clean_text(value) for value in rows[0]]
    records = []
    for row in rows[1:]:
        records.append({headers[index]: value for index, value in enumerate(row) if index < len(headers)})
    workbook.close()
    return records


def load_sheet_records_with_header(path, header_row):
    from openpyxl import load_workbook
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook.active
    headers = [clean_text(cell.value) for cell in next(sheet.iter_rows(min_row=header_row, max_row=header_row))]
    records = []
    for row in sheet.iter_rows(min_row=header_row + 1, values_only=True):
        records.append({headers[index]: value for index, value in enumerate(row) if index < len(headers)})
    workbook.close()
    return records


def business_establishment_match_lookup(records):
    by_or = {}
    by_business_id = {}
    for record in records:
        or_number = clean_text(record.get("OR Number"))
        business_id = clean_text(record.get("Business Identification Number"))
        has_paid = decimal_value(record.get("Total Amount Paid")) > 0
        has_permit = bool(clean_text(record.get("Permit No.")))
        score = (1 if has_paid else 0, 1 if has_permit else 0)

        if or_number:
            existing_score, _existing = by_or.get(or_number, ((-1, -1), None))
            if score > existing_score:
                by_or[or_number] = (score, record)
        if business_id:
            existing_score, _existing = by_business_id.get(business_id, ((-1, -1), None))
            if score > existing_score:
                by_business_id[business_id] = (score, record)

    return (
        {or_number: record for or_number, (_score, record) in by_or.items()},
        {business_id: record for business_id, (_score, record) in by_business_id.items()},
    )


def tax_on_business_category(business_nature, business_line):
    nature_text = clean_text(business_nature).lower()
    line_text = clean_text(business_line).lower()
    text = f"{nature_text} {line_text}"
    if any(keyword in text for keyword in ("bank", "financial", "lending", "pawn", "money", "remittance", "insurance")):
        return "Banks & Other Financial Int."
    if any(keyword in text for keyword in ("manufactur", "baking", "bakery", "milling", "printing", "processed")):
        return "Manufacturing"
    if any(keyword in line_text for keyword in ("wholesale", "distributor", "distribution")):
        return "Distributor"
    if any(keyword in line_text for keyword in ("retail", "store", "sari-sari", "pharmacy", "hardware", "convenience")):
        return "Retailing"
    if "wholesale and retail trade" in nature_text:
        return "Retailing"
    return "Other Business Tax"


def fetch_tax_on_business_summary(date_from, date_to):
    abstract_path = find_business_permit_workbook("ABSTRACT_OF_GENERAL_COLLECTION-BPLS*.xlsx")
    establishment_path = find_business_permit_workbook("BUSINESS_ESTABLISHMENT-BPLS*.xlsx")
    abstract_records = load_sheet_records_with_header(abstract_path, 7)
    establishment_records = load_sheet_records(establishment_path)
    by_or, by_business_id = business_establishment_match_lookup(establishment_records)
    start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
    end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
    category_order = [
        "Manufacturing",
        "Distributor",
        "Retailing",
        "Banks & Other Financial Int.",
        "Other Business Tax",
        "Fines & Penalties",
    ]
    summary = {
        category: {"business_tax": Decimal("0"), "surcharge": Decimal("0")}
        for category in category_order
    }

    for record in abstract_records:
        or_date = parse_excel_date(record.get("O.R. Date"))
        if or_date is None or not (start_date <= or_date <= end_date):
            continue
        business_tax = decimal_value(record.get("Business Tax"))
        surcharge = decimal_value(record.get("Surcharge"))
        if business_tax == 0 and surcharge == 0:
            continue

        or_number = clean_text(record.get("O.R. Number"))
        business_id = clean_text(record.get("Business Identification Number"))
        establishment = by_or.get(or_number) or by_business_id.get(business_id) or {}
        category = tax_on_business_category(
            establishment.get("Business Nature"),
            establishment.get("Business Line"),
        )

        if business_tax:
            summary[category]["business_tax"] += business_tax
        if surcharge:
            summary["Fines & Penalties"]["surcharge"] += surcharge

    rows = []
    for category in category_order:
        business_tax = summary[category]["business_tax"]
        surcharge = summary[category]["surcharge"]
        rows.append({
            "category": category,
            "business_tax": business_tax,
            "surcharge": surcharge,
            "total": business_tax + surcharge,
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
    elif number == 23:
        rows = fetch_rpt_summary(date_from, date_to)
    elif number == 27:
        authority = authoritative_rpt_sharing(date_from, date_to)
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
            "template_cells": authority["template_cells"],
            "share_panels": {
                "BSC": build_sharing_panel_rows(authority, "BSC"),
                "SEF": build_sharing_panel_rows(authority, "SEF"),
            },
        }
    elif number == 28:
        authority = authoritative_rpt_sharing(date_from, date_to)
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
            "template_cells": authority["template_cells"],
            "share_panels": {
                "BSC": build_sharing_panel_rows(authority, "BSC"),
                "SEF": build_sharing_panel_rows(authority, "SEF"),
            },
            "provincial_coding": build_provincial_coding_preview(date_from, date_to),
        }
    elif number == 31:
        rows = fetch_full_report_collections(date_from, date_to)
        return {
            "ok": True,
            "mode": "read_only_report_preview",
            "report_number": number,
            "date_from": date_from,
            "date_to": date_to,
            "columns": ["date", "ctc", "rpt", "gf_tf", "due_from", "rcd_total"],
            "rows": rows,
        }
    elif number == 33:
        rows = fetch_tax_on_business_summary(date_from, date_to)
        return {
            "ok": True,
            "mode": "read_only_report_preview",
            "report_number": number,
            "date_from": date_from,
            "date_to": date_to,
            "columns": ["category", "business_tax", "surcharge", "total"],
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
