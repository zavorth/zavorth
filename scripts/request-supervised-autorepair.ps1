param(
  [int]$WaitForPid = 0,
  [string]$Reason = '',
  [string]$NotifyChatId = '',
  [string]$RequestedBy = '',
  [switch]$ForceRestart,
  [switch]$AutoRepair,
  [string]$AutoRepairReason = ''
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$reloadScriptPath = Join-Path $projectRoot 'scripts\request-supervised-reload.ps1'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

if (-not (Test-Path $reloadScriptPath)) {
  throw "Nao encontrei o request-supervised-reload em $reloadScriptPath"
}

if (-not (Test-Path $powershellPath)) {
  throw "Nao encontrei o PowerShell em $powershellPath"
}

$effectiveReason = if ($AutoRepairReason) {
  $AutoRepairReason
} elseif ($Reason) {
  $Reason
} else {
  'Autoreparo supervisionado solicitado.'
}
$arguments = @(
  '-NoLogo',
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  $reloadScriptPath,
  '-WaitForPid',
  $WaitForPid,
  '-Reason',
  $effectiveReason,
  '-AutoRepair',
  '-AutoRepairReason',
  $effectiveReason
)

if ($ForceRestart) {
  $arguments += '-ForceRestart'
}

if ($NotifyChatId) {
  $arguments += @('-NotifyChatId', $NotifyChatId)
}

if ($RequestedBy) {
  $arguments += @('-RequestedBy', $RequestedBy)
}

& $powershellPath @arguments
exit $LASTEXITCODE
