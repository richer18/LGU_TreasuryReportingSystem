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

## 2026-06-27 Dashboard Logs Panel Update

The bottom-right Dashboard panel was changed from `Collection Share` to `Logs`.

Purpose:

```text
Show the latest paid receipt activity so the Treasurer can quickly see who recently paid.
```

Implementation:

```text
- Dashboard now loads recent paid collections from GET /api/general-fund/collections for the latest month window.
- The Logs panel displays newest paid receipts first.
- Cancelled/voided receipts are excluded by using rows with collection_status = Paid.
- Each log row shows taxpayer, OR number, payment date, collector, and total amount.
- The old Collection Share detail list was removed from that bottom panel.
- The existing Collection Share donut chart near the top remains available.
```

## 2026-06-28 Dashboard JSON Cache Snapshot

The Dashboard was optimized so normal page load no longer triggers many Firebird/Python scans.

Previous flow:

```text
Dashboard -> many API calls -> Laravel -> Python runners -> Firebird .FDB scans
```

Current flow:

```text
Dashboard -> GET /api/dashboard/summary -> Laravel reads JSON cache -> fast response
```

Implemented endpoints:

```text
GET  /api/dashboard/summary
POST /api/dashboard/summary/refresh
```

Frontend calls use the existing Axios base URL, so React calls:

```text
GET  /dashboard/summary
POST /dashboard/summary/refresh
```

JSON cache file location:

```text
backend/storage/app/dashboard-cache/dashboard_summary_YYYY_MM.json
```

Example:

```text
backend/storage/app/dashboard-cache/dashboard_summary_2026_06.json
```

Lock file:

```text
backend/storage/app/dashboard-cache/dashboard_summary_YYYY_MM.lock
```

Important behavior:

```text
- Normal dashboard page load reads JSON only.
- Firebird/Python runners do not run automatically on normal page load.
- Firebird/Python runners run only when the user clicks Refresh Data.
- Refresh writes a temporary JSON file first.
- Existing JSON is kept if refresh fails.
- Lock file prevents duplicate refresh scans.
```

New backend files:

```text
backend/app/Http/Controllers/Api/DashboardSummaryController.php
backend/app/Services/Dashboard/DashboardCacheService.php
backend/app/Services/Dashboard/DashboardSummaryBuilder.php
backend/app/Services/Dashboard/JsonDashboardCacheStore.php
backend/config/dashboard.php
docs/future-dashboard-cache-mysql.md
```

No MySQL table, migration, or MySQL dependency was added for this dashboard cache phase.

Testing checklist:

```text
1. Login as admin.
2. Open Dashboard.
3. If cache is missing, click Refresh Data.
4. Confirm JSON file is created in backend/storage/app/dashboard-cache/.
5. Refresh the browser.
6. Confirm Dashboard loads from JSON cache quickly.
7. Confirm Laravel logs show cache read during normal page load.
8. Confirm Firebird/Python work happens only during POST /api/dashboard/summary/refresh.
```

## 2026-06-28 User's Accounts Module

The system now has an Admin-only User's Accounts module for managing local Laravel/SQLite users.

No MySQL table was added.
No new users table was created.
No migration was added for this phase.

The module uses the existing users table fields:

```text
name
email
password
role
account_status
created_at
updated_at
```

Email is used as the login username for now because there is no separate username column yet.

Implemented routes:

```text
GET   /api/users
GET   /api/users/{user}
POST  /api/users
PUT   /api/users/{user}
PATCH /api/users/{user}/status
PATCH /api/users/{user}/reset-password
```

Frontend calls use the existing Axios base URL, so React calls:

```text
GET   /users
POST  /users
PUT   /users/{id}
PATCH /users/{id}/status
PATCH /users/{id}/reset-password
```

Security behavior:

