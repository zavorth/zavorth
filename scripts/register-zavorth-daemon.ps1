param(
  [switch]$Remove,
  [switch]$AllowInstall
)

$ErrorActionPreference = 'Stop'

$startupInstaller = Join-Path $PSScriptRoot 'install-windows-startup.ps1'
if (-not (Test-Path $startupInstaller)) {
  throw "Nao encontrei o instalador oficial de Startup em $startupInstaller"
}

$argsList = @()
if ($Remove) {
  $argsList += '-Remove'
}
if ($AllowInstall) {
  $argsList += '-AllowInstall'
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startupInstaller @argsList
