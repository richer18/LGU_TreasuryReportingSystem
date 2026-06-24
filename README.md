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
## 2026-06-24 Backend ODBC and Login Setup

These notes document the current backend work done on `E:\LGU_TreasuryReportingSystem`.

### What was changed

```text
1. Switched backend Firebird access from local .FDB path mode to ODBC mode.
2. Added ODBC settings in backend/config/firebird.php.
3. Updated backend services so Laravel passes ODBC and Windows environment values to Python.
4. Updated runner/firebird_probe.py so it can connect using pyodbc when FIREBIRD_CONNECTION=odbc.
5. Updated runner/search_receipt.py so receipt search/update uses the same connection mode.
6. Fixed HTTP /api/firebird/status 503 by passing required Windows env values to Python:
   - SystemRoot
   - WINDIR
   - PATH
   - USERPROFILE
   - APPDATA
7. Fixed Python package visibility for pyodbc when called from Laravel/PHP server.
8. Generated Laravel APP_KEY for the local backend .env.
9. Ran pending Laravel auth/Sanctum migrations.
10. Seeded the default admin login account.
```

### Current backend Firebird mode

The backend now expects ODBC settings in `backend/.env`:

```env
FIREBIRD_CONNECTION=odbc
FIREBIRD_ODBC_DSN=itaxzamboanguita
FIREBIRD_USER=SYSDBA
FIREBIRD_PASSWORD=masterkey
FIREBIRD_CHARSET=UTF8
FIREBIRD_ODBC_CLIENT_LIBRARY='C:\Program Files\Firebird\Firebird_2_5\bin\fbclient.dll'
PYTHON_BINARY='C:\Python313\python.exe'
```

Important: keep real credentials inside `backend/.env` only. Do not commit `.env`.

### Current ODBC target

The DSN `itaxzamboanguita` should point to the main iTAX Firebird database:

```text
Database: main-server:i_tax046zamboanguita
Client:   C:\Program Files\Firebird\Firebird_2_5\bin\fbclient.dll
Driver:   Firebird/InterBase(r) ODBC driver
Dialect:  3
```

If `/api/firebird/status` fails with `Failed to locate host machine "main-server"`, check DNS/network resolution for `main-server`. The server was observed as:

```text
MAIN-SERVER.local
192.168.101.20
```

### Verified working commands

From `E:\LGU_TreasuryReportingSystem\backend`:

```powershell
php artisan config:clear
php artisan firebird:status
php artisan test
```

Expected Firebird status:

```text
ok: true
connection: odbc
database: itaxzamboanguita
table_count: 237
view_count: 1
```

Expected HTTP status while backend is running:

```text
GET http://127.0.0.1:8000/api/firebird/status
StatusCode: 200
```

### Login setup completed

The local Laravel auth database was prepared with:

```powershell
php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force
```

Default local login:

```text
Email:    admin@zamboanguita.local
Password: admin123
```

Expected login result:

```text
POST http://127.0.0.1:8000/api/login
StatusCode: 200
```

### New PC installation checklist

On a new PC, install these first:

```text
Git
XAMPP / PHP 8.2+
Composer
Node.js
Python 3.13
Firebird ODBC driver
Firebird 2.5 client / fbclient.dll
```

Clone and install:

```powershell
cd E:\
git clone https://github.com/richer18/LGU_TreasuryReportingSystem.git
cd E:\LGU_TreasuryReportingSystem\backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
C:\Python313\python.exe -m pip install pyodbc==5.3.0 fdb openpyxl
```

Configure `backend/.env` with the ODBC block shown above.

Set up `ODBC Data Sources (64-bit)` with DSN name:

```text
itaxzamboanguita
```

Then test:

```powershell
cd E:\LGU_TreasuryReportingSystem\backend
php artisan config:clear
php artisan firebird:status
```

Frontend setup:

```powershell
cd E:\LGU_TreasuryReportingSystem\frontend
npm install
npm run dev
```

Backend run:

```powershell
cd E:\LGU_TreasuryReportingSystem\backend
php artisan serve --host=127.0.0.1 --port=8000
```

Open:

```text
http://127.0.0.1:5173
```

### Troubleshooting notes

If `/api/firebird/status` returns 503 with `pyodbc is required`, install pyodbc for the same Python used by `PYTHON_BINARY`:

```powershell
C:\Python313\python.exe -m pip install pyodbc==5.3.0
```

If `/api/login` returns 422, confirm the email/password are correct. If login returns 500 about missing encryption key, run:

```powershell
php artisan key:generate --force
php artisan config:clear
```

If login fails because tables are missing, run:

```powershell
php artisan migrate --force
php artisan db:seed --force
```
