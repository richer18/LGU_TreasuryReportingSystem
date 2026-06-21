@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
set "BACKEND_DIR=%REPO_ROOT%\backend"
set "HOST=127.0.0.1"
set "PORT=8000"
set "NO_PAUSE=%~1"

if not exist "%BACKEND_DIR%\artisan" (
    echo ERROR: Laravel backend was not found.
    echo Expected: %BACKEND_DIR%\artisan
    pause
    exit /b 1
)

where php >nul 2>nul
if errorlevel 1 (
    echo ERROR: PHP is not installed or not available in PATH.
    pause
    exit /b 1
)

powershell -NoProfile -Command "if ((Test-NetConnection '%HOST%' -Port %PORT% -InformationLevel Quiet)) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
    echo Laravel API already appears to be running:
    echo http://%HOST%:%PORT%
    if /I "%NO_PAUSE%"=="/no-pause" exit /b 0
    pause
    exit /b 0
)

echo Starting Laravel API server...
start "LGU Treasury Backend API" cmd /k "cd /d ""%BACKEND_DIR%"" && set PYTHON_BINARY=C:\Python314\python.exe&& php artisan serve --host=%HOST% --port=%PORT%"
echo.
echo Backend URL:
echo http://%HOST%:%PORT%
echo API health:
echo http://%HOST%:%PORT%/api/health
if /I "%NO_PAUSE%"=="/no-pause" exit /b 0
pause
