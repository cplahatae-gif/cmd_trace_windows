# scripts/create-shortcut.ps1
# CmdTrace 바탕화면 바로가기 생성

param(
    [string]$AppRoot = ""
)

# AppRoot 기본값: 이 스크립트의 상위 폴더
if ($AppRoot -eq "") {
    $AppRoot = Split-Path -Parent $PSScriptRoot
}

$VbsPath  = Join-Path $AppRoot "CmdTrace.vbs"
$LinkPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "CmdTrace.lnk"

if (-not (Test-Path $VbsPath)) {
    Write-Host "ERROR: CmdTrace.vbs not found at $VbsPath" -ForegroundColor Red
    exit 1
}

try {
    $WshShell  = New-Object -ComObject WScript.Shell
    $Shortcut  = $WshShell.CreateShortcut($LinkPath)
    $Shortcut.TargetPath       = "wscript.exe"
    $Shortcut.Arguments        = "`"$VbsPath`""
    $Shortcut.WorkingDirectory = $AppRoot
    $Shortcut.Description      = "CmdTrace - AI CLI Session Viewer"

    # 아이콘: electron.exe 아이콘 사용 (ico 파일 없어도 동작)
    $ElectronExe = Join-Path $AppRoot "node_modules\electron\dist\electron.exe"
    $IcoPath     = Join-Path $AppRoot "resources\icon.ico"
    if (Test-Path $IcoPath) {
        $Shortcut.IconLocation = $IcoPath
    } elseif (Test-Path $ElectronExe) {
        $Shortcut.IconLocation = "$ElectronExe,0"
    }

    $Shortcut.Save()
    Write-Host "SUCCESS: $LinkPath" -ForegroundColor Green
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
}
