import json,sys
sys.path.insert(0,r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner")
from firebird_probe import open_odbc_connection
c=open_odbc_connection(readonly=True); q=c.cursor()
q.execute("""
SELECT ta.POSTING_ID, ta.TAXYEAR, ta.ITAXTYPE_CT, ta.CASETYPE_CT,
       ta.DEBITAMOUNT, ta.CREDITAMOUNT, ta.VALUEDATE, ta.TRANSDATE,
       ta.CHANGEDATE, ta.TAXPERIOD_CT, ta.EVENTOBJECT_CT, ta.BOOKINGREFERENCE,
       ta.EARMARK_CT
FROM RPTASSESSMENT a
JOIN TPACCOUNT ta ON ta.TAXTRANS_ID=a.TAXTRANS_ID
WHERE a.TDNO=?
  AND ta.EARMARK_CT='OPN'
  AND ta.TAXYEAR<=2025
ORDER BY ta.TAXYEAR, ta.ITAXTYPE_CT, ta.CASETYPE_CT
""",('2017-20-0001-03237',))
cols=[d[0].strip().lower() for d in q.description]
print(json.dumps([dict(zip(cols,r)) for r in q.fetchall()],default=str,indent=2))
c.close()