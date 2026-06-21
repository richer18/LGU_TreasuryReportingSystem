@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

call "%SCRIPT_DIR%start_backend.bat" /no-pause
call "%SCRIPT_DIR%start_frontend.bat" /no-pause

echo.
echo Requested both development servers.
echo.
echo Backend API:
echo http://127.0.0.1:8000
echo.
echo Frontend:
echo http://127.0.0.1:5173
pause
