@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
cd /d "%REPO_ROOT%"

set "REPO_URL=https://github.com/richer18/LGU_TreasuryReportingSystem.git"
set "BRANCH=main"

where git >nul 2>nul
if errorlevel 1 (
    echo ERROR: Git is not installed or not available in PATH.
    pause
    exit /b 1
)

if not exist ".git" (
    echo ERROR: This folder is not initialized as a Git repository.
    echo Clone the repository first or initialize this folder.
    pause
    exit /b 1
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo Adding GitHub remote origin...
    git remote add origin "%REPO_URL%"
) else (
    echo Setting GitHub remote origin...
    git remote set-url origin "%REPO_URL%"
)

echo.
echo Checking local changes before pulling...
git status --short
echo.

git diff --quiet
if errorlevel 1 (
    echo WARNING: You have unstaged local changes.
    echo Commit or backup your changes before pulling from GitHub.
    pause
    exit /b 1
)

git diff --cached --quiet
if errorlevel 1 (
    echo WARNING: You have staged local changes.
    echo Commit or unstage your changes before pulling from GitHub.
    pause
    exit /b 1
)

echo Fetching latest changes from GitHub...
git fetch origin
if errorlevel 1 (
    echo ERROR: Fetch failed. Check internet, GitHub access, or repository URL.
    pause
    exit /b 1
)

echo.
echo Updating local machine from GitHub %BRANCH% branch...
git pull --rebase origin %BRANCH%
if errorlevel 1 (
    echo ERROR: Pull/rebase failed. Resolve conflicts, then run this again.
    pause
    exit /b 1
)

echo.
echo Local machine is updated successfully.
git status --short --branch
pause
