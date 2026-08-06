import json,sys
sys.path.insert(0,r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner")
from firebird_probe import open_odbc_connection
c=open_odbc_connection(readonly=True); q=c.cursor()
for table in ('RPTLIABILITY','RPTTRANSACTION','T_RPTRESTRICTION'):
 q.execute("""
 SELECT TRIM(rf.RDB$FIELD_NAME)
 FROM RDB$RELATION_FIELDS rf
 WHERE TRIM(rf.RDB$RELATION_NAME)=?
 ORDER BY rf.RDB$FIELD_POSITION
 """,(table,))
 print(table,json.dumps([r[0] for r in q.fetchall()]))
q.execute("SELECT FIRST 5 * FROM RPTLIABILITY")
cols=[d[0].strip().lower() for d in q.description]
print(json.dumps([dict(zip(cols,r)) for r in q.fetchall()],default=str,indent=2))
c.close()