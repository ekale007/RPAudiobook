# Index this repo into codebase-memory-mcp (Windows).
# Uses D:/RPAudiobook junction when present — avoids umlaut path issues with the CLI.
param(
  [ValidateSet("full", "moderate", "fast")]
  [string]$Mode = "full",
  [switch]$NoPersistence
)
$ErrorActionPreference = "Stop"
$bin = "D:\Codebase-memory-mcp\codebase-memory-mcp.exe"
if (-not (Test-Path $bin)) {
  $bin = "$env:LOCALAPPDATA\Programs\codebase-memory-mcp\codebase-memory-mcp.exe"
}
if (-not (Test-Path $bin)) {
  throw "codebase-memory-mcp not found. Install from https://github.com/DeusData/codebase-memory-mcp"
}

$repoPath = if (Test-Path "D:/RPAudiobook/package.json") {
  "D:/RPAudiobook"
} else {
  $here = (Get-Location).Path -replace "\\", "/"
  if ($here -notmatch "^[A-Za-z]:/") { throw "Run from repo root or create junction D:\RPAudiobook" }
  $here
}

$persistence = -not $NoPersistence
# CLI on Windows needs escaped JSON quotes (not ConvertTo-Json alone).
$json = "{`"repo_path`":`"$repoPath`",`"mode`":`"$Mode`",`"persistence`":$($persistence.ToString().ToLower())}"
$json = $json -replace '"', '\"'

Write-Host "Indexing $repoPath (mode=$Mode, persistence=$persistence)..."
& $bin cli index_repository $json
