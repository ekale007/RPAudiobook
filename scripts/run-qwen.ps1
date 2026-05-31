# Start Qwen3-TTS using .venv-qwen (run install-qwen.ps1 first)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$py = Join-Path $Root ".venv-qwen\Scripts\python.exe"
$script = Join-Path $Root "scripts\qwen-tts-server.py"

if (-not (Test-Path $py)) {
    Write-Host "Missing .venv-qwen. Run: npm run tts:qwen:install" -ForegroundColor Red
    exit 1
}

function Stop-QwenOnPort {
    param([int]$Port = 5125)
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        if (-not $procId) { continue }
        try {
            $proc = Get-Process -Id $procId -ErrorAction Stop
            Write-Host "Stopping $($proc.ProcessName) on port $Port (PID $procId) ..."
            Stop-Process -Id $procId -Force -ErrorAction Stop
        } catch {
            Write-Host "Could not stop PID $procId on port $Port" -ForegroundColor Yellow
        }
    }
    if ($pids) { Start-Sleep -Seconds 2 }
}

# Free port if a previous Qwen/uvicorn instance is still running
Stop-QwenOnPort -Port 5125

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
