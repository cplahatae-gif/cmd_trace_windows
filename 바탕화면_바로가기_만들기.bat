@echo off
setlocal

set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%APPDIR%\scripts\create-shortcut.ps1" -AppRoot "%APPDIR%"

if %errorlevel% equ 0 (
    echo Desktop shortcut created successfully!
) else (
    echo Failed. Right-click CmdTrace.vbs -^> Send to -^> Desktop shortcut
)
pause
