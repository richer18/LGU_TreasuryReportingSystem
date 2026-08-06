import sys, pyodbc
sys.path.insert(0, r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner")
from firebird_probe import open_odbc_connection
conn=open_odbc_connection(readonly=True)
for key,name in [(pyodbc.SQL_DATABASE_NAME,'database'),(pyodbc.SQL_DBMS_NAME,'dbms'),(pyodbc.SQL_SERVER_NAME,'server')]:
    try: print(name, conn.getinfo(key))
    except Exception as exc: print(name, 'unavailable', str(exc))
conn.close()