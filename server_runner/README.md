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
start_backend.bat   Starts local Laravel dev API on http://127.0.0.1:8000
start_frontend.bat  Starts React/Vite on http://192.168.101.20:5173 for LAN access
start_all.bat       Starts backend and frontend
check_ports.bat     Checks whether Laravel port 70 and frontend port 5173 are running
test_firebird_connection.bat
                    Shows Firebird .env settings and runs php artisan firebird:status
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
Laravel API: http://192.168.101.20:70
React frontend: http://192.168.101.20:5173
```

## New PC Firebird Connection

If the `.FDB` is on the main/local machine and this app is running on another PC, update `backend\.env` on the new PC.

Use the main PC name or IP address before the database path:

```text
FIREBIRD_DB_PATH='MAIN-PC-NAME:C:\PATH\TO\YOUR_DATABASE.FDB'
```

or:

```text
FIREBIRD_DB_PATH='192.168.1.10:C:\PATH\TO\YOUR_DATABASE.FDB'
```

The new PC must also have the Firebird client installed:

```text
FIREBIRD_CLIENT_LIBRARY='C:\Program Files\Firebird\Firebird_2_5\bin\fbclient.dll'
```

On the main PC, allow Firebird through Windows Firewall, especially TCP port `3050`.

To test from the menu:

```text
server_menu.bat
Option 6. Test Firebird database connection
```
