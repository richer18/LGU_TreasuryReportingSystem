# Python Runner

This folder is reserved for Python scripts that support the Laravel/React reporting system.

Project rule: all Python scripts for this system must be saved in this `runner/` folder.

Do not place Python scripts in `backend/`, `frontend/`, `docs/`, `server_runner/`, or the repository root unless there is a future approved reason.

## Intended Jobs

```text
Read Firebird .FDB data in read-only mode
Generate Excel reports using official templates
Validate report totals and reconciliations
Import selected reporting data into MySQL
Run scheduled or manual report generation jobs
```

## Expected Future Inputs

```text
report number
date from
date to
collector
fund type
output format
```

## Expected Future Outputs

```text
Excel files
PDF files
JSON summaries
validation logs
import result logs
```

## Safety Rule

Python runner scripts must not modify the live Firebird database. Use read-only queries for `.FDB` access.

## Current Firebird Probe

```powershell
python .\runner\firebird_probe.py --sample-limit 5
```

The Laravel backend calls this probe through:

```text
GET /api/firebird/status
```

CLI check from the backend folder:

```powershell
php artisan firebird:status
```
