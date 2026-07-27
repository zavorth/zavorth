param(
  [switch]$DryRun,
  [switch]$Headless,
  [switch]$ForceRestart,
  [switch]$AutoRepair,
  [string]$AutoRepairReason = '',
  [string]$Reason = '',
  [string]$NotifyChatId = '',
  [string]$RequestedBy = ''
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot 'data\runtime'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $runtimeDir "supervised-launcher-$timestamp.log"
$lastLogFile = Join-Path $runtimeDir 'supervised-launcher-last.log'
$fallbackLastLogFile = Join-Path $runtimeDir "supervised-launcher-last-$timestamp.log"
$activeLastLogFile = $lastLogFile
$zavorthControlRuntimeStateFile = Join-Path $runtimeDir 'zavorth-control-runtime.json'
$hostLockFile = Join-Path $runtimeDir 'host-supervisor.lock.json'
$telegramLockFile = Join-Path $runtimeDir 'telegram-bot.lock.json'
$codexRemoteBrokerDir = Join-Path $runtimeDir 'codex-remote-broker'
$codexRemoteBrokerLockFile = Join-Path $codexRemoteBrokerDir 'codex-remote-broker.lock.json'
$runtimeStdOutLogBase = Join-Path $runtimeDir 'supervised-runtime.out.log'
$runtimeStdErrLogBase = Join-Path $runtimeDir 'supervised-runtime.err.log'
$runtimeStdOutLog = $runtimeStdOutLogBase
$runtimeStdErrLog = $runtimeStdErrLogBase
$codexRemoteBrokerStdOutLogBase = Join-Path $runtimeDir 'codex-remote-broker.out.log'
$codexRemoteBrokerStdErrLogBase = Join-Path $runtimeDir 'codex-remote-broker.err.log'
$codexRemoteBrokerStdOutLog = $codexRemoteBrokerStdOutLogBase
$codexRemoteBrokerStdErrLog = $codexRemoteBrokerStdErrLogBase
$reloadReportFile = Join-Path $runtimeDir 'supervised-reload-last.json'
$pendingStartupNotificationFile = Join-Path $runtimeDir 'supervised-reload-pending-notification.json'
$envPath = Join-Path $projectRoot '.env'
$envExamplePath = Join-Path $projectRoot '.env.example'
$runnerScriptPath = Join-Path $projectRoot 'scripts\run-zavorth-supervised-host.ps1'
$codexRemoteBrokerScriptPath = Join-Path $projectRoot 'scripts\codex-remote-broker.ps1'
$autoRepairTsScriptPath = Join-Path $projectRoot 'scripts\autorepair.ts'
$autoRepairDistCliPath = Join-Path $projectRoot 'dist\autorepair-cli.js'
$autoRepairDistWrapperPath = Join-Path $projectRoot 'scripts\autorepair.mjs'
$autoRepairDistModulePath = Join-Path $projectRoot 'dist\cli\AutoRepairCli.js'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$AIGatewayWorktreeDir = Join-Path $projectRoot 'data\vendor-worktrees\AIGateway'
$ZavorthTerminalRemoteWorktreeDir = Join-Path $projectRoot 'data\vendor-worktrees\zavorth-terminal'
$projectRootNormalized = $projectRoot.ToLowerInvariant().Replace('/', '\')
$hostProcessMarkers = @('dist\host.js', 'src\host.ts', 'run-zavorth-supervised-host.ps1', 'start:supervised')
$workerProcessMarkers = @('dist\index.js', 'src\index.ts')
$brokerProcessMarkers = @('scripts\codex-remote-broker.ps1')
$managedProcessPatterns = @(
  (Join-Path $projectRoot 'dist\host.js').ToLowerInvariant(),
  (Join-Path $projectRoot 'src\host.ts').ToLowerInvariant(),
  (Join-Path $projectRoot 'dist\index.js').ToLowerInvariant(),
  (Join-Path $projectRoot 'src\index.ts').ToLowerInvariant(),
  (Join-Path $projectRoot 'scripts\run-zavorth-supervised-host.ps1').ToLowerInvariant(),
  (Join-Path $projectRoot 'scripts\codex-remote-broker.ps1').ToLowerInvariant(),
  $AIGatewayWorktreeDir.ToLowerInvariant(),
  $ZavorthTerminalRemoteWorktreeDir.ToLowerInvariant()
)

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
Set-Content -Path $logFile -Value '' -Encoding UTF8
try {
  Set-Content -Path $lastLogFile -Value '' -Encoding UTF8
} catch {
  $activeLastLogFile = $fallbackLastLogFile
  Set-Content -Path $activeLastLogFile -Value '' -Encoding UTF8
}

$launcherReport = [ordered]@{
  startedAt = (Get-Date).ToString('o')
  status = 'running'
  dryRun = [bool]$DryRun
  headless = [bool]$Headless
  forceRestart = [bool]$ForceRestart
  autoRepair = [bool]$AutoRepair
  autoRepairReason = $AutoRepairReason
  reason = $Reason
  requestedBy = $RequestedBy
  notifyChatId = $NotifyChatId
  logFile = $logFile
  lastLogFile = $activeLastLogFile
  runtimeStdOutLog = $runtimeStdOutLog
  runtimeStdErrLog = $runtimeStdErrLog
  pendingStartupNotificationFile = $pendingStartupNotificationFile
  lastAutoRepairCliStrategy = ''
  lastAutoRepairCliCommand = ''
  lastAutoRepairCliError = ''
  actions = @()
}

function Save-LauncherReport {
  $launcherReport.updatedAt = (Get-Date).ToString('o')
  Set-Content -Path $reloadReportFile -Value ($launcherReport | ConvertTo-Json -Depth 6) -Encoding UTF8
}

function Add-LauncherAction {
  param([string]$Action)

  if (-not $Action) {
    return
  }

  $launcherReport.actions = @($launcherReport.actions) + @($Action)
  Save-LauncherReport
}

Save-LauncherReport

function Write-LauncherLine {
  param([string]$Message)

  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Message
  Write-Host $line
  Add-Content -Path $logFile -Value $line -Encoding UTF8
  Add-Content -Path $activeLastLogFile -Value $line -Encoding UTF8
}

function Open-HelpfulFile {
  param([string]$Path)

  if ($DryRun -or $Headless -or -not (Test-Path $Path)) {
    return
  }

  try {
    Start-Process -FilePath 'notepad.exe' -ArgumentList @($Path) | Out-Null
  } catch {
    Write-LauncherLine "Could not open automatically: $Path"
  }
}

function Show-LauncherFailure {
  param(
    [string]$Message,
    [string[]]$PathsToOpen = @()
  )

  Write-LauncherLine $Message

  foreach ($path in ($PathsToOpen | Where-Object { $_ } | Select-Object -Unique)) {
    Open-HelpfulFile -Path $path
  }

  if ($DryRun -or $Headless) {
    return
  }

  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    [System.Windows.Forms.MessageBox]::Show(
      "$Message`r`n`r`nVeja o log em:`r`n$activeLastLogFile",
      'Zavorth Supervisionado',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {
    Write-LauncherLine "Could not open the failure MessageBox. Check the log at $activeLastLogFile"
  }
}

function Resolve-LauncherExecutable {
  param([string]$CommandName)

  $normalized = "$CommandName".Trim()
  if (-not $normalized) {
    return $normalized
  }

  switch ($normalized.ToLowerInvariant()) {
    'npm' {
      $npmCmd = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
      if ($null -ne $npmCmd -and $npmCmd.Source) {
        return [string]$npmCmd.Source
      }

      return 'npm.cmd'
    }
    'npx' {
      $npxCmd = Get-Command 'npx.cmd' -ErrorAction SilentlyContinue
      if ($null -ne $npxCmd -and $npxCmd.Source) {
        return [string]$npxCmd.Source
      }

      return 'npx.cmd'
    }
  }

  $resolved = Get-Command $normalized -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $resolved) {
    foreach ($propertyName in @('Source', 'Path', 'Definition')) {
      if ($resolved.PSObject.Properties.Name -contains $propertyName) {
        $propertyValue = $resolved.$propertyName
        if ($propertyValue) {
          return [string]$propertyValue
        }
      }
    }
  }

  return $normalized
}

function Invoke-LoggedCommand {
  param(
    [string]$Description,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory = $projectRoot
  )

  Write-LauncherLine $Description
  $resolvedFilePath = Resolve-LauncherExecutable -CommandName $FilePath
  $commandPreview = ($resolvedFilePath + ' ' + (($Arguments | ForEach-Object { $_ }) -join ' ')).Trim()

  if ($DryRun) {
    Write-LauncherLine "[dry-run] $commandPreview"
    return
  }

  Push-Location $WorkingDirectory
  try {
    & $resolvedFilePath @Arguments 2>&1 |
      Tee-Object -FilePath $logFile -Append |
      Tee-Object -FilePath $lastLogFile -Append

    if ($LASTEXITCODE -ne 0) {
      throw "Comando failed with code ${LASTEXITCODE}: $commandPreview"
    }
  } finally {
    Pop-Location
  }
}

function Invoke-AutoRepairCli {
  param(
    [string]$Reason,
    [string]$RequestedBy = 'launcher',
    [switch]$Force,
    [ValidateSet('auto', 'repair', 'improve')]
    [string]$Goal = 'repair'
  )

  $scriptArgs = @('--reason', $Reason, '--requested-by', $RequestedBy)
  if ($Force) {
    $scriptArgs += '--force'
  }

  switch ($Goal) {
    'repair' {
      $scriptArgs += '--repair'
    }
    'improve' {
      $scriptArgs += '--improve'
    }
  }

  $strategies = @()
  if (Test-Path $autoRepairDistCliPath) {
    $strategies += [pscustomobject]@{
      Name = 'node-dist-cli'
      Description = '[6/7] O Zavorth vai try um self-repair seguro via CLI compilado...'
      FilePath = 'node'
      Arguments = @($autoRepairDistCliPath) + $scriptArgs
    }
  }

  if ((Test-Path $autoRepairDistWrapperPath) -and (Test-Path $autoRepairDistModulePath)) {
    $strategies += [pscustomobject]@{
      Name = 'node-dist-wrapper'
      Description = '[6/7] O Zavorth vai try um self-repair seguro via wrapper JS compilado...'
      FilePath = 'node'
      Arguments = @($autoRepairDistWrapperPath) + $scriptArgs
    }
  }

  if (Test-Path $autoRepairTsScriptPath) {
    $strategies += [pscustomobject]@{
      Name = 'node-tsx-import'
      Description = '[6/7] O Zavorth vai try um self-repair seguro via node --import tsx...'
      FilePath = 'node'
      Arguments = @('--import', 'tsx', $autoRepairTsScriptPath) + $scriptArgs
    }
  }

  $strategies += [pscustomobject]@{
    Name = 'npm-script'
    Description = '[6/7] O Zavorth vai try um self-repair seguro via npm run ops:autorepair...'
    FilePath = 'npm'
    Arguments = @('run', 'ops:autorepair', '--') + $scriptArgs
  }

  $failures = @()
  foreach ($strategy in $strategies) {
    try {
      $resolvedFilePath = Resolve-LauncherExecutable -CommandName $strategy.FilePath
      $commandPreview = ($resolvedFilePath + ' ' + (($strategy.Arguments | ForEach-Object { $_ }) -join ' ')).Trim()
      $launcherReport.lastAutoRepairCliStrategy = $strategy.Name
      $launcherReport.lastAutoRepairCliCommand = $commandPreview
      $launcherReport.lastAutoRepairCliError = ''
      Save-LauncherReport

      Invoke-LoggedCommand $strategy.Description $strategy.FilePath $strategy.Arguments
      Add-LauncherAction ("autorepair-cli-{0}" -f $strategy.Name)
      return $true
    } catch {
      $failureMessage = $_.Exception.Message
      $failures += ("{0}: {1}" -f $strategy.Name, $failureMessage)
      Write-LauncherLine ("self-repair via CLI failed usando {0}: {1}" -f $strategy.Name, $failureMessage)
    }
  }

  $launcherReport.lastAutoRepairCliError = ($failures -join ' | ')
  Save-LauncherReport
  Add-LauncherAction 'autorepair-cli-failed'
  return $false
}

function Test-ProcessAlive {
  param([Nullable[int]]$ProcessId)

  if (-not $ProcessId) {
    return $false
  }

  try {
    Get-Process -Id $ProcessId -ErrorAction Stop | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Get-ProcessAgeSeconds {
  param([Nullable[int]]$ProcessId)

  if (-not (Test-ProcessAlive -ProcessId $ProcessId)) {
    return $null
  }

  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    return [int][Math]::Round(((Get-Date) - $process.StartTime).TotalSeconds)
  } catch {
    return $null
  }
}

function Get-ProcessCommandInfo {
  param([Nullable[int]]$ProcessId)

  if (-not $ProcessId) {
    return $null
  }

  try {
    return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
  } catch {
    return $null
  }
}

function Test-ProcessMatchesProjectMarkers {
  param(
    [Nullable[int]]$ProcessId,
    [string[]]$Markers
  )

  $processInfo = Get-ProcessCommandInfo -ProcessId $ProcessId
  if ($null -eq $processInfo) {
    return $false
  }

  $combined = @($processInfo.Name, $processInfo.ExecutablePath, $processInfo.CommandLine) -join ' '
  $normalized = $combined.ToLowerInvariant().Replace('/', '\')

  foreach ($marker in $Markers) {
    if ($normalized.Contains($marker.ToLowerInvariant())) {
      return $true
    }
  }

  return $false
}

function Test-ProcessStartMatchesLock {
  param(
    [Nullable[int]]$ProcessId,
    [object]$LockStartedAt,
    [int]$ToleranceSeconds = 20
  )

  if (-not $ProcessId -or $null -eq $LockStartedAt) {
    return $false
  }

  try {
    $startedAtUtc = ([datetime]$LockStartedAt).ToUniversalTime()
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $processStartUtc = $process.StartTime.ToUniversalTime()
    $deltaSeconds = [Math]::Abs(($processStartUtc - $startedAtUtc).TotalSeconds)
    return $deltaSeconds -le $ToleranceSeconds
  } catch {
    return $false
  }
}

function Remove-LockFileSafely {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  if ($DryRun) {
    Write-LauncherLine "[dry-run] Removeria lock: $Path"
    return
  }

  Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
}

function Get-LockStatus {
  param(
    [string]$LockPath,
    [string]$RoleName,
    [string[]]$Markers
  )

  if (-not (Test-Path $LockPath)) {
    return [PSCustomObject]@{
      Active = $false
      Pid = $null
      Reason = 'missing'
    }
  }

  try {
    $lock = Get-Content -Raw -LiteralPath $LockPath | ConvertFrom-Json
  } catch {
    Write-LauncherLine "$RoleName lock corrompido. Vou limpar e seguir."
    Remove-LockFileSafely -Path $LockPath
    return [PSCustomObject]@{
      Active = $false
      Pid = $null
      Reason = 'invalid'
    }
  }

  $lockedPid = 0
  if ($lock.PSObject.Properties.Name -contains 'pid') {
    $lockedPid = [int]$lock.pid
  }

  if ($lockedPid -le 0) {
    Write-LauncherLine "$RoleName lock without PID valido. Vou limpar e seguir."
    Remove-LockFileSafely -Path $LockPath
    return [PSCustomObject]@{
      Active = $false
      Pid = $null
      Reason = 'invalid-pid'
    }
  }

  if (-not (Test-ProcessAlive -ProcessId $lockedPid)) {
    Write-LauncherLine "$RoleName lock aponta para PID morto ($lockedPid). Vou limpar e seguir."
    Remove-LockFileSafely -Path $LockPath
    return [PSCustomObject]@{
      Active = $false
      Pid = $lockedPid
      Reason = 'dead-process'
    }
  }

  if (
    (-not (Test-ProcessMatchesProjectMarkers -ProcessId $lockedPid -Markers $Markers)) -and
    (-not (Test-ProcessStartMatchesLock -ProcessId $lockedPid -LockStartedAt $lock.startedAt))
  ) {
    Write-LauncherLine "$RoleName lock aponta para um process que not parece ser do Zavorth ($lockedPid). Vou limpar e seguir."
    Remove-LockFileSafely -Path $LockPath
    return [PSCustomObject]@{
      Active = $false
      Pid = $lockedPid
      Reason = 'pid-reused'
    }
  }

  return [PSCustomObject]@{
    Active = $true
    Pid = $lockedPid
    Reason = 'active'
  }
}

function Stop-ProcessTreeSafely {
  param(
    [Nullable[int]]$ProcessId,
    [string]$Label
  )

  if (-not (Test-ProcessAlive -ProcessId $ProcessId)) {
    return
  }

  if ($DryRun) {
    Write-LauncherLine "[dry-run] Encerraria $Label (PID $ProcessId)."
    return
  }

  Write-LauncherLine "Encerrando $Label (PID $ProcessId)..."

  $terminated = $false
  try {
    & taskkill /PID $ProcessId /T /F | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $terminated = $true
    }
  } catch {
    $terminated = $false
  }

  if (-not $terminated -and (Test-ProcessAlive -ProcessId $ProcessId)) {
    try {
      Stop-Process -Id $ProcessId -Force -ErrorAction Stop
      $terminated = -not (Test-ProcessAlive -ProcessId $ProcessId)
    } catch {
      Write-LauncherLine "Could not stop $Label (PID $ProcessId): $($_.Exception.Message)"
    }
  }

  if (-not $terminated -and (Test-ProcessAlive -ProcessId $ProcessId)) {
    Write-LauncherLine "$Label (PID $ProcessId) continuou active after da tentativa de encerramento."
  }
}

function Stop-OrphanedZavorthProcesses {
  $candidates = @()

  try {
    $candidates = Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
      $commandLine = if ($null -eq $_.CommandLine) { '' } else { [string]$_.CommandLine }
      if (-not $commandLine) {
        return $false
      }

      $normalized = $commandLine.ToLowerInvariant().Replace('/', '\')
      foreach ($pattern in $managedProcessPatterns) {
        if ($normalized.Contains($pattern)) {
          return $true
        }
      }

      return $false
    }
  } catch {
    Write-LauncherLine "Could not list processes for preventive cleanup: $($_.Exception.Message)"
    return
  }

  if ($candidates.Count -eq 0) {
    Write-LauncherLine 'Nenhum process orfao do Zavorth foi encontrado.'
    return
  }

  foreach ($candidate in ($candidates | Sort-Object ProcessId -Unique)) {
    Stop-ProcessTreeSafely -ProcessId $candidate.ProcessId -Label ($candidate.Name)
  }
}

function Test-PlaceholderValue {
  param([string]$Value)

  $normalized = "$Value".Trim().ToLowerInvariant()
  if (-not $normalized) {
    return $true
  }

  return (
    $normalized.Contains('sua_chave') -or
    $normalized.Contains('seu_token') -or
    $normalized.Contains('seu_id') -or
    $normalized.Contains('changeme') -or
    $normalized.Contains('placeholder') -or
    $normalized.Contains('example') -or
    $normalized.Contains('aqui')
  )
}

function Read-DotEnvFile {
  param([string]$Path)

  $result = @{}

  if (-not (Test-Path $Path)) {
    return $result
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -lt 1) {
      continue
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if ($name) {
      $result[$name] = $value
    }
  }

  return $result
}

function Get-EnvValue {
  param(
    [hashtable]$EnvMap,
    [string]$Name,
    [string]$DefaultValue = ''
  )

  if ($EnvMap.ContainsKey($Name)) {
    return [string]$EnvMap[$Name]
  }

  return $DefaultValue
}

function Test-AnyValidValue {
  param(
    [hashtable]$EnvMap,
    [string[]]$Names
  )

  foreach ($name in $Names) {
    $value = Get-EnvValue -EnvMap $EnvMap -Name $name
    if ($value -and -not (Test-PlaceholderValue -Value $value)) {
      return $true
    }
  }

  return $false
}

function Get-EffectiveBoolean {
  param(
    [string]$RawValue,
    [bool]$DefaultValue
  )

  $normalized = "$RawValue".Trim().ToLowerInvariant()
  if (-not $normalized) {
    return $DefaultValue
  }

  return $normalized -eq 'true'
}

function Test-WebSurfaceReady {
  param([int]$TimeoutSec = 6)

  $port = 33333
  $workerPid = $null
  if (Test-Path $telegramLockFile) {
    try {
      $workerState = Get-Content -Path $telegramLockFile -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
      if ($null -ne $workerState -and $workerState.PSObject.Properties.Name -contains 'pid') {
        $candidateWorkerPid = [int]$workerState.pid
        if ($candidateWorkerPid -gt 0) {
          $workerPid = $candidateWorkerPid
        }
      }
    } catch {
      $workerPid = $null
    }
  }

  if (Test-Path $zavorthControlRuntimeStateFile) {
    try {
      $zavorthControlState = Get-Content -Path $zavorthControlRuntimeStateFile -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
      $zavorthControlPid = $null
      if ($null -ne $zavorthControlState -and $zavorthControlState.PSObject.Properties.Name -contains 'pid') {
        $candidateZavorthControlPid = [int]$zavorthControlState.pid
        if ($candidateZavorthControlPid -gt 0) {
          $zavorthControlPid = $candidateZavorthControlPid
        }
      }
      $zavorthControlMatchesWorker = (-not $workerPid) -or (-not $zavorthControlPid) -or ($zavorthControlPid -eq $workerPid)
      if ($zavorthControlMatchesWorker -and $null -ne $zavorthControlState -and $zavorthControlState.PSObject.Properties.Name -contains 'port') {
        $candidatePort = [int]$zavorthControlState.port
        if ($candidatePort -gt 0) {
          $port = $candidatePort
        }
      }
    } catch {
      # segue com a porta default
    }
  }

  $uri = "http://127.0.0.1:$port/control"
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec $TimeoutSec -ErrorAction Stop
    return @{
      Ready = $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
      Url = $uri
      StatusCode = $response.StatusCode
      Error = ''
    }
  } catch {
    return @{
      Ready = $false
      Url = $uri
      StatusCode = $null
      Error = $_.Exception.Message
    }
  }
}

function Get-PrimaryNotificationChatId {
  param(
    [hashtable]$EnvMap,
    [string]$PreferredChatId
  )

  $preferred = "$PreferredChatId".Trim()
  if ($preferred) {
    return $preferred
  }

  $allowed = Get-EnvValue -EnvMap $EnvMap -Name 'TELEGRAM_ALLOWED_USER_IDS'
  $parts = @($allowed -split ',') | ForEach-Object { "$_".Trim() } | Where-Object { $_ }
  if ($parts.Count -eq 1) {
    return $parts[0]
  }

  return ''
}

function Send-TelegramNotification {
  param(
    [hashtable]$EnvMap,
    [string]$Status,
    [string]$Message
  )

  if ($DryRun) {
    return $false
  }

  $chatId = Get-PrimaryNotificationChatId -EnvMap $EnvMap -PreferredChatId $NotifyChatId
  if (-not $chatId) {
    return $false
  }

  $token = Get-EnvValue -EnvMap $EnvMap -Name 'TELEGRAM_BOT_TOKEN'
  if (-not $token) {
    return $false
  }

  try {
    $body = @{
      chat_id = $chatId
      text = $Message
    }
    Invoke-RestMethod -Method Post -Uri ("https://api.telegram.org/bot{0}/sendMessage" -f $token) -Body $body -TimeoutSec 12 | Out-Null
    Add-LauncherAction ("telegram-notify-$Status")
    return $true
  } catch {
    Write-LauncherLine "Could not send the launcher Telegram notification: $($_.Exception.Message)"
    return $false
  }
}

function Build-LauncherNotificationMessage {
  param(
    [string]$Status,
    [string]$SummaryLine,
    [string[]]$ExtraLines = @()
  )

  $label = if ($Status -eq 'success') { 'Zavorth supervised online' } else { 'Zavorth supervised failed ao subir' }
  $requestLine = if ($RequestedBy) { "Solicitado por: $RequestedBy" } else { '' }
  $reasonLine = if ($Reason) { "Motivo: $Reason" } else { '' }
  $actionPreview = @($launcherReport.actions) | Select-Object -First 6

  return @(
    $label
    $SummaryLine
    $requestLine
    $reasonLine
    if ($actionPreview.Count -gt 0) { "Actions: $($actionPreview -join ' | ')" } else { '' }
    @($ExtraLines | Where-Object { $_ })
    "Log: $lastLogFile"
  ) | Where-Object { $_ } | ForEach-Object { "$_".Trim() } | Where-Object { $_ } | Out-String
}

function Get-SanitizedProcessEnvironment {
  $sanitized = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::OrdinalIgnoreCase)
  $processVars = [System.Environment]::GetEnvironmentVariables('Process')

  foreach ($key in $processVars.Keys) {
    if ($null -eq $key) {
      continue
    }

    $name = [string]$key
    $value = [string]$processVars[$key]
    $canonicalName = if ($name -ieq 'path') { 'Path' } else { $name }
    $sanitized[$canonicalName] = $value
  }

  return $sanitized
}

function Save-PendingStartupNotification {
  param(
    [hashtable]$EnvMap,
    [string]$Status,
    [string]$Message
  )

  if ($DryRun -or $Status -ne 'success') {
    return
  }

  $chatId = Get-PrimaryNotificationChatId -EnvMap $EnvMap -PreferredChatId $NotifyChatId
  if (-not $chatId) {
    return
  }

  $payload = [ordered]@{
    chatId = $chatId
    message = $Message
    status = $Status
    createdAt = (Get-Date).ToString('o')
    requestedBy = $RequestedBy
    reason = $Reason
    source = 'launcher-supervised'
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $pendingStartupNotificationFile) | Out-Null
  Set-Content -Path $pendingStartupNotificationFile -Value ($payload | ConvertTo-Json -Depth 4) -Encoding UTF8
  $launcherReport.pendingStartupNotificationQueued = $true
  Write-LauncherLine ("Notificaction de startup supervised enfileirada para o chat {0}." -f $chatId)
  Add-LauncherAction 'startup-notification-queued'
}

function Clear-PendingStartupNotification {
  if (-not (Test-Path $pendingStartupNotificationFile)) {
    return
  }

  Remove-Item -LiteralPath $pendingStartupNotificationFile -Force -ErrorAction SilentlyContinue
  $launcherReport.pendingStartupNotificationQueued = $false
  Add-LauncherAction 'startup-notification-cleared'
}

function Ensure-EnvReady {
  if (-not (Test-Path $envPath)) {
    if (-not (Test-Path $envExamplePath)) {
      throw 'Could not find .env or .env.example to prepare configuration.'
    }

    Write-LauncherLine '[1/7] The .env file does not exist. I will create a template for you.'
    if ($DryRun) {
      Write-LauncherLine "[dry-run] Copiaria $envExamplePath para $envPath"
    } else {
      Copy-Item -LiteralPath $envExamplePath -Destination $envPath -Force
    }

    Open-HelpfulFile -Path $envPath
    throw 'Criei um .env a partir do template. Preencha as credentials principais e clique no shortcut de novo.'
  }

  $envMap = Read-DotEnvFile -Path $envPath
  $provider = (Get-EnvValue -EnvMap $envMap -Name 'LLM_PROVIDER' -DefaultValue 'gemini').Trim().ToLowerInvariant()
  if (-not $provider) {
    $provider = 'gemini'
  }

  $issues = New-Object System.Collections.Generic.List[string]

  if (-not (Test-AnyValidValue -EnvMap $envMap -Names @('TELEGRAM_BOT_TOKEN'))) {
    $issues.Add('TELEGRAM_BOT_TOKEN')
  }

  if (-not (Test-AnyValidValue -EnvMap $envMap -Names @('TELEGRAM_ALLOWED_USER_IDS'))) {
    $issues.Add('TELEGRAM_ALLOWED_USER_IDS')
  }

  switch ($provider) {
    'gemini' {
      if (-not (Test-AnyValidValue -EnvMap $envMap -Names @('GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'AISTUDIO_API_KEY'))) {
        $issues.Add('GEMINI_API_KEY')
      }
      break
    }
    'deepseek' {
      if (-not (Test-AnyValidValue -EnvMap $envMap -Names @('DEEPSEEK_API_KEY'))) {
        $issues.Add('DEEPSEEK_API_KEY')
      }
      break
    }
    'openai' {
      if (-not (Test-AnyValidValue -EnvMap $envMap -Names @('OPENAI_API_KEY'))) {
        $issues.Add('OPENAI_API_KEY')
      }
      break
    }
    'openrouter' {
      if (-not (Test-AnyValidValue -EnvMap $envMap -Names @('OPENROUTER_API_KEY'))) {
        $issues.Add('OPENROUTER_API_KEY')
      }
      break
    }
    'qwen' {
      if (-not (Test-AnyValidValue -EnvMap $envMap -Names @('PUTER_AUTH_TOKEN', 'QWEN_PUTER_AUTH_TOKEN'))) {
        $issues.Add('PUTER_AUTH_TOKEN')
      }
      break
    }
    'opencode' {
      if (-not (Test-AnyValidValue -EnvMap $envMap -Names @('OPENCODE_API_KEY'))) {
        $issues.Add('OPENCODE_API_KEY')
      }
      break
    }
    'AIGateway' {
      # Provider local, without chave obrigatoria aqui.
      break
    }
  }

  if ($issues.Count -gt 0) {
    Open-HelpfulFile -Path $envPath
    throw ("Configuraction incompleta no .env para o provider '{0}': {1}" -f $provider, (($issues | Select-Object -Unique) -join ', '))
  }

  Write-LauncherLine ("[1/7] Configuraction minima do .env validada para o provider '{0}'." -f $provider)
  return $envMap
}

function ConvertTo-SortedStringMap {
  param([object]$InputObject)

  $result = [ordered]@{}
  if ($null -eq $InputObject) {
    return $result
  }

  foreach ($property in ($InputObject.PSObject.Properties | Sort-Object Name)) {
    $result[$property.Name] = [string]$property.Value
  }

  return $result
}

function Get-DependencyFingerprintFromObject {
  param([object]$InputObject)

  if ($null -eq $InputObject) {
    return ''
  }

  $snapshot = [ordered]@{}
  foreach ($section in @('dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies')) {
    $sectionValue = $null
    if ($InputObject.PSObject.Properties.Name -contains $section) {
      $sectionValue = $InputObject.$section
    }

    $snapshot[$section] = ConvertTo-SortedStringMap -InputObject $sectionValue
  }

  return ($snapshot | ConvertTo-Json -Depth 10 -Compress)
}

function Get-PackageDependencyFingerprint {
  param([string]$JsonPath)

  if (-not (Test-Path $JsonPath)) {
    return ''
  }

  try {
    $json = Get-Content -Raw -LiteralPath $JsonPath | ConvertFrom-Json -ErrorAction Stop
    return Get-DependencyFingerprintFromObject -InputObject $json
  } catch {
    return ''
  }
}

function Get-PackageLockRootObject {
  param([object]$LockJson)

  if ($null -eq $LockJson) {
    return $null
  }

  if ($LockJson.PSObject.Properties.Name -contains 'packages') {
    $packagesProp = $LockJson.PSObject.Properties['packages']
    if ($null -ne $packagesProp -and $null -ne $packagesProp.Value) {
      $rootProp = $packagesProp.Value.PSObject.Properties['']
      if ($null -ne $rootProp) {
        return $rootProp.Value
      }
    }
  }

  return $LockJson
}

function Get-PackageLockDependencyFingerprint {
  param([string]$JsonPath)

  if (-not (Test-Path $JsonPath)) {
    return ''
  }

  try {
    $lockJson = Get-Content -Raw -LiteralPath $JsonPath | ConvertFrom-Json -ErrorAction Stop
    $rootPackage = Get-PackageLockRootObject -LockJson $lockJson
    return Get-DependencyFingerprintFromObject -InputObject $rootPackage
  } catch {
    return ''
  }
}

function Test-NpmInstallRequired {
  param([string]$WorkingDirectory)

  $nodeModulesDir = Join-Path $WorkingDirectory 'node_modules'
  if (-not (Test-Path $nodeModulesDir)) {
    return $true
  }

  $packageJsonPath = Join-Path $WorkingDirectory 'package.json'
  $packageLockPath = Join-Path $WorkingDirectory 'package-lock.json'
  $installStampPath = Join-Path $nodeModulesDir '.package-lock.json'
  $packageDependencyFingerprint = Get-PackageDependencyFingerprint -JsonPath $packageJsonPath
  $lockedDependencyFingerprint = Get-PackageLockDependencyFingerprint -JsonPath $packageLockPath

  $referenceTime = $null
  if (Test-Path $installStampPath) {
    $referenceTime = (Get-Item -LiteralPath $installStampPath).LastWriteTimeUtc
  } else {
    $referenceTime = (Get-Item -LiteralPath $nodeModulesDir).LastWriteTimeUtc
  }

  if ($packageDependencyFingerprint -and $lockedDependencyFingerprint -and ($packageDependencyFingerprint -ne $lockedDependencyFingerprint)) {
    return $true
  }

  if ((Test-Path $packageLockPath) -and ((Get-Item -LiteralPath $packageLockPath).LastWriteTimeUtc -gt $referenceTime)) {
    return $true
  }

  if (-not (Test-Path $packageLockPath) -and (Test-Path $packageJsonPath) -and ((Get-Item -LiteralPath $packageJsonPath).LastWriteTimeUtc -gt $referenceTime)) {
    return $true
  }

  return $false
}

function Get-LatestWriteTimeUtc {
  param([string[]]$Paths)

  $latest = [datetime]::MinValue

  foreach ($path in $Paths) {
    if (-not (Test-Path $path)) {
      continue
    }

    $target = Get-Item -LiteralPath $path
    $items = @()

    if ($target.PSIsContainer) {
      $items = @(Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue)
    } else {
      $items = @($target)
    }

    foreach ($item in $items) {
      if ($item.LastWriteTimeUtc -gt $latest) {
        $latest = $item.LastWriteTimeUtc
      }
    }
  }

  return $latest
}

function Test-BuildRequired {
  $hostScript = Join-Path $projectRoot 'dist\host.js'
  $workerScript = Join-Path $projectRoot 'dist\index.js'

  if (-not (Test-Path $hostScript) -or -not (Test-Path $workerScript)) {
    return $true
  }

  $latestSourceWrite = Get-LatestWriteTimeUtc -Paths @(
    (Join-Path $projectRoot 'src'),
    (Join-Path $projectRoot 'package.json'),
    (Join-Path $projectRoot 'package-lock.json'),
    (Join-Path $projectRoot 'tsconfig.json')
  )

  $earliestBuildWrite = @(
    (Get-Item -LiteralPath $hostScript).LastWriteTimeUtc
    (Get-Item -LiteralPath $workerScript).LastWriteTimeUtc
  ) | Sort-Object | Select-Object -First 1

  return $latestSourceWrite -gt $earliestBuildWrite
}

function Ensure-ThirdPartyReady {
  param([hashtable]$EnvMap)

  $provider = (Get-EnvValue -EnvMap $EnvMap -Name 'LLM_PROVIDER' -DefaultValue 'gemini').Trim().ToLowerInvariant()
  if (-not $provider) {
    $provider = 'gemini'
  }

  $AIGatewayEnabled = Get-EffectiveBoolean -RawValue (Get-EnvValue -EnvMap $EnvMap -Name 'AIGateway_SIDECAR_ENABLED') -DefaultValue ($provider -eq 'AIGateway')
  $zavorthBridgeAutomationEnabled = Get-EffectiveBoolean -RawValue (Get-EnvValue -EnvMap $EnvMap -Name 'ZAVORTH_BRIDGE_AUTOMATION_ENABLED') -DefaultValue $true
  $ZavorthTerminalEnabled = Get-EffectiveBoolean -RawValue (Get-EnvValue -EnvMap $EnvMap -Name 'ZAVORTH_BRIDGE_REMOTE_SIDECAR_ENABLED') -DefaultValue $zavorthBridgeAutomationEnabled

  $AIGatewayPackage = Join-Path $AIGatewayWorktreeDir 'package.json'
  $ZavorthTerminalPackage = Join-Path $ZavorthTerminalRemoteWorktreeDir 'package.json'
  $thirdPartyBootstrapScript = Join-Path $projectRoot 'scripts\bootstrap-third-party.mjs'
  $needsBootstrap =
    (($AIGatewayEnabled -and -not (Test-Path $AIGatewayPackage)) -or
    ($ZavorthTerminalEnabled -and -not (Test-Path $ZavorthTerminalPackage)))

  if ($needsBootstrap) {
    $missingTargets = New-Object System.Collections.Generic.List[string]
    if ($AIGatewayEnabled -and -not (Test-Path $AIGatewayPackage)) {
      $missingTargets.Add('AIGateway')
    }

    if ($ZavorthTerminalEnabled -and -not (Test-Path $ZavorthTerminalPackage)) {
      $missingTargets.Add('ZavorthTerminalRemoteChat')
    }

    if (-not (Test-Path $thirdPartyBootstrapScript)) {
      Write-LauncherLine ("[4/7] Bootstrap legado de terceiros ausente; vou seguir without {0} e manter o Zavorth supervised em modo degradado." -f ($missingTargets -join ', '))
      Add-LauncherAction 'third-party-bootstrap-missing'
    } elseif (-not (Get-Command git -ErrorAction SilentlyContinue)) {
      Write-LauncherLine ("[4/7] Git unavailable para recriar worktrees de terceiros ({0}); vou seguir without esses sidecars." -f ($missingTargets -join ', '))
      Add-LauncherAction 'third-party-bootstrap-skipped-no-git'
    } else {
      try {
        Invoke-LoggedCommand '[4/7] Preparando copias locais de AIGateway e ZavorthTerminalRemoteChat...' 'node' @('scripts/bootstrap-third-party.mjs')
      } catch {
        Write-LauncherLine ("[4/7] Bootstrap de terceiros failed ({0}); vou seguir without esses sidecars por enquanto." -f $_.Exception.Message)
        Add-LauncherAction 'third-party-bootstrap-failed'
      }
    }
  } else {
    Write-LauncherLine '[4/7] Worktrees de terceiros already are ready.'
  }

  $sidecarTasks = New-Object System.Collections.Generic.List[object]

  if ($AIGatewayEnabled -and (Test-Path $AIGatewayPackage)) {
    $sidecarTasks.Add([PSCustomObject]@{
      Name = 'AIGateway'
      Directory = $AIGatewayWorktreeDir
    })
  }

  if ($ZavorthTerminalEnabled -and (Test-Path $ZavorthTerminalPackage)) {
    $sidecarTasks.Add([PSCustomObject]@{
      Name = 'ZavorthTerminalRemoteChat'
      Directory = $ZavorthTerminalRemoteWorktreeDir
    })
  }

  if ($sidecarTasks.Count -eq 0) {
    Write-LauncherLine '[5/7] No local sidecar needs additional preparation.'
    return
  }

  $ranInstall = $false
  foreach ($sidecar in $sidecarTasks) {
    if (Test-NpmInstallRequired -WorkingDirectory $sidecar.Directory) {
      $ranInstall = $true
      Invoke-LoggedCommand ("[5/7] Atualizando dependencies do {0}..." -f $sidecar.Name) 'npm' @('install') $sidecar.Directory
    }
  }

  if (-not $ranInstall) {
    Write-LauncherLine '[5/7] sidecar dependencies are ready.'
  }
}

function Invoke-ZavorthBuildWithRepair {
  param([bool]$BuildRequired)

  if (-not $BuildRequired) {
    Write-LauncherLine '[6/7] Build supervised already is atualizado.'
    return
  }

  try {
    Invoke-LoggedCommand '[6/7] Build do Zavorth ausente ou desatualizado. Recompilando...' 'npm' @('run', 'build')
    Add-LauncherAction 'build'
  } catch {
    Write-LauncherLine '[6/7] Build failed. Vou try um reparo rapido com npm install before recompilar.'
    Add-LauncherAction 'build-failed-initial'
    try {
      Invoke-LoggedCommand '[6/7] Reparando dependencies do Zavorth before try o build de novo...' 'npm' @('install')
      Add-LauncherAction 'repair-install'
      Invoke-LoggedCommand '[6/7] Recompilando again after o reparo...' 'npm' @('run', 'build')
      Add-LauncherAction 'build-after-repair'
    } catch {
      Write-LauncherLine '[6/7] Build ainda failed after do npm install. Vou try um self-repair seguro do own Zavorth.'
      Add-LauncherAction 'build-failed-after-repair'
      $autoRepairReason = 'Failure de build no launcher supervised after npm install.'
      $autoRepairRequestedBy = if ($RequestedBy) { $RequestedBy } else { 'launcher' }
      $autoRepairWorked = Invoke-AutoRepairCli -Reason $autoRepairReason -RequestedBy $autoRepairRequestedBy -Force -Goal 'repair'
      if (-not $autoRepairWorked) {
        throw
      }

      Invoke-LoggedCommand '[6/7] Recompilando again after o self-repair...' 'npm' @('run', 'build')
      Add-LauncherAction 'build-after-autorepair'
    }
  }
}

function Start-CodexRemoteBroker {
  if (-not (Test-Path $codexRemoteBrokerScriptPath)) {
    throw "Could not find the Codex Remote PowerShell broker at $codexRemoteBrokerScriptPath"
  }

  Write-LauncherLine '[7/7] Starting the Codex Remote PowerShell broker...'

  if ($DryRun) {
    Write-LauncherLine ("[dry-run] Codex Remote broker would start at {0}" -f $codexRemoteBrokerScriptPath)
    return $null
  }

  $script:codexRemoteBrokerStdOutLog = Prepare-RuntimeLogPath -PreferredPath $codexRemoteBrokerStdOutLogBase
  $script:codexRemoteBrokerStdErrLog = Prepare-RuntimeLogPath -PreferredPath $codexRemoteBrokerStdErrLogBase
  $launcherReport.codexRemoteBrokerStdOutLog = $codexRemoteBrokerStdOutLog
  $launcherReport.codexRemoteBrokerStdErrLog = $codexRemoteBrokerStdErrLog
  Save-LauncherReport

  Remove-LockFileSafely -Path $codexRemoteBrokerLockFile

  $cmdPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
  $quotedPowerShell = '"' + $powershellPath + '"'
  $quotedBroker = '"' + $codexRemoteBrokerScriptPath + '"'
  $quotedProjectRoot = '"' + $projectRoot + '"'
  $quotedStdOut = '"' + $codexRemoteBrokerStdOutLog + '"'
  $quotedStdErr = '"' + $codexRemoteBrokerStdErrLog + '"'
  $commandLine = "$quotedPowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $quotedBroker -ProjectRoot $quotedProjectRoot 1>>$quotedStdOut 2>>$quotedStdErr"

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $cmdPath
  $startInfo.Arguments = "/d /c `"$commandLine`""
  $startInfo.WorkingDirectory = $projectRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true

  $sanitizedEnvironment = Get-SanitizedProcessEnvironment
  $environmentApplied = $false

  try {
    if ($startInfo.PSObject.Properties.Name -contains 'Environment' -and $null -ne $startInfo.Environment) {
      $startInfo.Environment.Clear()
      foreach ($entry in $sanitizedEnvironment.GetEnumerator()) {
        $startInfo.Environment[$entry.Key] = [string]$entry.Value
      }
      $environmentApplied = $true
    }
  } catch {
    $environmentApplied = $false
  }

  if (-not $environmentApplied) {
    try {
      if ($null -ne $startInfo.EnvironmentVariables) {
        $startInfo.EnvironmentVariables.Clear()
        foreach ($entry in $sanitizedEnvironment.GetEnumerator()) {
          $startInfo.EnvironmentVariables[$entry.Key] = [string]$entry.Value
        }
        $environmentApplied = $true
      }
    } catch {
      $environmentApplied = $false
    }
  }

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo

  if (-not $process.Start()) {
    throw 'Could not start the Codex Remote PowerShell broker.'
  }

  return $process
}

function Wait-ForCodexRemoteBrokerBoot {
  param([System.Diagnostics.Process]$BrokerProcess)

  if ($DryRun) {
    return
  }

  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    $brokerStatus = Get-LockStatus -LockPath $codexRemoteBrokerLockFile -RoleName 'Codex Remote broker' -Markers $brokerProcessMarkers
    if ($brokerStatus.Active) {
      Write-LauncherLine ("Codex Remote PowerShell broker active (PID {0})." -f $brokerStatus.Pid)
      return
    }

    if ($null -ne $BrokerProcess) {
      $BrokerProcess.Refresh()
      if ($BrokerProcess.HasExited) {
        throw ("The Codex Remote PowerShell broker exited early with code {0}." -f $BrokerProcess.ExitCode)
      }
    }

    Start-Sleep -Seconds 1
  }

  throw 'The Codex Remote PowerShell broker did not confirm boot within the expected time.'
}

function Ensure-CodexRemoteBrokerRunning {
  $brokerStatus = Get-LockStatus -LockPath $codexRemoteBrokerLockFile -RoleName 'Codex Remote broker' -Markers $brokerProcessMarkers
  $launcherReport.codexRemoteBrokerBefore = $brokerStatus
  Save-LauncherReport

  if ($brokerStatus.Active) {
    Write-LauncherLine ("Codex Remote PowerShell broker is already active (PID {0})." -f $brokerStatus.Pid)
    Add-LauncherAction 'codex-remote-broker-already-healthy'
    return
  }

  $brokerProcess = Start-CodexRemoteBroker
  Wait-ForCodexRemoteBrokerBoot -BrokerProcess $brokerProcess
  Add-LauncherAction 'codex-remote-broker-started'
}

function Start-SupervisorWithRetry {
  $bootFailureAutoRepairDone = $false
  $attempt = 1
  while ($attempt -le 2) {
    try {
      $wrapperProcess = Start-DetachedSupervisor
      Wait-ForSupervisorBoot -WrapperProcess $wrapperProcess
      Add-LauncherAction ("boot-success-attempt-$attempt")
      return
    } catch {
      if ($attempt -ge 2) {
        throw
      }

      if (-not $bootFailureAutoRepairDone) {
        $bootFailureReason = if ($Reason) {
          "Failure de boot no launcher supervised. Contexto original: $Reason"
        } else {
          'Failure de boot no launcher supervised.'
        }
        $bootFailureRequestedBy = if ($RequestedBy) { $RequestedBy } else { 'launcher' }
        Write-LauncherLine ("Boot supervised failed na tentativa {0}. Vou trigger um self-repair seguro before try de novo." -f $attempt)
        Add-LauncherAction 'boot-autorepair-requested'
        $bootAutoRepairWorked = Invoke-AutoRepairCli -Reason $bootFailureReason -RequestedBy $bootFailureRequestedBy -Force -Goal 'repair'
        if ($bootAutoRepairWorked) {
          Add-LauncherAction 'boot-autorepair-succeeded'
          Invoke-ZavorthBuildWithRepair -BuildRequired $true
        } else {
          Add-LauncherAction 'boot-autorepair-failed'
        }
        $bootFailureAutoRepairDone = $true
      }

      Write-LauncherLine ("Boot supervised failed na tentativa {0}. Vou limpar o estado e try uma vez mais." -f $attempt)
      Add-LauncherAction ("boot-retry-$attempt")
      Stop-OrphanedZavorthProcesses
      $attempt += 1
    }
  }
}

function Start-DetachedSupervisor {
  if (-not (Test-Path $runnerScriptPath)) {
    throw "Could not find the supervised runner at $runnerScriptPath"
  }

  Write-LauncherLine '[7/7] Iniciando Zavorth supervised com verificaction de boot...'

  if ($DryRun) {
    Write-LauncherLine ("[dry-run] Start-Process {0} -File `"{1}`"" -f $powershellPath, $runnerScriptPath)
    return $null
  }

  $script:runtimeStdOutLog = Prepare-RuntimeLogPath -PreferredPath $runtimeStdOutLogBase
  $script:runtimeStdErrLog = Prepare-RuntimeLogPath -PreferredPath $runtimeStdErrLogBase
  $launcherReport.runtimeStdOutLog = $runtimeStdOutLog
  $launcherReport.runtimeStdErrLog = $runtimeStdErrLog
  Save-LauncherReport

  $cmdPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
  if (-not (Test-Path $cmdPath)) {
    throw "Could not find cmd.exe at $cmdPath"
  }

  $quotedPowerShell = '"' + $powershellPath + '"'
  $quotedRunner = '"' + $runnerScriptPath + '"'
  $quotedStdOut = '"' + $runtimeStdOutLog + '"'
  $quotedStdErr = '"' + $runtimeStdErrLog + '"'
  $commandLine = "$quotedPowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $quotedRunner 1>>$quotedStdOut 2>>$quotedStdErr"

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $cmdPath
  $startInfo.Arguments = "/d /c `"$commandLine`""
  $startInfo.WorkingDirectory = $projectRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true

  $sanitizedEnvironment = Get-SanitizedProcessEnvironment
  $environmentApplied = $false

  try {
    if ($startInfo.PSObject.Properties.Name -contains 'Environment' -and $null -ne $startInfo.Environment) {
      $startInfo.Environment.Clear()
      foreach ($entry in $sanitizedEnvironment.GetEnumerator()) {
        $startInfo.Environment[$entry.Key] = [string]$entry.Value
      }
      $environmentApplied = $true
    }
  } catch {
    $environmentApplied = $false
  }

  if (-not $environmentApplied) {
    try {
      if ($null -ne $startInfo.EnvironmentVariables) {
        $startInfo.EnvironmentVariables.Clear()
        foreach ($entry in $sanitizedEnvironment.GetEnumerator()) {
          $startInfo.EnvironmentVariables[$entry.Key] = [string]$entry.Value
        }
        $environmentApplied = $true
      }
    } catch {
      $environmentApplied = $false
    }
  }

  if (-not $environmentApplied) {
    Write-LauncherLine 'Could not apply a sanitized environment to the supervised process. Continuing with the default environment.'
  }

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo

  if (-not $process.Start()) {
    throw 'Could not start the supervised process.'
  }

  return $process
}

function Prepare-RuntimeLogPath {
  param([string]$PreferredPath)

  try {
    Set-Content -Path $PreferredPath -Value '' -Encoding UTF8 -ErrorAction Stop
    return $PreferredPath
  } catch {
    $directory = Split-Path -Parent $PreferredPath
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($PreferredPath)
    $extension = [System.IO.Path]::GetExtension($PreferredPath)
    $fallbackPath = Join-Path $directory ("{0}-{1}{2}" -f $baseName, (Get-Date -Format 'yyyyMMdd-HHmmss-fff'), $extension)

    Write-LauncherLine ("Log file in use ({0}). I will use {1} in this attempt." -f $PreferredPath, $fallbackPath)
    Set-Content -Path $fallbackPath -Value '' -Encoding UTF8
    return $fallbackPath
  }
}

function Start-DetachedSingleProcessWorker {
  Write-LauncherLine '[7/7] Host supervisor unavailable. Iniciando worker direct em modo degradado...'

  if ($DryRun) {
    Write-LauncherLine ("[dry-run] Worker degradado seria iniciado em {0}" -f (Join-Path $projectRoot 'dist\index.js'))
    return $null
  }

  $workerScriptPath = Join-Path $projectRoot 'dist\index.js'
  if (-not (Test-Path $workerScriptPath)) {
    throw "Could not find the compiled worker at $workerScriptPath"
  }

  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $cmdPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
  $quotedNode = '"' + $nodePath + '"'
  $quotedWorker = '"' + $workerScriptPath + '"'
  $quotedStdOut = '"' + $runtimeStdOutLog + '"'
  $quotedStdErr = '"' + $runtimeStdErrLog + '"'
  $commandLine = "$quotedNode $quotedWorker 1>>$quotedStdOut 2>>$quotedStdErr"

  Remove-LockFileSafely -Path $hostLockFile

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $cmdPath
  $startInfo.Arguments = "/d /c `"$commandLine`""
  $startInfo.WorkingDirectory = $projectRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true

  $sanitizedEnvironment = Get-SanitizedProcessEnvironment
  $environmentApplied = $false

  try {
    if ($startInfo.PSObject.Properties.Name -contains 'Environment' -and $null -ne $startInfo.Environment) {
      $startInfo.Environment.Clear()
      foreach ($entry in $sanitizedEnvironment.GetEnumerator()) {
        if ([string]$entry.Key -ieq 'ZAVORTH_SUPERVISED') {
          continue
        }
        $startInfo.Environment[$entry.Key] = [string]$entry.Value
      }
      $startInfo.Environment['ZAVORTH_SINGLE_PROCESS_SAFE_MODE'] = 'true'
      $environmentApplied = $true
    }
  } catch {
    $environmentApplied = $false
  }

  if (-not $environmentApplied) {
    try {
      if ($null -ne $startInfo.EnvironmentVariables) {
        $startInfo.EnvironmentVariables.Clear()
        foreach ($entry in $sanitizedEnvironment.GetEnumerator()) {
          if ([string]$entry.Key -ieq 'ZAVORTH_SUPERVISED') {
            continue
          }
          $startInfo.EnvironmentVariables[$entry.Key] = [string]$entry.Value
        }
        $startInfo.EnvironmentVariables['ZAVORTH_SINGLE_PROCESS_SAFE_MODE'] = 'true'
        $environmentApplied = $true
      }
    } catch {
      $environmentApplied = $false
    }
  }

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo

  if (-not $process.Start()) {
    throw 'Could not start the degraded Zavorth worker.'
  }

  Add-LauncherAction 'boot-degraded-single-process'
  $launcherReport.degradedSingleProcess = $true
  Save-LauncherReport
  return $process
}

function Test-LogContains {
  param(
    [string]$Path,
    [string]$Pattern
  )

  if (-not (Test-Path $Path)) {
    return $false
  }

  try {
    return (Get-Content -Raw -LiteralPath $Path -ErrorAction Stop) -match $Pattern
  } catch {
    return $false
  }
}

function Wait-ForSupervisorBoot {
  param([System.Diagnostics.Process]$WrapperProcess)

  if ($DryRun) {
    return
  }

  $deadline = (Get-Date).AddSeconds(35)
  $fallbackWorkerStarted = $false

  while ((Get-Date) -lt $deadline) {
    $hostStatus = Get-LockStatus -LockPath $hostLockFile -RoleName 'Host supervisor' -Markers $hostProcessMarkers
    $workerStatus = Get-LockStatus -LockPath $telegramLockFile -RoleName 'Worker Telegram' -Markers $workerProcessMarkers

    if ($workerStatus.Active) {
      if ($fallbackWorkerStarted) {
        Write-LauncherLine ("Zavorth iniciou em modo degradado com worker direct (PID {0})." -f $workerStatus.Pid)
      } else {
        Write-LauncherLine ("Zavorth supervised confirmou o worker Telegram (PID {0})." -f $workerStatus.Pid)
      }
      return
    }

    if (Test-LogContains -Path $runtimeStdOutLog -Pattern 'Worker booted successfully\.') {
      Write-LauncherLine 'Zavorth supervised confirmou boot completo.'
      return
    }

    if ($null -ne $WrapperProcess) {
      $WrapperProcess.Refresh()
      if ($WrapperProcess.HasExited) {
        throw ("O bootstrap supervised encerrou cedo with code {0}." -f $WrapperProcess.ExitCode)
      }
    }

    if ((-not $fallbackWorkerStarted) -and (Test-LogContains -Path $runtimeStdErrLog -Pattern 'spawn EPERM')) {
      Write-LauncherLine 'Detectei spawn EPERM no host supervised. Vou subir o Zavorth em modo degradado de process single.'
      $null = Start-DetachedSingleProcessWorker
      $fallbackWorkerStarted = $true
      Start-Sleep -Seconds 2
      continue
    }

    Start-Sleep -Seconds 2
  }

  $hostStatus = Get-LockStatus -LockPath $hostLockFile -RoleName 'Host supervisor' -Markers $hostProcessMarkers
  if ($hostStatus.Active) {
    Write-LauncherLine ("Supervisor started (PID {0}) and continues booting in the background." -f $hostStatus.Pid)
    return
  }

  throw 'O supervisor not confirmou boot nem lock do host no tempo esperado.'
}

Write-LauncherLine '==========================================='
Write-LauncherLine ' Zavorth Supervised Launcher'
Write-LauncherLine '==========================================='
Write-LauncherLine "Project: $projectRoot"
Write-LauncherLine "Log current: $logFile"

Push-Location $projectRoot
try {
  if (-not (Test-Path (Join-Path $projectRoot 'package.json'))) {
    throw "Could not find package.json at $projectRoot"
  }

  if (-not (Test-Path $powershellPath)) {
    throw "Could not find PowerShell at $powershellPath"
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is not installed or is not on PATH.'
  }

  if (-not (Get-Command 'npm.cmd' -ErrorAction SilentlyContinue)) {
    throw 'npm.cmd is not available on PATH.'
  }

  $envMap = Ensure-EnvReady
  Add-LauncherAction 'env-ready'

  Write-LauncherLine '[2/7] Limpando locks orfaos e processs presos do Zavorth...'
  $hostStatus = Get-LockStatus -LockPath $hostLockFile -RoleName 'Host supervisor' -Markers $hostProcessMarkers
  $workerStatus = Get-LockStatus -LockPath $telegramLockFile -RoleName 'Worker Telegram' -Markers $workerProcessMarkers
  $brokerStatus = Get-LockStatus -LockPath $codexRemoteBrokerLockFile -RoleName 'Codex Remote broker' -Markers $brokerProcessMarkers
  $surfaceHealth = Test-WebSurfaceReady
  $installRequired = Test-NpmInstallRequired -WorkingDirectory $projectRoot
  $buildRequired = Test-BuildRequired
  $requiresReload = $ForceRestart -or $installRequired -or $buildRequired
  $reloadReasons = New-Object System.Collections.Generic.List[string]
  if ($ForceRestart) {
    $reloadReasons.Add('forcado explicitmente')
  }
  if ($installRequired) {
    $reloadReasons.Add('dependencies desatualizadas')
  }
  if ($buildRequired) {
    $reloadReasons.Add('build desatualizado')
  }
  $launcherReport.hostBefore = $hostStatus
  $launcherReport.workerBefore = $workerStatus
  $launcherReport.codexRemoteBrokerBefore = $brokerStatus
  $launcherReport.surfaceBefore = $surfaceHealth
  $launcherReport.installRequired = $installRequired
  $launcherReport.buildRequired = $buildRequired
  Save-LauncherReport

  if ($hostStatus.Active -and $workerStatus.Active) {
    if (-not $surfaceHealth.Ready) {
      Write-LauncherLine ("Host e worker are actives, mas a surface web not respondeu em {0}. Vou reciclar a stack supervised." -f $surfaceHealth.Url)
      if ($surfaceHealth.Error) {
        Write-LauncherLine ("Detalhe da surface web: {0}" -f $surfaceHealth.Error)
      }
      Add-LauncherAction 'reload-stale-surface'
      $requiresReload = $true
    }

    if (-not $requiresReload) {
      Ensure-CodexRemoteBrokerRunning
      Write-LauncherLine ("Zavorth supervised already is active e saudavel (host PID {0}, worker PID {1})." -f $hostStatus.Pid, $workerStatus.Pid)
      Add-LauncherAction 'already-healthy'
      $launcherReport.status = 'success'
      $launcherReport.finishedAt = (Get-Date).ToString('o')
      Save-LauncherReport
      Write-LauncherLine 'Launcher finished.'
      return
    }

    Write-LauncherLine (
      "Zavorth supervised is saudavel, mas encontrei changes que exigem reciclagem da stack ({0})." -f ($reloadReasons -join ', ')
    )
    Add-LauncherAction 'reload-healthy-stack'
  }

  if ($hostStatus.Active -and -not $workerStatus.Active) {
    $hostAgeSeconds = Get-ProcessAgeSeconds -ProcessId $hostStatus.Pid
    if ($null -ne $hostAgeSeconds -and $hostAgeSeconds -lt 90 -and -not $requiresReload) {
      Write-LauncherLine ("O host supervisor already is subindo (PID {0}, uptime {1}s)." -f $hostStatus.Pid, $hostAgeSeconds)
      Add-LauncherAction 'host-already-booting'
      $launcherReport.status = 'success'
      $launcherReport.finishedAt = (Get-Date).ToString('o')
      Save-LauncherReport
      Write-LauncherLine 'Launcher finished.'
      return
    }

    Write-LauncherLine ("O host supervisor parece travado without worker active (PID {0}). Vou reiniciar a stack supervised." -f $hostStatus.Pid)
    Add-LauncherAction 'reload-stuck-host'
  }

  if ($requiresReload -and $hostStatus.Active) {
    Stop-ProcessTreeSafely -ProcessId $hostStatus.Pid -Label 'Host supervisor active'
    Add-LauncherAction 'stop-active-host'
  }

  if ($requiresReload -and $workerStatus.Active) {
    Stop-ProcessTreeSafely -ProcessId $workerStatus.Pid -Label 'Worker Telegram active'
    Add-LauncherAction 'stop-active-worker'
  }

  if ($requiresReload -and $brokerStatus.Active) {
    Stop-ProcessTreeSafely -ProcessId $brokerStatus.Pid -Label 'Codex Remote PowerShell broker'
    Add-LauncherAction 'stop-active-codex-remote-broker'
  }

  Stop-OrphanedZavorthProcesses
  Add-LauncherAction 'cleanup-orphans'
  $null = Get-LockStatus -LockPath $hostLockFile -RoleName 'Host supervisor' -Markers $hostProcessMarkers
  $null = Get-LockStatus -LockPath $telegramLockFile -RoleName 'Worker Telegram' -Markers $workerProcessMarkers

  if ($installRequired) {
    Invoke-LoggedCommand '[3/7] Instalando ou atualizando dependencies do Zavorth...' 'npm' @('install')
    Add-LauncherAction 'npm-install'
  } else {
    Write-LauncherLine '[3/7] dependencies do Zavorth already are presentes.'
  }

  Ensure-ThirdPartyReady -EnvMap $envMap
  Add-LauncherAction 'third-party-ready'

  if ($AutoRepair) {
    $preflightAutoRepairReason = if ($AutoRepairReason) {
      $AutoRepairReason
    } elseif ($Reason) {
      $Reason
    } else {
      'self-repair preventivo solicitado ao launcher supervised.'
    }
    $preflightAutoRepairRequestedBy = if ($RequestedBy) { $RequestedBy } else { 'launcher' }
    Write-LauncherLine '[6/7] O launcher recebeu um request de self-repair preventivo before do boot.'
    $preflightAutoRepairWorked = Invoke-AutoRepairCli -Reason $preflightAutoRepairReason -RequestedBy $preflightAutoRepairRequestedBy -Force -Goal 'repair'
    if ($preflightAutoRepairWorked) {
      Add-LauncherAction 'autorepair-preflight'
      $buildRequired = $true
      $requiresReload = $true
      $launcherReport.buildRequired = $true
      Save-LauncherReport
    } else {
      Add-LauncherAction 'autorepair-preflight-failed'
    }
  }

  Invoke-ZavorthBuildWithRepair -BuildRequired $buildRequired
  Ensure-CodexRemoteBrokerRunning

  Start-SupervisorWithRetry
  $launcherReport.status = 'success'
  $launcherReport.finishedAt = (Get-Date).ToString('o')
  Save-LauncherReport
  $successMessage = (Build-LauncherNotificationMessage -Status 'success' -SummaryLine 'O launcher supervised terminou o boot com success.' -ExtraLines @(
      if ($reloadReasons.Count -gt 0) { "Motivos do recycle: $($reloadReasons -join ', ')" } else { '' }
    )).Trim()
  Save-PendingStartupNotification -EnvMap $envMap -Status 'success' -Message $successMessage
  $directSuccessNotificationSent = Send-TelegramNotification -EnvMap $envMap -Status 'success' -Message $successMessage
  if ($directSuccessNotificationSent) {
    Clear-PendingStartupNotification
  }
  Write-LauncherLine 'Launcher finished.'
} catch {
  $launcherReport.status = 'failed'
  $launcherReport.finishedAt = (Get-Date).ToString('o')
  $launcherReport.errorMessage = $_.Exception.Message
  Save-LauncherReport
  if ($envMap) {
    $failureMessage = (Build-LauncherNotificationMessage -Status 'failed' -SummaryLine ("Failure no launcher supervised: {0}" -f $_.Exception.Message)).Trim()
    Send-TelegramNotification -EnvMap $envMap -Status 'failed' -Message $failureMessage
  }
  Show-LauncherFailure -Message ("Failure no launcher supervised: {0}" -f $_.Exception.Message) -PathsToOpen @($lastLogFile, $runtimeStdErrLog, $runtimeStdOutLog, $envPath)
  throw
} finally {
  Pop-Location
}
