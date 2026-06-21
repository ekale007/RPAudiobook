param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RepoRoot = Split-Path -Parent $Root

$python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    # Fallback: HörbuchKI cover venv (same SDXL deps)
    $fallback = Join-Path $RepoRoot ".venv-covers\Scripts\python.exe"
    if (Test-Path $fallback) {
        Write-Host "Using parent .venv-covers (run image-studio\scripts\install.ps1 for own .venv)" -ForegroundColor DarkGray
        $python = $fallback
    }
}

if (-not (Test-Path $python)) {
    Write-Host "No Python venv found." -ForegroundColor Red
    Write-Host "  cd image-studio && .\scripts\install.ps1" -ForegroundColor Yellow
    Write-Host "  or from HörbuchKI root: npm run covers:install" -ForegroundColor Yellow
    exit 1
}

$port = 5125
if ($env:IMAGE_STUDIO_PORT -and $env:IMAGE_STUDIO_PORT.Trim()) {
    $port = [int]$env:IMAGE_STUDIO_PORT
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listener) {
    $pid = $listener.OwningProcess
    Write-Host "Port $port is already in use (PID $pid)." -ForegroundColor Red
    Write-Host "  Stop-Process -Id $pid -Force" -ForegroundColor Yellow
    Write-Host "  (often a leftover image-studio / images:server from an earlier run)" -ForegroundColor DarkGray
    exit 1
}

Set-Location (Join-Path $Root "server")
& $python app.py --port $port @Args
exit $LASTEXITCODE
