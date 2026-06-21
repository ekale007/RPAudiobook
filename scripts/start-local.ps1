# Start Next.js + Kokoro TTS (two new PowerShell windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not (Test-Path (Join-Path $Root ".venv-kokoro\Scripts\python.exe"))) {
    Write-Host "Kokoro not installed. Run: .\scripts\install-kokoro.ps1" -ForegroundColor Red
    exit 1
}

Write-Host "Starting Kokoro (5124) and Next.js (3000) in new windows..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root'; npm run tts:kokoro"
Start-Sleep -Seconds 2
$devCmd = "cd '$Root'; `$env:NEXT_PUBLIC_DEPLOYMENT_MODE='local'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $devCmd
Write-Host "Local-first mode (IndexedDB, no login). Wait ~30s for Kokoro, then http://localhost:3000" -ForegroundColor Green
