@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

:menu
cls
echo ==================================================
echo   LGU Treasury Reporting System - Server Runner
echo ==================================================
echo.
echo 1. Start backend Laravel API
echo 2. Start frontend React/Vite
echo 3. Start backend and frontend
echo 4. Check local server ports
echo 5. Exit
echo.
set /p CHOICE=Choose option [1-5]: 

if "%CHOICE%"=="1" (
    call "%SCRIPT_DIR%start_backend.bat"
    goto menu
)

if "%CHOICE%"=="2" (
    call "%SCRIPT_DIR%start_frontend.bat"
    goto menu
)

if "%CHOICE%"=="3" (
    call "%SCRIPT_DIR%start_all.bat"
    goto menu
)

if "%CHOICE%"=="4" (
    call "%SCRIPT_DIR%check_ports.bat"
    goto menu
)

if "%CHOICE%"=="5" (
    exit /b 0
)

echo Invalid choice.
pause
goto menu
