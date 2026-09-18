import argparse
import json
from datetime import date, datetime
from decimal import Decimal

from firebird_probe import connect, connection_mode, resolve_db_path, resolve_odbc_dsn


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


def search_td_no(cursor, td_no, limit):
    search_text = (td_no or "").strip()
    if not search_text:
        return []

    exact = search_text.upper()
    contains = f"%{exact}%"
    cursor.execute(
        """
        SELECT FIRST ?
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE) AS PAYMENT_DATE,
            TRIM(p.RECEIPTNO) AS RECEIPT_NO,
            COALESCE(
                (SELECT FIRST 1 NULLIF(TRIM(tp.OWNERNAME), '')
                 FROM TPACCOUNT ta
                 JOIN TAXPAYER tp ON tp.LOCAL_TIN = ta.LOCAL_TIN
                 WHERE ta.TAXTRANS_ID = ra.TAXTRANS_ID
                   AND ta.TAXYEAR = pcd.TAXYEAR
                 ORDER BY tp.OWNERNAME),
                NULLIF(TRIM(p.PAIDBY), ''),
                '-'
            ) AS PAID_BY,
            NULLIF(TRIM(p.PAIDBY), '') AS PAYMENT_PAID_BY,
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), NULLIF(TRIM(p.USERID), ''), '-') AS COLLECTOR,
            TRIM(p.RCDNUMBER) AS RCD_NUMBER,
            TRIM(p.STATUS_CT) AS STATUS_CODE,
            COALESCE(p.VOID_BV, 0) AS VOID_BV,
            ra.TAXTRANS_ID,
            TRIM(ra.TDNO) AS TD_NO,
            TRIM(ra.TDNOFORGR) AS TD_NO_FOR_GR,
            COALESCE(
                (SELECT FIRST 1 TRIM(owner.OWNERNAME)
                 FROM PROPERTYOWNER po
                 JOIN TAXPAYER owner ON owner.LOCAL_TIN = po.LOCAL_TIN
                 WHERE po.PROP_ID = prop.PROP_ID
                 ORDER BY po.VALIDUNTIL DESC),
                '-'
            ) AS DECLARED_OWNER,
            COALESCE(NULLIF(TRIM(prop.LOTNO), ''), TRIM(prop.CADASTRALLOTNO), '-') AS LOT_NO,
            TRIM(prop.PINNO) AS PIN,
            TRIM(prop.NEWPINNO) AS NEW_PIN,
            TRIM(prop.BARANGAY_CT) AS BARANGAY_CODE,
            COALESCE(NULLIF(TRIM(brgy.DESCRIPTION), ''), TRIM(prop.BARANGAY_CT), '-') AS BARANGAY_NAME,
            MAX(NULLIF(TRIM(cls.DESCRIPTION), '')) AS PROPERTY_CLASSIFICATION,
            MAX(NULLIF(TRIM(kind.DESCRIPTION), '')) AS PROPERTY_KIND,
            pcd.TAXYEAR,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'BSC' AND pcd.CASETYPE_CT = 'REG' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS BASIC_TAX,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'BSC' AND pcd.CASETYPE_CT = 'DED' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS BASIC_DISCOUNT_AMOUNT,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'BSC' AND pcd.CASETYPE_CT = 'PEN' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS BASIC_PENALTY,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'SEF' AND pcd.CASETYPE_CT = 'REG' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS SEF_TAX,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'SEF' AND pcd.CASETYPE_CT = 'DED' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS SEF_DISCOUNT_AMOUNT,
            SUM(CASE WHEN pcd.ITAXTYPE_CT = 'SEF' AND pcd.CASETYPE_CT = 'PEN' THEN COALESCE(pcd.AMOUNT, 0) ELSE 0 END) AS SEF_PENALTY,
            SUM(COALESCE(pcd.AMOUNT, 0)) AS TOTAL_AMOUNT
        FROM PAYMENTCLASSDETAIL pcd
        JOIN PAYMENT p ON p.PAYMENT_ID = pcd.PAYMENT_ID
        JOIN RPTASSESSMENT ra ON ra.TAXTRANS_ID = pcd.TAXTRANS_ID
        LEFT JOIN PROPERTY prop ON prop.PROP_ID = ra.PROP_ID
        LEFT JOIN T_BARANGAY brgy
               ON brgy.CODE = prop.BARANGAY_CT
              AND brgy.MUNICIPAL_ID = prop.MUNICIPAL_ID
              AND brgy.PROVINCE_CT = prop.PROVINCE_CT
        LEFT JOIN T_CLASSIFICATION cls
               ON cls.CODE = COALESCE(pcd.CLASSCODE_CT, ra.PREDOMCLASSCODE_CT)
        LEFT JOIN T_PROPERTYKIND kind
               ON kind.CODE = COALESCE(pcd.PROPERTYKIND_CT, prop.PROPERTYKIND_CT)
        WHERE COALESCE(pcd.CANCELLED_BV, 0) = 0
          AND COALESCE(p.VOID_BV, 0) = 0
          AND COALESCE(TRIM(p.STATUS_CT), '') NOT IN ('CAN', 'CNC', 'CNL', 'CANCEL', 'CANCELLED', 'VOID', 'VOI')
          AND UPPER(COALESCE(TRIM(p.PAYGROUP_CT), '')) = 'RPT'
          AND (
              UPPER(TRIM(ra.TDNO)) = ?
              OR UPPER(TRIM(ra.TDNOFORGR)) = ?
              OR UPPER(TRIM(ra.TDNO)) LIKE ?
              OR UPPER(TRIM(ra.TDNOFORGR)) LIKE ?
          )
        GROUP BY
            p.PAYMENT_ID,
            CAST(p.PAYMENTDATE AS DATE),
            TRIM(p.RECEIPTNO),
            NULLIF(TRIM(p.PAIDBY), ''),
            COALESCE(NULLIF(TRIM(p.COLLECTOR), ''), NULLIF(TRIM(p.USERID), ''), '-'),
            TRIM(p.RCDNUMBER),
            TRIM(p.STATUS_CT),
            COALESCE(p.VOID_BV, 0),
            ra.TAXTRANS_ID,
            TRIM(ra.TDNO),
            TRIM(ra.TDNOFORGR),
            prop.PROP_ID,
            COALESCE(NULLIF(TRIM(prop.LOTNO), ''), TRIM(prop.CADASTRALLOTNO), '-'),
            TRIM(prop.PINNO),
            TRIM(prop.NEWPINNO),
            TRIM(prop.BARANGAY_CT),
            COALESCE(NULLIF(TRIM(brgy.DESCRIPTION), ''), TRIM(prop.BARANGAY_CT), '-'),
            pcd.TAXYEAR
        ORDER BY CAST(p.PAYMENTDATE AS DATE) DESC, TRIM(p.RECEIPTNO) DESC, pcd.TAXYEAR DESC
        """,
        [limit, exact, exact, contains, contains],
    )

    result = rows(cursor)
    for item in result:
        item["collection_status"] = "Paid"
        item["period_covered"] = str(item.get("taxyear") or "")
        taxyear = int(item.get("taxyear") or 0)
        pay_year = int(str(item.get("payment_date") or "0000")[:4] or 0)
        basic_tax = float(item.get("basic_tax") or 0)
        basic_discount = abs(float(item.get("basic_discount_amount") or 0))
        basic_penalty = float(item.get("basic_penalty") or 0)
        sef_tax = float(item.get("sef_tax") or 0)
        sef_discount = abs(float(item.get("sef_discount_amount") or 0))
        sef_penalty = float(item.get("sef_penalty") or 0)

        is_current = taxyear and pay_year and taxyear == pay_year
        is_previous = taxyear and pay_year and taxyear == pay_year - 1
        item["basic_current_gross"] = basic_tax if is_current else 0
        item["basic_discount"] = basic_discount
        item["basic_prior_years"] = 0 if is_current else basic_tax
        item["basic_penalty_current_year"] = basic_penalty if is_current else 0
        item["basic_penalty_previous_years"] = basic_penalty if is_previous else 0
        item["basic_penalty_prior_years"] = 0 if is_current or is_previous else basic_penalty
        item["basic_gross_total"] = basic_tax + basic_penalty
        item["basic_net_total"] = max(item["basic_gross_total"] - basic_discount, 0)
        item["sef_current_gross"] = sef_tax if is_current else 0
        item["sef_discount"] = sef_discount
        item["sef_prior_years"] = 0 if is_current else sef_tax
        item["sef_penalty_current_year"] = sef_penalty if is_current else 0
        item["sef_penalty_previous_years"] = sef_penalty if is_previous else 0
        item["sef_penalty_prior_years"] = 0 if is_current or is_previous else sef_penalty
        item["sef_gross_total"] = sef_tax + sef_penalty
        item["sef_net_total"] = max(item["sef_gross_total"] - sef_discount, 0)
        item["grand_gross_total"] = item["basic_gross_total"] + item["sef_gross_total"]
        item["grand_net_total"] = item["basic_net_total"] + item["sef_net_total"]
        item["payment_total_amount"] = float(item.get("total_amount") or item["grand_net_total"] or 0)
        item["share_25_percent"] = round(item["basic_net_total"] * 0.25, 2)
        item["payment_status_ct"] = item.get("status_code") or "PAID"
        item["is_cancelled"] = False
        item["is_void"] = bool(item.get("void_bv") or 0)
        item["include_in_report"] = not item["is_void"]
    return result


def summarize(items):
    payors = sorted({str(item.get("paid_by") or "-").strip() for item in items if str(item.get("paid_by") or "").strip()})
    receipts = sorted({str(item.get("receipt_no") or "-").strip() for item in items if str(item.get("receipt_no") or "").strip()})
    total = sum(float(item.get("total_amount") or 0) for item in items)
    return {"row_count": len(items), "receipt_count": len(receipts), "total_amount": round(total, 2), "payors": payors, "multiple_payors": len(payors) > 1}


def main():
    parser = argparse.ArgumentParser(description="Search RPT payment history by Tax Declaration number.")
    parser.add_argument("--td-no", required=True)
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    payload = {"ok": False, "mode": "search_td_no", "database": resolve_odbc_dsn() if connection_mode() == "odbc" else resolve_db_path(), "connection": connection_mode(), "td_no": args.td_no}
    try:
        connection = connect()
        cursor = connection.cursor()
        data = search_td_no(cursor, args.td_no, max(1, min(args.limit, 500)))
        connection.close()
        payload["data"] = data
        payload["summary"] = summarize(data)
        payload["ok"] = True
    except Exception as exc:
        payload.update({"ok": False, "error": str(exc), "error_type": exc.__class__.__name__})
    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
