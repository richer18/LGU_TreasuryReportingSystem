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

echo.
echo Current changes:
git status --short
echo.

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
