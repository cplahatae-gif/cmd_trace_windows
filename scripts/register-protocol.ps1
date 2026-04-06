param([string]$AppRoot = (Split-Path -Parent $PSScriptRoot))

$handlerPath = Join-Path $AppRoot "scripts\cmdtrace-protocol-handler.bat"

if (-not (Test-Path $handlerPath)) {
    Write-Error "Handler not found: $handlerPath"
    exit 1
}

$basePath = "HKCU:\Software\Classes\cmdtrace"
New-Item -Path $basePath -Force | Out-Null
Set-ItemProperty -Path $basePath -Name "(Default)" -Value "URL:cmdtrace"
New-ItemProperty -Path $basePath -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null

$commandPath = "$basePath\shell\open\command"
New-Item -Path $commandPath -Force | Out-Null
Set-ItemProperty -Path $commandPath -Name "(Default)" -Value "`"$handlerPath`" `"%1`""

Write-Host "cmdtrace:// protocol registered"
Write-Host "  Handler: $handlerPath"
