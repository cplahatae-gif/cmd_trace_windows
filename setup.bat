@echo off
chcp 65001 > nul
setlocal

echo.
echo  ██████╗███╗   ███╗██████╗ ████████╗██████╗  █████╗  ██████╗███████╗
echo ██╔════╝████╗ ████║██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝
echo ██║     ██╔████╔██║██║  ██║   ██║   ██████╔╝███████║██║     █████╗
echo ██║     ██║╚██╔╝██║██║  ██║   ██║   ██╔══██╗██╔══██║██║     ██╔══╝
echo ╚██████╗██║ ╚═╝ ██║██████╔╝   ██║   ██║  ██║██║  ██║╚██████╗███████╗
echo  ╚═════╝╚═╝     ╚═╝╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝
echo.
echo  CmdTrace Windows Setup
echo  ─────────────────────────────────────────────────────
echo.

set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"

:: ── 1. Node.js 확인 ──────────────────────────────────────
echo [1/4] Node.js 확인...
node --version > nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Node.js가 설치되어 있지 않습니다.
    echo  https://nodejs.org 에서 설치 후 다시 실행해주세요.
    echo.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo        OK - Node.js %NODE_VER%

:: ── 2. npm install ───────────────────────────────────────
echo.
echo [2/4] 패키지 설치 중... (처음 실행 시 몇 분 소요)
cd /d "%APPDIR%"
call npm install --prefer-offline 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] npm install 실패
    pause & exit /b 1
)
echo        OK

:: ── 3. 빌드 ──────────────────────────────────────────────
echo.
echo [3/4] 앱 빌드 중...

echo        - React 렌더러 빌드...
call npm run build:renderer 2>&1
if errorlevel 1 (
    echo  [ERROR] 렌더러 빌드 실패
    pause & exit /b 1
)

echo        - Electron 메인 프로세스 빌드...
call npm run build:electron 2>&1
if errorlevel 1 (
    echo  [ERROR] Electron 빌드 실패
    pause & exit /b 1
)
echo        OK

:: ── 4. 바탕화면 바로가기 생성 ────────────────────────────
echo.
echo [4/4] 바탕화면 바로가기 생성...
powershell -NoProfile -ExecutionPolicy Bypass -File "%APPDIR%\scripts\create-shortcut.ps1" -AppRoot "%APPDIR%"
if errorlevel 1 (
    echo  [WARNING] 바로가기 자동 생성 실패
    echo            CmdTrace.vbs 파일을 마우스 오른쪽 클릭 ^> 보내기 ^> 바탕화면에 바로가기 만들기
) else (
    echo        OK - 바탕화면에 CmdTrace 아이콘 생성됨
)

:: ── 완료 ─────────────────────────────────────────────────
echo.
echo  ─────────────────────────────────────────────────────
echo  설치 완료! 바탕화면의 CmdTrace 아이콘을 더블클릭하세요.
echo  ─────────────────────────────────────────────────────
echo.
pause
