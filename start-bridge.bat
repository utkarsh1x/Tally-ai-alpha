@echo off
title TallyAI Local Gateway Bridge
color 0A
echo ========================================================
echo        Starting TallyAI Local Gateway Bridge
echo ========================================================
echo.
echo Checking Node.js installation...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js is not found in your PATH.
    echo Please install Node.js from https://nodejs.org/ to run the TallyAI Bridge.
    echo.
    pause
    exit /b 1
)

echo Node.js detected:
node -v
echo.
echo Starting Bridge on port 9001 (Connecting to TallyPrime on port 9000)...
echo.
node bridge/index.js
pause
