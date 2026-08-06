import argparse
import json
import os
from datetime import date, datetime
from decimal import Decimal

from firebird_probe import connection_mode, open_odbc_connection


def scalar(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, str):
        return value.strip()
    return value


def fetch_rows(cursor):
    columns = [column[0].strip().lower() for column in cursor.description]
    return [
        {column: scalar(value) for column, value in zip(columns, record)}
        for record in cursor.fetchall()
    ]


def build_query(limit, has_barangay):
    barangay_filter = "AND p.BARANGAY_CT = ?" if has_barangay else ""
    return f"""
WITH RECURSIVE
active_ids AS (
    SELECT
        a.TAXTRANS_ID AS CURRENT_TAXTRANS_ID,
        a.PROP_ID,
        a.TDNO,
        p.PINNO,
        p.CADASTRALLOTNO,
        p.BARANGAY_CT,
        p.PROPERTYKIND_CT,
        a.PREDOMCLASSCODE_CT,
        ta.LOCAL_TIN,
        MAX(CASE
            WHEN NULLIF(TRIM(tp.OWNERNAME), '') IS NULL
            THEN COALESCE(TRIM(tp.LASTNAME), '') || ', ' || COALESCE(TRIM(tp.FIRSTNAME), '')
            ELSE TRIM(tp.OWNERNAME)
        END) AS DECLARANT,
        MAX(COALESCE(pj.ASSVALUETOTAL, 0)) AS ASSESSED_VALUE
    FROM RPTASSESSMENT a
    JOIN PROPERTY p ON p.PROP_ID = a.PROP_ID
    JOIN TPACCOUNT ta
      ON ta.TAXTRANS_ID = a.TAXTRANS_ID
     AND ta.PROP_ID = p.PROP_ID
    JOIN POSTINGJOURNAL pj ON pj.TAXTRANS_ID = a.TAXTRANS_ID
    LEFT JOIN TAXPAYER tp ON tp.LOCAL_TIN = ta.LOCAL_TIN
    WHERE ta.EARMARK_CT IN ('OPN', 'PBL')
      AND ta.TAXYEAR <= ?
      AND (ta.CANCELLED_BV = 0 OR ta.CANCELLED_BV IS NULL)
      AND (a.ENDED_BV <> 1 OR a.ENDED_BV IS NULL)
      AND ((p.PROPSECTION <> '800' AND p.PROPSECTION <> '900') OR p.PROPSECTION IS NULL)
      AND ta.PK_EVENTOBJECT IS NOT NULL
      AND ta.VALUEDATE <= ?
      AND ta.EVENTOBJECT_CT IN ('ASS', 'MAN')
      AND pj.TAXYEAR = (
          SELECT MAX(latest_pj.TAXYEAR)
          FROM POSTINGJOURNAL latest_pj
          WHERE latest_pj.TAXTRANS_ID = a.TAXTRANS_ID
      )
      {barangay_filter}
    GROUP BY
        a.TAXTRANS_ID,
        a.PROP_ID,
        a.TDNO,
        p.PINNO,
        p.CADASTRALLOTNO,
        p.BARANGAY_CT,
        p.PROPERTYKIND_CT,
        a.PREDOMCLASSCODE_CT,
        ta.LOCAL_TIN
),
chain(current_taxtrans_id, local_tin, taxtrans_id, depth) AS (
    SELECT CURRENT_TAXTRANS_ID, LOCAL_TIN, CURRENT_TAXTRANS_ID, 0
    FROM active_ids

    UNION ALL

    SELECT c.current_taxtrans_id, c.local_tin, prev.TAXTRANS_ID, c.depth + 1
    FROM chain c
    JOIN RPTASSESSMENT current_assessment
      ON current_assessment.TAXTRANS_ID = c.taxtrans_id
    JOIN RPTASSESSMENT prev
      ON prev.TAXTRANS_ID = current_assessment.PREVTAXTRANS_ID
    WHERE c.depth < 25
      AND EXISTS (
          SELECT 1
          FROM TPACCOUNT previous_ledger
          WHERE previous_ledger.TAXTRANS_ID = prev.TAXTRANS_ID
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
        c.current_taxtrans_id,
        c.depth,
        ta.TAXYEAR,
        ta.ITAXTYPE_CT,
        SUM(CASE
            WHEN ta.CASETYPE_CT = 'REG' THEN COALESCE(ta.DEBITAMOUNT, 0)
            ELSE 0
        END) AS REGULAR_BALANCE,
        SUM(CASE
            WHEN ta.CASETYPE_CT IN ('PEN', 'DED') THEN COALESCE(ta.DEBITAMOUNT, 0)
            ELSE 0
        END) AS PENALTY_BALANCE
    FROM chain c
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
    GROUP BY c.current_taxtrans_id, c.depth, ta.TAXYEAR, ta.ITAXTYPE_CT
),
ledger_summary AS (
    SELECT
        current_taxtrans_id,
        MIN(CASE
            WHEN REGULAR_BALANCE <> 0 OR PENALTY_BALANCE <> 0 THEN TAXYEAR
        END) AS START_YEAR,
        SUM(CASE
            WHEN ITAXTYPE_CT = 'BSC' AND REGULAR_BALANCE > 0 THEN REGULAR_BALANCE
            ELSE 0
        END) AS BASIC_TAX_DUE,
        SUM(CASE
            WHEN ITAXTYPE_CT = 'BSC' THEN PENALTY_BALANCE
            ELSE 0
        END) AS BASIC_PENALTY,
        SUM(CASE
            WHEN ITAXTYPE_CT = 'SEF' AND REGULAR_BALANCE > 0 THEN REGULAR_BALANCE
            ELSE 0
        END) AS SEF_DUE,
        SUM(CASE
            WHEN ITAXTYPE_CT = 'SEF' THEN PENALTY_BALANCE
            ELSE 0
        END) AS SEF_PENALTY
    FROM ledger_by_year
    GROUP BY current_taxtrans_id
)
SELECT
    ai.DECLARANT,
    TRIM(ai.PINNO) AS PROPERTY_INDEX_NO,
    COALESCE(NULLIF(TRIM(ai.CADASTRALLOTNO), ''), ' ') AS LOT_NO,
    TRIM(ai.TDNO) AS TD_NO,
    ai.BARANGAY_CT AS BARANGAY_CODE,
    COALESCE(
        (SELECT FIRST 1 TRIM(kind.DESCRIPTION)
         FROM T_PROPERTYKIND kind
         WHERE kind.CODE = ai.PROPERTYKIND_CT),
        TRIM(ai.PROPERTYKIND_CT),
        ''
    ) AS PROPERTY_KIND,
    COALESCE(
        (SELECT FIRST 1 TRIM(classification.DESCRIPTION)
         FROM T_CLASSIFICATION classification
         WHERE classification.CODE = ai.PREDOMCLASSCODE_CT),
        TRIM(ai.PREDOMCLASSCODE_CT),
        ''
    ) AS PROPERTY_CLASSIFICATION,
    ai.ASSESSED_VALUE,
    ls.START_YEAR,
    ls.BASIC_TAX_DUE,
    ls.BASIC_PENALTY,
    ls.SEF_DUE,
    ls.SEF_PENALTY,
    (ls.BASIC_TAX_DUE + ls.BASIC_PENALTY + ls.SEF_DUE + ls.SEF_PENALTY) AS TOTAL,
    CAST('' AS VARCHAR(120)) AS REMARKS
FROM active_ids ai
JOIN ledger_summary ls ON ls.current_taxtrans_id = ai.current_taxtrans_id
WHERE (ls.BASIC_TAX_DUE + ls.BASIC_PENALTY + ls.SEF_DUE + ls.SEF_PENALTY) > 0
ORDER BY ai.DECLARANT, ai.TDNO, ai.CADASTRALLOTNO
ROWS 1 TO {limit}
"""


