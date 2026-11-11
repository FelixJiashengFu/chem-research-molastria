# Starts the MolAstria online models when you sign in to Windows, and keeps them running (start.ps1 -KeepAlive).
# It puts one shortcut in your own Startup folder: no administrator rights, no scheduled task, no Windows service.
#   powershell -ExecutionPolicy Bypass -File tools\uma-server\autostart.ps1 -Install -Python D:\ChemDraw\uma-env\Scripts\python.exe [-MacePython D:\ChemDraw\mace-env\Scripts\python.exe] [-Xtb C:\path\to\xtb.exe]
#   powershell -ExecutionPolicy Bypass -File tools\uma-server\autostart.ps1 -Status
#   powershell -ExecutionPolicy Bypass -File tools\uma-server\autostart.ps1 -Remove
# The models start after you sign in, not when the computer is switched on: the GPU and the tunnel's login belong
# to your account. A sleeping computer is offline; the site and the compute API say so.
# The shortcut points at this folder. If the repository moves, run -Install again.
param(
  [switch]$Install,
  [switch]$Remove,
  [switch]$Status,
  [string]$Python = $env:MOLASTRIA_UMA_PYTHON,
  [string]$MacePython = $env:MOLASTRIA_MACE_PYTHON,
  [string]$Xtb = $env:MOLASTRIA_XTB,
  [string]$Tunnel = 'molastria-uma'
)
$link = Join-Path ([Environment]::GetFolderPath('Startup')) 'MolAstria online models.lnk'
$start = Join-Path $PSScriptRoot 'start.ps1'
$log = Join-Path $PSScriptRoot 'keepalive.log'

if ($Install) {
  if (-not $Python) { Write-Error 'Pass -Python (the python.exe of the environment with fairchem-core and rdkit) or set MOLASTRIA_UMA_PYTHON.'; exit 2 }
  foreach ($path in @($Python, $MacePython, $start) | Where-Object { $_ }) {
    if (-not (Test-Path $path)) { Write-Error "Not found: $path"; exit 2 }
  }
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$start`" -KeepAlive -Python `"$Python`" -Tunnel `"$Tunnel`""
  if ($MacePython) { $arguments += " -MacePython `"$MacePython`"" }
  if ($Xtb) { $arguments += " -Xtb `"$Xtb`"" }
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($link)
  $shortcut.TargetPath = (Get-Command powershell.exe).Source
  $shortcut.Arguments = $arguments
  $shortcut.WorkingDirectory = $PSScriptRoot
  $shortcut.WindowStyle = 7  # minimized: the window stays on the taskbar, closing it takes the models offline
  $shortcut.Description = 'MolAstria online models and their Cloudflare Tunnel (start.ps1 -KeepAlive)'
  $shortcut.Save()
  Write-Host "Installed: $link"
  Write-Host 'The models start at your next sign-in. To start them now, double-click that shortcut.'
  exit 0
}
if ($Remove) {
  if (Test-Path $link) { Remove-Item $link; Write-Host "Removed: $link" } else { Write-Host 'Nothing to remove: the models do not start at sign-in.' }
  Write-Host 'This does not stop models that are running now; close their window for that.'
  exit 0
}
if ($Status) {
  if (Test-Path $link) {
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($link)
    Write-Host "Starts at sign-in: yes ($link)"
    Write-Host "  $($shortcut.TargetPath) $($shortcut.Arguments)"
  } else { Write-Host 'Starts at sign-in: no' }
  $probe = New-Object Net.Sockets.TcpClient
  try { $probe.Connect('127.0.0.1', 8765); $running = $true } catch { $running = $false } finally { $probe.Close() }
  Write-Host "Running now: $(if ($running) { 'yes (port 8765 answers)' } else { 'no' })"
  if (Test-Path $log) { Write-Host 'Last restarts (keepalive.log):'; Get-Content $log -Tail 5 | ForEach-Object { Write-Host "  $_" } }
  exit 0
}
Write-Host 'Pass -Install, -Status or -Remove. See the comments at the top of this file.'
exit 2