```text
- User management APIs are protected by auth:sanctum and admin middleware.
- Only users with role admin can access the backend user management routes.
- Sidebar shows User's Accounts only if the logged-in user has users.manage permission.
- Non-admin users get 403 Forbidden if they call the API manually.
- Passwords are hashed with Laravel Hash::make().
- Passwords and password hashes are never returned in API responses.
- Passwords are never logged.
- Reset password is separate from normal edit.
- Current admin cannot deactivate their own account.
- Deactivating a user deletes that user's active Sanctum tokens.
```

Roles currently defined:

```text
admin
treasurer
cashier
collector
viewer
```

New backend files:

```text
backend/app/Http/Controllers/Api/UserAccountController.php
backend/app/Http/Middleware/EnsureAdminUser.php
```

Frontend files:

```text
frontend/src/pages/UserAccounts/UserAccountsPage.jsx
frontend/src/App.jsx
frontend/src/App.css
```

User's Accounts UI includes:

```text
- User list table
- Search by name/email
- Filter by role
- Filter by status
- View details modal
- New User Account modal
- Edit User modal
- Reset Password modal
- Activate/Deactivate action
```

The User Details, New User Account, Edit User, and Reset Password modals were improved with:

```text
- Compact centered modal layout
- Profile/avatar header
- Role and status chips
- Top-right close button
- Cleaner form spacing
- Responsive layout for smaller screens
```

Testing checklist:

```text
1. Login as admin@zamboanguita.local.
2. Confirm User's Accounts appears in the sidebar.
3. Create a user with an 8+ character password.
4. Confirm password is not visible in API response.
5. Edit name/email/role/status without changing password.
6. Reset password from the separate reset modal.
7. Deactivate another user and confirm login is blocked.
8. Confirm current admin cannot deactivate self.
9. Login as non-admin and confirm User's Accounts is hidden.
10. Call /api/users as non-admin and confirm 403 Forbidden.
```

## 2026-06-28 Receipt Exceptions Report

The system now has a first-version read-only Receipt Exceptions Report module.

Scope of this phase:

```text
- Read-only report module only
- No Firebird writes
- No AccessDB writes
- No MySQL
- No migration
- No new database table
- No RCD save/remit workflow change
- No Dashboard JSON cache change
- No User's Accounts change
```

Sidebar page:

```text
Receipt Exceptions
```

The page is available to users with `reports.view` permission and contains two tabs:

```text
1. Canceled / Void
2. Not Remitted
```

Implemented backend routes:

```text
GET /api/reports/receipt-exceptions/canceled-void
GET /api/reports/receipt-exceptions/not-remitted
```

Frontend Axios calls use the existing `/api` base URL, so React calls:

```text
GET /reports/receipt-exceptions/canceled-void
GET /reports/receipt-exceptions/not-remitted
```

New/updated implementation files:

```text
runner/receipt_exceptions_readonly.py
backend/app/Services/ReceiptExceptionsReportService.php
backend/app/Http/Controllers/Api/ReceiptExceptionsController.php
backend/config/firebird.php
backend/routes/api.php
frontend/src/pages/ReceiptExceptions/ReceiptExceptionsPage.jsx
frontend/src/App.jsx
frontend/src/App.css
```

Canceled / Void detection uses confirmed Firebird fields:

```text
PAYMENT.VOID_BV = 1
PAYMENT.STATUS_CT IN ('VOID', 'VOI', 'CNL', 'CAN', 'CNC', 'CANCEL', 'CANCELLED')
T_STATUS.DESCRIPTION contains CANCEL or VOID
PAYMENTCLASSDETAIL.CANCELLED_BV = 1
```

Canceled / Void report columns:

```text
OR Date
OR Number
Taxpayer Name
Amount
Fund Type
Transaction Type
Collector / Cashier
Status
Status Code
Void Flag
Remarks
Transaction Date
User ID
```

Not Remitted detection uses first-version range-based matching:

