@echo off
setlocal

echo Checking local development ports...
echo.

powershell -NoProfile -Command "if ((Test-NetConnection '127.0.0.1' -Port 8000 -InformationLevel Quiet)) { Write-Host 'Backend API  http://127.0.0.1:8000  RUNNING' } else { Write-Host 'Backend API  http://127.0.0.1:8000  NOT RUNNING' }"
powershell -NoProfile -Command "if ((Test-NetConnection '127.0.0.1' -Port 5173 -InformationLevel Quiet)) { Write-Host 'Frontend     http://127.0.0.1:5173  RUNNING' } else { Write-Host 'Frontend     http://127.0.0.1:5173  NOT RUNNING' }"

echo.
pause
