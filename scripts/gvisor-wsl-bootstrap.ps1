[CmdletBinding()]
param(
  [string]$Distro = 'Ubuntu-24.04',
  [string]$ShimPath = "$HOME\docker-wsl-zavorth.cmd",
  [string]$ProjectRoot = '',
  [switch]$SkipEnvUpdate
)

$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot) {
  $scriptDir =
    if ($PSScriptRoot) {
      $PSScriptRoot
    } else {
      Split-Path -Parent $MyInvocation.MyCommand.Path
    }
  $ProjectRoot = Split-Path -Parent $scriptDir
}

function Invoke-WslRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  & wsl.exe -d $Distro -u root -- bash -lc $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Failure ao run no WSL ($Distro): $Command"
  }
}

function Set-OrAddEnvLine {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvPath,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $content = @()
  if (Test-Path -LiteralPath $EnvPath) {
    $content = Get-Content -LiteralPath $EnvPath
  }

  $updated = $false
  for ($i = 0; $i -lt $content.Count; $i++) {
    if ($content[$i] -match "^$([regex]::Escape($Key))=") {
      $content[$i] = "$Key=$Value"
      $updated = $true
    }
  }

  if (-not $updated) {
    $content += "$Key=$Value"
  }

  Set-Content -LiteralPath $EnvPath -Value $content -Encoding ASCII
}

function Get-EnvValueFromFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvPath,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    [string]$DefaultValue
  )

  if (-not (Test-Path -LiteralPath $EnvPath)) {
    return $DefaultValue
  }

  $match = Select-String -Path $EnvPath -Pattern "^$([regex]::Escape($Key))=(.*)$" | Select-Object -First 1
  if (-not $match) {
    return $DefaultValue
  }

  $value = $match.Matches[0].Groups[1].Value
  if (-not $value) {
    return $DefaultValue
  }

  return $value
}

$daemonConfig = @'
{
  "data-root": "/var/lib/docker-zavorth",
  "exec-root": "/var/run/docker-zavorth",
  "hosts": ["unix:///var/run/docker-zavorth.sock"],
  "bridge": "none",
  "iptables": false,
  "ip6tables": false,
  "ip-forward": false,
  "ip-masq": false,
  "runtimes": {
    "runsc": {
      "path": "/usr/bin/runsc"
    }
  },
  "default-runtime": "runc"
}
'@

$serviceUnit = @'
[Unit]
Description=Zavorth Docker daemon with gVisor runtime
After=network-online.target containerd.service
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/bin/dockerd --config-file /etc/docker/daemon-zavorth.json
ExecReload=/bin/kill -s HUP $MAINPID
TimeoutStartSec=0
Restart=on-failure
RestartSec=2
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity
Delegate=yes
KillMode=process
OOMScoreAdjust=-500

[Install]
WantedBy=multi-user.target
'@

$shim = @"
@echo off
setlocal
wsl.exe -d $Distro -u root -- env DOCKER_HOST=unix:///var/run/docker-zavorth.sock docker %*
exit /b %ERRORLEVEL%
"@

Write-Host 'Preparando gVisor no WSL...'
Invoke-WslRoot 'apt-get update >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y runsc >/dev/null'

Write-Host 'Writing dedicated daemon configuration...'
$daemonConfig | & wsl.exe -d $Distro -u root -- tee /etc/docker/daemon-zavorth.json > $null
if ($LASTEXITCODE -ne 0) {
  throw 'Failure ao gravar /etc/docker/daemon-zavorth.json no WSL.'
}

$serviceUnit | & wsl.exe -d $Distro -u root -- tee /etc/systemd/system/zavorth-docker.service > $null
if ($LASTEXITCODE -ne 0) {
  throw 'Failure ao gravar /etc/systemd/system/zavorth-docker.service no WSL.'
}

Write-Host 'Ativando daemon dedicado...'
Invoke-WslRoot 'systemctl daemon-reload && systemctl enable zavorth-docker.service >/dev/null && systemctl restart zavorth-docker.service'
Start-Sleep -Seconds 3
Invoke-WslRoot 'systemctl is-active zavorth-docker.service >/dev/null'

Write-Host 'Criando shim local without espacos...'
$shimDir = Split-Path -Parent $ShimPath
if (-not (Test-Path -LiteralPath $shimDir)) {
  New-Item -ItemType Directory -Path $shimDir -Force | Out-Null
}
Set-Content -LiteralPath $ShimPath -Value $shim -Encoding ASCII

if (-not $SkipEnvUpdate) {
  $envPath = Join-Path $ProjectRoot '.env'
  Write-Host 'Atualizando .env local do Zavorth...'
  Set-OrAddEnvLine -EnvPath $envPath -Key 'DOCKER_CLI_PATH' -Value $ShimPath
  Set-OrAddEnvLine -EnvPath $envPath -Key 'ZAVORTH_DOCKER_SANDBOX_RUNTIME' -Value 'runsc'
}

$envPath = Join-Path $ProjectRoot '.env'
$javascriptImage = Get-EnvValueFromFile -EnvPath $envPath -Key 'ZAVORTH_DOCKER_SANDBOX_JAVASCRIPT_IMAGE' -DefaultValue 'node:22-bullseye'
$pythonImage = Get-EnvValueFromFile -EnvPath $envPath -Key 'ZAVORTH_DOCKER_SANDBOX_PYTHON_IMAGE' -DefaultValue 'python:3.12-slim'
$shellImage = Get-EnvValueFromFile -EnvPath $envPath -Key 'ZAVORTH_DOCKER_SANDBOX_SHELL_IMAGE' -DefaultValue 'bash:5.2'

Write-Host 'Pre-carregando imagens base do sandbox...'
Invoke-WslRoot "DOCKER_HOST=unix:///var/run/docker-zavorth.sock docker pull '$javascriptImage' >/dev/null"
Invoke-WslRoot "DOCKER_HOST=unix:///var/run/docker-zavorth.sock docker pull '$pythonImage' >/dev/null"
Invoke-WslRoot "DOCKER_HOST=unix:///var/run/docker-zavorth.sock docker pull '$shellImage' >/dev/null"

Write-Host 'Validando runsc no daemon dedicado...'
Invoke-WslRoot 'DOCKER_HOST=unix:///var/run/docker-zavorth.sock docker run --rm --runtime runsc busybox true >/dev/null'

Write-Host ''
Write-Host 'gVisor local prepared com success.'
Write-Host "Shim: $ShimPath"
Write-Host 'Daemon: unix:///var/run/docker-zavorth.sock'