```text
1. Start from valid/paid Firebird PAYMENT records.
2. Exclude canceled/void receipts using the same canceled/void rules.
3. If PAYMENT.RCDNUMBER has a value, treat the receipt as remitted.
4. If PAYMENT.RCDNUMBER is blank, compare the OR number against AccessDB rcd_collection_lines receipt_no_from and receipt_no_to ranges.
5. If the OR is inside a final/remitted RCD range, treat it as remitted and exclude it from the report.
6. If the OR is inside a draft/pending RCD range, show it as Pending / Not Fully Remitted.
7. If no matching final range is found, show it as Not Remitted.
```

Final/remitted RCD statuses for first version:

```text
Remitted to ACO
Received by ACO
Posted
Completed
```

Pending/not-final RCD statuses for first version:

```text
Draft
Saved
For Remittance
Ready for Remittance
With Variance
```

Not Remitted report columns:

```text
OR Date
OR Number
Taxpayer Name
Amount
Fund Type
Transaction Type
Collector / Cashier
Transaction Date
RCD Number
RCD Date
RCD Status
Days Unremitted
Remarks
```

Filters available in the UI:

```text
Date From
Date To
Fund Type
Collector / Cashier
Status
Transaction Type
OR Number
Taxpayer
```

Pagination:

```text
page
limit
```

The frontend table supports rows per page:

```text
25
50
100
250
```

Sample API calls:

```text
GET /api/reports/receipt-exceptions/canceled-void?date_from=2026-06-01&date_to=2026-06-30&page=1&limit=25
GET /api/reports/receipt-exceptions/not-remitted?date_from=2026-06-01&date_to=2026-06-30&collector=ricardo&page=1&limit=25
```

OR number handling:

```text
- Original PAYMENT.RECEIPTNO is preserved for display.
- A normalized numeric OR value is used only for AccessDB range matching.
- If an OR cannot be safely converted to numeric form, the row is not crashed or skipped.
- The row is marked Unable to range-match with a clear remarks value.
```

Important limitation:

```text
Not Remitted detection uses PAYMENT.RCDNUMBER plus RCD range matching.
Exact per-OR remittance tracking can be improved later by populating rcd_entries.
```

Testing checklist:

```text
1. Start backend and frontend.
2. Login as a user with reports.view permission.
3. Open Receipt Exceptions from the sidebar.
4. Confirm Canceled / Void loads using current-month date defaults.
5. Set Date From and Date To, then click Load Report.
6. Switch to Not Remitted.
7. Confirm the note about PAYMENT.RCDNUMBER plus RCD range matching appears.
8. Test OR Number and Taxpayer filters.
9. Confirm totals show total_count and total_amount.
10. Confirm pagination changes the page/limit without loading all rows at once.
```

Verification commands used:

```powershell
php -l backend/routes/api.php
php -l backend/app/Http/Controllers/Api/ReceiptExceptionsController.php
php -l backend/app/Services/ReceiptExceptionsReportService.php
php -l backend/config/firebird.php
php artisan route:list --path=receipt-exceptions
npm run build
```

## 2026-06-29 MySQL Future Deployment and Current System Handoff

This section documents the latest planning and review for moving selected LGU Treasury Reporting System data to MySQL later while keeping the existing SQLite laptop setup working.

### Current database direction

```text
Current local app database:
- SQLite is still used for the laptop/local Laravel auth and app storage.

Legacy official collection source:
- Firebird .FDB remains the source of truth for actual payments, OR numbers, taxpayer names, collection dates, amounts, RPT/CTC/General Fund/Trust Fund/Other Fees details, and payment status.

Future server database:
- MySQL 8.0+ through XAMPP will store app-owned data only.
- Do not replace Firebird payment records with MySQL records.
- Do not remove SQLite support until the migration is formally approved and tested.
```

### XAMPP MySQL settings planned

```text
Database name: lgu_treasury_reporting
MySQL target: MySQL 8.0+
XAMPP MySQL port: 3307
Host: 127.0.0.1
Default local user: root
Default local password: blank unless configured in XAMPP
```

