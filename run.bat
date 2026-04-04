@echo off
cd /d "%~dp0"
"node_modules\electron\dist\electron.exe" . > electron_out.txt 2>&1
echo ExitCode=%ERRORLEVEL% >> electron_out.txt
