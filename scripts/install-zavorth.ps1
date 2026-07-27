param(
  [switch]$DryRun,
  [ValidatePattern('^[A-Za-z0-9._-]+$')]
  [string]$Tag = 'latest'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ANSI Color codes for modern terminals
$ESC = [char]27
$CLR_RESET = "$ESC[0m"
$CLR_PRIMARY = "$ESC[1;36m"   # Bold Cyan
$CLR_ACCENT = "$ESC[1;35m"    # Bold Magenta
$CLR_MUTED = "$ESC[90m"       # Dark Gray
$CLR_SUCCESS = "$ESC[1;32m"   # Bold Green
$CLR_WARNING = "$ESC[1;33m"   # Bold Yellow
$CLR_ERROR = "$ESC[1;31m"     # Bold Red
$CLR_INFO = "$ESC[1;34m"      # Bold Blue

# Safe Unicode definitions to prevent Windows PowerShell encoding-dependent parse errors
$CHAR_CHECK = [char]0x2713      # ✓
$CHAR_CROSS = [char]0x2717      # ✗
$CHAR_SPIN = [char]0x280B       # ⠋
$CHAR_INFO = [char]0x2139       # ℹ
$CHAR_SPARKLE = [char]0x2728    # ✨
$CHAR_LINE = [char]0x2500       # ─
$CHAR_PARTY = [System.Char]::ConvertFromUtf32(0x1F389) # 🎉

$DIVIDER = [string]$CHAR_LINE * 60

function Write-ZavorthOk {
  param([string]$Message)
  Write-Host " ${CLR_SUCCESS}$CHAR_CHECK${CLR_RESET} $Message"
}

function Write-ZavorthStep {
  param([string]$Message)
  Write-Host " ${CLR_PRIMARY}$CHAR_SPIN${CLR_RESET} $Message"
}

function Stop-ZavorthInstall {
  param(
    [string]$Message,
    [int]$Code = 1
  )
  Write-Host ""
  Write-Host " ${CLR_ERROR}$CHAR_CROSS ERROR:${CLR_RESET} $Message" -ForegroundColor Red
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

function Start-ZavorthSpinner {
  param(
    [string]$Message,
    [string]$FilePath,
    [string[]]$Arguments,
    [int]$FailureExitCode
  )

  $spinchars = @(
    [char]0x280B, [char]0x2819, [char]0x2839, [char]0x2838,
    [char]0x283C, [char]0x2834, [char]0x2826, [char]0x2827,
    [char]0x2807, [char]0x280F
  )

  # Start the process in the background using .NET Process to easily monitor without job overhead
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.Arguments = $Arguments -join ' '
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi

  $started = $process.Start()
  if (-not $started) {
    Stop-ZavorthInstall "Failed to start $FilePath" $FailureExitCode
  }

  $i = 0
  while (-not $process.HasExited) {
    $char = $spinchars[$i % $spinchars.Length]
    Write-Host -NoNewline "`r ${CLR_PRIMARY}$char${CLR_RESET} $Message..."
    Start-Sleep -Milliseconds 80
    $i++
  }

  # Flush remainder stdout/stderr
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()

  Write-Host -NoNewline "`r"
  if ($process.ExitCode -ne 0) {
    Write-Host " ${CLR_ERROR}$CHAR_CROSS${CLR_RESET} $Message (Failed)`n$stderr"
    Stop-ZavorthInstall "Command failed with exit code $($process.ExitCode)" $FailureExitCode
  } else {
    Write-ZavorthOk $Message
  }
}

Clear-Host
Write-Host "${CLR_PRIMARY} $CHAR_SPARKLE  Z A V O R T H  |  I N S T A L L E R${CLR_RESET}"
Write-Host "${CLR_MUTED}  Local-first intelligence. Governed execution. Clear evidence.${CLR_RESET}"
Write-Host "${CLR_MUTED} $DIVIDER${CLR_RESET}"
Write-Host ""

$packageSpec = "zavorth@$Tag"

# Validate Node.js & npm
$nodeExe = Require-ZavorthCommand -Name 'node' -Help 'Install Node.js 18 or newer, then run this installer again.'
$npmExe = Require-ZavorthCommand -Name 'npm' -Help 'Install npm with Node.js, then run this installer again.'

$nodeVersion = (& $nodeExe --version).Trim()
$npmVersion = (& $npmExe --version).Trim()
$nodeMajor = & $nodeExe -p "process.versions.node.split('.')[0]"
if ([int]$nodeMajor -lt 18) {
  Stop-ZavorthInstall "Node.js $nodeVersion was found. Zavorth requires Node.js 18 or newer." 2
}

Write-ZavorthOk "Node.js runtime detected: ${CLR_MUTED}$nodeVersion${CLR_RESET}"
Write-ZavorthOk "npm package manager detected: ${CLR_MUTED}v$npmVersion${CLR_RESET}"
Write-Host " ${CLR_MUTED}Target Package:${CLR_RESET} ${CLR_PRIMARY}$packageSpec${CLR_RESET}"
Write-Host ""

if ($DryRun) {
  Write-ZavorthOk "Dry-run mode active. No install will be performed."
  Write-Host "Would run: npm install -g $packageSpec"
  Write-Host "Would run: zavorth --help"
  Write-Host "Would run: zavorth help doctor"
  exit 0
}

# Install global npm package with spinner
Start-ZavorthSpinner -Message "Downloading and installing $packageSpec globally" -FilePath $npmExe -Arguments @('install', '-g', $packageSpec) -FailureExitCode 3

$zavorthExe = Require-ZavorthCommand -Name 'zavorth' -Help 'Restart the terminal or check npm global bin.' -Code 4

# Run safe post-install checks
Start-ZavorthSpinner -Message "Verifying CLI executable integrity" -FilePath $zavorthExe -Arguments @('--help') -FailureExitCode 5
Start-ZavorthSpinner -Message "Verifying system diagnostics readiness" -FilePath $zavorthExe -Arguments @('help', 'doctor') -FailureExitCode 5

Write-Host ""
Write-Host " ${CLR_SUCCESS}$CHAR_PARTY Success! Zavorth has been successfully installed.${CLR_RESET}"
Write-Host " ${CLR_MUTED}$DIVIDER${CLR_RESET}"
Write-Host " ${CLR_PRIMARY}Next steps to get started:${CLR_RESET}"
Write-Host "  1. Run ${CLR_ACCENT}zavorth setup${CLR_RESET} to connect your first AI model."
Write-Host "  2. Run ${CLR_ACCENT}zavorth start${CLR_RESET} to launch the background runtime daemon."
Write-Host "  3. Run ${CLR_ACCENT}zavorth open${CLR_RESET} to open the visual dashboard in your browser."
Write-Host " ${CLR_MUTED}$DIVIDER${CLR_RESET}"
Write-Host ""
exit 0