Future Laravel `.env` values when switching a server/PC to MySQL:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=lgu_treasury_reporting
DB_USERNAME=root
DB_PASSWORD=
```

Command to run the future standalone SQL script in XAMPP:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root -P 3307 < database\mysql\lgu_treasury_schema.sql
```

If root has a password:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root -p -P 3307 < database\mysql\lgu_treasury_schema.sql
```

Important note:

```text
-P means port.
-p means password.
```

### What should be stored in MySQL later

MySQL should store app-owned and workflow-owned data:

```text
1. User accounts
   - users
   - roles
   - permissions
   - role_permissions
   - user_permissions

2. Collector/cashier assignment mapping
   - collector_cashier_assignments
   - maps Laravel users to Firebird PAYMENT.COLLECTOR / PAYMENT.USERID safely

3. Accountable forms
   - accountable_forms
   - accountable_form_transactions
   - tracks AF51, AF56, CTC, and other accountable form release/return logs

4. RCD workflow
   - rcd_batches
   - rcd_collection_lines
   - rcd_entries
   - rcd_remittance_events
   - rcd_access_audit_logs

5. Income target
   - income_targets

6. Cache/snapshot tables
   - dashboard_summary_cache
   - report_preview_cache
   - generated_report_files
   - receipt_exception_snapshots

7. Treasury calendar/reminders
   - treasury_calendar_events
```

### What should not be copied as master data

Do not use MySQL as the master source for these yet:

```text
- All Firebird PAYMENT rows
- All PAYMENTDETAIL rows
- All PAYMENTCLASSDETAIL rows
- All taxpayer master records
- All RPT/CTC/general fund/trust fund payment details
```

Reason:

```text
Firebird .FDB is still the official legacy source of collection truth.
MySQL should store RCD/remittance workflow, audit trail, user management, accountable-form tracking, income targets, cache snapshots, and other web-app data.
```

### Remitted OR tracking decision

The OR numbers that have been remitted should be stored in MySQL later, but only as RCD/remittance tracking records, not as replacement payment records.

Recommended table:

```text
rcd_entries
```

Purpose:

```text
- Store every OR included in an RCD/remittance.
- Link each OR to rcd_batches.
- Store receipt_no, receipt_date, taxpayer_name, amount, collector_name, fund_type, transaction_type, Firebird payment/detail IDs, RCD number, RCD date, remittance status, remitted_at, received_at, and validation status.
- Allow Search Receipt and General Fund View to show whether an OR is already remitted and what RCD number it belongs to.
- Make Receipts Not Remitted reporting more accurate than range-only matching.
```

Rule:

```text
Only save ORs to MySQL when they enter the RCD/remittance workflow.
Do not import all Firebird receipts into MySQL by default.
Cancelled or voided receipts must not be included in normal paid collection totals.
```

### Proposed standalone SQL file

The proposed future schema file is:

```text
database/mysql/lgu_treasury_schema.sql
```

Status:

```text
- SQL script was designed in the conversation.
- File has not yet been created unless explicitly approved later.
- No Laravel migrations have been created for this MySQL phase.
- No MySQL tables have been created or executed from this plan yet.
```

The script should include these tables:

```text
roles
permissions
users
role_permissions
user_permissions
collector_cashier_assignments
accountable_forms
accountable_form_transactions
rcd_batches
rcd_collection_lines
rcd_entries
rcd_remittance_events
rcd_access_audit_logs
dashboard_summary_cache
report_preview_cache
generated_report_files
receipt_exception_snapshots
income_targets
treasury_calendar_events
```

### Report 37 investigation result

A new report was investigated but not implemented yet:

```text
37. Official Report Breakdown
Subtitle: Category Breakdown
Output: Download-only Excel report
Endpoint to reuse: GET /api/generated-reports/37/download
Frontend call: /generated-reports/37/download
```

Report 37 needs Date From / Date To filters instead of Month and Year.

Example call:

```text
/generated-reports/37/download?date_from=2026-01-01&date_to=2026-03-31
```

Required categories:

```text
Tax on Business
Receipts from Economic Enterprises
Regulatory Fees
Service/User Charges
Real Property Tax only Municipal Sharing
RPT GF
RPT SF
Grand Total
```

Existing mapping found:

```text
Tax on Business:
- Manufacturing
- Distributor
- Retailing
- Banks & Other Financial Int.
- Other Business Tax

