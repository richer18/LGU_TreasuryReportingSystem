import argparse
import json
import os
import sys
from pathlib import Path

import fdb


DEFAULT_DB_PATHS = [
    r"E:\ZAMBOANGUITA.FDB",
    r"C:\ZAMBOANGUITA_DB\ZAMBOANGUITA.FDB",
]
DEFAULT_CLIENT_PATH = r"C:\Program Files\Firebird\Firebird_2_5\bin\fbclient.dll"


def resolve_db_path() -> str:
    env_path = os.environ.get("ESRE_FIREBIRD_DB") or os.environ.get("FIREBIRD_DB_PATH")
    candidates = [env_path] if env_path else []
    candidates.extend(DEFAULT_DB_PATHS)
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return candidates[0] if candidates else DEFAULT_DB_PATHS[0]


def connect():
    return fdb.connect(
        dsn=resolve_db_path(),
        user=os.environ.get("FIREBIRD_USER", "SYSDBA"),
        password=os.environ.get("FIREBIRD_PASSWORD", "masterkey"),
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

    result = {
        "ok": False,
        "mode": "read_only_probe",
        "database": resolve_db_path(),
        "client_library": os.environ.get("FIREBIRD_CLIENT_LIBRARY", DEFAULT_CLIENT_PATH),
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
