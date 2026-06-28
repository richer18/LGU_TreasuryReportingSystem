import argparse
import json
from datetime import date, datetime
from decimal import Decimal

from firebird_probe import connect, resolve_db_path


TRUST_ABSTRACT_NAMES = {
    "Building Permit Fee",
    "Electrical Permit Fee",
    "Zoning Fee",
    "Livestock",
    "Diving Fee",
}

PAID_STATUS_CODES = {"CNL", "CAN", "CNC", "CANCEL", "CANCELLED", "VOID", "VOI"}

COLLECTOR_ALIASES = {
    "iris": "angelique",
    "iris arbolado": "angelique",
    "angelique iris": "angelique",
}


def paid_payment_filter(alias="p"):
    return (
        f"AND COALESCE({alias}.VOID_BV, 0) = 0 "
        f"AND COALESCE(TRIM({alias}.STATUS_CT), '') NOT IN "
        "('CNL', 'CAN', 'CNC', 'CANCEL', 'CANCELLED', 'VOID', 'VOI')"
    )


def normalize_collector(value):
    collector = (value or "").strip()
    if not collector:
        return ""
    return COLLECTOR_ALIASES.get(collector.lower(), collector)


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


def one(cursor):
    result = rows(cursor)
    return result[0] if result else {}


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


def source_category(source_name):
    if source_name in {
        "Manufacturing",
        "Distributor",
        "Retailing",
        "Banks & Other Financial Int.",
        "Other Business Tax",
    }:
        return "Tax on Business"
    if source_name in {
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
    }:
        return "Regulatory Fees"
    if source_name in {
        "Water Fees",
        "Market Stall Fee",
        "Slaughterhouse Fee",
        "Rent of Equipment",
        "Cockpit Share",
        "Sultadas",
    }:
        return "Receipts from Economic Enterprises"
    if source_name in {
        "Registration of Birth",
        "Marriage Fees",
        "Burial Fees",
        "Correction of Entry",
        "Sale of Agri. Prod.",
        "Sale of Acc. Forms",
        "Doc Stamp Tax",
        "Secretary Fees",
        "Med./Lab. Fees",
        "Garbage Fees",
    }:
        return "Service/User Charges"
    return "Miscellaneous"


def date_params(args):
    return [args.date_from, args.date_to]


def collection_status(row):
    status_code = (row.get("payment_status_code") or "").strip().upper()
    status_description = (row.get("payment_status_description") or "").strip().upper()
    is_void = int(row.get("void_bv") or 0) == 1

    if is_void or status_code in {"VOID", "VOI"} or "VOID" in status_description:
        return "Void"
    if status_code in PAID_STATUS_CODES or "CANCEL" in status_description:
        return "Cancelled"
    return "Paid"


def fetch_general_details(cursor, args, include_void=False):
    status_filter = "" if include_void else paid_payment_filter("p")
    fund_scope = getattr(args, "fund_scope", "general")

    cursor.execute(
        f"""
        SELECT
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS collection_date,
            TRIM(p.RECEIPTNO) AS receipt_no,
            TRIM(p.PAIDBY) AS taxpayer,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS collector,
            TRIM(p.AFTYPE) AS receipt_type,
            TRIM(p.RCDNUMBER) AS rcd_number,
            TRIM(p.PAYGROUP_CT) AS paygroup,
            COALESCE(p.VOID_BV, 0) AS void_bv,
            TRIM(p.STATUS_CT) AS payment_status_code,
            COALESCE(TRIM(st.DESCRIPTION), TRIM(p.STATUS_CT), '') AS payment_status_description,
            pd.PAYMENTDETAIL_ID,
            TRIM(pd.ITAXTYPE_CT) AS source_code,
            TRIM(pd.STATUS_CT) AS detail_status_code,
            COALESCE(TRIM(it.DESCRIPTION), TRIM(pd.ITAXTYPE_CT), 'UNSPECIFIED') AS description,
            TRIM(opr.DESCRIPTION) AS child_description,
            pd.SOURCEID AS source_id,
            TRIM(pd.SOURCE_CT) AS source_ct,
            pd.AMOUNTPAID AS amount
        FROM PAYMENT p
        JOIN PAYMENTDETAIL pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN T_ITAXTYPE it ON it.CODE = pd.ITAXTYPE_CT
        LEFT JOIN T_OTHERPAYMENTRATE opr ON opr.OPRATE_ID = pd.SOURCEID
        LEFT JOIN T_STATUS st ON st.CODE = p.STATUS_CT
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {status_filter}
          AND COALESCE(TRIM(p.PAYGROUP_CT), '') <> 'RPT'
        ORDER BY CAST(p.PAYMENTDATE AS DATE), TRIM(p.RECEIPTNO), p.PAYMENT_ID, pd.RECEIPTITEMORDER
        """,
        date_params(args),
    )
    details = []
    for row in rows(cursor):
        source_name = classify_summary_source(row["source_code"], row["source_id"], row["source_ct"])
        if not source_name:
            continue

        if fund_scope == "trust":
            if source_name not in TRUST_ABSTRACT_NAMES:
                continue
        elif fund_scope == "community_tax":
            if source_name != "Community Tax":
                continue
        else:
            if source_name == "Community Tax" or source_name in TRUST_ABSTRACT_NAMES:
                continue

        row["source_name"] = source_name
        row["parent_description"] = source_name
        row["category"] = source_category(source_name)
        row["collection_status"] = collection_status(row)
        details.append(row)
    return details


