# update-invoice.ps1
# Validates, commits and pushes the PO/GRN invoice-generation change.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File .\update-invoice.ps1
$ErrorActionPreference = 'Stop'

# Resolve repo root = folder containing this script
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
Write-Host "Repo: $root"

# 1. Fail fast on syntax errors
$files = @('js\sdp-plus.js', 'js\pages-2.js', 'js\app.js')
foreach ($f in $files) {
  if (-not (Test-Path $f)) { throw "Missing $f" }
  node --check $f
  if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $f" }
  Write-Host "  ok  $f"
}

# 2. Commit + push (Render auto-deploys on push to main)
git add -A
git commit -m "PO/GRN invoice generation in Finance + Purchase modules"
if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }

git pull --rebase origin main
if ($LASTEXITCODE -ne 0) { throw 'git pull --rebase failed' }

git push origin main
if ($LASTEXITCODE -ne 0) { throw 'git push failed' }

Write-Host ''
Write-Host 'Done. Render will redeploy automatically. Wait ~60s, then Ctrl+F5 at https://itms-app-j91m.onrender.com'
