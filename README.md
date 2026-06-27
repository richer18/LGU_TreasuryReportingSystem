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

## 2026-06-27 UI, Report Preview, and RCD Handoff Updates

These notes document the latest desktop Codex work on the local system.

### UI theme and branding

Applied the official system color palette across the frontend:

```text
Primary Blue: #0554F2
Secondary Sky Blue: #6AAED9
Success Green: #8CBF3F
Warning Yellow: #F2D230
Danger / Alert Orange-Red: #D93F07
```

Reusable CSS tokens were added in:

```text
frontend/src/index.css
```

Main UI styling updates were added in:

```text
frontend/src/App.css
```

Affected areas:

```text
Login
Sidebar
Dashboard
General Fund / Trust Fund / Community Tax / Real Property Tax collection monitor pages
Reports page
RCD page
ACO Dashboard
MUI buttons, chips, alerts, tables, dialogs, status badges
```

Logo update:

```text
frontend/src/assets/TREASURER_ORIGINAL_LOGO.png
```

The app now imports the PNG logo in:

```text
frontend/src/App.jsx
frontend/src/pages/Login/LoginPage.jsx
```

The JPG source was kept as reference and was not deleted.

### Sidebar and page header behavior

Sidebar changes:

```text
1. Sidebar is sticky/fixed-height on desktop.
2. Main workspace is the scrollable area.
3. Sidebar navigation scrolls internally if needed.
4. Sign out stays at the bottom of the dark sidebar panel.
```

Files:

```text
frontend/src/App.css
```

Shared topbar was hidden for pages that already have their own page header:

```text
General Fund
Trust Fund
Community Tax
Real Property Tax
RCD
ACO Dashboard
Income Target
Search Receipt
Reports
```

File:

```text
frontend/src/App.jsx
```

### Reports page dropdown cleanup

The Reports dropdown had duplicate entries because reports 1 to 20 appeared in the main list and again under `Other Reports`.

Fix:

```text
1. Main dropdown now shows implemented/active reports only.
2. Reports 1 to 20 are shown only under Other Reports.
```

File:

```text
frontend/src/pages/Reports/ReportsPage.jsx
```

### Summary Report Sharing preview fixes

Report 27 preview had table alignment issues in the BSC/SEF sharing layout.

Fixes:

```text
1. Corrected LAND and BUILDING header colspans.
2. Added explicit column widths.
3. Allowed long labels like BLDG-RESIDENTIAL to wrap cleanly.
4. Prevented rightmost Prior columns from overflowing outside table borders.
```

Files:

```text
frontend/src/pages/Reports/ReportsPage.jsx
frontend/src/App.css
```

### Report 28 Provincial RPT Coding / Remittance Report

Report 28 preview was changed to follow:

```text
template/PROVINCIAL_RPT_CODING_TEMPLATE.xlsx
```

Template structure found:

```text
Sheets:
- GF
- SEF

Columns:
- Property classification
- Account code
- Current year amount
- Account code
- Prior year amount
- Account code
- Current year penalty amount
- Account code
- Prior year amount

Rows:
- Land Residential
- Land Commercial
- Land Industrial
- Land Machinery
- Land Agricultural
- Land Recreational
- Land-TIMBER
- Building Residential
- Building Commercial
- Building Industrial
- Building Machinery
- Building Agricultural
- Building Recreational
- SUB TOTAL
- TOTAL REMITTANCE GF / SEF
```

Implementation:

```text
1. Backend preview runner now returns template_cells for report 28.
2. Frontend converts Report 27 classification cells into Report 28 GF and SEF coding sheets.
3. Report 28 preview now renders both GENERAL FUND and SEF sections.
4. Report 28 GF uses 35% provincial share from BSC.
5. Report 28 SEF uses 50% provincial share from SEF.
```

Files:

```text
runner/report_preview_readonly.py
frontend/src/pages/Reports/ReportsPage.jsx
frontend/src/App.css
```

Important reconciliation result tested for June 2026:

```text
Date range: 2026-06-01 to 2026-06-30

Report 27 BSC Provincial:        61,308.331000
Report 28 GF Remittance:         61,308.331000
Variance:                         0.000000

Report 28 SEF Remittance:        87,583.330000
```

Conclusion:

```text
Report 28 TOTAL REMITTANCE GF ties to Report 27 BSC Provincial Share.
Report 28 TOTAL REMITTANCE SEF is computed from the same Report 27 SEF template cells.
```

### Current caution

Some property classification labels in the Firebird data do not map one-to-one with the provincial coding template labels. To avoid overstating totals, rows with unclear duplicate bucket mapping were left blank instead of reusing the same source bucket twice.

Examples needing future confirmation:

```text
Land Machinery
Land Recreational
Building Recreational
Special / Scientific / Industrial grouping
```

The grand totals are designed to reconcile, but per-classification allocation should still be reviewed with the Treasurer/Assessor coding rules before final official use.
## 2026-06-27 RCD Accountable Forms Tracking Phase 2

Accountable Forms Tracking is now prepared as a working RCD tab after the ACO remittance workflow foundation.

Implemented scope:

```text
Frontend:
- RCD page now shows an Accountable Forms tab.
- The tab has a custodian release form for Type/Form No., Serial/Booklet No., OR From, OR To, Collector, Date Released, Released By, Collector Signed By, and Remarks.
- The UI computes receipt count from OR From/To.
- Saved releases display in a table with Released Date, Form, Serial, Collector, OR Range, Receipts, Released By, Signed By, Ending Balance, Status, and Remarks.

Backend:
- Added Laravel API endpoints:
  - GET /api/rcd/accountable-forms
  - POST /api/rcd/accountable-forms
- These endpoints call the Python AccessDB runner actions accountable-list and accountable-save.

AccessDB / Python runner:
- rcd_access_store.py supports accountable-list and accountable-save.
- rcd_accountable_form_releases stores accountable form releases.
- Saved accountable form releases are later used by RCD remittance validation to check whether OR ranges match the assigned collector.
```

