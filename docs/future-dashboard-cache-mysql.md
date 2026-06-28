# Future Dashboard Cache MySQL Plan

The current dashboard cache implementation uses JSON files only.

No MySQL table, migration, or dependency is required for this phase.

If the system later moves dashboard snapshots to MySQL, the suggested table name is:

`dashboard_summary_cache`

Suggested columns:

- `id`
- `cache_key`
- `year`
- `month`
- `date_from`
- `date_to`
- `payload_json`
- `generated_at`
- `expires_at`
- `status`
- `created_at`
- `updated_at`

The future MySQL version should keep the same public API:

- `GET /api/dashboard/summary`
- `POST /api/dashboard/summary/refresh`

That way, the React dashboard does not need to change when the cache storage moves from JSON to MySQL.
