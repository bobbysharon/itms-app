# check-itil.ps1 — syntax-check the changed files for the ITIL/finance integration
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

$files = @('js\workflow.js', 'js\sdp-plus.js', 'js\pages-4.js', 'js\testdata.js', 'js\app.js')
$fail = $false
foreach ($f in $files) {
  node --check $f
  if ($LASTEXITCODE -eq 0) { Write-Host "  ok  $f" } else { Write-Host "FAIL  $f"; $fail = $true }
}
if ($fail) { Write-Host 'SYNTAX ERRORS FOUND'; exit 1 }
Write-Host 'ALL OK'
