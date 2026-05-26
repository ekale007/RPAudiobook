# Start Kokoro TTS using .venv-kokoro (run install-kokoro.ps1 first)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$py = Join-Path $Root ".venv-kokoro\Scripts\python.exe"
$script = Join-Path $Root "scripts\kokoro-tts-server.py"

if (-not (Test-Path $py)) {
    Write-Host "Missing .venv-kokoro. Run: .\scripts\install-kokoro.ps1" -ForegroundColor Red
    exit 1
}

# Pass HF_TOKEN from .env.local into the Kokoro process
$envFile = Join-Path $Root ".env.local"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $parts = $line -split '=', 2
        $key = $parts[0].Trim()
        $val = $parts[1].Trim().Trim('"').Trim("'")
        if ($key -in @('HF_TOKEN', 'HUGGINGFACE_HUB_TOKEN', 'HUGGING_FACE_HUB_TOKEN') -and $val) {
            $env:HF_TOKEN = $val
            $env:HUGGINGFACE_HUB_TOKEN = $val
        }
    }
}

& $py $script @args
