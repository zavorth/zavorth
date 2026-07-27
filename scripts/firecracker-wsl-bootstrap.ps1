[CmdletBinding()]
param(
  [string]$Distro = 'Ubuntu-24.04',
  [switch]$SkipSmoke
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
  throw "Could not convert the project path to WSL: $projectRoot"
}

$drive = $Matches[1].ToLower()
$rest = $Matches[2]
$wslProjectRoot = "/mnt/$drive/$rest"
$wslDataDir = "$wslProjectRoot/data/firecracker"

function Invoke-WslRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  & wsl.exe -d $Distro -u root -- bash -lc $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to run no WSL ($Distro): $Command"
  }
}

Write-Host 'Preparando Firecracker no WSL...'
Invoke-WslRoot "cd '$wslProjectRoot' && ZAVORTH_FIRECRACKER_ROOTFS_SIZE_MB=2048 bash scripts/firecracker-host-bootstrap.sh --with-rootfs"

Write-Host 'Instalando kernel Linux virtual para extraction do vmlinux...'
Invoke-WslRoot 'DEBIAN_FRONTEND=noninteractive apt-get install -y linux-image-virtual linux-tools-common >/dev/null'

Write-Host 'Extraindo vmlinux para o diretorio do Zavorth...'
Invoke-WslRoot @"
mkdir -p '$wslDataDir'
if [ ! -x /usr/local/bin/extract-vmlinux ]; then
  curl -fsSL https://raw.githubusercontent.com/torvalds/linux/master/scripts/extract-vmlinux -o /usr/local/bin/extract-vmlinux
  chmod +x /usr/local/bin/extract-vmlinux
fi
/usr/local/bin/extract-vmlinux /boot/vmlinuz > '$wslDataDir/vmlinux'
"@

if (-not $SkipSmoke) {
  Write-Host 'Rodando smoke do Firecracker no WSL...'
  Invoke-WslRoot "cd '$wslProjectRoot' && ZAVORTH_FIRECRACKER_ENABLED=true ZAVORTH_FIRECRACKER_BIN_PATH=/usr/local/bin/firecracker bash scripts/firecracker-smoke.sh"
}

Write-Host ''
Write-Host 'Firecracker WSL prepared com success.'
Write-Host "Assets: $projectRoot\data\firecracker"
