import argparse
import json
import os
import site
import sys
from pathlib import Path

import fdb


user_site_candidates = [site.getusersitepackages()]
appdata = os.environ.get("APPDATA")
if appdata:
    user_site_candidates.append(str(Path(appdata) / "Python" / f"Python{sys.version_info.major}{sys.version_info.minor}" / "site-packages"))
userprofile = os.environ.get("USERPROFILE")
if userprofile:
    user_site_candidates.append(str(Path(userprofile) / "AppData" / "Roaming" / "Python" / f"Python{sys.version_info.major}{sys.version_info.minor}" / "site-packages"))
user_site_candidates.append(r"C:\Users\Treasurer-Server\AppData\Roaming\Python\Python313\site-packages")

for user_site in user_site_candidates:
    if user_site and Path(user_site).exists() and user_site not in sys.path:
        sys.path.append(user_site)


DEFAULT_DB_PATHS = []
DEFAULT_CLIENT_PATH = r"C:\Program Files\Firebird\Firebird_2_5\bin\fbclient.dll"
DEFAULT_ODBC_DSN = "itaxzamboanguita"


def connection_mode() -> str:
    return (os.environ.get("FIREBIRD_CONNECTION") or "native").strip().lower()


def resolve_db_path() -> str:
    env_path = os.environ.get("ESRE_FIREBIRD_DB") or os.environ.get("FIREBIRD_DB_PATH")
    candidates = [env_path] if env_path else []
    candidates.extend(DEFAULT_DB_PATHS)
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return candidates[0] if candidates else ""


def resolve_odbc_dsn() -> str:
    return (os.environ.get("FIREBIRD_ODBC_DSN") or DEFAULT_ODBC_DSN).strip()


def resolve_odbc_client() -> str:
    return (os.environ.get("FIREBIRD_ODBC_CLIENT_LIBRARY") or os.environ.get("FIREBIRD_CLIENT_LIBRARY") or DEFAULT_CLIENT_PATH).strip()


def open_odbc_connection(readonly: bool = True):
    try:
        import pyodbc
    except ImportError as exc:
        raise RuntimeError("pyodbc is required for FIREBIRD_CONNECTION=odbc. Install it with: python -m pip install pyodbc==5.3.0") from exc

    dsn = resolve_odbc_dsn()
    if not dsn:
        raise RuntimeError("FIREBIRD_ODBC_DSN is not configured.")

    parts = [
        f"DSN={dsn}",
        f"UID={os.environ.get('FIREBIRD_USER', '')}",
        f"PWD={os.environ.get('FIREBIRD_PASSWORD', '')}",
    ]

    client = resolve_odbc_client()
    if client:
        parts.append(f"CLIENT={client}")

    return pyodbc.connect(";".join(parts) + ";", autocommit=False, readonly=readonly)


def connect():
    if connection_mode() == "odbc":
        return open_odbc_connection(readonly=True)

    db_path = resolve_db_path()
    if not db_path:
        raise RuntimeError("FIREBIRD_DB_PATH is not configured.")

    return fdb.connect(
        dsn=db_path,
        user=os.environ.get("FIREBIRD_USER", ""),
        password=os.environ.get("FIREBIRD_PASSWORD", ""),
        charset=os.environ.get("FIREBIRD_CHARSET", "UTF8"),
        fb_library_name=os.environ.get("FIREBIRD_CLIENT_LIBRARY", DEFAULT_CLIENT_PATH),
        isolation_level=fdb.ISOLATION_LEVEL_READ_COMMITED_RO,
        no_db_triggers=True,
        no_gc=True,
    )


def table_count(cursor) -> int:
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM RDB$RELATIONS
        WHERE COALESCE(RDB$SYSTEM_FLAG, 0) = 0
          AND RDB$VIEW_BLR IS NULL
        """
    )
    return int(cursor.fetchone()[0])


def view_count(cursor) -> int:
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM RDB$RELATIONS
        WHERE COALESCE(RDB$SYSTEM_FLAG, 0) = 0
          AND RDB$VIEW_BLR IS NOT NULL
        """
    )
    return int(cursor.fetchone()[0])


def sample_tables(cursor, limit: int) -> list[str]:
    cursor.execute(
        """
        SELECT FIRST ? TRIM(RDB$RELATION_NAME)
        FROM RDB$RELATIONS
        WHERE COALESCE(RDB$SYSTEM_FLAG, 0) = 0
          AND RDB$VIEW_BLR IS NULL
        ORDER BY RDB$RELATION_NAME
        """,
        [limit],
    )
    return [row[0] for row in cursor.fetchall()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only Firebird connection probe.")
    parser.add_argument("--sample-limit", type=int, default=10)
    args = parser.parse_args()

    mode = connection_mode()
    result = {
        "ok": False,
        "mode": "read_only_probe",
        "connection": mode,
        "database": resolve_odbc_dsn() if mode == "odbc" else resolve_db_path(),
        "client_library": resolve_odbc_client() if mode == "odbc" else os.environ.get("FIREBIRD_CLIENT_LIBRARY", DEFAULT_CLIENT_PATH),
    }

    try:
        connection = connect()
        cursor = connection.cursor()
        result.update(
            {
                "ok": True,
                "table_count": table_count(cursor),
                "view_count": view_count(cursor),
                "sample_tables": sample_tables(cursor, args.sample_limit),
            }
        )
        connection.close()
    except Exception as exc:
        result.update(
            {
                "ok": False,
                "error": str(exc),
                "error_type": exc.__class__.__name__,
            }
        )

    sys.stdout.write(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())