def fetch_rpt_details(cursor, args):
    cursor.execute(
        f"""
        SELECT
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS collection_date,
            TRIM(p.RECEIPTNO) AS receipt_no,
            TRIM(p.PAIDBY) AS taxpayer,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS collector,
            COALESCE(NULLIF(TRIM(p.AFTYPE), ''), 'AF 56') AS receipt_type,
            TRIM(p.RCDNUMBER) AS rcd_number,
            TRIM(p.PAYGROUP_CT) AS paygroup,
            COALESCE(p.VOID_BV, 0) AS void_bv,
            TRIM(p.STATUS_CT) AS payment_status_code,
            COALESCE(TRIM(st.DESCRIPTION), TRIM(p.STATUS_CT), '') AS payment_status_description,
            p.PAYMENT_ID AS PAYMENTDETAIL_ID,
            'RPT' AS source_code,
            '' AS detail_status_code,
            'Real Property Tax' AS description,
            'Real Property Tax' AS child_description,
            NULL AS source_id,
            'RPT' AS source_ct,
            COALESCE(rpt_totals.RPT_TOTAL, p.AMOUNT, 0) AS amount
        FROM PAYMENT p
        LEFT JOIN (
            SELECT PAYMENT_ID, SUM(AMOUNT) AS RPT_TOTAL
            FROM PAYMENTCLASSDETAIL
            GROUP BY PAYMENT_ID
        ) rpt_totals ON rpt_totals.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN T_STATUS st ON st.CODE = p.STATUS_CT
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {paid_payment_filter("p")}
          AND COALESCE(TRIM(p.PAYGROUP_CT), '') = 'RPT'
        ORDER BY CAST(p.PAYMENTDATE AS DATE), TRIM(p.RECEIPTNO), p.PAYMENT_ID
        """,
        date_params(args),
    )
    details = []
    for row in rows(cursor):
        row["source_name"] = "Real Property Tax"
        row["parent_description"] = "Real Property Tax"
        row["category"] = "Real Property Tax"
        row["collection_status"] = collection_status(row)
        details.append(row)
    return details


def fetch_details(cursor, args, include_void=False):
    if getattr(args, "fund_scope", "general") == "rpt":
        return fetch_rpt_details(cursor, args)
    return fetch_general_details(cursor, args, include_void=include_void)


def payment_groups(details):
    grouped = {}
    for row in details:
        group_key = (
            row["collection_date"],
            row["receipt_no"],
            row["taxpayer"],
            row["collector"],
        )
        payment = grouped.setdefault(
            group_key,
            {
                "payment_id": row["payment_id"],
                "payment_ids": [],
                "collection_date": row["collection_date"],
                "receipt_no": row["receipt_no"],
                "taxpayer": row["taxpayer"],
                "collector": row["collector"],
                "receipt_type": row["receipt_type"] or row["paygroup"],
                "receipt_types": [],
                "rcd_number": row["rcd_number"],
                "collection_status": row.get("collection_status") or "Paid",
                "collection_statuses": [],
                "void_bv": row.get("void_bv") or 0,
                "payment_status_code": row.get("payment_status_code"),
                "payment_status_description": row.get("payment_status_description"),
                "line_count": 0,
                "total_amount": 0.0,
            },
        )
        if row["payment_id"] not in payment["payment_ids"]:
            payment["payment_ids"].append(row["payment_id"])
        receipt_type = row["receipt_type"] or row["paygroup"]
        if receipt_type and receipt_type not in payment["receipt_types"]:
            payment["receipt_types"].append(receipt_type)
            payment["receipt_type"] = " / ".join(sorted(payment["receipt_types"]))
        status = row.get("collection_status") or "Paid"
        if status not in payment["collection_statuses"]:
            payment["collection_statuses"].append(status)
            if len(payment["collection_statuses"]) > 1:
                payment["collection_status"] = "Mixed"
            else:
                payment["collection_status"] = status
        payment["line_count"] += 1
        payment["total_amount"] += float(row["amount"] or 0)
    return list(grouped.values())


