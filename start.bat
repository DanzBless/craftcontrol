@echo off
title CraftControl Server Dashboard
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\express" (
    echo [INFO] First run detected. Installing dependencies...
    call npm install --omit=dev
)

:: Open default browser to localhost:3000 after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Start the CraftControl dashboard server
node server.js
exit /b 0
