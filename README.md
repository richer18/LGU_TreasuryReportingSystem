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
