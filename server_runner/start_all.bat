@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

call "%SCRIPT_DIR%start_frontend.bat" /no-pause

echo.
echo Requested frontend server. Laravel API is served by Apache/Laravel on port 70.
echo.
echo Backend API:
echo http://192.168.101.20:70
echo.
echo Frontend:
echo http://192.168.101.20:5173
pause