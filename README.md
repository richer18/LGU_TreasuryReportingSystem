# LGU Treasury Reporting System

Future web application for LGU Treasurer reporting, collection monitoring, and report generation based on the existing Firebird `.FDB` data and future imported MySQL reporting data.

## Project Structure

```text
backend/        Laravel REST API
frontend/       ReactJS web interface
runner/         Python report runner and Firebird/MySQL data jobs
docs/           Documentation, workflow notes, mappings, and report rules
template/       Excel report templates
receipt/        Receipt-related references or assets
icons/          UI/system icons
server_runner/  Local server helper scripts
git_hub_updater/ Git helper scripts
```

## Main Responsibilities

### Backend: Laravel + REST API

The backend is the system API layer. It should handle authentication, report catalog endpoints, request validation, role-based access, future MySQL reads, and future calls to the Python runner when a report must be generated.

Current starter API endpoints:

```text
GET /api/health
GET /api/firebird/status
GET /api/reports
GET /api/reports/{number}
```

### Frontend: ReactJS

The frontend is the user interface for Treasurer Office users. It should eventually provide report selection, date range filters, collector filters, preview tables, export buttons, and dashboard summaries.

### Runner: Python

The runner is for reporting jobs that are better handled outside Laravel, especially Firebird `.FDB` extraction, Excel template filling, reconciliation checks, and future scheduled import jobs into MySQL.

Project rule: all Python scripts for this system must be saved inside `runner/`.

The runner must use read-only access when connecting directly to the Firebird production database.

### Server Runner: Local Server Helpers

The server runner folder is for batch or PowerShell helpers that start the Laravel API server, start the React/Vite frontend server, or start both together during local development.

### Docs: Documentation

The docs folder should store the project brain: report definitions, database table mappings, workflow decisions, formulas, validation rules, known issues, and handoff notes.

## Reporting Direction

The first report registry follows the current ESRE/report list from the existing reporting work:

```text
1-17   Source queries and collection analysis
18-20  Process documentation for RPT, CTC, and Other Fees/Charges
21-31  Implemented Python/FDB report outputs
```

Future implementation should connect these layers:

```text
ReactJS UI -> Laravel REST API -> Python runner / MySQL reporting tables -> Excel/PDF output
```

Current Firebird check:

```powershell
cd backend
php artisan firebird:status
```

Or through REST API while Laravel is running:

```text
http://127.0.0.1:8000/api/firebird/status
```

## Safety Rule

Do not write to the live Firebird `.FDB` database from reporting features. Treat the Firebird database as a source-of-truth read-only system unless a future official posting workflow is formally reviewed and approved.

## Desktop Codex Area Updates

These notes were added by **desktop codex area** as a handoff reference for the laptop/workstation setup.

### 2026-06-23 GitHub-safe update

```text
Commit: e7fda87 Secure Firebird config before GitHub update
Branch: main
Remote: origin/main
```

Completed updates:

```text
1. Confirmed Laravel/Python can access the Firebird database through the Python runner.
2. Installed the missing local Python Firebird driver package: fdb.
3. Kept real Firebird database settings inside backend/.env only.
4. Removed real-looking database paths and default passwords from tracked code/examples.
5. Added __pycache__/ and *.pyc to .gitignore.
6. Removed tracked Python cache files from GitHub.
7. Updated backend/config/firebird.php so database path, user, and password come from .env.
8. Updated backend/.env.example to use placeholder database path and blank credentials.
9. Updated runner Firebird connection defaults so credentials must come from environment variables.
10. Updated server runner docs/scripts to use placeholder database paths.
11. Removed the old hardcoded Python override from server_runner/start_backend.bat.
12. Pinned frontend dev server to 127.0.0.1:5173 in frontend/package.json.
13. Pushed the cleaned update to GitHub main.
```

### Local-only settings not pushed to GitHub

The following settings must stay in `backend/.env` on each computer and must not be committed:

```text
FIREBIRD_DB_PATH=
FIREBIRD_USER=
FIREBIRD_PASSWORD=
FIREBIRD_CLIENT_LIBRARY=
PYTHON_BINARY=
FIREBIRD_ALLOW_RECEIPT_UPDATE=
```

For a computer that needs receipt editing, set:

```text
FIREBIRD_ALLOW_RECEIPT_UPDATE=true
```

For a computer that should be view/search only, leave it unset or set:

```text
FIREBIRD_ALLOW_RECEIPT_UPDATE=false
```

### Search Receipt update behavior

The Search Receipt module can:

```text
1. Search receipts by OR/receipt number.
2. View payment header and line-item details.
3. Show receipt status such as Paid, Void, or Cancelled.
4. Update only these PAYMENT fields when explicitly enabled:
   - COLLECTOR
   - RECEIPTNO
```

Receipt updates are disabled unless `FIREBIRD_ALLOW_RECEIPT_UPDATE=true` is present in the local `backend/.env`.

### Laptop setup reminder

When using this project on the laptop:

```text
1. Pull latest GitHub main.
2. Create or update backend/.env from backend/.env.example.
3. Fill in the local Firebird path, username, password, client library path, and Python binary.
4. Install Python dependency fdb if missing.
5. Run php artisan config:clear from backend.
6. Test with php artisan firebird:status.
7. Start backend and frontend using server_runner scripts.
```
