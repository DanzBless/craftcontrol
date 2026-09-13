@echo off
title CraftOrbit - Setup
cd /d "%~dp0"

echo =======================================================
echo          CraftOrbit - Quick Setup Wizard
echo =======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js (v18+ recommended) from: https://nodejs.org
    echo Once installed, run this setup.bat again.
    echo.
    pause
    exit /b 1
)

echo [1/2] Installing dependencies (express, ws)...
call npm install --omit=dev

echo.
echo [2/2] Setup complete! Launching CraftOrbit Web Dashboard...
echo.
start "" start.bat
exit /b 0
