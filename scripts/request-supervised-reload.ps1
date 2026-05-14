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
$launcherScriptPath = Join-Path $projectRoot 'scripts\launch-zavorth-supervised.ps1'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

if (-not (Test-Path $launcherScriptPath)) {
  throw "Nao encontrei o launcher supervisionado em $launcherScriptPath"
}

if (-not (Test-Path $powershellPath)) {
  throw "Nao encontrei o PowerShell em $powershellPath"
}

function Wait-ForProcessExit {
  param(
    [int]$ProcessId,
    [int]$TimeoutSeconds = 45
  )

  if ($ProcessId -le 0) {
    return
  }

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $null = Get-Process -Id $ProcessId -ErrorAction Stop
      Start-Sleep -Milliseconds 500
      continue
    } catch {
      return
    }
  }
}

Wait-ForProcessExit -ProcessId $WaitForPid

$arguments = @(
  '-NoLogo',
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  $launcherScriptPath,
  '-Headless'
)

if ($ForceRestart) {
  $arguments += '-ForceRestart'
}

if ($Reason) {
  $arguments += @('-Reason', $Reason)
}

if ($NotifyChatId) {
  $arguments += @('-NotifyChatId', $NotifyChatId)
}

if ($RequestedBy) {
  $arguments += @('-RequestedBy', $RequestedBy)
}

if ($AutoRepair) {
  $arguments += '-AutoRepair'
}

if ($AutoRepairReason) {
  $arguments += @('-AutoRepairReason', $AutoRepairReason)
}

& $powershellPath @arguments
exit $LASTEXITCODE
