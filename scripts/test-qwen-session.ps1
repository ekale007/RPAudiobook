# Mini session: narrator + Naya + Lucifer (npm run tts:qwen first)
param(
  [string]$BaseUrl = "http://127.0.0.1:5125",
  [ValidateSet("de", "en")]
  [string]$Locale = "de"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$py = Join-Path $Root ".venv-qwen\Scripts\python.exe"
$script = Join-Path $Root "scripts\test-qwen-session.py"

if (-not (Test-Path $py)) {
  Write-Host "Missing .venv-qwen - run: npm run tts:qwen:install" -ForegroundColor Red
  exit 1
}

& $py $script --base $BaseUrl --locale $Locale
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$out = Join-Path $Root "test-output\qwen-session"
Write-Host "WAVs: $out" -ForegroundColor Green
Start-Process $out
