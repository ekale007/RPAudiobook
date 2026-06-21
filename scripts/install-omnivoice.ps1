# HoerbuchKI - OmniVoice setup (Windows)
# Run from repo root:  npm run tts:omnivoice:install

param(
    [switch]$CpuOnly
)

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
    if ($code -ne 0) {
        throw "pip failed (exit $code): pip $($PipArguments -join ' ')"
    }
}

Write-Host "=== OmniVoice setup for HoerbuchKI ===" -ForegroundColor Cyan

$venv = Join-Path $Root ".venv-omnivoice"
if (-not (Test-Path $venv)) {
    Write-Host "Creating .venv-omnivoice ..."
    py -3.11 -m venv $venv
}
$python = Join-Path $venv "Scripts\python.exe"

Write-Host "Installing PyTorch ..."
Invoke-Pip @("install", "--upgrade", "pip")

if ($CpuOnly) {
    Invoke-Pip @("install", "torch==2.8.0", "torchaudio==2.8.0")
} else {
    Write-Host "CUDA torch 2.8 (cu128, fallback CPU) ..."
    try {
        Invoke-Pip @(
            "install", "torch==2.8.0+cu128", "torchaudio==2.8.0+cu128",
            "--extra-index-url", "https://download.pytorch.org/whl/cu128"
        )
    } catch {
        Write-Host "CUDA install failed, falling back to CPU torch 2.8 ..." -ForegroundColor Yellow
        Invoke-Pip @("install", "torch==2.8.0", "torchaudio==2.8.0")
    }
}

Invoke-Pip @("install", "-r", (Join-Path $Root "scripts\requirements-omnivoice.txt"))

Write-Host ""
Write-Host "Verifying omnivoice import ..."
& $python -c "import torch; from omnivoice import OmniVoice; print('omnivoice OK'); print('cuda', torch.cuda.is_available())"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Import failed - check errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Next:" -ForegroundColor Green
Write-Host '  python scripts/omnivoice-build-refs.py'
Write-Host '  npm run tts:omnivoice:probe'
