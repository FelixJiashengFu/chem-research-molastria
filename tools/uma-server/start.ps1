# Starts the MolAstria online models and their Cloudflare Tunnel. Closing this window (or Ctrl+C) takes both
# offline; the site then shows "the owner's GPU is offline". Do not run it as administrator: the service needs no
# rights beyond reading its secret and model files and writing its result cache in this folder.
#   powershell -ExecutionPolicy Bypass -File tools\uma-server\start.ps1 -Python D:\ChemDraw\uma-env\Scripts\python.exe [-MacePython D:\ChemDraw\mace-env\Scripts\python.exe]
# -KeepAlive starts the service again when it stops by itself (a crash, a driver reset) and the tunnel when it has
# gone; restarts are written to keepalive.log in this folder. autostart.ps1 uses it to start the models at sign-in.
param(
  [string]$Python = $env:MOLASTRIA_UMA_PYTHON,       # fairchem (UMA, eSEN, AllScAIP), TorchANI, rdkit
  [string]$MacePython = $env:MOLASTRIA_MACE_PYTHON,  # mace-torch, rdkit; without it the MACE models stay off
  [string]$Tunnel = 'molastria-uma',
  [switch]$KeepAlive
)
if (-not $Python) { Write-Error 'Pass -Python (the python.exe of the environment with fairchem-core and rdkit) or set MOLASTRIA_UMA_PYTHON.'; exit 2 }
if (-not (Test-Path (Join-Path $PSScriptRoot 'secret.local'))) { Write-Error 'No secret yet: run  node tools/uma-server/new-secret.mjs  first.'; exit 2 }
# A window opened before cloudflared was installed does not have it on PATH yet; try the installer's folders too.
$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) { $cloudflared = @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1 }
if (-not $cloudflared) { Write-Error 'cloudflared is not installed: winget install --id Cloudflare.cloudflared'; exit 2 }
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) { Write-Warning 'This window runs as administrator. Start it from a normal window instead.'; exit 2 }
# One copy only: a second service cannot take the port, and a second tunnel would only add a connection to the same
# place. This is what happens when the models start at sign-in and the script is then run by hand.
$probe = New-Object Net.Sockets.TcpClient
try { $probe.Connect('127.0.0.1', 8765); $running = $true } catch { $running = $false } finally { $probe.Close() }
if ($running) { Write-Host 'The model service is already running on this computer (port 8765 answers). Nothing to start.'; exit 0 }

# The model files are already on this computer: no calls to Hugging Face while serving (download new models by hand).
$env:HF_HUB_OFFLINE = '1'
$extra = @()
if ($MacePython) { $extra = @('--mace-python', $MacePython) } else { Write-Warning 'No -MacePython: the MACE models stay off.' }

function Start-Tunnel { Start-Process $cloudflared -ArgumentList 'tunnel', 'run', $Tunnel -PassThru -WindowStyle Minimized }
function Write-Note([string]$Text) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Text"
  Write-Host $line
  if ($KeepAlive) { Add-Content -Path (Join-Path $PSScriptRoot 'keepalive.log') -Value $line -Encoding UTF8 }
}

$tunnelProcess = Start-Tunnel
Write-Host "Tunnel $Tunnel started (process $($tunnelProcess.Id)). Starting the model service; close this window to stop both."
if ($KeepAlive) { Write-Note 'Started with -KeepAlive.' }
$quick = 0  # how many times in a row the service stopped within two minutes of starting
try {
  while ($true) {
    if ($tunnelProcess.HasExited) { Write-Note 'The tunnel had stopped; starting it again.'; $tunnelProcess = Start-Tunnel }
    $began = Get-Date
    # UTF-8 mode: on a Chinese-locale Windows, fairchem otherwise reads its own data files as GBK and fails.
    & $Python -X utf8 -u (Join-Path $PSScriptRoot 'server.py') @extra
    $code = $LASTEXITCODE
    if (-not $KeepAlive) { break }
    $ran = [int]((Get-Date) - $began).TotalSeconds
    if ($ran -lt 120) { $quick++ } else { $quick = 0 }
    # Something that fails at once every time (a missing package, a broken driver) is not fixed by trying again.
    if ($quick -ge 5) { Write-Note "The model service stopped five times in a row within two minutes (last exit code $code). Giving up; fix the cause and start it again."; break }
    $wait = @(5, 15, 30, 60, 120)[[Math]::Min($quick, 4)]
    Write-Note "The model service stopped after $ran s (exit code $code). Starting it again in $wait s."
    Start-Sleep -Seconds $wait
  }
} finally {
  Stop-Process -Id $tunnelProcess.Id -ErrorAction SilentlyContinue
  Write-Host 'Model service and tunnel stopped.'
}
