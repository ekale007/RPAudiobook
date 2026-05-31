# Run local-image-server.py from .venv-covers
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$python = Join-Path $Root ".venv-covers\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "Run first: npm run covers:install" -ForegroundColor Red
    exit 1
}

Set-Location $Root
& $python scripts/local-image-server.py @Args
exit $LASTEXITCODE
