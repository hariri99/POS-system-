$ErrorActionPreference = "Stop"

$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if (-not $connections) {
  Write-Host "No process is listening on port 3000." -ForegroundColor Yellow
  exit 0
}

$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $pids) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process) {
    Write-Host "Stopping $($process.ProcessName) (PID $processId) on port 3000..." -ForegroundColor Cyan
    Stop-Process -Id $processId -Force
  }
}

Write-Host "ProteinOS has been stopped on port 3000." -ForegroundColor Green
