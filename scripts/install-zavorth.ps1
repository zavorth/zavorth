param(
  [switch]$DryRun,
  [ValidatePattern('^[A-Za-z0-9._-]+$')]
  [string]$Tag = 'latest'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-ZavorthStep {
  param([string]$Message)
  Write-Host "[Zavorth] $Message"
}

function Resolve-ZavorthExecutable {
  param([string]$Name)

  $candidates = if ($Name -eq 'npm') {
    @('npm.cmd', 'npm')
  } elseif ($Name -eq 'zavorth') {
    @('zavorth.cmd', 'zavorth')
  } else {
    @($Name)
  }

  foreach ($candidate in $candidates) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
      return $command.Source
    }
  }

  return $null
}

function Require-ZavorthCommand {
  param(
    [string]$Name,
    [string]$Help
  )

  $source = Resolve-ZavorthExecutable -Name $Name
  if (-not $source) {
    Write-Error "$Name was not found. $Help"
    exit 2
  }

  return $source
}

function Invoke-CheckedCommand {
  param(
    [string]$Description,
    [string]$FilePath,
    [string[]]$Arguments,
    [int]$FailureExitCode
  )

  Write-ZavorthStep $Description
  & $FilePath @Arguments

  if ($LASTEXITCODE -ne 0) {
    Write-Error "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    exit $FailureExitCode
  }
}

$packageSpec = "zavorth@$Tag"

Write-ZavorthStep "Official installer"
Write-ZavorthStep "Mode: $(if ($DryRun) { 'dry-run' } else { 'install' })"
Write-ZavorthStep "Package: $packageSpec"

$nodeExe = Require-ZavorthCommand -Name 'node' -Help 'Install Node.js 18 or newer, then run this installer again.'
$npmExe = Require-ZavorthCommand -Name 'npm' -Help 'Install npm with Node.js, then run this installer again.'

$nodeVersion = (& $nodeExe --version).Trim()
$npmVersion = (& $npmExe --version).Trim()
$nodeMajor = & $nodeExe -p "process.versions.node.split('.')[0]"
if ([int]$nodeMajor -lt 18) {
  Write-Error "Node.js $nodeVersion was found. Zavorth requires Node.js 18 or newer."
  exit 2
}

Write-ZavorthStep "Node: $nodeVersion"
Write-ZavorthStep "npm: $npmVersion"

if ($DryRun) {
  Write-ZavorthStep "Would run: npm install -g $packageSpec"
  Write-ZavorthStep "Would run: zavorth --help"
  Write-ZavorthStep "Would run: zavorth help doctor"
  Write-ZavorthStep "Dry-run complete. No global install, runtime start, or secret write happened."
  exit 0
}

Invoke-CheckedCommand `
  -Description "Installing $packageSpec globally..." `
  -FilePath $npmExe `
  -Arguments @('install', '-g', $packageSpec) `
  -FailureExitCode 3

$zavorthExe = Require-ZavorthCommand -Name 'zavorth' -Help 'Restart the terminal or check npm global bin.'

Invoke-CheckedCommand `
  -Description 'Running safe post-install check: zavorth --help' `
  -FilePath $zavorthExe `
  -Arguments @('--help') `
  -FailureExitCode 5

Invoke-CheckedCommand `
  -Description 'Running safe post-install check: zavorth help doctor' `
  -FilePath $zavorthExe `
  -Arguments @('help', 'doctor') `
  -FailureExitCode 5

Write-ZavorthStep "Ready. Next: zavorth setup"
exit 0
