# Test RunPod (or local) Qwen TTS: GET /health + POST /speak
param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [string]$ApiKey = "",
  [string]$Voice = "Ryan",
  [string]$Text = "Hallo. Das ist ein Test der Erzähler-Stimme."
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.Trim().TrimEnd("/")

Write-Host "Health: $base/health"
$health = Invoke-RestMethod -Uri "$base/health" -Method Get
$health | ConvertTo-Json -Depth 4

$headers = @{ "Content-Type" = "application/json" }
if ($ApiKey) { $headers["X-API-Key"] = $ApiKey }

$body = @{
  text     = $Text
  voice    = $Voice
  language = "German"
} | ConvertTo-Json

Write-Host "`nSpeak: $base/speak (voice=$Voice) …"
$outFile = Join-Path $env:TEMP "qwen-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').wav"
Invoke-WebRequest -Uri "$base/speak" -Method Post -Headers $headers -Body $body -OutFile $outFile
Write-Host "Saved: $outFile"
Start-Process $outFile
