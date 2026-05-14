[CmdletBinding()]
param(
  [string]$Distro = 'Ubuntu-24.04'
)

$ErrorActionPreference = 'Stop'

$scriptDir =
  if ($PSScriptRoot) {
    $PSScriptRoot
  } else {
    Split-Path -Parent $MyInvocation.MyCommand.Path
  }

$projectRoot = Split-Path -Parent $scriptDir
$windowsPath = $projectRoot -replace '\\', '/'

if ($windowsPath -notmatch '^([A-Za-z]):/(.*)$') {
  throw "Nao foi possivel converter o caminho do projeto para WSL: $projectRoot"
}

$drive = $Matches[1].ToLower()
$rest = $Matches[2]
$wslProjectRoot = "/mnt/$drive/$rest"

$command = "cd '$wslProjectRoot' && ZAVORTH_FIRECRACKER_ENABLED=true ZAVORTH_FIRECRACKER_BIN_PATH=/usr/local/bin/firecracker bash scripts/firecracker-smoke.sh"

& wsl.exe -d $Distro -u root -- bash -lc $command
exit $LASTEXITCODE
