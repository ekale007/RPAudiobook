# Probe RunPod Serverless Qwen (Load Balancer): /ping -> /health -> /speak
param(
  [string]$BaseUrl = "",
  [string]$RunPodApiKey = "",
  [string]$QwenApiKey = "",
  [string]$Voice = "Ryan",
  [string]$Text = "Hallo. Das ist ein Test der Serverless Erzaehler-Stimme.",
  [int]$PingRetries = 24,
  [int]$PingDelaySec = 10
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# Windows PowerShell 5.1 has no -SkipHttpErrorCheck (PS 7+ only).
function Invoke-HttpProbe {
  param(
    [string]$Uri,
    [hashtable]$Headers,
    [string]$Method = "Get",
    [string]$Body = $null
  )
  try {
    $params = @{
      Uri             = $Uri
      Method          = $Method
      Headers         = $Headers
      UseBasicParsing = $true
    }
    if ($Body) {
      $params.Body = $Body
      $params.ContentType = "application/json"
    }
    $resp = Invoke-WebRequest @params
    return @{
      StatusCode = [int]$resp.StatusCode
      Body       = $resp.Content
    }
  } catch {
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $errBody = $reader.ReadToEnd()
      $reader.Close()
      return @{
        StatusCode = [int]$_.Exception.Response.StatusCode
        Body       = $errBody
      }
    }
    throw
  }
}

function Read-DotEnvKey([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return "" }
  foreach ($line in Get-Content $path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    if ($t -match "^\s*$key\s*=\s*(.+)$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return ""
}

$envLocal = Join-Path $root ".env.local"
if (-not $BaseUrl) {
  $BaseUrl = $env:QWEN_TTS_URL
  if (-not $BaseUrl) { $BaseUrl = Read-DotEnvKey $envLocal "QWEN_TTS_URL" }
}
if (-not $RunPodApiKey) {
  $RunPodApiKey = $env:RUNPOD_API_KEY
  if (-not $RunPodApiKey) { $RunPodApiKey = Read-DotEnvKey $envLocal "RUNPOD_API_KEY" }
}
if (-not $QwenApiKey) {
  $QwenApiKey = $env:QWEN_TTS_API_KEY
  if (-not $QwenApiKey) { $QwenApiKey = Read-DotEnvKey $envLocal "QWEN_TTS_API_KEY" }
}

if (-not $BaseUrl) {
  throw "Set QWEN_TTS_URL in .env.local or pass -BaseUrl"
}
if (-not $RunPodApiKey) {
  throw "Set RUNPOD_API_KEY in .env.local or pass -RunPodApiKey"
}

$base = $BaseUrl.Trim().TrimEnd("/")
$authHeaders = @{
  "Authorization" = "Bearer $RunPodApiKey"
}

Write-Host "Base: $base"

try {
  $h = Invoke-HttpProbe -Uri "$base/health" -Headers $authHeaders -Method Get
  Write-Host "Health snapshot: $($h.StatusCode)"
  if ($h.Body) { Write-Host $h.Body }
} catch {
  Write-Host "Health nicht erreichbar: $($_.Exception.Message)"
}

Write-Host "Ping retries: $PingRetries x ${PingDelaySec}s ..."

$ready = $false
for ($i = 1; $i -le $PingRetries; $i++) {
  try {
    $r = Invoke-HttpProbe -Uri "$base/ping" -Headers $authHeaders -Method Get
    $snippet = ""
    if ($r.Body -and $r.Body.Length -gt 0) {
      $snippet = " " + ($r.Body -replace "\s+", " ").Substring(0, [Math]::Min(120, $r.Body.Length))
    }
    Write-Host "  [$i] /ping -> $($r.StatusCode)$snippet"
    if ($r.StatusCode -eq 200) {
      $ready = $true
      break
    }
    if ($r.StatusCode -eq 503 -and $r.Body -match "HF_TOKEN") {
      Write-Host "  HINWEIS: HF_TOKEN auf RunPod Endpoint setzen, dann Worker neu starten." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "  [$i] /ping error: $($_.Exception.Message)"
  }
  if ($i -lt $PingRetries) { Start-Sleep -Seconds $PingDelaySec }
}

if (-not $ready) {
  throw "/ping did not return 200 - worker still cold or misconfigured. Check RunPod worker logs."
}

Write-Host ""
Write-Host "Health: $base/health"
$health = Invoke-RestMethod -Uri "$base/health" -Method Get -Headers $authHeaders
$health | ConvertTo-Json -Depth 4

$speakHeaders = @{
  "Content-Type" = "application/json"
  "Authorization" = "Bearer $RunPodApiKey"
}
if ($QwenApiKey) { $speakHeaders["X-API-Key"] = $QwenApiKey }

$body = @{
  text     = $Text
  voice    = $Voice
  language = "German"
} | ConvertTo-Json

Write-Host ""
Write-Host "Speak: $base/speak (voice=$Voice) ..."
$outFile = Join-Path $env:TEMP "runpod-qwen-$(Get-Date -Format 'yyyyMMdd-HHmmss').wav"
Invoke-WebRequest -Uri "$base/speak" -Method Post -Headers $speakHeaders -Body $body -OutFile $outFile -UseBasicParsing
Write-Host "OK - saved: $outFile"
Start-Process $outFile
