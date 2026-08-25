#!/usr/bin/env python3
"""Read-only Real Property Tax Payment Card lookup."""

import argparse
import json
import os
import sys
from datetime import date, datetime
from decimal import Decimal

from firebird_probe import connection_mode, open_odbc_connection


def value(item):
    if isinstance(item, Decimal):
        return float(item)
    if isinstance(item, (date, datetime)):
        return item.isoformat()
    return item.strip() if isinstance(item, str) else item


def mapped(cursor, records):
    names = [column[0].strip().lower() for column in cursor.description]
    return [{name: value(item) for name, item in zip(names, record)} for record in records]


def initials(user_id, collector):
    source = (user_id or collector or "").replace(".", " ").replace("_", " ").strip()
    words = source.split()
    return (words[0][:3] if len(words) == 1 else "".join(word[0] for word in words[:4])).upper()


def find_matches(cursor, args):
    filters = ["COALESCE(a.ENDED_BV, 0) = 0", "a.CANCELLATIONDATE IS NULL"]
    params = []
    pairs = [
        (args.taxtrans_id, "a.TAXTRANS_ID = ?"),
        (args.tax_declaration, "TRIM(a.TDNO) CONTAINING ?"),
        (args.barangay_code, "p.BARANGAY_CT = ?"),
        (args.tct_number, "TRIM(p.CERTIFICATETITLENO) CONTAINING ?"),
        (args.lot_number, "COALESCE(NULLIF(TRIM(p.LOTNO), ''), TRIM(p.CADASTRALLOTNO)) CONTAINING ?"),
    ]
    for item, expression in pairs:
        if item:
            filters.append(expression)
            params.append(item.strip())

    if args.owner:
        filters.append(
            "EXISTS (SELECT 1 FROM PROPERTYOWNER ox JOIN TAXPAYER tx ON tx.LOCAL_TIN = ox.LOCAL_TIN "
            "WHERE ox.PROP_ID = p.PROP_ID AND TRIM(tx.OWNERNAME) CONTAINING ?)"
        )
        params.append(args.owner.strip())

    limit = max(1, min(args.limit, 50))
    sql = f"""
        SELECT FIRST {limit}
            a.TAXTRANS_ID,
            a.PROP_ID,
            TRIM(a.TDNO) AS TAX_DECLARATION_NUMBER,
            TRIM(p.PINNO) AS PROPERTY_INDEX_NUMBER,
            TRIM(p.CERTIFICATETITLENO) AS TCT_NUMBER,
            COALESCE(NULLIF(TRIM(p.LOTNO), ''), TRIM(p.CADASTRALLOTNO)) AS LOT_NUMBER,
            TRIM(p.BARANGAY_CT) AS BARANGAY_CODE,
            (SELECT FIRST 1 TRIM(b.DESCRIPTION) FROM T_BARANGAY b
             WHERE b.CODE = p.BARANGAY_CT AND b.MUNICIPAL_ID = p.MUNICIPAL_ID
               AND b.PROVINCE_CT = p.PROVINCE_CT ORDER BY b.DESCRIPTION) AS BARANGAY,
            (SELECT FIRST 1 TRIM(t.OWNERNAME) FROM PROPERTYOWNER o
             JOIN TAXPAYER t ON t.LOCAL_TIN = o.LOCAL_TIN WHERE o.PROP_ID = p.PROP_ID
             ORDER BY o.VALIDUNTIL DESC NULLS FIRST, o.VALIDFROM DESC) AS OWNER_NAME
        FROM RPTASSESSMENT a
        JOIN PROPERTY p ON p.PROP_ID = a.PROP_ID
        WHERE {' AND '.join(filters)}
        ORDER BY OWNER_NAME, a.TDNO
    """
    cursor.execute(sql, params)
    return mapped(cursor, cursor.fetchall())


