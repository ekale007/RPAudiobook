# HoerbuchKI - Kokoro TTS setup (Windows)
# Run from repo root:  .\scripts\install-kokoro.ps1
# GPU (large):  .\scripts\install-kokoro.ps1
# CPU only:     .\scripts\install-kokoro.ps1 -CpuOnly

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

function Stop-KokoroServer {
    $conns = Get-NetTCPConnection -LocalPort 5124 -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $procId = $c.OwningProcess
        if ($procId) {
            Write-Host "Stopping process on port 5124 (PID $procId) ..."
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 2
}

function Remove-TorchLeftovers {
    $site = Join-Path $venv "Lib\site-packages"
    foreach ($name in @("torch", "~orch", "~torch")) {
        $path = Join-Path $site $name
        if (Test-Path $path) {
            Write-Host "Removing leftover folder: $name"
            Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "=== Kokoro TTS setup for HoerbuchKI ===" -ForegroundColor Cyan

$espeak = Get-Command espeak-ng -ErrorAction SilentlyContinue
if (-not $espeak) {
    Write-Host "espeak-ng not found." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Installing via winget: eSpeak-NG.eSpeak-NG"
        winget install -e --id eSpeak-NG.eSpeak-NG --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host "Installing via Chocolatey: choco install espeak-ng -y"
        choco install espeak-ng -y
    } else {
        Write-Host "Install espeak-ng: winget install -e --id eSpeak-NG.eSpeak-NG" -ForegroundColor Yellow
        exit 1
    }
    $espeak = Get-Command espeak-ng -ErrorAction SilentlyContinue
    if (-not $espeak) {
        Write-Host "espeak-ng still not on PATH - open a new terminal and re-run." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "espeak-ng OK: $($espeak.Source)" -ForegroundColor Green
}

$venv = Join-Path $Root ".venv-kokoro"
if (-not (Test-Path $venv)) {
    Write-Host "Creating .venv-kokoro ..."
    python -m venv $venv
}
$python = Join-Path $venv "Scripts\python.exe"

Write-Host "Stop Kokoro if running (unlocks torch files) ..."
Stop-KokoroServer

Write-Host "Installing PyTorch ..."
Invoke-Pip @("install", "--upgrade", "pip")

Invoke-Pip @("uninstall", "-y", "torch")
Remove-TorchLeftovers

if ($CpuOnly) {
    Write-Host "CPU-only torch (smaller download, no GPU)."
    Invoke-Pip @("install", "torch", "--index-url", "https://download.pytorch.org/whl/cpu")
} else {
    Write-Host "CUDA torch for GPU (~2.5 GB download) ..."
    try {
        Invoke-Pip @("install", "torch", "--index-url", "https://download.pytorch.org/whl/cu124")
    } catch {
        Write-Host "CUDA install failed. Falling back to CPU torch ..." -ForegroundColor Yellow
        Invoke-Pip @("install", "torch", "--index-url", "https://download.pytorch.org/whl/cpu")
    }
}

Invoke-Pip @("install", "-r", (Join-Path $Root "scripts\requirements-kokoro.txt"))

Write-Host ""
Write-Host "Verifying kokoro import ..." -ForegroundColor Cyan
& $python (Join-Path $Root "scripts\verify-kokoro.py")

& $python (Join-Path $Root "scripts\check-cuda.py")
if ($LASTEXITCODE -ne 0 -and -not $CpuOnly) {
    Write-Host ""
    Write-Host "cuda=False: GPU torch not active. Close apps using the GPU, free ~6 GB on D:, re-run." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Hugging Face (recommended for model download):" -ForegroundColor Cyan
Write-Host "  Add HF_TOKEN=hf_... to .env.local in the repo root"
Write-Host "  Or: hf auth login"
Write-Host ""
Write-Host "Done. Start: npm run tts:kokoro" -ForegroundColor Green
Write-Host "App: Settings - Local - Engine kokoro - pick voice with preview - Save" -ForegroundColor Green
