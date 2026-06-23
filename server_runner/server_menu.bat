@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

:menu
cls
echo ==================================================
echo   LGU Treasury Reporting System - Server Runner
echo ==================================================
echo.
echo 1. Setup backend auth database
echo 2. Start backend Laravel API
echo 3. Start frontend React/Vite
echo 4. Start backend and frontend
echo 5. Check local server ports
echo 6. Test Firebird database connection
echo 7. Exit
echo.
set /p CHOICE=Choose option [1-7]: 

if "%CHOICE%"=="1" (
    call "%SCRIPT_DIR%setup_backend_auth_db.bat"
    goto menu
)

if "%CHOICE%"=="2" (
    call "%SCRIPT_DIR%start_backend.bat"
    goto menu
)

if "%CHOICE%"=="3" (
    call "%SCRIPT_DIR%start_frontend.bat"
    goto menu
)

if "%CHOICE%"=="4" (
    call "%SCRIPT_DIR%start_all.bat"
    goto menu
)

if "%CHOICE%"=="5" (
    call "%SCRIPT_DIR%check_ports.bat"
    goto menu
)

if "%CHOICE%"=="6" (
    call "%SCRIPT_DIR%test_firebird_connection.bat"
    goto menu
)

if "%CHOICE%"=="7" (
    exit /b 0
)

echo Invalid choice.
pause
goto menu
