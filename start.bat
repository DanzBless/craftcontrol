@echo off
title Minecraft Server Web Dashboard
cd /d "%~dp0"

echo =======================================================
echo   Starting Minecraft Server Web Dashboard...
echo =======================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    pause
    exit /b 1
)

:: Automatically open localhost browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Start the node server (exiting automatically when shutdown button is clicked)
node server.js
exit /b 0