def payment_details(cursor, args):
    if getattr(args, "fund_scope", "general") == "rpt":
        details = fetch_rpt_details(cursor, args)
        if args.receipt_no:
            return [row for row in details if str(row.get("receipt_no") or "") == str(args.receipt_no)]
        return [row for row in details if str(row.get("payment_id") or "") == str(args.payment_id)]

    params = []
    filters = []

    if args.receipt_no:
        filters.append("TRIM(p.RECEIPTNO) = ?")
        params.append(args.receipt_no)
        if args.taxpayer:
            filters.append("TRIM(p.PAIDBY) = ?")
            params.append(args.taxpayer)
        if args.collector:
            filters.append("COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') = ?")
            params.append(normalize_collector(args.collector))
    else:
        filters.append("p.PAYMENT_ID = ?")
        params.append(args.payment_id)

    params.extend([args.date_from, args.date_to])

    cursor.execute(
        f"""
        SELECT
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS collection_date,
            TRIM(p.RECEIPTNO) AS receipt_no,
            TRIM(p.PAIDBY) AS taxpayer,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS collector,
            TRIM(p.AFTYPE) AS receipt_type,
            TRIM(p.RCDNUMBER) AS rcd_number,
            TRIM(p.PAYGROUP_CT) AS paygroup,
            pd.PAYMENTDETAIL_ID,
            TRIM(pd.ITAXTYPE_CT) AS source_code,
            COALESCE(TRIM(it.DESCRIPTION), TRIM(pd.ITAXTYPE_CT), 'UNSPECIFIED') AS raw_description,
            TRIM(opr.DESCRIPTION) AS child_description,
            pd.SOURCEID AS source_id,
            TRIM(pd.SOURCE_CT) AS source_ct,
            pd.AMOUNTPAID AS amount
        FROM PAYMENT p
        JOIN PAYMENTDETAIL pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN T_ITAXTYPE it ON it.CODE = pd.ITAXTYPE_CT
        LEFT JOIN T_OTHERPAYMENTRATE opr ON opr.OPRATE_ID = pd.SOURCEID
        WHERE {" AND ".join(filters)}
          AND p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {paid_payment_filter("p")}
          AND COALESCE(TRIM(p.PAYGROUP_CT), '') <> 'RPT'
        ORDER BY TRIM(p.AFTYPE), pd.RECEIPTITEMORDER, pd.PAYMENTDETAIL_ID
        """,
        params,
    )
    details = []
    for row in rows(cursor):
        source_name = classify_summary_source(row["source_code"], row["source_id"], row["source_ct"])
        if not source_name:
            continue

        fund_scope = getattr(args, "fund_scope", "general")
        if fund_scope == "trust":
            if source_name not in TRUST_ABSTRACT_NAMES:
                continue
        elif fund_scope == "community_tax":
            if source_name != "Community Tax":
                continue
        else:
            if source_name == "Community Tax" or source_name in TRUST_ABSTRACT_NAMES:
                continue

        row["source_name"] = source_name
        row["parent_description"] = source_name
        row["description"] = source_name
        row["category"] = source_category(source_name)
        details.append(row)
    return details


def aggregate(details, key):
    grouped = {}
    for row in details:
        group_key = row[key]
        item = grouped.setdefault(group_key, {key: group_key, "receipt_ids": set(), "total_amount": 0.0})
        item["receipt_ids"].add(row["payment_id"])
        item["total_amount"] += float(row["amount"] or 0)
    result = []
    for item in grouped.values():
        item["receipt_count"] = len(item.pop("receipt_ids"))
        result.append(item)
    result.sort(key=lambda item: item["total_amount"], reverse=True)
    return result


