@echo off
setlocal
title Universal Browser Control - 1-Click Setup

echo ========================================================
echo   Universal Browser Control Runtime - Automated Setup
echo ========================================================
echo.

:: 1. Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please install Node.js (version 18 or higher) from https://nodejs.org/
    echo After installing, reopen this setup script.
    echo.
    pause
    exit /b 1
)

:: 2. Install Dependencies
echo [1/3] Installing runtime and MCP dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install encountered an error.
    pause
    exit /b %ERRORLEVEL%
)

:: 3. Configure MCP
echo.
echo [2/3] Configuring MCP server in Antigravity / Claude config...
node "%~dp0scripts\configure-mcp.js"

:: 4. Create Desktop Shortcut for Brave
echo.
echo [3/3] Creating Brave (Antigravity) desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0brave-launcher\create-connected-shortcut.ps1"

echo.
echo ========================================================
echo   SETUP COMPLETED SUCCESSFULLY!
echo ========================================================
echo   How to use:
echo   1. Double-click the "Brave (Antigravity)" icon on your Desktop.
echo   2. Open Antigravity IDE (or Gemini CLI / Claude Desktop).
echo   3. Your AI agent is now connected to your browser!
echo ========================================================
echo.
pause
