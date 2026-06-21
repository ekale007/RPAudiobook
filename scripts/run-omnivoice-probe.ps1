# Build refs (edge-tts) + run OmniVoice probes
param(
    [string[]]$Only,
    [string]$Device = "auto",
    [int]$NumStep = 32
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$py = Join-Path $Root ".venv-omnivoice\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Host "Missing .venv-omnivoice. Run: npm run tts:omnivoice:install" -ForegroundColor Red
    exit 1
}

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

Write-Host "=== Building reference WAVs (edge-tts) ===" -ForegroundColor Cyan
& $py (Join-Path $Root "scripts\omnivoice-build-refs.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$probeArgs = @(
    (Join-Path $Root "scripts\omnivoice-probe.py"),
    "--device", $Device,
    "--num-step", $NumStep
)
if ($Only) {
    $probeArgs += "--only"
    $probeArgs += $Only
}

Write-Host "=== OmniVoice probes ===" -ForegroundColor Cyan
& $py @probeArgs
exit $LASTEXITCODE
