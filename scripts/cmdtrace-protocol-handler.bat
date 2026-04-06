@echo off
setlocal
set "APPDIR=%~dp0.."
set "ELECTRON_DEV=true"
"%APPDIR%\node_modules\electron\dist\electron.exe" "%APPDIR%\dist-electron\main.js" "--" %1
