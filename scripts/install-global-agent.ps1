$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $ProjectRoot 'scripts\run-global-agent.ps1'
$TaskName = 'JARVIS Global Agent'
$PowerShell = (Get-Command powershell.exe).Source
$Action = New-ScheduledTaskAction -Execute $PowerShell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Output "Installed and started: $TaskName"
Write-Output "Core logs: $ProjectRoot\data\jarvis\agent-logs"
Write-Output 'The tunnel URL is written to tunnel.log when cloudflared starts.'