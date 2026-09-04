$ErrorActionPreference = 'Stop'

$TaskName = 'JARVIS Global Agent'
& schtasks.exe /End /TN $TaskName 2>$null | Out-Null
& schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null
Get-Process node, cloudflared -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like '*jarvis*' -or $_.ProcessName -eq 'cloudflared'
} | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Output "Removed: $TaskName"