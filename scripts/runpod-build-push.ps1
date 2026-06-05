# Build and push Qwen Serverless Docker image for RunPod Load Balancer.
param(
  [Parameter(Mandatory = $true)]
  [string]$DockerUser,
  [string]$Tag = "serverless",
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$image = "${DockerUser}/hoerbuchki-qwen-tts:${Tag}"

function Test-DockerDaemon {
  docker info 2>$null | Out-Null
  return $LASTEXITCODE -eq 0
}

if (-not (Test-DockerDaemon)) {
  Write-Host ""
  Write-Host "Docker Desktop laeuft nicht (Engine nicht erreichbar)." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Option A: Docker Desktop starten, warten bis Engine running, dann erneut:"
  Write-Host "  .\scripts\runpod-build-push.ps1 -DockerUser $DockerUser"
  Write-Host ""
  Write-Host "Option B: Ohne lokales Docker - RunPod baut aus GitHub:"
  Write-Host "  Serverless -> New Endpoint -> Import Git Repository"
  Write-Host "  Repo: RPAudiobook, Dockerfile: Dockerfile (repo root)"
  Write-Host "  Siehe docs/RUNPOD-SERVERLESS-QWEN.md (Deploy via GitHub)"
  Write-Host ""
  exit 1
}

Push-Location $root
try {
  Write-Host "Building $image (linux/amd64) ..."
  docker build --platform linux/amd64 -f Dockerfile -t $image .
  if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

  if (-not $NoPush) {
    Write-Host "Pushing $image ..."
    docker push $image
    if ($LASTEXITCODE -ne 0) { throw "docker push failed" }
  }

  Write-Host ""
  Write-Host "Image: $image"
  Write-Host "RunPod: New Endpoint -> Load Balancer -> Container Image -> $image"
  Write-Host "Docs:   docs/RUNPOD-SERVERLESS-QWEN.md"
}
finally {
  Pop-Location
}
