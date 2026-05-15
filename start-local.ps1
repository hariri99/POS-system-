$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  & npm.cmd install
}

Write-Host "Starting ProteinOS on http://localhost:3000" -ForegroundColor Green
Write-Host "For phone access on the same Wi-Fi, use http://192.168.10.214:3000" -ForegroundColor Green
& npm.cmd run dev:host

