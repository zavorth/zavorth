[CmdletBinding()]
param(
  [string]$Distro = 'Ubuntu-24.04',
  [switch]$Smoke
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

if ($windowsPath -match '^([A-Za-z]):/(.*)$') {
  $drive = $Matches[1].ToLower()
  $rest = $Matches[2]
  $wslProjectRoot = "/mnt/$drive/$rest"
} else {
  throw "Nao foi possivel converter o caminho do projeto para WSL: $projectRoot"
}

$modeArg = if ($Smoke) { ' --smoke' } else { '' }
$command = "cd '$wslProjectRoot' && DOCKER_HOST=unix:///var/run/docker-zavorth.sock bash scripts/sandbox-doctor.sh$modeArg"

& wsl.exe -d $Distro -u root -- sh -lc $command
exit $LASTEXITCODE