Receipts from Economic Enterprises:
- Water Fee
- Market Stall Fee
- Cash Tickets
- SlaughterHouse Fee
- Rental of Equipment
- Cockpit Share
- Sultadas
- Diving Fee

Regulatory Fees:
- Mayor's Permit
- Weights & Measures
- Tricycle Permit Fee
- Occupation Tax
- Cert. of Ownership
- Cert. of Transfer
- Sand & Gravel
- Fines & Penalties
- Docking and Mooring Fee
- Fishing Permit Fee
- Miscellaneous

Service/User Charges:
- Registration of Birth
- Marriage Fee
- Burial Fee
- Correction of Entry
- Sale of Agri. Prod.
- Sale of Acct. Forms
- Doc Stamp Tax
- Secretaries Fees
- Med./Lab. Fees
- Garbage Fees

RPT GF / BSC:
- PAYMENT + PAYMENTCLASSDETAIL
- ITAXTYPE_CT = 'BSC'
- Municipal share = 40%

RPT SF / SEF:
- PAYMENT + PAYMENTCLASSDETAIL
- ITAXTYPE_CT = 'SEF'
- Municipal share = 50%
```

Files expected to change if Report 37 is approved:

```text
frontend/src/pages/Reports/ReportsPage.jsx
frontend/src/data/reportCatalog.js
backend/app/Reports/ReportCatalog.php
backend/app/Http/Controllers/Api/GeneratedReportController.php
runner/report_excel_export_readonly.py
```

Do not change Report 21/27 calculations when adding Report 37.
Do not double-count RPT or sharing amounts.

### Current repository review note

Latest quick review showed one modified local data file:

```text
backend/database/rcd/rcd_remittance.accdb
```

This is the AccessDB RCD data file. Treat it as local data. Do not overwrite or reset it unless the user explicitly approves.

No project code files were changed during the MySQL planning step.

### Recommended next steps on another PC

```text
1. Read this README first.
2. Keep SQLite running unless the user explicitly wants to switch to MySQL.
3. Configure backend/.env for local Firebird/ODBC access.
4. Start backend and frontend using server_runner/server_menu.bat.
5. Confirm login works.
6. Confirm /api/firebird/status works.
7. Confirm Dashboard loads from JSON cache.
8. Confirm Reports page still downloads reports 21 to 36.
9. Confirm RCD AccessDB path is valid and not overwritten.
10. Only after approval, create database/mysql/lgu_treasury_schema.sql from the planned SQL script.
11. Only after approval, run the SQL against XAMPP MySQL port 3307.
12. Only after approval, convert the standalone SQL design into Laravel migrations.
```

## 2026-06-29 Next MySQL Step: Data Import / Seed Runner

If the MySQL database and tables were already created from the planned `lgu_treasury_schema.sql`, the next step is not to change the schema immediately. The next step is to build a controlled data import / seed runner.

### Goal of the next runner

Create a safe script runner that can insert or import app-owned data into MySQL, especially:

```text
1. User login accounts
2. Roles and permissions seed data
3. Role-permission mappings
4. Collector/cashier assignments
5. Income target data from Excel
6. Optional dashboard/report cache seed data later
7. RCD/remitted OR data later after workflow approval
```

### Recommended runner location

Use the project runner folder:

```text
runner/mysql_seed_runner.py
```

Optional helper batch file later:

```text
server_runner/mysql_seed_menu.bat
```

Do not place Python scripts outside `runner/`.

### Recommended MySQL connection source

The runner should read database settings from environment variables or Laravel `.env`, not hardcoded values.

Future MySQL `.env` values:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=lgu_treasury_reporting
DB_USERNAME=root
DB_PASSWORD=
```

### First data to insert

