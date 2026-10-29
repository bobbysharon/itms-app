$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\TF3060\Documents\GitHub\itms-app"

Write-Host "=== Syntax check ===" -ForegroundColor Cyan
$fail = $false
foreach ($f in @('js\auth.js','routes\auth.js','server.js')) {
  node --check $f
  if ($LASTEXITCODE -eq 0) { Write-Host "  OK  $f" -ForegroundColor Green }
  else { Write-Host "FAIL  $f" -ForegroundColor Red; $fail = $true }
}
if ($fail) { Write-Host 'SYNTAX ERRORS — fix before pushing' -ForegroundColor Red; exit 1 }

Write-Host "`n=== Git commit + push ===" -ForegroundColor Cyan
git add -A
git commit -m "Change login to use employee ID or username instead of email"
git pull --rebase origin main
git push origin main

Write-Host "`nDone. Render auto-deploys in ~60s." -ForegroundColor Green
