param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [int]$PollMs = 400
)

$ErrorActionPreference = 'Stop'

$brokerRoot = Join-Path $ProjectRoot 'data\runtime\codex-remote-broker'
$requestsDir = Join-Path $brokerRoot 'requests'
$responsesDir = Join-Path $brokerRoot 'responses'
$processedDir = Join-Path $brokerRoot 'processed'
$lockFilePath = Join-Path $brokerRoot 'codex-remote-broker.lock.json'
$runnerScriptPath = Join-Path $ProjectRoot 'scripts\codex-remote-runner.ps1'
$systemRoot = if ($env:SystemRoot) { $env:SystemRoot } else { 'C:\Windows' }
$powershellPath = Join-Path $systemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

function Ensure-Directory {
  param([string]$Path)
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Write-JsonFile {
  param(
    [string]$Path,
    [hashtable]$Payload
  )
  $parent = Split-Path -Parent $Path
  if ($parent) {
    Ensure-Directory -Path $parent
  }
  $tempPath = "$Path.tmp"
  Set-Content -LiteralPath $tempPath -Value ($Payload | ConvertTo-Json -Depth 8) -Encoding UTF8
  try {
    Move-Item -LiteralPath $tempPath -Destination $Path -Force -ErrorAction Stop
  } catch {
    Copy-Item -LiteralPath $tempPath -Destination $Path -Force
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return $null
  }
  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Test-PidAlive {
  param([Nullable[int]]$Pid)
  if ($null -eq $Pid -or $Pid -le 0) {
    return $false
  }
  try {
    $process = Get-Process -Id $Pid -ErrorAction Stop
    return $null -ne $process
  } catch {
    return $false
  }
}

function Get-LastMeaningfulLine {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return $null
  }
  $lines = Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue |
    ForEach-Object { "$_".Trim() } |
    Where-Object { $_ }
  if (-not $lines) {
    return $null
  }
  for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    if ($lines[$i] -notmatch '^(warning|info)[:\s]') {
      return $lines[$i]
    }
  }
  return $lines[-1]
}

function Join-QuotedArguments {
  param([string[]]$Arguments)
  $parts = foreach ($entry in $Arguments) {
    $value = [string]$entry
    if ($value -notmatch '[\s"&()<>^|%!]' ) {
      $value
      continue
    }
    '"' + ($value -replace '"', '\"') + '"'
  }
  return ($parts -join ' ')
}

function Write-Response {
  param(
    [string]$RequestId,
    [string]$Action,
    [bool]$Ok,
    [hashtable]$Data,
    [string]$ErrorMessage
  )
  $responsePath = Join-Path $responsesDir "$RequestId.json"
  $payload = @{
    requestId = $RequestId
    action = $Action
    ok = $Ok
    handledAt = (Get-Date).ToString('o')
    data = $Data
    error = if ($Ok) { $null } else { $ErrorMessage }
  }
  Write-JsonFile -Path $responsePath -Payload $payload
}

function Invoke-Probe {
  param([pscustomobject]$Payload)
  $cliPath = [string]$Payload.codexCliPath
  if (-not $cliPath -or -not (Test-Path $cliPath)) {
    return @{
      available = $false
      brokerReady = $true
      version = $null
      note = "CLI ausente em $cliPath"
    }
  }

  $version = $null
  try {
    $firstLine = (& $cliPath --version 2>&1 | Select-Object -First 1)
    if ($firstLine) {
      $version = [string]$firstLine
    }
  } catch {}

  return @{
    available = $true
    brokerReady = $true
    version = $version
    note = 'Broker PowerShell active.'
  }
}

function Invoke-StartSession {
  param([pscustomobject]$Payload)
  if (-not (Test-Path $runnerScriptPath)) {
    throw "Codex Remote runner missing at $runnerScriptPath"
  }

  $statusFilePath = [string]$Payload.statusFilePath
  $sessionDir = Split-Path -Parent $statusFilePath
  Ensure-Directory -Path $sessionDir
  $promptFilePath = Join-Path $sessionDir 'prompt.txt'
  Set-Content -LiteralPath $promptFilePath -Value ([string]$Payload.prompt) -Encoding UTF8
  $arguments = @(
    '-NoLogo',
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $runnerScriptPath,
    '-SessionId', [string]$Payload.sessionId,
    '-CodexCliPath', [string]$Payload.codexCliPath,
    '-WorkspaceRoot', [string]$Payload.workspaceRoot,
    '-PromptFilePath', $promptFilePath,
    '-Sandbox', [string]$Payload.sandbox,
    '-LogFilePath', [string]$Payload.logFilePath,
    '-OutputFilePath', [string]$Payload.outputFilePath,
    '-StatusFilePath', $statusFilePath
  )

  if ([string]$Payload.codexHome) {
    $arguments += @('-CodexHome', [string]$Payload.codexHome)
  }
  if ($Payload.maxRuntimeSeconds) {
    $arguments += @('-MaxRuntimeSeconds', [string]([int]$Payload.maxRuntimeSeconds))
  }

  $argumentLine = Join-QuotedArguments -Arguments $arguments
  $process = Start-Process -FilePath $powershellPath -ArgumentList $argumentLine -WindowStyle Hidden -PassThru
  return @{
    pid = $process.Id
    startedAt = (Get-Date).ToString('o')
    statusFilePath = $statusFilePath
  }
}

