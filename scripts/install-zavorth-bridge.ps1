param(
  [string]$SourceDir = (Join-Path $PSScriptRoot '..\zavorth-bridge-extension'),
  [string]$TargetRoot = "$env:USERPROFILE\.zavorthBridge\extensions",
  [string]$Version = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $SourceDir)) {
  throw "Source extension folder not found: $SourceDir"
}

$packageJsonPath = Join-Path $SourceDir 'package.json'
if (-not $Version) {
  if (-not (Test-Path $packageJsonPath)) {
    throw "package.json not found in source extension folder: $packageJsonPath"
  }

  $packageJson = Get-Content -Path $packageJsonPath -Raw | ConvertFrom-Json
  if (-not $packageJson.version) {
    throw "Could not read extension version from: $packageJsonPath"
  }

  $Version = [string]$packageJson.version
}

$publisher = if ($packageJson.publisher) { [string]$packageJson.publisher } else { 'zavorthlabs' }
$targetDir = Join-Path $TargetRoot "$publisher.zavorth-zavorth-bridge-$Version"

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null
if (Test-Path $targetDir) {
  Remove-Item -Path $targetDir -Recurse -Force
}

Copy-Item -Path $SourceDir -Destination $targetDir -Recurse -Force

[pscustomobject]@{
  ok = $true
  source = $SourceDir
  target = $targetDir
  message = "Zavorth Zavorth Bridge installed."
} | ConvertTo-Json -Compress
