@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
set "GIT_OPTIONAL_LOCKS=0"
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

for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if not "%CURRENT_BRANCH%"=="%BRANCH%" (
    echo ERROR: Current branch is "%CURRENT_BRANCH%", expected "%BRANCH%".
    echo Please switch to %BRANCH% first before using this updater.
    pause
    exit /b 1
)

if exist ".git\index.lock" (
    echo ERROR: .git\index.lock exists.
    echo Close GitHub Desktop, VS Code Git operations, or other Git terminals.
    echo If no Git process is running, delete .git\index.lock, then try again.
    pause
    exit /b 1
)

echo.
echo Checking local changes before pulling...
git status --short
echo.

for /f "delims=" %%S in ('git status --porcelain') do set "HAS_LOCAL_CHANGES=1"
if "%HAS_LOCAL_CHANGES%"=="1" (
    echo WARNING: You have local changes or untracked files.
    echo Run update_github.bat first, or manually commit/back up your changes before pulling.
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
