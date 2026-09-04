$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $ProjectRoot 'scripts\run-global-agent.ps1'
$TaskName = 'JARVIS Global Agent'
$PowerShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$TaskCommand = "`"$PowerShell`" -NoProfile -ExecutionPolicy Bypass -File `"$Runner`""

& schtasks.exe /Create /TN $TaskName /SC ONSTART /RU SYSTEM /RL HIGHEST /TR $TaskCommand /F | Out-Host
if ($LASTEXITCODE -ne 0) {
	throw "Could not create the JARVIS scheduled task (exit code $LASTEXITCODE). Run this script as Administrator."
}
& schtasks.exe /Run /TN $TaskName | Out-Host
if ($LASTEXITCODE -ne 0) {
	throw "The JARVIS scheduled task was created but could not be started (exit code $LASTEXITCODE)."
}
Write-Output "Installed and started: $TaskName"
Write-Output "Core logs: $ProjectRoot\data\jarvis\agent-logs"
Write-Output 'The tunnel URL is written to tunnel.log when cloudflared starts.'