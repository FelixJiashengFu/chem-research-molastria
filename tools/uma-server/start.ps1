# Starts the MolAstria UMA service and its Cloudflare Tunnel. Closing this window (or Ctrl+C) takes both offline;
# the site then shows "the owner's GPU is offline". Do not run it as administrator: the service needs no rights
# beyond reading its secret and writing its result cache in this folder.
#   powershell -ExecutionPolicy Bypass -File tools\uma-server\start.ps1 [-Python C:\path\to\uma-env\Scripts\python.exe]
param(
  [string]$Python = $env:MOLASTRIA_UMA_PYTHON,
  [string]$Tunnel = 'molastria-uma'
)
if (-not $Python) { Write-Error 'Pass -Python (the python.exe of the environment with fairchem-core and rdkit) or set MOLASTRIA_UMA_PYTHON.'; exit 2 }
if (-not (Test-Path (Join-Path $PSScriptRoot 'secret.local'))) { Write-Error 'No secret yet: run  node tools/uma-server/new-secret.mjs  first.'; exit 2 }
# A window opened before cloudflared was installed does not have it on PATH yet; try the installer's folders too.
$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) { $cloudflared = @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1 }
if (-not $cloudflared) { Write-Error 'cloudflared is not installed: winget install --id Cloudflare.cloudflared'; exit 2 }
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) { Write-Warning 'This window runs as administrator. Start it from a normal window instead.'; exit 2 }

$tunnelProcess = Start-Process $cloudflared -ArgumentList 'tunnel', 'run', $Tunnel -PassThru -WindowStyle Minimized
Write-Host "Tunnel $Tunnel started (process $($tunnelProcess.Id)). Starting the UMA service; close this window to stop both."
try {
  # UTF-8 mode: on a Chinese-locale Windows, fairchem otherwise reads its own data files as GBK and fails.
  & $Python -X utf8 -u (Join-Path $PSScriptRoot 'server.py')
} finally {
  Stop-Process -Id $tunnelProcess.Id -ErrorAction SilentlyContinue
  Write-Host 'UMA service and tunnel stopped.'
}
