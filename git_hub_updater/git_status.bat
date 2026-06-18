@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
cd /d "%REPO_ROOT%"

where git >nul 2>nul
if errorlevel 1 (
    echo ERROR: Git is not installed or not available in PATH.
    pause
    exit /b 1
)

if not exist ".git" (
    echo ERROR: This folder is not initialized as a Git repository.
    echo Folder: %CD%
    pause
    exit /b 1
)

echo Repository folder:
echo %CD%
echo.
echo Current branch and status:
git status --short --branch
echo.
echo GitHub remote:
git remote -v
echo.
echo Latest commit:
git log -1 --oneline
echo.
pause