def report21_collector_name_sql(alias="p"):
    return f"""
        CASE
            WHEN NULLIF(TRIM({alias}.COLLECTOR), '') IS NULL THEN 'Unassigned / Unknown'
            ELSE TRIM({alias}.COLLECTOR)
        END
    """


def report21_collector_summary(cursor, args):
    grouped = {}
    collector_sql = report21_collector_name_sql("p")

    def add_amount(collector, payment_id, amount):
        collector = collector or "Unassigned / Unknown"
        item = grouped.setdefault(
            collector,
            {"collector": collector, "receipt_ids": set(), "total_amount": 0.0},
        )
        item["receipt_ids"].add(payment_id)
        item["total_amount"] += float(amount or 0)

    cursor.execute(
        f"""
        SELECT
            {collector_sql} AS collector,
            p.PAYMENT_ID,
            pd.ITAXTYPE_CT,
            pd.SOURCEID,
            pd.SOURCE_CT,
            SUM(pd.AMOUNTPAID) AS amount
        FROM PAYMENT p
        JOIN PAYMENTDETAIL pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {paid_payment_filter("p")}
          AND COALESCE(TRIM(p.PAYGROUP_CT), '') <> 'RPT'
        GROUP BY {collector_sql}, p.PAYMENT_ID, pd.ITAXTYPE_CT, pd.SOURCEID, pd.SOURCE_CT
        """,
        date_params(args),
    )

    for row in rows(cursor):
        source = classify_summary_source(row["itaxtype_ct"], row["sourceid"], row["source_ct"])
        if source:
            add_amount(row["collector"], row["payment_id"], row["amount"])

    cursor.execute(
        f"""
        SELECT
            {collector_sql} AS collector,
            p.PAYMENT_ID,
            SUM(pcd.AMOUNT) AS amount
        FROM PAYMENT p
        JOIN PAYMENTCLASSDETAIL pcd ON pcd.PAYMENT_ID = p.PAYMENT_ID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          AND COALESCE(TRIM(p.PAYGROUP_CT), '') = 'RPT'
          {paid_payment_filter("p")}
          AND COALESCE(pcd.CANCELLED_BV, 0) = 0
        GROUP BY {collector_sql}, p.PAYMENT_ID
        """,
        date_params(args),
    )

    for row in rows(cursor):
        add_amount(row["collector"], row["payment_id"], row["amount"])

    result = []
    for item in grouped.values():
        item["receipt_count"] = len(item.pop("receipt_ids"))
        item["total_amount"] = round(item["total_amount"], 4)
        result.append(item)
    result.sort(key=lambda item: item["total_amount"], reverse=True)
    return result


def summary(cursor, args):
    details = fetch_details(cursor, args)
    payments = payment_groups(details)
    collectors_seen = {row["collector"] for row in payments}
    receipt_values = [row["receipt_no"] for row in payments if row.get("receipt_no")]

    return {
        "date_from": args.date_from,
        "date_to": args.date_to,
        "totals": {
            "receipt_count": len(payments),
            "collector_count": len(collectors_seen),
            "receipt_from": min(receipt_values) if receipt_values else None,
            "receipt_to": max(receipt_values) if receipt_values else None,
            "total_amount": sum(float(row["total_amount"] or 0) for row in payments),
        },
        "categories": [
            {
                "category": row["category"],
                "receipt_count": row["receipt_count"],
                "total_amount": row["total_amount"],
            }
            for row in aggregate(details, "category")
        ],
    }


def collections(cursor, args):
    payments = payment_groups(fetch_details(cursor, args))
    if args.collector:
        collector = normalize_collector(args.collector)
        payments = [row for row in payments if (row["collector"] or "").upper() == collector.upper()]
    if args.receipt_from:
        payments = [row for row in payments if str(row.get("receipt_no") or "") >= args.receipt_from]
    if args.receipt_to:
        payments = [row for row in payments if str(row.get("receipt_no") or "") <= args.receipt_to]
    payments.sort(key=lambda row: (row["collection_date"], str(row.get("receipt_no") or "")))
    return payments[: args.limit]


