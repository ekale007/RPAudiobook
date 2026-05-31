# HoerbuchKI - Qwen3-TTS setup (Windows)
# Run from repo root:  npm run tts:qwen:install

param(
    [switch]$CpuOnly,
    [switch]$LargeModel
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

function Stop-QwenServer {
    $conns = Get-NetTCPConnection -LocalPort 5125 -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $procId = $c.OwningProcess
        if ($procId) {
            Write-Host "Stopping process on port 5125 (PID $procId) ..."
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 2
}

Write-Host "=== Qwen3-TTS setup for HoerbuchKI ===" -ForegroundColor Cyan

$venv = Join-Path $Root ".venv-qwen"
if (-not (Test-Path $venv)) {
    Write-Host "Creating .venv-qwen ..."
    py -3.11 -m venv $venv
}
$python = Join-Path $venv "Scripts\python.exe"

Stop-QwenServer

Write-Host "Installing PyTorch ..."
Invoke-Pip @("install", "--upgrade", "pip")

if ($CpuOnly) {
    Invoke-Pip @("install", "torch", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cpu")
} else {
    Write-Host "CUDA torch + torchaudio (cu124) ..."
    try {
        Invoke-Pip @(
            "install", "torch", "torchaudio==2.6.0+cu124",
            "--index-url", "https://download.pytorch.org/whl/cu124"
        )
    } catch {
        Write-Host "CUDA install failed, falling back to CPU ..." -ForegroundColor Yellow
        Invoke-Pip @("install", "torch", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cpu")
    }
}

Invoke-Pip @("install", "-r", (Join-Path $Root "scripts\requirements-qwen.txt"))

Write-Host ""
Write-Host "Verifying qwen_tts import ..."
& $python -c "import torch; import qwen_tts; print('qwen_tts OK'); print('cuda', torch.cuda.is_available())"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Import failed — check errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Hugging Face (recommended):" -ForegroundColor Cyan
Write-Host "  Add HF_TOKEN=hf_... to .env.local"
Write-Host ""
if ($LargeModel) {
    Write-Host "Large model: pass --model Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice when starting server" -ForegroundColor Yellow
} else {
    Write-Host "Default model: 0.6B CustomVoice (faster on GTX 1080 Ti)" -ForegroundColor Green
}
Write-Host "Voice design / clone: use 1.7B-VoiceDesign or 1.7B-Base models (see docs/QWEN-TTS.md)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Done. Start: npm run tts:qwen" -ForegroundColor Green
Write-Host "App: Settings - Local - Engine qwen - voice Ryan - Save" -ForegroundColor Green
