import json,sys
sys.path.insert(0,r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner")
from firebird_probe import open_odbc_connection
c=open_odbc_connection(readonly=True); q=c.cursor()
q.execute("""
WITH RECURSIVE
active_ids AS (
 SELECT a.TAXTRANS_ID current_taxtrans_id
 FROM RPTASSESSMENT a JOIN PROPERTY p ON p.PROP_ID=a.PROP_ID
 WHERE COALESCE(a.ENDED_BV,0)=0 AND a.CANCELLATIONDATE IS NULL AND p.BARANGAY_CT='001'
),
chain(current_taxtrans_id,taxtrans_id,depth) AS (
 SELECT current_taxtrans_id,current_taxtrans_id,0 FROM active_ids
 UNION ALL
 SELECT c.current_taxtrans_id,p.TAXTRANS_ID,c.depth+1
 FROM chain c JOIN RPTASSESSMENT a ON a.TAXTRANS_ID=c.taxtrans_id
 JOIN RPTASSESSMENT p ON p.TAXTRANS_ID=a.PREVTAXTRANS_ID
 WHERE c.depth<25
)
SELECT ta.ITAXTYPE_CT,ta.CASETYPE_CT,
       SUM(COALESCE(ta.DEBITAMOUNT,0)-COALESCE(ta.CREDITAMOUNT,0)) net_amount,
       COUNT(*) record_count
FROM chain c JOIN TPACCOUNT ta ON ta.TAXTRANS_ID=c.taxtrans_id
WHERE COALESCE(ta.CANCELLED_BV,0)=0 AND ta.EARMARK_CT='OPN' AND ta.TAXYEAR<=2025
GROUP BY ta.ITAXTYPE_CT,ta.CASETYPE_CT
ORDER BY ta.ITAXTYPE_CT,ta.CASETYPE_CT
""")
cols=[d[0].strip().lower() for d in q.description]
print(json.dumps([dict(zip(cols,r)) for r in q.fetchall()],default=str,indent=2))
c.close()