Priority order:

```text
1. roles
2. permissions
3. role_permissions
4. first admin user
5. collector_cashier_assignments
6. income_targets
```

### User import rule

Passwords must never be plaintext in MySQL.

The runner must either:

```text
- Ask Laravel/API to create users so Laravel Hash::make() is used; or
- Generate bcrypt-compatible password hashes safely; or
- Accept already-hashed Laravel password values only.
```

Do not store plaintext passwords.
Do not log passwords.
Do not print password hashes in normal logs.

Recommended first admin placeholder:

```text
Email: admin@zamboanguita.local
Password: create/reset through Laravel, not direct plaintext SQL
Role: admin
Status: active
```

### Income Target import

The income target importer should read from the existing Excel file if available:

```text
IncomeTarget/2026_Income_Target.xlsx
```

Expected MySQL target table:

```text
income_targets
```

Expected columns to populate:

```text
year
source_group
target_amount
increase_rate
remarks
created_by
updated_by
created_at
updated_at
```

Expected source groups:

```text
Tax on Business
Regulatory Fees and Charges
Receipt from Economic Enterprise
Service/User Charges
Other Taxes
RPT Local GF
RPT SEF
Others
```

Annual increase rule:

```text
Default planned increase rate: 10% per year
Stored as: 0.1000
```

### Collector/cashier assignment seed

Seed these known mappings:

```text
FLORA MY D. FERRER        -> firebird collector: flora
AGNES B. ELLO             -> firebird collector: agnes
RICARDO T. ENOPIA         -> firebird collector: ricardo
EMILY E. CREDO            -> firebird collector: emily
ANGELIQUE IRIS A. RAFALES -> firebird collector: angelique
```

### Idempotent import requirement

The runner must be safe to run more than once.

Use upsert behavior:

```text
- roles by name
- permissions by name
- users by email
- collector assignments by firebird_collector_name or alias
- income_targets by year + source_group
```

Do not duplicate rows when the runner is executed again.

### Suggested runner commands

Possible future commands:

```powershell
python .\runner\mysql_seed_runner.py --check
python .\runner\mysql_seed_runner.py --seed-roles
python .\runner\mysql_seed_runner.py --seed-admin
python .\runner\mysql_seed_runner.py --seed-collectors
python .\runner\mysql_seed_runner.py --import-income-target 2026
python .\runner\mysql_seed_runner.py --all
```

### Safety rules for next developer

```text
- Do not import all Firebird payments into MySQL.
- Do not overwrite Firebird data.
- Do not modify Firebird from this runner.
- MySQL should store app-owned data only.
- For remitted OR tracking, import only ORs that enter the RCD/remittance workflow.
- Keep SQLite support until the MySQL switch is formally approved.
- Test import first on a local XAMPP database, not production.
```

### Validation after data import

After the seed/import runner is built, verify:

```text
1. MySQL roles exist.
2. MySQL permissions exist.
3. Admin user can login after Laravel is configured to MySQL.
4. Collector/cashier assignment rows exist and match Firebird collector names.
5. Income targets match the Excel workbook totals.
6. Running the import twice does not duplicate records.
7. No plaintext passwords exist in the users table.
```

### Current status

```text
- MySQL schema design was prepared.
- The user may already have created the MySQL database and tables using the SQL script.
- The next task is to create a data import/seed runner.
- No import runner has been created yet in this handoff update.
```

## 2026-07-07 MySQL Login, Cash Tickets, and RCD Workspace Implementation

This section records the implementation work completed on July 7, 2026.

### Database switch

Laravel was switched from SQLite to the local XAMPP MySQL database.

Active `.env` database settings:

```text
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=lgu_treasury_reporting
DB_USERNAME=root
DB_PASSWORD=
```

Verified runtime connection:

```text
driver: mysql
database: lgu_treasury_reporting
```

Important rule remains unchanged:

```text
Firebird is still the official source for receipt/payment validation.
MySQL stores app-owned workflow data only.
Do not import all Firebird payments into MySQL.
Do not modify Firebird data.
```