def property_record(cursor, taxtrans_id):
    cursor.execute(
        """
        SELECT
            a.TAXTRANS_ID, a.PROP_ID, TRIM(a.TDNO) AS TAX_DECLARATION_NUMBER,
            TRIM(p.PINNO) AS PROPERTY_INDEX_NUMBER,
            TRIM(p.CERTIFICATETITLENO) AS TCT_NUMBER,
            COALESCE(NULLIF(TRIM(p.LOTNO), ''), TRIM(p.CADASTRALLOTNO)) AS LOT_NUMBER,
            TRIM(p.BARANGAY_CT) AS BARANGAY_CODE,
            (SELECT FIRST 1 TRIM(b.DESCRIPTION) FROM T_BARANGAY b
             WHERE b.CODE = p.BARANGAY_CT AND b.MUNICIPAL_ID = p.MUNICIPAL_ID
               AND b.PROVINCE_CT = p.PROVINCE_CT ORDER BY b.DESCRIPTION) AS BARANGAY,
            COALESCE((SELECT SUM(COALESCE(l.AREA, 0)) FROM RPTLANDAPPRAISAL l
                      WHERE l.TAXTRANS_ID = a.TAXTRANS_ID AND COALESCE(l.TAXABILITY_BV, 1) = 1), 0) AS AREA,
            COALESCE((SELECT SUM(CASE WHEN d.PROPERTYKIND_CT = 'L' THEN COALESCE(d.ASSESSEDVALUE, 0) ELSE 0 END)
                      FROM RPTASSESSMENTDETAIL d WHERE d.TAXTRANS_ID = a.TAXTRANS_ID
                        AND COALESCE(d.TAXABILITY_BV, 1) = 1), 0) AS LAND_ASSESSED_VALUE,
            COALESCE((SELECT SUM(CASE WHEN COALESCE(d.PROPERTYKIND_CT, '') <> 'L' THEN COALESCE(d.ASSESSEDVALUE, 0) ELSE 0 END)
                      FROM RPTASSESSMENTDETAIL d WHERE d.TAXTRANS_ID = a.TAXTRANS_ID
                        AND COALESCE(d.TAXABILITY_BV, 1) = 1), 0) AS IMPROVEMENT_ASSESSED_VALUE,
            COALESCE((SELECT SUM(COALESCE(d.ASSESSEDVALUE, 0)) FROM RPTASSESSMENTDETAIL d
                      WHERE d.TAXTRANS_ID = a.TAXTRANS_ID AND COALESCE(d.TAXABILITY_BV, 1) = 1), 0) AS TOTAL_ASSESSED_VALUE
        FROM RPTASSESSMENT a JOIN PROPERTY p ON p.PROP_ID = a.PROP_ID
        WHERE a.TAXTRANS_ID = ?
        """,
        [taxtrans_id],
    )
    rows = mapped(cursor, cursor.fetchall())
    return rows[0] if rows else None


def ownership(cursor, prop_id):
    cursor.execute(
        """
        WITH RECURSIVE chain(PROP_ID, DEPTH) AS (
            SELECT PROP_ID, 0 FROM PROPERTY WHERE PROP_ID = ?
            UNION ALL
            SELECT old.PROP_ID, chain.DEPTH + 1 FROM chain
            JOIN PROPERTY current_property ON current_property.PROP_ID = chain.PROP_ID
            JOIN PROPERTY old ON old.PROP_ID = current_property.PREVPROP_ID
            WHERE chain.DEPTH < 25 AND old.PROP_ID <> chain.PROP_ID
        )
        SELECT FIRST 12 TRIM(t.OWNERNAME) AS NAME, TRIM(t.OWNERADDRESS) AS ADDRESS,
               o.VALIDFROM AS DATE_OF_TRANSFER
        FROM chain JOIN PROPERTYOWNER o ON o.PROP_ID = chain.PROP_ID
        JOIN TAXPAYER t ON t.LOCAL_TIN = o.LOCAL_TIN
        ORDER BY o.VALIDFROM DESC NULLS LAST, t.OWNERNAME
        """,
        [prop_id],
    )
    return mapped(cursor, cursor.fetchall())


