# Run generate-library-covers.py from .venv-covers
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$python = Join-Path $Root ".venv-covers\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "Run first: .\scripts\install-covers.ps1" -ForegroundColor Red
    exit 1
}

Set-Location $Root
& $python scripts/generate-library-covers.py @Args
exit $LASTEXITCODE