def receipt_report(cursor, args):
    payments = payment_groups(fetch_details(cursor, args, include_void=True))
    if args.collector:
        collector = normalize_collector(args.collector)
        payments = [row for row in payments if (row["collector"] or "").upper() == collector.upper()]
    if args.receipt_from:
        payments = [row for row in payments if str(row.get("receipt_no") or "") >= args.receipt_from]
    if args.receipt_to:
        payments = [row for row in payments if str(row.get("receipt_no") or "") <= args.receipt_to]
    payments.sort(key=lambda row: (row["collection_date"], str(row.get("receipt_no") or "")))
    return payments[: args.limit]


def daily(cursor, args):
    grouped = {}
    details = fetch_details(cursor, args)
    payments = payment_groups(details)
    for payment in payments:
        item = grouped.setdefault(
            payment["collection_date"],
            {
                "collection_date": payment["collection_date"],
                "receipt_ids": set(),
                "receipts": [],
                "tax_on_business": 0.0,
                "regulatory_fees": 0.0,
                "receipts_from_economic_enterprises": 0.0,
                "service_user_charges": 0.0,
                "miscellaneous": 0.0,
                "total_amount": 0.0,
            },
        )
        item["receipt_ids"].add(payment["payment_id"])
        if payment["receipt_no"]:
            item["receipts"].append(payment["receipt_no"])
        item["total_amount"] += payment["total_amount"]

    for detail in details:
        item = grouped.setdefault(
            detail["collection_date"],
            {
                "collection_date": detail["collection_date"],
                "receipt_ids": set(),
                "receipts": [],
                "tax_on_business": 0.0,
                "regulatory_fees": 0.0,
                "receipts_from_economic_enterprises": 0.0,
                "service_user_charges": 0.0,
                "miscellaneous": 0.0,
                "total_amount": 0.0,
            },
        )
        amount = float(detail["amount"] or 0)
        category = detail["category"]
        if category == "Tax on Business":
            item["tax_on_business"] += amount
        elif category == "Regulatory Fees":
            item["regulatory_fees"] += amount
        elif category == "Receipts from Economic Enterprises":
            item["receipts_from_economic_enterprises"] += amount
        elif category == "Service/User Charges":
            item["service_user_charges"] += amount
        else:
            item["miscellaneous"] += amount

    result = []
    for item in grouped.values():
        receipts = item.pop("receipts")
        item["receipt_count"] = len(item.pop("receipt_ids"))
        item["receipt_from"] = min(receipts) if receipts else None
        item["receipt_to"] = max(receipts) if receipts else None
        result.append(item)
    result.sort(key=lambda row: row["collection_date"])
    return result


def sources(cursor, args):
    grouped = {}
    for row in fetch_details(cursor, args):
        key = (row["source_name"], row["source_code"], row["description"], row["category"])
        item = grouped.setdefault(
            key,
            {
                "source_name": row["source_name"],
                "source_code": row["source_code"],
                "description": row["source_name"],
                "raw_description": row["description"],
                "category": row["category"],
                "receipt_ids": set(),
                "total_amount": 0.0,
            },
        )
        item["receipt_ids"].add(row["payment_id"])
        item["total_amount"] += float(row["amount"] or 0)
    result = []
    for item in grouped.values():
        item["receipt_count"] = len(item.pop("receipt_ids"))
        result.append(item)
    result.sort(key=lambda row: row["total_amount"], reverse=True)
    return result


def collectors(cursor, args):
    if getattr(args, "fund_scope", "general") == "report21":
        return report21_collector_summary(cursor, args)

    return [
        {"collector": row["collector"], "receipt_count": row["receipt_count"], "total_amount": row["total_amount"]}
        for row in aggregate(fetch_details(cursor, args), "collector")
    ]


