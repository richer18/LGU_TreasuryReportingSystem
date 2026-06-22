# Server Runner

This folder is reserved for local helper scripts that start or manage the development servers.

## Intended Use

```text
Start Laravel API server
Start React/Vite frontend server
Start both backend and frontend together
Check local ports
Stop or restart local development services
```

## Difference From runner/

```text
runner/         Python reporting jobs, Firebird reads, Excel exports, imports
server_runner/  Local server startup and developer convenience scripts
```

## Suggested Future Scripts

```text
start_backend.bat
start_frontend.bat
start_all.bat
check_ports.bat
```

## Current Scripts

```text
server_menu.bat     Menu for server runner actions
setup_backend_auth_db.bat
                    Creates backend .env, portable SQLite auth DB, runs migrations,
                    and seeds the default admin login
start_backend.bat   Starts Laravel API on http://127.0.0.1:8000
start_frontend.bat  Starts React/Vite on http://127.0.0.1:5173 with a fresh Vite cache
start_all.bat       Starts backend and frontend
check_ports.bat     Checks whether ports 8000 and 5173 are running
```

Use `server_menu.bat` if you want a simple menu. On a newly cloned PC, run option 1 first to prepare the login database, then start the backend and frontend.

## New PC Login Setup

```text
server_menu.bat
Option 1. Setup backend auth database
```

This creates:

```text
backend\.env
backend\database\database.sqlite
```

Then it runs Laravel migrations and seeds the local admin account:

```text
Email: admin@zamboanguita.local
Password: admin123
```

## Default Local URLs

```text
Laravel API: http://127.0.0.1:8000
React frontend: http://127.0.0.1:5173
```
