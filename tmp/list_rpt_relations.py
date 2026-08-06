import json,sys
sys.path.insert(0,r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner")
from firebird_probe import open_odbc_connection
c=open_odbc_connection(readonly=True); q=c.cursor()
q.execute("""
SELECT TRIM(RDB$RELATION_NAME)
FROM RDB$RELATIONS
WHERE COALESCE(RDB$SYSTEM_FLAG,0)=0
  AND (UPPER(RDB$RELATION_NAME) LIKE '%ACCOUNT%'
    OR UPPER(RDB$RELATION_NAME) LIKE '%LEDGER%'
    OR UPPER(RDB$RELATION_NAME) LIKE '%DUE%'
    OR UPPER(RDB$RELATION_NAME) LIKE '%RPT%'
    OR UPPER(RDB$RELATION_NAME) LIKE '%TAX%')
ORDER BY RDB$RELATION_NAME
""")
print(json.dumps([r[0] for r in q.fetchall()],indent=2))
c.close()