def dive_tickets(cursor, args):
    cursor.execute(
        f"""
        SELECT
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS collection_date,
            TRIM(p.RECEIPTNO) AS receipt_no,
            TRIM(p.PAIDBY) AS taxpayer,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), TRIM(p.USERID), 'UNSPECIFIED') AS collector,
            TRIM(p.AFTYPE) AS receipt_type,
            TRIM(pd.ITAXTYPE_CT) AS source_code,
            TRIM(opr.DESCRIPTION) AS child_description,
            pd.SOURCEID AS source_id,
            TRIM(pd.SOURCE_CT) AS source_ct,
            pd.AMOUNTPAID AS amount
        FROM PAYMENT p
        JOIN PAYMENTDETAIL pd ON pd.PAYMENT_ID = p.PAYMENT_ID
        LEFT JOIN T_OTHERPAYMENTRATE opr ON opr.OPRATE_ID = pd.SOURCEID
        WHERE p.PAYMENTDATE >= CAST(? AS DATE)
          AND p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))
          {paid_payment_filter("p")}
          AND COALESCE(TRIM(p.PAYGROUP_CT), '') <> 'RPT'
        ORDER BY CAST(p.PAYMENTDATE AS DATE), TRIM(p.RECEIPTNO), p.PAYMENT_ID, pd.RECEIPTITEMORDER
        """,
        date_params(args),
    )

    buyer_totals = {}
    collector_totals = {}
    receipt_ids = set()
    rows_out = []
    total_amount = 0.0

    for row in rows(cursor):
        source_name = classify_summary_source(row["source_code"], row["source_id"], row["source_ct"])
        if source_name != "Diving Fee":
            continue

        amount = float(row["amount"] or 0)
        total_amount += amount
        receipt_ids.add(row["payment_id"])
        rows_out.append(
            {
                "payment_id": row["payment_id"],
                "collection_date": row["collection_date"],
                "receipt_no": row["receipt_no"],
                "taxpayer": row["taxpayer"] or "UNSPECIFIED",
                "collector": row["collector"],
                "description": row["child_description"] or "Diving Fee",
                "amount": amount,
            }
        )

        buyer = buyer_totals.setdefault(
            row["taxpayer"] or "UNSPECIFIED",
            {"taxpayer": row["taxpayer"] or "UNSPECIFIED", "receipt_ids": set(), "total_amount": 0.0, "line_count": 0},
        )
        buyer["receipt_ids"].add(row["payment_id"])
        buyer["total_amount"] += amount
        buyer["line_count"] += 1

        collector = collector_totals.setdefault(
            row["collector"],
            {"collector": row["collector"], "receipt_ids": set(), "total_amount": 0.0},
        )
        collector["receipt_ids"].add(row["payment_id"])
        collector["total_amount"] += amount

    top_buyers = []
    for buyer in buyer_totals.values():
        buyer["receipt_count"] = len(buyer.pop("receipt_ids"))
        top_buyers.append(buyer)
    top_buyers.sort(key=lambda item: (item["total_amount"], item["receipt_count"]), reverse=True)

    collectors = []
    for collector in collector_totals.values():
        collector["receipt_count"] = len(collector.pop("receipt_ids"))
        collectors.append(collector)
    collectors.sort(key=lambda item: item["total_amount"], reverse=True)

    return {
        "date_from": args.date_from,
        "date_to": args.date_to,
        "total_amount": total_amount,
        "receipt_count": len(receipt_ids),
        "buyer_count": len(top_buyers),
        "top_buyers": top_buyers[:3],
        "collectors": collectors,
        "rows": rows_out[: args.limit],
    }


def run_report(report, cursor, args):
    if report == "summary":
        return summary(cursor, args)
    if report == "collections":
        return collections(cursor, args)
    if report == "daily":
        return daily(cursor, args)
    if report == "sources":
        return sources(cursor, args)
    if report == "collectors":
        return collectors(cursor, args)
    if report == "receipt-report":
        return receipt_report(cursor, args)
    if report == "payment-details":
        return payment_details(cursor, args)
    if report == "dive-tickets":
        return dive_tickets(cursor, args)
    raise ValueError(f"Unsupported report: {report}")


def main():
    parser = argparse.ArgumentParser(description="Read-only General Fund Firebird reports.")
    parser.add_argument(
        "report",
        choices=[
            "summary",
            "collections",
            "daily",
            "sources",
            "collectors",
            "receipt-report",
            "payment-details",
            "dive-tickets",
        ],
    )
    parser.add_argument("--date-from", required=True)
    parser.add_argument("--date-to", required=True)
    parser.add_argument("--collector")
    parser.add_argument("--receipt-from")
    parser.add_argument("--receipt-to")
    parser.add_argument("--receipt-no")
    parser.add_argument("--taxpayer")
    parser.add_argument("--payment-id")
    parser.add_argument("--fund-scope", choices=["general", "trust", "community_tax", "rpt", "report21"], default="general")
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()

    if args.report == "payment-details" and not args.payment_id and not args.receipt_no:
        parser.error("--payment-id or --receipt-no is required for payment-details")

    payload = {
        "ok": False,
        "mode": "read_only_general_fund",
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
        payload.update(
            {
                "ok": False,
                "error": str(exc),
                "error_type": exc.__class__.__name__,
            }
        )

    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
