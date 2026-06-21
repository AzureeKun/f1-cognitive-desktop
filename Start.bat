@echo off
title F1 Cognitive Telemetry
echo ========================================
echo   F1 Cognitive Focus Telemetry
echo   Starting application...
echo ========================================
echo.

:: Check if Python is available (try both 'py' and 'python')
set PYTHON_CMD=py
py --version >nul 2>&1
if errorlevel 1 (
    set PYTHON_CMD=python
    python --version >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python is not installed or not in PATH!
        echo Please install Python 3.10+ from https://www.python.org/downloads/
        pause
        exit /b 1
    )
)

:: Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Install Python dependencies if needed (first run)
if not exist "%~dp0python-backend\.deps_installed" (
    echo [*] First run: Installing Python dependencies...
    %PYTHON_CMD% -m pip install -r "%~dp0python-backend\requirements.txt" --quiet
    if errorlevel 1 (
        echo [ERROR] Failed to install Python dependencies!
        pause
        exit /b 1
    )
    echo. > "%~dp0python-backend\.deps_installed"
    echo [OK] Python dependencies installed!
)

:: Install Node modules if needed (first run)
if not exist "%~dp0node_modules" (
    echo [*] First run: Installing Node.js dependencies...
    npm install --prefix "%~dp0" --quiet
    if errorlevel 1 (
        echo [ERROR] Failed to install Node.js dependencies!
        pause
        exit /b 1
    )
    echo [OK] Node.js dependencies installed!
)

:: Start Python backend in background
echo [*] Starting AI backend...
start /B %PYTHON_CMD% "%~dp0python-backend\app.py"

:: Wait for backend to be ready
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
echo   Press any key to stop the server.
echo ========================================
pause >nul

:: Kill Python backend when user closes
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *" >nul 2>&1
