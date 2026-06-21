# HoerbuchKI - local library cover generation (SDXL-Turbo)
# From repo root:  .\scripts\install-covers.ps1
# Then:           npm run covers:missing

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

Write-Host "=== Local cover generation (SDXL-Turbo) ===" -ForegroundColor Cyan

$venv = Join-Path $Root ".venv-covers"
if (-not (Test-Path $venv)) {
    Write-Host "Creating .venv-covers ..."
    python -m venv $venv
}
$python = Join-Path $venv "Scripts\python.exe"

Write-Host "Upgrading pip ..."
Invoke-Pip @("install", "--upgrade", "pip", "wheel")

if ($CpuOnly) {
    Write-Host "Installing PyTorch (CPU) ..."
    Invoke-Pip @(
        "install", "torch", "torchvision",
        "--index-url", "https://download.pytorch.org/whl/cpu"
    )
} else {
    Write-Host "Installing PyTorch (CUDA 12.1, GTX 10xx / RTX compatible) ..."
    Invoke-Pip @(
        "install", "torch", "torchvision",
        "--index-url", "https://download.pytorch.org/whl/cu121"
    )
}

Write-Host "Installing diffusers + deps ..."
Invoke-Pip @("install", "-r", "scripts/requirements-covers.txt")

Write-Host ""
Write-Host "Verifying GPU ..." -ForegroundColor Cyan
& $python scripts/check-cuda.py
if ($LASTEXITCODE -ne 0 -and -not $CpuOnly) {
    Write-Host "CUDA not visible - re-run with -CpuOnly for CPU mode (slow)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "  npm run covers:list-missing"
Write-Host "  npm run covers:missing"
Write-Host "  npm run covers:generate -- --id guild-last-light"
Write-Host ""
Write-Host "Optional: HF_TOKEN in .env.local speeds up Hugging Face model download." -ForegroundColor DarkGray
Write-Host "  Batch: npm run covers:missing" -ForegroundColor DarkGray