function Invoke-InspectSession {
  param([pscustomobject]$Payload)
  $statusFilePath = [string]$Payload.statusFilePath
  $status = Read-JsonFile -Path $statusFilePath
  $pid = if ($status -and $status.pid) { [int]$status.pid } elseif ($Payload.pid) { [int]$Payload.pid } else { $null }
  $alive = Test-PidAlive -Pid $pid
  $now = (Get-Date).ToString('o')

  if ($alive) {
    $current = @{
      sessionId = [string]$Payload.sessionId
      state = 'running'
      pid = $pid
      childPid = if ($status) { $status.childPid } else { $null }
      startedAt = if ($status) { $status.startedAt } else { $now }
      finishedAt = $null
      lastHeartbeatAt = $now
      lastOutput = if ($status) { $status.lastOutput } else { $null }
      lastError = $null
      exitCode = $null
    }
    Write-JsonFile -Path $statusFilePath -Payload $current
    return @{
      alive = $true
      pid = $pid
      state = 'running'
      startedAt = $current.startedAt
      finishedAt = $null
      lastHeartbeatAt = $now
      lastOutput = $current.lastOutput
      lastError = $null
      exitCode = $null
    }
  }

  if ($status) {
    $state = [string]$status.state
    if (-not $state) {
      $state = 'lost'
    }
    return @{
      alive = $false
      pid = if ($status.pid) { [int]$status.pid } else { $null }
      state = $state
      startedAt = $status.startedAt
      finishedAt = $status.finishedAt
      lastHeartbeatAt = $status.lastHeartbeatAt
      lastOutput = $status.lastOutput
      lastError = $status.lastError
      exitCode = if ($null -ne $status.exitCode) { [int]$status.exitCode } else { $null }
    }
  }

  return @{
    alive = $false
    pid = $pid
    state = 'lost'
    startedAt = $null
    finishedAt = $now
    lastHeartbeatAt = $now
    lastOutput = $null
    lastError = 'The broker could not find the session status.'
    exitCode = $null
  }
}

function Invoke-StopSession {
  param([pscustomobject]$Payload)
  $statusFilePath = [string]$Payload.statusFilePath
  $status = Read-JsonFile -Path $statusFilePath
  $pid = if ($status -and $status.pid) { [int]$status.pid } elseif ($Payload.pid) { [int]$Payload.pid } else { $null }
  if ($pid) {
    try {
      & taskkill /PID $pid /T /F | Out-Null
    } catch {
      try {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      } catch {}
    }
  }

  $finishedAt = (Get-Date).ToString('o')
  $lastError = [string]$Payload.reason
  $lastOutput = if ($status) { $status.lastOutput } else { $null }
  Write-JsonFile -Path $statusFilePath -Payload @{
    sessionId = [string]$Payload.sessionId
    state = 'stopped'
    pid = $pid
    childPid = if ($status) { $status.childPid } else { $null }
    startedAt = if ($status) { $status.startedAt } else { $null }
    finishedAt = $finishedAt
    lastHeartbeatAt = $finishedAt
    lastOutput = $lastOutput
    lastError = if ($lastError) { $lastError } else { 'Session interrupted by the operator.' }
    exitCode = if ($status) { $status.exitCode } else { $null }
  }
  return @{
    stopped = $true
    pid = $pid
    state = 'stopped'
    finishedAt = $finishedAt
    lastError = if ($lastError) { $lastError } else { 'Session interrupted by the operator.' }
    lastOutput = $lastOutput
    exitCode = if ($status) { $status.exitCode } else { $null }
  }
}

Ensure-Directory -Path $brokerRoot
Ensure-Directory -Path $requestsDir
Ensure-Directory -Path $responsesDir
Ensure-Directory -Path $processedDir
try {
  $existingLock = Read-JsonFile -Path $lockFilePath
  if ($existingLock -and $existingLock.pid) {
    $existingPid = [int]$existingLock.pid
    if ($existingPid -gt 0 -and $existingPid -ne $PID -and (Test-PidAlive -Pid $existingPid)) {
      throw "Another Codex Remote PowerShell broker is already active (PID $existingPid)."
    }
  }
} catch {
  throw
}
Write-JsonFile -Path $lockFilePath -Payload @{
  pid = $PID
  owner = 'codex-remote-broker'
  startedAt = (Get-Date).ToString('o')
}

try {
  while ($true) {
    $requestFiles = @(Get-ChildItem -LiteralPath $requestsDir -Filter '*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc)
    foreach ($requestFile in $requestFiles) {
      $request = $null
      try {
        $request = Read-JsonFile -Path $requestFile.FullName
        if (-not $request) {
          throw "Pedido invalid em $($requestFile.FullName)"
        }
        $action = [string]$request.action
        $payload = $request.payload
        $data = switch ($action) {
          'probe' { Invoke-Probe -Payload $payload }
          'start-session' { Invoke-StartSession -Payload $payload }
          'inspect-session' { Invoke-InspectSession -Payload $payload }
          'stop-session' { Invoke-StopSession -Payload $payload }
          default { throw "Unknown broker action: $action" }
        }
        Write-Response -RequestId ([string]$request.requestId) -Action $action -Ok $true -Data $data -ErrorMessage $null
      } catch {
        $requestId = if ($request -and $request.requestId) { [string]$request.requestId } else { [System.IO.Path]::GetFileNameWithoutExtension($requestFile.Name) }
        $action = if ($request -and $request.action) { [string]$request.action } else { 'unknown' }
        Write-Response -RequestId $requestId -Action $action -Ok $false -Data @{} -ErrorMessage $_.Exception.Message
      } finally {
        try {
          Move-Item -LiteralPath $requestFile.FullName -Destination (Join-Path $processedDir $requestFile.Name) -Force
        } catch {
          Remove-Item -LiteralPath $requestFile.FullName -Force -ErrorAction SilentlyContinue
        }
      }
    }
    Start-Sleep -Milliseconds $PollMs
  }
} finally {
  try {
    $lock = Read-JsonFile -Path $lockFilePath
    if ($lock -and $lock.pid -and ([int]$lock.pid) -eq $PID) {
      Remove-Item -LiteralPath $lockFilePath -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}
