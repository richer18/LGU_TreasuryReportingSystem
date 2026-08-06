@echo off
title Starting XAMPP

echo Starting Apache...
start "" "C:\xampp\apache_start.bat"

timeout /t 3 /nobreak >nul

echo Starting MySQL...
start "" "C:\xampp\mysql_start.bat"

echo.
echo XAMPP Services Started.
exit