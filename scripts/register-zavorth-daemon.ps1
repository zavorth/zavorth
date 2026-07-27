param(
  [switch]$Remove,
  [switch]$AllowInstall
)

$ErrorActionPreference = 'Stop'

$startupInstaller = Join-Path $PSScriptRoot 'install-windows-startup.ps1'
if (-not (Test-Path $startupInstaller)) {
  throw "Could not find the official Startup installer at $startupInstaller"
}

$argsList = @()
if ($Remove) {
  $argsList += '-Remove'
}
if ($AllowInstall) {
  $argsList += '-AllowInstall'
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startupInstaller @argsList
