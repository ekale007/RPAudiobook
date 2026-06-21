# Local Qwen smoke tests — server must run: npm run tts:qwen
param(
  [string]$BaseUrl = "http://127.0.0.1:5125",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")
if (-not $OutDir) {
  $OutDir = Join-Path (Split-Path -Parent $PSScriptRoot) "test-output\qwen-local"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Test-Speak {
  param(
    [string]$Name,
    [string]$Text,
    [string]$Voice = "Ryan",
    [string]$Language = "Auto",
    [string]$Instruct = ""
  )
  $body = @{
    text     = $Text
    voice    = $Voice
    language = $Language
  }
  if ($Instruct) { $body.instruct = $Instruct }

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $out = Join-Path $OutDir "$Name.wav"
  Invoke-WebRequest -Uri "$base/speak" -Method Post `
    -ContentType "application/json" `
    -Body ($body | ConvertTo-Json) `
    -OutFile $out
  $sw.Stop()
  $len = (Get-Item $out).Length
  [pscustomobject]@{
    test     = $Name
    voice    = $Voice
    language = $Language
    seconds  = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    bytes    = $len
    file     = $out
  }
}

Write-Host "Health: $base/health" -ForegroundColor Cyan
$h = Invoke-RestMethod "$base/health"
$h | ConvertTo-Json -Depth 2

$tests = @(
  @{
    Name     = "01-en-narrator"
    Text     = "The rain hammered the cobblestones. Elias pulled his coat tighter and kept walking."
    Voice    = "Ryan"
    Language = "English"
  },
  @{
    Name     = "02-de-narrator"
    Text     = "Der Regen trommelte auf das Kopfsteinpflaster. Elias zog den Mantel enger und ging weiter."
    Voice    = "Ryan"
    Language = "German"
  },
  @{
    Name     = "03-de-female"
    Text     = "Du hättest mir das sagen können, bevor wir los sind."
    Voice    = "Serena"
    Language = "German"
  },
  @{
    Name     = "04-en-instruct-tense"
    Text     = "Something moved in the shadows ahead."
    Voice    = "Aiden"
    Language = "English"
    Instruct = "Quiet, suspenseful narration, low and measured."
  }
)

$results = foreach ($t in $tests) {
  Write-Host "`n=== $($t.Name) ===" -ForegroundColor Yellow
  Test-Speak @t
}

Write-Host "`n--- Summary ---" -ForegroundColor Green
$results | Format-Table -AutoSize
Write-Host "WAV files: $OutDir"
Write-Host "Open folder: explorer $OutDir"
