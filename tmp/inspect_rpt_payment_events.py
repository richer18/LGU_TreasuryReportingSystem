import json,sys
sys.path.insert(0,r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner")
from firebird_probe import open_odbc_connection
c=open_odbc_connection(readonly=True); q=c.cursor()
q.execute("""
SELECT ta.EVENTOBJECT_CT,ta.CASETYPE_CT,ta.ITAXTYPE_CT,ta.EARMARK_CT,
 COUNT(*) record_count,
 SUM(COALESCE(ta.DEBITAMOUNT,0)) debit_total,
 SUM(COALESCE(ta.CREDITAMOUNT,0)) credit_total
FROM TPACCOUNT ta
WHERE ta.TRANSDATE BETWEEN '2026-01-01' AND '2026-07-15 23:59:59'
  AND ta.TAXYEAR<=2025
  AND (COALESCE(ta.CREDITAMOUNT,0)>0 OR ta.EVENTOBJECT_CT<>'ASS')
GROUP BY ta.EVENTOBJECT_CT,ta.CASETYPE_CT,ta.ITAXTYPE_CT,ta.EARMARK_CT
ORDER BY ta.EVENTOBJECT_CT,ta.CASETYPE_CT,ta.ITAXTYPE_CT,ta.EARMARK_CT
""")
cols=[d[0].strip().lower() for d in q.description]
print(json.dumps([dict(zip(cols,r)) for r in q.fetchall()],default=str,indent=2))
c.close()