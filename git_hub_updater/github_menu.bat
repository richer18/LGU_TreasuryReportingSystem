@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "GIT_OPTIONAL_LOCKS=0"

:menu
cls
echo ================================================
echo   LGU Treasury Reporting System - GitHub Updater
echo ================================================
echo.
echo Repository helper for:
echo %SCRIPT_DIR%..
echo.
echo 1. Check Git status
echo 2. Update GitHub from this local machine
echo 3. Update this local machine from GitHub
echo 4. Exit
echo.
set /p CHOICE=Choose option [1-4]: 

if "%CHOICE%"=="1" (
    call "%SCRIPT_DIR%git_status.bat"
    goto menu
)

if "%CHOICE%"=="2" (
    call "%SCRIPT_DIR%update_github.bat"
    goto menu
)

if "%CHOICE%"=="3" (
    call "%SCRIPT_DIR%update_local_machine.bat"
    goto menu
)

if "%CHOICE%"=="4" (
    exit /b 0
)

echo Invalid choice.
pause
goto menu
