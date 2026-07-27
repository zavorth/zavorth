param(
  [switch]$DryRun,
  [switch]$Headless,
  [switch]$ForceRestart,
  [switch]$AutoRepair,
  [string]$AutoRepairReason = '',
  [string]$Reason = '',
  [string]$NotifyChatId = '',
  [string]$RequestedBy = '',
  [string[]]$PassthroughArgs = @()
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot 'data\runtime'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $runtimeDir "unified-launcher-$timestamp.log"
$lastLogFile = Join-Path $runtimeDir 'unified-launcher-last.log'
$supervisedScript = Join-Path $projectRoot 'scripts\launch-zavorth-supervised.ps1'
$keepaliveLog = Join-Path $runtimeDir 'ops-remote-keepalive.out.log'
$keepaliveErr = Join-Path $runtimeDir 'ops-remote-keepalive.err.log'
$runtimeProfile = 'core'
if ($null -ne $env:ZAVORTH_PROFILE -and [string]::IsNullOrWhiteSpace([string]$env:ZAVORTH_PROFILE) -eq $false) {
  $runtimeProfile = ([string]$env:ZAVORTH_PROFILE).ToLowerInvariant()
}
$keepaliveExplicitlyEnabled = $false
if ($null -ne $env:ZAVORTH_ENABLE_REMOTE_KEEPALIVE) {
  $keepaliveExplicitlyEnabled = ([string]$env:ZAVORTH_ENABLE_REMOTE_KEEPALIVE).ToLowerInvariant() -eq 'true'
}

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

Write-LauncherLine '==========================================='
Write-LauncherLine ' Zavorth Unified Launcher'
Write-LauncherLine '==========================================='
Write-LauncherLine "Project: $projectRoot"
Write-LauncherLine "Log current: $logFile"

if (-not (Test-Path $supervisedScript)) {
  Write-LauncherLine "Could not find supervised launcher at $supervisedScript"
  throw "Launcher supervised ausente."
}

$supervisedArgs = @()
if ($DryRun) { $supervisedArgs += '-DryRun' }
if ($Headless) { $supervisedArgs += '-Headless' }
if ($ForceRestart) { $supervisedArgs += '-ForceRestart' }
if ($AutoRepair) { $supervisedArgs += '-AutoRepair' }
if ($AutoRepairReason) { $supervisedArgs += @('-AutoRepairReason', $AutoRepairReason) }
if ($Reason) { $supervisedArgs += @('-Reason', $Reason) }
if ($NotifyChatId) { $supervisedArgs += @('-NotifyChatId', $NotifyChatId) }
if ($RequestedBy) { $supervisedArgs += @('-RequestedBy', $RequestedBy) }
if ($PassthroughArgs.Count -gt 0) { $supervisedArgs += $PassthroughArgs }

Write-LauncherLine 'Iniciando Zavorth supervised...'
& $supervisedScript @supervisedArgs

if (-not $DryRun -and ($runtimeProfile -eq 'full' -or $keepaliveExplicitlyEnabled)) {
  Write-LauncherLine 'Iniciando keepalive de AIGateway + node-host...'
  Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','ops:remote:keepalive') `
    -WorkingDirectory $projectRoot -WindowStyle Minimized `
    -RedirectStandardOutput $keepaliveLog -RedirectStandardError $keepaliveErr | Out-Null
  Write-LauncherLine "Keepalive iniciado (logs: $keepaliveLog)."
} elseif (-not $DryRun) {
  Write-LauncherLine "Keepalive remote ignorado no perfil $runtimeProfile. Use ZAVORTH_PROFILE=full ou ZAVORTH_ENABLE_REMOTE_KEEPALIVE=true para habilitar."
} else {
  Write-LauncherLine '[dry-run] Keepalive not started.'
}

Write-LauncherLine 'Launcher unificado finished.'
