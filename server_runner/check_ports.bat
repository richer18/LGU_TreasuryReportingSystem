@echo off
setlocal

echo Checking LGU Treasury server ports...
echo.

powershell -NoProfile -Command "if ((Test-NetConnection '192.168.101.20' -Port 70 -InformationLevel Quiet)) { Write-Host 'Laravel API  http://192.168.101.20:70  RUNNING' } else { Write-Host 'Laravel API  http://192.168.101.20:70  NOT RUNNING' }"
powershell -NoProfile -Command "if ((Test-NetConnection '127.0.0.1' -Port 5173 -InformationLevel Quiet)) { Write-Host 'Frontend     http://192.168.101.20:5173  RUNNING' } else { Write-Host 'Frontend     http://192.168.101.20:5173  NOT RUNNING' }"

echo.
pause