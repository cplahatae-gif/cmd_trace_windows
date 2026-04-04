@echo off
chcp 65001 > nul

set "SHORTCUT=%USERPROFILE%\Desktop\CmdTrace.lnk"
set "VBS_PATH=%~dp0CmdTrace.vbs"

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$s = $ws.CreateShortcut('%SHORTCUT%');" ^
  "$s.TargetPath = 'wscript.exe';" ^
  "$s.Arguments = '\"\"\"' + '%VBS_PATH%' + '\"\"\"';" ^
  "$s.WorkingDirectory = Split-Path '%VBS_PATH%';" ^
  "$s.Description = 'CmdTrace - AI CLI Session Viewer';" ^
  "$s.Save();"

if exist "%SHORTCUT%" (
    echo 바탕화면에 CmdTrace 바로가기가 생성됐습니다!
) else (
    echo 생성 실패. 아래 방법을 사용하세요:
    echo CmdTrace.vbs 파일을 마우스 오른쪽 클릭 -^> 보내기 -^> 바탕화면에 바로가기 만들기
)
pause
