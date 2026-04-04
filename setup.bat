@echo off
setlocal

echo.
echo  CmdTrace Windows - Setup
echo  ========================================
echo.

set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"

:: 1. Check Node.js
echo [1/4] Checking Node.js...
node --version > nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo         Please install from https://nodejs.org and run again.
    echo.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo        OK - Node.js %NODE_VER%

:: 2. npm install
echo.
echo [2/4] Installing packages... (first run may take a few minutes)
cd /d "%APPDIR%"
call npm install --prefer-offline 2>&1
if errorlevel 1 (
    echo [ERROR] npm install failed
    pause & exit /b 1
)
echo        OK

:: 3. Build
echo.
echo [3/4] Building app...
echo        - Building React renderer...
call npm run build:renderer 2>&1
if errorlevel 1 (
    echo [ERROR] Renderer build failed
    pause & exit /b 1
)
echo        - Building Electron main process...
call npm run build:electron 2>&1
if errorlevel 1 (
    echo [ERROR] Electron build failed
    pause & exit /b 1
)
echo        OK

:: 4. Create desktop shortcut
echo.
echo [4/4] Creating desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -File "%APPDIR%\scripts\create-shortcut.ps1" -AppRoot "%APPDIR%"
if errorlevel 1 (
    echo [WARNING] Shortcut auto-creation failed
    echo           Right-click CmdTrace.vbs -^> Send to -^> Desktop shortcut
) else (
    echo        OK - CmdTrace icon created on Desktop
)

echo.
echo  ========================================
echo  Setup complete! Double-click CmdTrace on Desktop.
echo  ========================================
echo.
pause
