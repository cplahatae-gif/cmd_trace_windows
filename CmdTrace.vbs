Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

' 현재 스크립트 폴더 기준으로 경로 설정
Dim scriptDir
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' node launch.js 를 터미널 창 없이 실행 (0 = 숨김)
WshShell.Run "node """ & scriptDir & "\launch.js""", 0, False

Set WshShell = Nothing