def payments(cursor, taxtrans_id, args):
    filters = [
        "p.PAYGROUP_CT = 'RPT'",
        "COALESCE(p.VOID_BV, 0) = 0",
        "COALESCE(TRIM(p.STATUS_CT), '') NOT IN ('CNL','CAN','CNC','CANCEL','CANCELLED','VOID','VOI')",
        "COALESCE(d.CANCELLED_BV, 0) = 0",
    ]
    params = [taxtrans_id]
    if args.tax_year:
        filters.append("d.TAXYEAR = ?")
        params.append(args.tax_year)
    if args.date_from:
        filters.append("p.PAYMENTDATE >= CAST(? AS DATE)")
        params.append(args.date_from)
    if args.date_to:
        filters.append("p.PAYMENTDATE < DATEADD(1 DAY TO CAST(? AS DATE))")
        params.append(args.date_to)

    cursor.execute(
        f"""
        WITH RECURSIVE chain(TAXTRANS_ID, DEPTH) AS (
            SELECT TAXTRANS_ID, 0 FROM RPTASSESSMENT WHERE TAXTRANS_ID = ?
            UNION ALL
            SELECT old.TAXTRANS_ID, chain.DEPTH + 1 FROM chain
            JOIN RPTASSESSMENT current_assessment ON current_assessment.TAXTRANS_ID = chain.TAXTRANS_ID
            JOIN RPTASSESSMENT old ON old.TAXTRANS_ID = current_assessment.PREVTAXTRANS_ID
            WHERE chain.DEPTH < 25 AND old.TAXTRANS_ID <> chain.TAXTRANS_ID
        ),
        assessed AS (
            SELECT TAXTRANS_ID,
                SUM(CASE WHEN PROPERTYKIND_CT = 'L' THEN COALESCE(ASSESSEDVALUE,0) ELSE 0 END) LAND_VALUE,
                SUM(CASE WHEN COALESCE(PROPERTYKIND_CT,'') <> 'L' THEN COALESCE(ASSESSEDVALUE,0) ELSE 0 END) IMPROVEMENT_VALUE,
                SUM(COALESCE(ASSESSEDVALUE,0)) TOTAL_VALUE
            FROM RPTASSESSMENTDETAIL WHERE COALESCE(TAXABILITY_BV,1)=1 GROUP BY TAXTRANS_ID
        )
        SELECT TRIM(a.TDNO) TAX_DECLARATION_NUMBER,
            COALESCE(v.LAND_VALUE,0) LAND_ASSESSED_VALUE,
            COALESCE(v.IMPROVEMENT_VALUE,0) IMPROVEMENT_ASSESSED_VALUE,
            COALESCE(v.TOTAL_VALUE,0) TOTAL_ASSESSED_VALUE,
            d.TAXYEAR TAX_YEAR,
            SUM(CASE WHEN d.ITAXTYPE_CT='BSC' AND d.CASETYPE_CT='REG' THEN COALESCE(d.AMOUNT,0) ELSE 0 END) BASIC_TAX,
            SUM(CASE WHEN d.ITAXTYPE_CT='SEF' AND d.CASETYPE_CT='REG' THEN COALESCE(d.AMOUNT,0) ELSE 0 END) SEF_TAX,
            SUM(CASE WHEN d.CASETYPE_CT IN ('DED','PEN') THEN COALESCE(d.AMOUNT,0) ELSE 0 END) DISCOUNT_PENALTY,
            SUM(COALESCE(d.AMOUNT,0)) TOTAL_TAX_COLLECTED,
            TRIM(p.RECEIPTNO) OFFICIAL_RECEIPT_NUMBER,
            CAST(p.PAYMENTDATE AS DATE) PAYMENT_DATE,
            TRIM(p.USERID) CLERK_USER_ID, TRIM(p.COLLECTOR) COLLECTOR
        FROM chain JOIN RPTASSESSMENT a ON a.TAXTRANS_ID=chain.TAXTRANS_ID
        JOIN PAYMENTCLASSDETAIL d ON d.TAXTRANS_ID=chain.TAXTRANS_ID
        JOIN PAYMENT p ON p.PAYMENT_ID=d.PAYMENT_ID
        LEFT JOIN assessed v ON v.TAXTRANS_ID=chain.TAXTRANS_ID
        WHERE {' AND '.join(filters)}
        GROUP BY a.TDNO,v.LAND_VALUE,v.IMPROVEMENT_VALUE,v.TOTAL_VALUE,d.TAXYEAR,
                 p.PAYMENT_ID,p.RECEIPTNO,CAST(p.PAYMENTDATE AS DATE),p.USERID,p.COLLECTOR
        ORDER BY CAST(p.PAYMENTDATE AS DATE),p.RECEIPTNO,d.TAXYEAR
        """,
        params,
    )
    rows = mapped(cursor, cursor.fetchall())
    for row in rows:
        row["clerk_initials"] = initials(row.get("clerk_user_id"), row.get("collector"))
    return rows


