@echo off
TITLE BusBook Dev Launcher
echo ==========================================================
echo    BusBook - Smart Bus Reservation System Launcher
echo ==========================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

echo [1/2] Launching Backend on Port 3000...
start "BusBook Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [2/2] Launching Frontend on Port 5173...
start "BusBook Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ==========================================================
echo    Services launched in separate windows!
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:3000/api
echo ==========================================================
echo.
pause
