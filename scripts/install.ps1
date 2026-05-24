param(
  [switch]$DryRun,
  [switch]$Completions,
  [ValidateSet('stable', 'beta', 'nightly', 'dev')]
  [string]$Channel = $(if ($env:ZAVORTH_CHANNEL) { $env:ZAVORTH_CHANNEL } else { 'stable' }),
  [ValidatePattern('^[A-Za-z0-9._-]+$')]
  [string]$Tag = $(if ($env:ZAVORTH_NPM_TAG) { $env:ZAVORTH_NPM_TAG } else { '' })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-ZavorthStep {
  param([string]$Message)
  Write-Host "[Zavorth] $Message"
}

function Write-ZavorthOk {
  param([string]$Message)
  Write-Host "[Zavorth] OK $Message" -ForegroundColor Green
}

function Stop-ZavorthInstall {
  param(
    [string]$Message,
    [int]$Code = 1
  )
  Write-Error "[Zavorth] ERROR $Message"
  exit $Code
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
    [string]$Help,
    [int]$Code = 2
  )

  $source = Resolve-ZavorthExecutable -Name $Name
  if (-not $source) {
    Stop-ZavorthInstall "$Name was not found. $Help" $Code
  }

  return $source
}

function Invoke-ZavorthCommand {
  param(
    [string]$Description,
    [string]$FilePath,
    [string[]]$Arguments,
    [int]$FailureExitCode
  )

  Write-ZavorthStep $Description
  & $FilePath @Arguments

  if ($LASTEXITCODE -ne 0) {
    Stop-ZavorthInstall "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')" $FailureExitCode
  }
}

Write-Host "  Z A V O R T H   I N S T A L L E R"
Write-Host "  Local-first intelligence. Governed execution. Clear evidence."
Write-Host ""

$defaultTag = switch ($Channel) {
  'stable' { 'latest' }
  'beta' { 'beta' }
  'nightly' { 'nightly' }
  'dev' { 'dev' }
}
if (-not $Tag) {
  $Tag = $defaultTag
}

$packageSpec = "zavorth@$Tag"
Write-ZavorthStep "Mode: $(if ($DryRun) { 'dry-run' } else { 'install' })"
Write-ZavorthStep "Channel: $Channel"
Write-ZavorthStep "Package: $packageSpec"

$nodeExe = Require-ZavorthCommand -Name 'node' -Help 'Install Node.js 18 or newer, then run this installer again.'
$npmExe = Require-ZavorthCommand -Name 'npm' -Help 'Install npm with Node.js, then run this installer again.'

$nodeVersion = (& $nodeExe --version).Trim()
$npmVersion = (& $npmExe --version).Trim()
$nodeMajor = & $nodeExe -p "process.versions.node.split('.')[0]"
if ([int]$nodeMajor -lt 18) {
  Stop-ZavorthInstall "Node.js $nodeVersion was found. Zavorth requires Node.js 18 or newer." 2
}

Write-ZavorthStep "Node: $nodeVersion"
Write-ZavorthStep "npm: $npmVersion"

if ($DryRun) {
  Write-ZavorthStep "Would run: npm install -g $packageSpec"
  Write-ZavorthStep "Would run: zavorth --help"
  Write-ZavorthStep "Would run: zavorth help doctor"
  if ($Completions) {
    Write-ZavorthStep "Would suggest: zavorth completions powershell --install"
  }
  Write-ZavorthOk "Dry-run complete. No install, runtime start, PATH edit, or secret write happened."
  exit 0
}

Invoke-ZavorthCommand `
  -Description "Installing $packageSpec globally..." `
  -FilePath $npmExe `
  -Arguments @('install', '-g', $packageSpec) `
  -FailureExitCode 3

$zavorthExe = Require-ZavorthCommand -Name 'zavorth' -Help 'Restart the terminal or check npm global bin.' -Code 4

Invoke-ZavorthCommand `
  -Description 'Running safe post-install check: zavorth --help' `
  -FilePath $zavorthExe `
  -Arguments @('--help') `
  -FailureExitCode 5

Invoke-ZavorthCommand `
  -Description 'Running safe post-install check: zavorth help doctor' `
  -FilePath $zavorthExe `
  -Arguments @('help', 'doctor') `
  -FailureExitCode 5

Write-ZavorthOk 'Ready. Next: zavorth setup'
if ($Completions) {
  Write-ZavorthStep 'Completions are opt-in. Run: zavorth completions powershell --install'
}
exit 0
