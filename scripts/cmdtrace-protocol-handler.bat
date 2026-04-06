@echo off
setlocal
set "APPDIR=%~dp0.."
set "CMDTRACE_DEEPLINK=%~1"
"%APPDIR%\node_modules\electron\dist\electron.exe" "%APPDIR%\dist-electron\main.js"
