@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
set "FRONTEND_DIR=%REPO_ROOT%\frontend"
set "HOST=0.0.0.0"
set "PUBLIC_HOST=192.168.101.20"
set "CHECK_HOST=127.0.0.1"
set "PORT=5173"
set "NO_PAUSE=%~1"

if not exist "%FRONTEND_DIR%\package.json" (
    echo ERROR: React frontend was not found.
    echo Expected: %FRONTEND_DIR%\package.json
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm is not installed or not available in PATH.
    pause
    exit /b 1
)

pushd "%FRONTEND_DIR%"
if errorlevel 1 (
    echo ERROR: Could not enter frontend folder.
    echo %FRONTEND_DIR%
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing frontend npm dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: npm install failed. Check internet connection or package.json/package-lock.json.
        popd
        pause
        exit /b 1
    )
) else (
    echo Frontend npm dependencies already installed.
)

powershell -NoProfile -Command "if ((Test-NetConnection '%CHECK_HOST%' -Port %PORT% -InformationLevel Quiet)) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
    echo React frontend already appears to be running:
    echo http://%PUBLIC_HOST%:%PORT%
    popd
    if /I "%NO_PAUSE%"=="/no-pause" exit /b 0
    pause
    exit /b 0
)

echo Starting React/Vite frontend server...
start "LGU Treasury Frontend" cmd /k "pushd ""%FRONTEND_DIR%"" && npm run dev -- --host %HOST% --port %PORT% --force"
echo.
echo Frontend URL:
echo http://%PUBLIC_HOST%:%PORT%
popd
if /I "%NO_PAUSE%"=="/no-pause" exit /b 0
pause