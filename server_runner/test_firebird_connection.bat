@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "BACKEND_DIR=%PROJECT_DIR%\backend"

echo ==================================================
echo   Firebird Database Connection Test
echo ==================================================
echo.

if not exist "%BACKEND_DIR%\.env" (
    echo ERROR: backend\.env was not found.
    echo Run server_menu.bat option 1 first to create the backend .env file.
    echo.
    pause
    exit /b 1
)

echo Current Firebird settings from backend\.env:
echo --------------------------------------------------
findstr /B /I "FIREBIRD_DB_PATH FIREBIRD_USER FIREBIRD_CHARSET FIREBIRD_CLIENT_LIBRARY PYTHON_BINARY" "%BACKEND_DIR%\.env"
echo --------------------------------------------------
echo.
echo If the .FDB is on another/main PC, FIREBIRD_DB_PATH must use this format:
echo   MAIN-PC-NAME:C:\ZAMBOANGUITA_DB\ZAMBOANGUITA.FDB
echo or:
echo   192.168.1.10:C:\ZAMBOANGUITA_DB\ZAMBOANGUITA.FDB
echo.
echo The new PC must also have fbclient.dll installed, usually:
echo   C:\Program Files\Firebird\Firebird_2_5\bin\fbclient.dll
echo.

pushd "%BACKEND_DIR%"
echo Running Laravel Firebird status check...
echo.
php artisan config:clear >nul 2>nul
php artisan firebird:status
set "RESULT=%ERRORLEVEL%"
popd

echo.
if "%RESULT%"=="0" (
    echo Firebird connection test finished.
) else (
    echo Firebird connection test failed.
    echo Check the database path/IP, Firebird service, Windows Firewall TCP 3050, and fbclient.dll path.
)
echo.
pause
exit /b %RESULT%
