@echo off
set "BRAVE_EXE=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
set "USER_DATA=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data"

if not exist "%BRAVE_EXE%" set "BRAVE_EXE=C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%BRAVE_EXE%" set "BRAVE_EXE=C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe"

taskkill /f /im brave.exe >nul 2>&1
ping -n 3 127.0.0.1 >nul

start "" "%BRAVE_EXE%" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%USER_DATA%" --restore-last-session
exit /b 0
