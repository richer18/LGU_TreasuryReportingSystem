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
    echo Folder: %CD%
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
echo Current changes:
git status --short
echo.

echo Fetching GitHub state before pushing...
git fetch origin %BRANCH%
if errorlevel 1 (
    echo ERROR: Fetch failed. Check internet, GitHub login, or repository access.
    pause
    exit /b 1
)

git merge-base --is-ancestor origin/%BRANCH% HEAD
if errorlevel 1 (
    echo ERROR: GitHub has changes that are not yet in this local folder.
    echo Run update_local_machine.bat first, resolve any conflicts, then push again.
    pause
    exit /b 1
)

set "MSG=%~1"
if "%MSG%"=="" (
    set /p MSG=Commit message [Update LGU Treasury Reporting System]: 
)
if "%MSG%"=="" set "MSG=Update LGU Treasury Reporting System"

echo.
echo Staging project files...
git add -A
if errorlevel 1 (
    echo ERROR: git add failed.
    pause
    exit /b 1
)

git diff --cached --quiet
if errorlevel 1 (
    echo Creating commit...
    git commit -m "%MSG%"
    if errorlevel 1 (
        echo ERROR: git commit failed.
        pause
        exit /b 1
    )
) else (
    echo No staged changes to commit.
)

echo.
echo Pushing to GitHub %BRANCH% branch...
git push -u origin %BRANCH%
if errorlevel 1 (
    echo ERROR: Push failed. Check internet, GitHub login, or repository access.
    pause
    exit /b 1
)

echo.
echo GitHub is updated successfully.
git status --short --branch
pause
