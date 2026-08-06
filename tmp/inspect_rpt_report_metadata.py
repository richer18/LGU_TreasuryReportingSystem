import json, sys
sys.path.insert(0, r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner")
from firebird_probe import open_odbc_connection
conn=open_odbc_connection(readonly=True)
cur=conn.cursor()
cur.execute("""
SELECT TRIM(RDB$PROCEDURE_NAME)
FROM RDB$PROCEDURES
WHERE UPPER(RDB$PROCEDURE_NAME) LIKE '%DELINQ%'
   OR UPPER(RDB$PROCEDURE_NAME) LIKE '%PENALT%'
   OR UPPER(RDB$PROCEDURE_NAME) LIKE '%RPT%'
ORDER BY RDB$PROCEDURE_NAME
""")
print('PROCEDURES')
print(json.dumps([r[0] for r in cur.fetchall()], indent=2))
cur.execute("""
SELECT TRIM(RDB$RELATION_NAME), COALESCE(RDB$VIEW_SOURCE, '')
FROM RDB$RELATIONS
WHERE RDB$VIEW_BLR IS NOT NULL
  AND (UPPER(RDB$RELATION_NAME) LIKE '%DELINQ%'
    OR UPPER(RDB$RELATION_NAME) LIKE '%PENALT%'
    OR UPPER(RDB$RELATION_NAME) LIKE '%RPT%')
ORDER BY RDB$RELATION_NAME
""")
print('VIEWS')
print(json.dumps([{'name':r[0], 'source':str(r[1])[:1000]} for r in cur.fetchall()], indent=2))
cur.execute("""
SELECT TRIM(RDB$FUNCTION_NAME)
FROM RDB$FUNCTIONS
WHERE UPPER(RDB$FUNCTION_NAME) LIKE '%DELINQ%'
   OR UPPER(RDB$FUNCTION_NAME) LIKE '%PENALT%'
   OR UPPER(RDB$FUNCTION_NAME) LIKE '%RPT%'
ORDER BY RDB$FUNCTION_NAME
""")
print('FUNCTIONS')
print(json.dumps([r[0] for r in cur.fetchall()], indent=2))
conn.close()