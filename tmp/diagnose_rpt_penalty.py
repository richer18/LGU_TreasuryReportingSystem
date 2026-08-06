import json, sys
sys.path.insert(0, r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner")
from firebird_probe import open_odbc_connection
conn=open_odbc_connection(readonly=True)
cur=conn.cursor()
cur.execute("""
SELECT TRIM(rf.RDB$FIELD_NAME)
FROM RDB$RELATION_FIELDS rf
WHERE TRIM(rf.RDB$RELATION_NAME)='TPACCOUNT'
ORDER BY rf.RDB$FIELD_POSITION
""")
print(json.dumps([r[0] for r in cur.fetchall()]))
cur.execute("""
WITH RECURSIVE chain(taxtrans_id, depth) AS (
 SELECT TAXTRANS_ID, 0 FROM RPTASSESSMENT WHERE TDNO=?
 UNION ALL
 SELECT p.TAXTRANS_ID, c.depth+1
 FROM chain c
 JOIN RPTASSESSMENT a ON a.TAXTRANS_ID=c.taxtrans_id
 JOIN RPTASSESSMENT p ON p.TAXTRANS_ID=a.PREVTAXTRANS_ID
 WHERE c.depth<25
)
SELECT c.depth, ta.TAXTRANS_ID, ta.TAXYEAR, ta.ITAXTYPE_CT, ta.CASETYPE_CT,
       ta.DEBITAMOUNT, ta.CREDITAMOUNT, ta.EARMARK_CT, ta.CANCELLED_BV
FROM chain c
JOIN TPACCOUNT ta ON ta.TAXTRANS_ID=c.taxtrans_id
WHERE ta.TAXYEAR<=2025
  AND ta.ITAXTYPE_CT IN ('BSC','SEF')
  AND ta.CASETYPE_CT IN ('REG','PEN')
ORDER BY c.depth, ta.TAXYEAR, ta.ITAXTYPE_CT, ta.CASETYPE_CT
""", ('2017-20-0001-03237',))
cols=[d[0].strip().lower() for d in cur.description]
print(json.dumps([dict(zip(cols,r)) for r in cur.fetchall()], default=str, indent=2))
conn.close()