### Database login accounts

The Laravel login now uses database users from MySQL.

Seeded login accounts:

```text
Admin:     admin@zamboanguita.local     / admin123
Treasurer: treasurer@zamboanguita.local / treasurer123
Cashier:   cashier@zamboanguita.local   / cashier123
Collector: collector@zamboanguita.local / collector123
Viewer:    viewer@zamboanguita.local    / viewer123
```

Implementation notes:

```text
- AuthController normalizes email by trimming and lowercasing before lookup.
- DatabaseSeeder creates one active account per role.
- Existing user passwords are preserved when accounts already exist.
- Login form no longer pre-fills the admin email.
```

Verification:

```text
- All five users exist in MySQL.
- All five default passwords validated with Laravel Hash::check().
- Cashier login through POST /api/login returned HTTP 200 with token and role cashier.
```

Recommended operational step:

```text
Change default passwords through User's Accounts after first real deployment.
```

### Cash Tickets module

Cash Tickets is now implemented as an app-owned MySQL module.

Main backend pieces:

```text
backend/app/Http/Controllers/Api/CashTicketController.php
backend/app/Models/CashTicketType.php
backend/app/Models/CashTicketBook.php
backend/app/Models/CashTicketCollection.php
backend/app/Models/CashTicketReportRow.php
backend/app/Models/CashTicketAuditLog.php
backend/database/migrations/2026_07_07_000001_create_cash_ticket_tables.php
backend/database/migrations/2026_07_07_000002_add_release_tracking_to_cash_ticket_books.php
backend/database/mysql/cash_ticket_schema.sql
```

Main frontend piece:

```text
frontend/src/pages/CashTickets/CashTicketsPage.jsx
```

Cash Ticket API routes:

```text
GET  /api/cash-tickets
GET  /api/cash-tickets/template
POST /api/cash-tickets/import
GET  /api/cash-tickets/types
POST /api/cash-tickets/types
PUT  /api/cash-tickets/types/{type}
GET  /api/cash-tickets/books
POST /api/cash-tickets/books
PUT  /api/cash-tickets/books/{book}
GET  /api/cash-tickets/collections
POST /api/cash-tickets/collections
PUT  /api/cash-tickets/collections/{collection}
POST /api/cash-tickets/report-rows
```

Cash Ticket tables:

```text
cash_ticket_types
cash_ticket_books
cash_ticket_collections
cash_ticket_report_rows
cash_ticket_audit_logs
```

Implemented workflow:

```text
1. Record cash ticket given/released to collector.
2. Track serial number as one field.
3. Track amount released, collector signature, date issued, assigned collector.
4. Record cash ticket collections/remittances.
5. Monitor amount released, amount remitted, balance, last remittance date, and last RD number.
6. Import from Excel template.
7. Download blank import template.
```

Import template:

```text
template/CASH_TICKET_IMPORT_TEMPLATE.xlsx
```

The template includes:

```text
Sheet 1: Cash Ticket Import
Sheet 2: Given to Collector
```

### RCD Workspace MySQL storage

RCD Workspace was switched from AccessDB runner storage to Laravel/MySQL storage while keeping the same frontend/API route contract.

Main backend pieces:

```text
backend/app/Http/Controllers/Api/RcdAccessController.php
backend/app/Services/RcdMysqlStoreService.php
backend/database/migrations/2026_07_07_000003_prepare_rcd_mysql_workspace.php
runner/rcd_mysql_export.py
```

RCD API routes remain unchanged:

```text
GET    /api/rcd/access/status
GET    /api/rcd/batches
POST   /api/rcd/batches
GET    /api/rcd/batches/{reportNo}
PATCH  /api/rcd/batches/{reportNo}
DELETE /api/rcd/batches/{reportNo}
GET    /api/rcd/batches/{reportNo}/download
POST   /api/rcd/batches/{reportNo}/remit
POST   /api/rcd/batches/{reportNo}/receive
GET    /api/rcd/batches/{reportNo}/audit
GET    /api/rcd/audit-trail
GET    /api/rcd/accountable-forms
POST   /api/rcd/accountable-forms
GET    /api/rcd/generate-or
POST   /api/rcd/generate-or
```

