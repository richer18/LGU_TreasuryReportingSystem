@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
set "BACKEND_DIR=%REPO_ROOT%\backend"
set "DB_FILE=%BACKEND_DIR%\database\database.sqlite"

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

cd /d "%BACKEND_DIR%"

if not exist ".env" (
    echo Creating backend .env from .env.example...
    copy ".env.example" ".env" >nul
) else (
    echo Existing backend .env found.
)

if not exist "vendor\autoload.php" (
    where composer >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Composer dependencies are missing and composer is not available in PATH.
        echo Run composer install inside:
        echo %BACKEND_DIR%
        pause
        exit /b 1
    )

    echo Installing Laravel backend dependencies...
    composer install
    if errorlevel 1 (
        echo ERROR: composer install failed.
        pause
        exit /b 1
    )
)

if not exist "database" mkdir "database"
if not exist "%DB_FILE%" (
    echo Creating portable SQLite auth database...
    type nul > "%DB_FILE%"
) else (
    echo SQLite auth database already exists:
    echo %DB_FILE%
)

findstr /R "^APP_KEY=base64:" ".env" >nul 2>nul
if errorlevel 1 (
    echo Generating Laravel APP_KEY...
    php artisan key:generate --force
    if errorlevel 1 (
        echo ERROR: APP_KEY generation failed.
        pause
        exit /b 1
    )
)

echo Clearing Laravel config cache...
php artisan config:clear
if errorlevel 1 (
    echo ERROR: config clear failed.
    pause
    exit /b 1
)

echo Running auth database migrations...
php artisan migrate --force
if errorlevel 1 (
    echo ERROR: database migration failed.
    pause
    exit /b 1
)

echo Seeding default admin login...
php artisan db:seed --force
if errorlevel 1 (
    echo ERROR: database seeding failed.
    pause
    exit /b 1
)

echo.
echo Backend auth database is ready.
echo Database:
echo %DB_FILE%
echo.
echo Test login:
echo Email: admin@zamboanguita.local
echo Password: admin123
echo.
pause
