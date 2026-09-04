$ErrorActionPreference = 'Stop'

$TaskName = 'JARVIS Global Agent'
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Get-Process node, cloudflared -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like '*jarvis*' -or $_.ProcessName -eq 'cloudflared'
} | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Output "Removed: $TaskName"