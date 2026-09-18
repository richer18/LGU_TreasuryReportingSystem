CANCELLED_STATUS_CODES = (
    "'CNL', 'CAN', 'CNC', 'CANCEL', 'CANCELLED', 'VOID', 'VOI'"
)


def active_payment_predicate(alias="p"):
    return (
        f"COALESCE({alias}.VOID_BV, 0) = 0 "
        f"AND COALESCE(TRIM({alias}.STATUS_CT), '') NOT IN ({CANCELLED_STATUS_CODES})"
    )


def earlier_exact_duplicate_predicate(alias="p"):
    earlier = f"{alias}_earlier"
    current_time = f"COALESCE({alias}.TRANSDATE, {alias}.VALUEDATE, {alias}.PAYMENTDATE)"
    earlier_time = f"COALESCE({earlier}.TRANSDATE, {earlier}.VALUEDATE, {earlier}.PAYMENTDATE)"
    current_collector = (
        f"COALESCE(NULLIF(UPPER(TRIM({alias}.COLLECTOR)), ''), "
        f"UPPER(TRIM({alias}.USERID)), '')"
    )
    earlier_collector = (
        f"COALESCE(NULLIF(UPPER(TRIM({earlier}.COLLECTOR)), ''), "
        f"UPPER(TRIM({earlier}.USERID)), '')"
    )

    return f"""
        EXISTS (
            SELECT 1
            FROM PAYMENT {earlier}
            WHERE {earlier}.RECEIPTNO = {alias}.RECEIPTNO
              AND {earlier}.PAYMENT_ID <> {alias}.PAYMENT_ID
              AND {active_payment_predicate(earlier)}
              AND CAST({earlier}.PAYMENTDATE AS DATE) = CAST({alias}.PAYMENTDATE AS DATE)
              AND COALESCE(TRIM({earlier}.AFTYPE), '') = COALESCE(TRIM({alias}.AFTYPE), '')
              AND COALESCE(TRIM({earlier}.PAYGROUP_CT), '') = COALESCE(TRIM({alias}.PAYGROUP_CT), '')
              AND COALESCE(UPPER(TRIM({earlier}.PAIDBY)), '') = COALESCE(UPPER(TRIM({alias}.PAIDBY)), '')
              AND COALESCE({earlier}.AMOUNT, 0) = COALESCE({alias}.AMOUNT, 0)
              AND {earlier_collector} = {current_collector}
              AND (
                    {earlier_time} < {current_time}
                    OR ({earlier_time} = {current_time} AND {earlier}.PAYMENT_ID < {alias}.PAYMENT_ID)
              )
        )
    """.strip()


def reportable_payment_predicate(alias="p"):
    return f"{active_payment_predicate(alias)} AND NOT ({earlier_exact_duplicate_predicate(alias)})"


def reportable_payment_filter(alias="p"):
    return f"AND {reportable_payment_predicate(alias)}"


def include_inactive_payment_filter(alias="p"):
    return f"AND (NOT ({active_payment_predicate(alias)}) OR NOT ({earlier_exact_duplicate_predicate(alias)}))"
