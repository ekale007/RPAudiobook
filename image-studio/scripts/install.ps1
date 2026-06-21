# Image Studio — SDXL-Turbo GPU setup
# From image-studio/:  .\scripts\install.ps1

param([switch]$CpuOnly)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Invoke-Pip {
    param([Parameter(Mandatory = $true)][string[]]$PipArguments)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $python -m pip @PipArguments 2>&1 | ForEach-Object { Write-Host "$_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($code -ne 0) { throw "pip failed (exit $code)" }
}

Write-Host "=== Image Studio (SDXL-Turbo) ===" -ForegroundColor Cyan

$venv = Join-Path $Root ".venv"
if (-not (Test-Path $venv)) {
    python -m venv $venv
}
$python = Join-Path $venv "Scripts\python.exe"

Invoke-Pip @("install", "--upgrade", "pip", "wheel")

if ($CpuOnly) {
    Invoke-Pip @("install", "torch", "torchvision", "--index-url", "https://download.pytorch.org/whl/cpu")
} else {
    Invoke-Pip @("install", "torch", "torchvision", "--index-url", "https://download.pytorch.org/whl/cu121")
}

Invoke-Pip @("install", "-r", "requirements.txt")

Write-Host "Verifying GPU …" -ForegroundColor Cyan
& $python server/check_cuda.py
if ($LASTEXITCODE -ne 0 -and -not $CpuOnly) {
    Write-Host "CUDA not visible — re-run with -CpuOnly" -ForegroundColor Yellow
}

Write-Host "Done. npm install && npm run dev" -ForegroundColor Green
