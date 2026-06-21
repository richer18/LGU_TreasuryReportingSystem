# Architecture Notes

## Target Stack

```text
Backend: Laravel REST API
Frontend: ReactJS
Runner: Python
Documentation: docs folder
Primary legacy source: Firebird .FDB
Future reporting store: MySQL
```

## Responsibility Split

| Layer | Responsibility |
| --- | --- |
| ReactJS frontend | User interface, filters, previews, export requests, dashboards |
| Laravel backend | REST API, authentication, authorization, validation, report catalog, orchestration |
| Python runner | Firebird reads, heavy report extraction, Excel template filling, import jobs |
| Server runner | Local helper scripts for starting backend/frontend development servers |
| MySQL | Future imported/cached reporting database for faster web reporting |
| Firebird .FDB | Existing source database; should be read-only for reporting |
| docs | Report rules, mappings, workflow notes, formulas, and handoff knowledge |

## Suggested Flow

```text
User selects report in React
React calls Laravel REST API
Laravel validates request
Laravel checks report catalog and user access
Laravel reads MySQL data or calls Python runner
Python runner reads Firebird in read-only mode when needed
Laravel returns status, preview data, or downloadable file link
```

## Current Firebird Connection Bridge

Because the current PHP installation does not include `pdo_firebird` or `interbase`, the first working Firebird connection is implemented through the Python runner.

```text
Laravel REST API -> App\Services\FirebirdProbeService -> runner/firebird_probe.py -> Firebird .FDB
```

All Python scripts for this system must live in `runner/`.

Current connection check:

```text
GET /api/firebird/status
php artisan firebird:status
python runner/firebird_probe.py --sample-limit 5
```

## Near-Term Module Plan

1. Report catalog API
2. Date range and collector filter validation
3. Python runner command wrapper
4. Export job tracking
5. MySQL import table design
6. Report preview endpoints
7. Excel/PDF export endpoints

## Report Categories

```text
RPT reports
Community Tax Certificate reports
Other Fees and Charges reports
Summary of Collection reports
Abstract of General Collections
Abstract of Trust Funds Collections
Provincial remittance/sharing reports
Full collection report
```

## Data Safety

Reporting operations should not insert, update, or delete records in Firebird. Any future write operation must be separated from reporting and reviewed as an official transaction-posting workflow.
