@echo off
setlocal
set ROOT=%~dp0
set BACKEND=%ROOT%backend
set INPUT_FILE=%ROOT%runner\remitted_receipts_to_scrape.json

if not "%~1"=="" set INPUT_FILE=%~1

cd /d "%BACKEND%"
php artisan migrate --force
php artisan receipts:scrape-remitted --input="%INPUT_FILE%"

pause
