$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$CoreRoot = Join-Path $ProjectRoot 'jarvis-core'
$CoreEntry = Join-Path $CoreRoot 'dist\index.js'
$LogRoot = Join-Path $ProjectRoot 'data\jarvis\agent-logs'
$Node = @(
    (Get-Command node.exe -ErrorAction SilentlyContinue).Source,
    'C:\Program Files\nodejs\node.exe',
    'C:\Program Files (x86)\nodejs\node.exe'
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $Node) {
    throw 'Node.js was not found. Install Node.js system-wide before installing the JARVIS agent.'
}

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
if (-not (Test-Path $CoreEntry)) {
    throw "Core build not found: $CoreEntry. Run npm --prefix jarvis-core run build first."
}

$coreOut = Join-Path $LogRoot 'core.out.log'
$coreErr = Join-Path $LogRoot 'core.err.log'
Start-Process -FilePath $Node -ArgumentList $CoreEntry -WorkingDirectory $CoreRoot -WindowStyle Hidden -RedirectStandardOutput $coreOut -RedirectStandardError $coreErr

$cloudflared = @(
    (Get-Command cloudflared.exe -ErrorAction SilentlyContinue).Source,
    'C:\Program Files (x86)\cloudflared\cloudflared.exe',
    'C:\Program Files\cloudflared\cloudflared.exe'
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($cloudflared) {
    $tunnelOut = Join-Path $LogRoot 'tunnel.out.log'
    $tunnelErr = Join-Path $LogRoot 'tunnel.err.log'
    Start-Process -FilePath $cloudflared -ArgumentList 'tunnel', '--url', 'http://127.0.0.1:8767', '--no-autoupdate' -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr
}