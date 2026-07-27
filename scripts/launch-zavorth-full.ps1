param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot 'data\runtime'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $runtimeDir "launcher-$timestamp.log"
$lastLogFile = Join-Path $runtimeDir 'launcher-last.log'

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
Set-Content -Path $logFile -Value '' -Encoding UTF8
Set-Content -Path $lastLogFile -Value '' -Encoding UTF8

function Write-LauncherLine {
  param([string]$Message)

  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Message
  Write-Host $line
  Add-Content -Path $logFile -Value $line -Encoding UTF8
  Add-Content -Path $lastLogFile -Value $line -Encoding UTF8
}

function Invoke-LoggedCommand {
  param(
    [string]$Description,
    [string]$FilePath,
    [string[]]$Arguments
  )

  Write-LauncherLine $Description
  $commandPreview = ($FilePath + ' ' + (($Arguments | ForEach-Object { $_ }) -join ' ')).Trim()

  if ($DryRun) {
    Write-LauncherLine "[dry-run] $commandPreview"
    return
  }

  Push-Location $projectRoot
  try {
    & $FilePath @Arguments 2>&1 |
      Tee-Object -FilePath $logFile -Append |
      Tee-Object -FilePath $lastLogFile -Append

    if ($LASTEXITCODE -ne 0) {
      throw "Comando failed with code ${LASTEXITCODE}: $commandPreview"
    }
  } finally {
    Pop-Location
  }
}

Write-LauncherLine '==========================================='
Write-LauncherLine ' Zavorth Full Stack Launcher'
Write-LauncherLine '==========================================='
Write-LauncherLine "Project: $projectRoot"
Write-LauncherLine "Log current: $logFile"

Push-Location $projectRoot
try {
  if (-not (Test-Path (Join-Path $projectRoot 'package.json'))) {
    throw "Could not find package.json in $projectRoot"
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is not installed or not in PATH.'
  }

  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm is not available in PATH.'
  }

  if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
    Invoke-LoggedCommand '[1/4] Instalando dependencies do Zavorth...' 'npm' @('install')
  } else {
    Write-LauncherLine '[1/4] dependencies do Zavorth already are presentes.'
  }

  $thirdPartyBootstrapScript = Join-Path $projectRoot 'scripts\bootstrap-third-party.mjs'
  if (-not (Test-Path (Join-Path $projectRoot 'data\vendor-worktrees\AIGateway\package.json'))) {
    if (-not (Test-Path $thirdPartyBootstrapScript)) {
      Write-LauncherLine '[2/4] Bootstrap legado de terceiros ausente; vou seguir without os sidecars optional.'
    } else {
      try {
        Invoke-LoggedCommand '[2/4] Preparando copias locais de AIGateway e ZavorthTerminalRemoteChat...' 'node' @('scripts/bootstrap-third-party.mjs')
      } catch {
        Write-LauncherLine ("[2/4] Bootstrap de terceiros failed ({0}); vou seguir without os sidecars optional." -f $_.Exception.Message)
      }
    }
  } else {
    Write-LauncherLine '[2/4] Copias locais de terceiros already are preparadas.'
  }

  if (-not (Test-Path (Join-Path $projectRoot 'dist\host.js'))) {
    Invoke-LoggedCommand '[3/4] Compilando o Zavorth...' 'npm' @('run', 'build')
  } else {
    Write-LauncherLine '[3/4] Build do Zavorth already existe.'
  }

  $startAllArgs = @('run', 'start:all')
  if ($DryRun) {
    $startAllArgs += '--'
    $startAllArgs += '--dry-run'
  }

  Invoke-LoggedCommand '[4/4] Iniciando ZavorthBridge + Zavorth + AIGateway...' 'npm' $startAllArgs
  Write-LauncherLine 'Launcher finished.'
} catch {
  Write-LauncherLine "Failure no launcher: $($_.Exception.Message)"
  throw
} finally {
  Pop-Location
}
