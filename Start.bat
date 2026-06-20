@echo off
title F1 Cognitive Telemetry
echo ========================================
echo   F1 Cognitive Focus Telemetry
echo   Starting application...
echo ========================================
echo.

:: Start Python backend in background
start /B python "%~dp0python-backend\app.py" >nul 2>&1

:: Wait for backend to be ready
echo [*] Starting AI backend...
:wait_loop
timeout /t 1 /nobreak >nul
curl -s http://localhost:5000/api/health >nul 2>&1
if errorlevel 1 goto wait_loop
echo [OK] Backend ready!

:: Start Electron app
echo [*] Opening dashboard...
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0main.js"

echo.
echo ========================================
echo   Application is running!
echo   Close this window to stop.
echo ========================================
pause >nul

:: Kill Python when user closes
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *app.py*" >nul 2>&1