def main():
    parser = argparse.ArgumentParser(description="Read-only list of real property tax delinquencies.")
    parser.add_argument("--cut-off-year", type=int, required=True)
    parser.add_argument("--as-of-date", required=True)
    parser.add_argument("--barangay-code", default="")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--list-barangays", action="store_true")
    args = parser.parse_args()

    as_of_date = date.fromisoformat(args.as_of_date)
    limit = max(1, min(int(args.limit), 5000))
    barangay_code = (args.barangay_code or "").strip()
    payload = {
        "ok": False,
        "mode": "read_only",
        "database": os.environ.get("FIREBIRD_ODBC_DSN", "").strip(),
        "as_of_date": as_of_date.isoformat(),
        "cut_off_year": args.cut_off_year,
        "barangay_code": barangay_code,
        "limit": limit,
        "rows": [],
    }

    connection = None
    try:
        if connection_mode() != "odbc" or not payload["database"]:
            raise RuntimeError(
                "RPT delinquency report requires FIREBIRD_CONNECTION=odbc and "
                "FIREBIRD_ODBC_DSN in the backend .env."
            )

        connection = open_odbc_connection(readonly=True)
        cursor = connection.cursor()

        if args.list_barangays:
            cursor.execute(
                """
                SELECT DISTINCT
                    TRIM(p.BARANGAY_CT) AS CODE,
                    TRIM(b.DESCRIPTION) AS NAME
                FROM PROPERTY p
                LEFT JOIN T_BARANGAY b
                  ON b.CODE = p.BARANGAY_CT
                 AND b.MUNICIPAL_ID = p.MUNICIPAL_ID
                 AND b.PROVINCE_CT = p.PROVINCE_CT
                WHERE p.BARANGAY_CT IS NOT NULL
                  AND TRIM(p.BARANGAY_CT) <> ''
                ORDER BY NAME, CODE
                """
            )
            payload.update({
                "ok": True,
                "barangays": fetch_rows(cursor),
            })
        else:
            parameters = [as_of_date.year, as_of_date]
            if barangay_code:
                parameters.append(barangay_code)
            parameters.extend([args.cut_off_year, args.cut_off_year, as_of_date])
            cursor.execute(build_query(limit, bool(barangay_code)), parameters)
            result_rows = fetch_rows(cursor)
            payload.update({
                "ok": True,
                "count": len(result_rows),
                "total_amount": round(sum(float(row.get("total") or 0) for row in result_rows), 2),
                "totals": {
                    "basic_tax_due": round(sum(float(row.get("basic_tax_due") or 0) for row in result_rows), 2),
                    "basic_penalty": round(sum(float(row.get("basic_penalty") or 0) for row in result_rows), 2),
                    "sef_due": round(sum(float(row.get("sef_due") or 0) for row in result_rows), 2),
                    "sef_penalty": round(sum(float(row.get("sef_penalty") or 0) for row in result_rows), 2),
                },
                "rows": result_rows,
            })

        try:
            connection.rollback()
        except Exception:
            pass
    except Exception as exc:
        payload.update({
            "ok": False,
            "error": str(exc),
            "error_type": exc.__class__.__name__,
        })
    finally:
        if connection is not None:
            connection.close()

    print(json.dumps(payload, ensure_ascii=True))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