RCD MySQL tables used:

```text
rcd_batches
rcd_collection_lines
rcd_entries
rcd_remittance_events
rcd_access_audit_logs
rcd_accountable_form_releases
rcd_accountability_snapshots
```

RCD process:

```text
1. Accountable Form Release
2. New RCD Entry
3. Validate OR lines against Firebird
4. Save RCD workflow data to MySQL
5. Remit to ACO
6. ACO Receive
7. Print/Download RCD Excel
```

Important RCD source-of-truth split:

```text
Firebird = official receipt/payment validation source
MySQL    = RCD workflow, remittance, accountable forms, snapshots, audit trail
```

RCD status endpoint now reports:

```text
driver: MySQL
database: lgu_treasury_reporting
exists: true
```

### Verification completed on 2026-07-07

Commands/checks run:

```text
php artisan config:clear
php artisan migrate --force
php artisan db:seed --force
php artisan migrate:status
php artisan route:list --path=api
php artisan test
npm.cmd run build
python -m py_compile runner/rcd_mysql_export.py
```

Verified results:

```text
- Laravel active database is MySQL.
- Database is lgu_treasury_reporting.
- Login users exist and can authenticate.
- Cash Ticket MySQL tables exist.
- RCD MySQL tables exist.
- RCD save/list/show/remit/receive smoke test passed.
- RCD export generated a valid .xlsx.
- Backend tests passed.
- Frontend production build passed.
```

Smoke test note:

```text
RCD service smoke tests were wrapped in DB transactions and rolled back, so no test RCD data remained.
```

### Review findings / follow-up risks from 2026-07-08 review

These were found after the MySQL/RCD implementation and should be handled next.

1. RCD export status risk

```text
RcdMysqlStoreService export currently updates exported batches to Saved.
If a batch is already Remitted to ACO, Received by ACO, or With Variance,
downloading/printing may downgrade the workflow status.

Recommended fix:
Only change Draft/Printed-style statuses when exporting, or do not change status at all on download.
```

2. Receipt Exceptions and Calendar still reference old AccessDB RCD range matching

```text
ReceiptExceptionsReportService and CalendarService still pass RCD_ACCESS_DB to Python runners.
The runners still read old AccessDB RCD range data.

Recommended fix:
Move RCD range lookup for Receipt Exceptions and Calendar markers to MySQL,
or add a MySQL-aware runner path.
```

3. Fresh install risk for RCD MySQL tables

```text
The current RCD MySQL migration prepares/extends existing rcd_batches and rcd_collection_lines.
It does not create the base RCD tables if they are missing.

This is okay on the current machine because the tables already exist,
but a new clean database may need a full base RCD migration.
```

4. RCD variance field meaning

```text
variance_amount is currently used for both Firebird-vs-collector difference
and later remittance/ACO receive variance.

Recommended fix:
Use separate fields or labels for validation difference and remittance variance.
```

5. Automated test gap

```text
phpunit.xml still uses SQLite for automated tests.
Existing tests do not fully exercise Cash Ticket or RCD MySQL workflows.

Recommended fix:
Add focused feature tests for login, Cash Tickets, and RCD MySQL service behavior.
```

### Recommended next work order

```text
1. Fix RCD export so download/print does not downgrade remittance status.
2. Update Receipt Exceptions RCD range matching to use MySQL.
3. Update Calendar RCD markers to use MySQL.
4. Add a full base migration for RCD MySQL tables for clean installs.
5. Clarify RCD variance fields.
6. Add feature tests for Cash Tickets and RCD workflow.
7. Browser-test real workflow: login -> cash ticket -> RCD -> remit -> receive -> export.
8. Commit and push once browser workflow is confirmed.
```