Important rule:

```text
Firebird .FDB remains read-only.
Accountable Forms release tracking is stored in AccessDB only.
Sold OR totals and payment validation still come from Firebird read-only checks.
```

## 2026-06-27 RCD New Updates Summary

These are the latest RCD workflow decisions and implemented behavior that should be carried forward.

### RCD workspace behavior

```text
- RCD page focuses on Daily Entries and Accountable Forms.
- Review Queue, Deposit Queue, old Remittance Timeline, and old placeholder Accountability sections were hidden/commented while the core RCD workflow is stabilized.
- New Entry opens the working RCD entry modal.
- Report No. is manual and optional for now because late/older RCDs may already have an external/manual report number.
- Fund/Template selection is no longer user-selected inside the core RCD entry. Generated/downloaded RCD output includes both:
  - 100_GF
  - 200_SEF
```

### A. Collections rule

```text
Collector enters:
- Type / Form No.
- OR From
- OR To
- Collector Amount

System validates against Firebird .FDB in read-only mode.

The .FDB amount is used only for validation/comparison.
The original Firebird database is never updated.
```

### RPT / AF 56 split rule

```text
AF 56 / RPT can contain both GF and SEF portions.
When validating 100_GF only, an RPT total may look doubled unless split.
Example:
Total in Firebird: 375.92
GF 100 share: 187.96
SEF 200 share: 187.96
Combined total: 375.92
```

### RCD template and output

```text
Template:
C:\Users\LIFT-LAPTOP\OneDrive\Desktop\LGU_TreasuryReportingSystem\template\RCD_UPDATED.xlsx

The Python export fills the Excel template, not a plain HTML/table printout.
When printing or downloading, both 100_GF and 200_SEF sheets are prepared.
The temporary output filename uses collector full name and date, for example:
RICARDO_T_ENOPIA_2026-05-28.xlsx
```

### Collector name mapping

```text
FLORA MY = FLORA MY D. FERRER
AGNES    = AGNES B. ELLO
RICARDO  = RICARDO T. ENOPIA
IRIS     = ANGELIQUE IRIS A. RAFALES
EMILY    = EMILY E. CREDO
```

### RCD labels and display

```text
- Community Tax Certificate should display as Comm Tax. in RCD outputs.
- Report No. blank field should not print as a dash.
- Save/print should not duplicate the same RCD batch.
- Print or download changes finalized output status to Saved.
```

### RCD daily batches action menu

```text
Action column should use one Actions dropdown/menu, not multiple crowded buttons.

Draft:
- View Details
- Edit
- Validate
- Delete Draft

For Remittance / Ready for Remittance:
- View Details
- Remit to ACO
- Edit
- Void / Cancel

Remitted to ACO:
- View Details
- Print
- Download PDF / Excel output
- Audit Trail

Received by ACO:
- View Details
- Print
- Download PDF / Excel output
- Audit Trail
- Void / Cancel with reason

Printed:
- View Details
- Reprint
- Download PDF / Excel output
- Audit Trail
- Void / Cancel with reason

Voided:
- View Details
- Audit Trail only
```

### Delete / void rule

```text
Do not allow delete for Saved, Remitted, Received, or Printed RCD records.
Only Draft can be deleted.
Finalized records must use Void / Cancel with reason.
```

### Remittance workflow

```text
Collector remits collection to the Accountable Collecting Officer (ACO).

Collector action label:
- Remit to ACO

ACO action label:
- Receive Remittance

Before remitting, validate:
- RCD has OR records
- Total amount is greater than zero
- No duplicate OR numbers
- No cancelled/voided OR numbers
- Collector matches the assigned accountable form OR range
- Amount remitted matches the total collection, or remarks are required for variance
```

### RCD audit fields to preserve

```text
remittance_status
remitted_to_aco_by
remitted_to_aco_at
received_by_aco
received_by_aco_at
amount_remitted
amount_received
variance_amount
remittance_remarks
created_by
created_at
updated_by
updated_at
printed_by
printed_at
voided_by
voided_at
void_reason
```

### Future RCD receipt/remittance lookup

```text
Goal:
When an OR is already remitted, the General Fund / receipt view should show:
- remitted status
- RCD number
- RCD date/status

Temporary source:
- JSON or AccessDB

Future source:
- MySQL tables after final validation

Cancelled or voided receipts must not be included in normal paid collection reports.
```

## 2026-06-27 ACO Dashboard Phase 2

The ACO Dashboard Phase 2 tabs are now functional instead of placeholders.

Implemented tabs:

```text
Remittances:
- Existing RCD remittance monitor remains active.
- Refresh now reloads RCD batches, Accountable Forms, and Audit Trail together.

Accountable Forms:
- Shows accountable form releases from AccessDB.
- Displays Released Date, Form, Serial, Collector, OR Range, Receipts, Released By, Signed By, Ending Balance, Status, and Remarks.
- Uses GET /api/rcd/accountable-forms.

Audit Trail:
- Shows recent RCD AccessDB audit logs globally.
- Displays Date/Time, RCD No., Collector, Action, Performed By, Status, Amount, and Details.
- Uses GET /api/rcd/audit-trail.

Reports:
- Shows operational ACO summaries from the active RCD data:
  - Collection per Collector
  - Status Summary
  - Form / OR Type Summary
```

Backend / runner update:

```text
runner/rcd_access_store.py now supports:
- audit-list

Laravel API endpoint added:
- GET /api/rcd/audit-trail
```