def delinquencies(cursor, taxtrans_id):
    as_of_date = date.today()
    cursor.execute(
        """
        WITH RECURSIVE
        roots(current_taxtrans_id, local_tin) AS (
            SELECT DISTINCT a.TAXTRANS_ID, ta.LOCAL_TIN
            FROM RPTASSESSMENT a
            JOIN TPACCOUNT ta ON ta.TAXTRANS_ID = a.TAXTRANS_ID
            WHERE a.TAXTRANS_ID = ?
              AND ta.EARMARK_CT IN ('OPN', 'PBL')
              AND (ta.CANCELLED_BV = 0 OR ta.CANCELLED_BV IS NULL)
        ),
        chain(current_taxtrans_id, local_tin, taxtrans_id, depth) AS (
            SELECT current_taxtrans_id, local_tin, current_taxtrans_id, 0
            FROM roots

            UNION ALL

            SELECT c.current_taxtrans_id, c.local_tin, previous.TAXTRANS_ID, c.depth + 1
            FROM chain c
            JOIN RPTASSESSMENT current_assessment
              ON current_assessment.TAXTRANS_ID = c.taxtrans_id
            JOIN RPTASSESSMENT previous
              ON previous.TAXTRANS_ID = current_assessment.PREVTAXTRANS_ID
            WHERE c.depth < 25
              AND previous.TAXTRANS_ID <> c.taxtrans_id
              AND EXISTS (
                  SELECT 1
                  FROM TPACCOUNT previous_ledger
                  WHERE previous_ledger.TAXTRANS_ID = previous.TAXTRANS_ID
                    AND previous_ledger.LOCAL_TIN = c.local_tin
                    AND previous_ledger.EARMARK_CT IN ('OPN', 'PBL')
                    AND previous_ledger.CANCELLED_BV <> 1
                    AND previous_ledger.CANCELLED_BV IS NOT NULL
                    AND previous_ledger.ITAXTYPE_CT IN ('BSC', 'SEF')
                    AND previous_ledger.TAXYEAR <= ?
                    AND previous_ledger.EVENTOBJECT_CT NOT IN ('PAY', 'CPA')
                    AND previous_ledger.CASETYPE_CT <> 'CPA'
              )
        ),
        ledger_by_year AS (
            SELECT
                TRIM(a.TDNO) AS TAX_DECLARATION_NUMBER,
                ta.TAXYEAR AS TAX_YEAR,
                ta.ITAXTYPE_CT,
                SUM(CASE WHEN ta.CASETYPE_CT = 'REG' THEN COALESCE(ta.DEBITAMOUNT, 0) ELSE 0 END) AS REGULAR_BALANCE,
                SUM(CASE WHEN ta.CASETYPE_CT IN ('PEN', 'DED') THEN COALESCE(ta.DEBITAMOUNT, 0) ELSE 0 END) AS PENALTY_BALANCE
            FROM chain c
            JOIN RPTASSESSMENT a ON a.TAXTRANS_ID = c.taxtrans_id
            JOIN TPACCOUNT ta
              ON ta.TAXTRANS_ID = c.taxtrans_id
             AND ta.LOCAL_TIN = c.local_tin
            WHERE ta.EARMARK_CT IN ('OPN', 'PBL')
              AND ta.TAXYEAR <= ?
              AND ta.VALUEDATE <= ?
              AND ta.EVENTOBJECT_CT NOT IN ('PAY', 'CPA')
              AND ta.CASETYPE_CT <> 'CPA'
              AND ta.CANCELLED_BV <> 1
              AND ta.CANCELLED_BV IS NOT NULL
              AND ta.ITAXTYPE_CT IN ('BSC', 'SEF')
              AND ta.CASETYPE_CT IN ('REG', 'PEN', 'DED')
            GROUP BY a.TDNO, ta.TAXYEAR, ta.ITAXTYPE_CT
        ),
        balances AS (
            SELECT
                TAX_DECLARATION_NUMBER,
                TAX_YEAR,
                SUM(CASE WHEN ITAXTYPE_CT = 'BSC' AND REGULAR_BALANCE > 0 THEN REGULAR_BALANCE ELSE 0 END) AS BASIC_TAX_DUE,
                SUM(CASE WHEN ITAXTYPE_CT = 'BSC' THEN PENALTY_BALANCE ELSE 0 END) AS BASIC_PENALTY,
                SUM(CASE WHEN ITAXTYPE_CT = 'SEF' AND REGULAR_BALANCE > 0 THEN REGULAR_BALANCE ELSE 0 END) AS SEF_DUE,
                SUM(CASE WHEN ITAXTYPE_CT = 'SEF' THEN PENALTY_BALANCE ELSE 0 END) AS SEF_PENALTY
            FROM ledger_by_year
            GROUP BY TAX_DECLARATION_NUMBER, TAX_YEAR
        )
        SELECT
            TAX_DECLARATION_NUMBER,
            TAX_YEAR,
            BASIC_TAX_DUE,
            BASIC_PENALTY,
            SEF_DUE,
            SEF_PENALTY,
            (BASIC_TAX_DUE + BASIC_PENALTY + SEF_DUE + SEF_PENALTY) AS TOTAL
        FROM balances
        WHERE (BASIC_TAX_DUE + BASIC_PENALTY + SEF_DUE + SEF_PENALTY) > 0
        ORDER BY TAX_YEAR, TAX_DECLARATION_NUMBER
        """,
        [taxtrans_id, as_of_date.year, as_of_date.year, as_of_date],
    )
    return mapped(cursor, cursor.fetchall())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--taxtrans-id", default="")
    parser.add_argument("--tax-declaration", default="")
    parser.add_argument("--owner", default="")
    parser.add_argument("--barangay-code", default="")
    parser.add_argument("--tct-number", default="")
    parser.add_argument("--lot-number", default="")
    parser.add_argument("--tax-year", type=int)
    parser.add_argument("--date-from", default="")
    parser.add_argument("--date-to", default="")
    parser.add_argument("--limit", type=int, default=25)
    args = parser.parse_args()
    result = {
        "ok": False,
        "mode": "read_only",
        "connection": connection_mode(),
        "database": os.environ.get("FIREBIRD_ODBC_DSN", "").strip(),
        "matches": [],
        "card": None,
    }
    try:
        if connection_mode() != "odbc" or not result["database"]:
            raise RuntimeError(
                "RPT Payment Card requires FIREBIRD_CONNECTION=odbc and "
                "FIREBIRD_ODBC_DSN in the backend .env."
            )

        connection = open_odbc_connection(readonly=True)
        cursor = connection.cursor()
        result["matches"] = find_matches(cursor, args)
        selected = args.taxtrans_id.strip()
        if not selected and len(result["matches"]) == 1:
            selected = str(result["matches"][0].get("taxtrans_id") or "")
        if selected:
            prop = property_record(cursor, selected)
            if prop:
                result["card"] = {
                    "property": prop,
                    "ownership": ownership(cursor, prop["prop_id"]),
                    "payments": payments(cursor, selected, args),
                    "delinquency_as_of": date.today().isoformat(),
                    "delinquencies": delinquencies(cursor, selected),
                }
        connection.rollback()
        connection.close()
        result["ok"] = True
    except Exception as exc:
        result.update(error=str(exc), error_type=exc.__class__.__name__)
    sys.stdout.write(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
