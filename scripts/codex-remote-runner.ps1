param(
  [Parameter(Mandatory = $true)][string]$SessionId,
  [Parameter(Mandatory = $true)][string]$CodexCliPath,
  [Parameter(Mandatory = $true)][string]$WorkspaceRoot,
  [Parameter(Mandatory = $true)][string]$Sandbox,
  [Parameter(Mandatory = $true)][string]$LogFilePath,
  [Parameter(Mandatory = $true)][string]$OutputFilePath,
  [Parameter(Mandatory = $true)][string]$StatusFilePath,
  [string]$Prompt = '',
  [string]$PromptFilePath = '',
  [string]$CodexHome = '',
  [int]$MaxRuntimeSeconds = 0
)

$ErrorActionPreference = 'Stop'

function Ensure-ParentDirectory {
  param([string]$Path)
  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
}

function Write-JsonFile {
  param(
    [string]$Path,
    [hashtable]$Payload
  )
  Ensure-ParentDirectory -Path $Path
  $tempPath = "$Path.tmp"
  Set-Content -LiteralPath $tempPath -Value ($Payload | ConvertTo-Json -Depth 8) -Encoding UTF8
  try {
    Move-Item -LiteralPath $tempPath -Destination $Path -Force -ErrorAction Stop
  } catch {
    Copy-Item -LiteralPath $tempPath -Destination $Path -Force
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
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

Ensure-ParentDirectory -Path $LogFilePath
Ensure-ParentDirectory -Path $OutputFilePath
Ensure-ParentDirectory -Path $StatusFilePath

$stderrFilePath = [System.IO.Path]::ChangeExtension($LogFilePath, '.stderr.log')
Remove-Item -LiteralPath $LogFilePath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stderrFilePath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $OutputFilePath -Force -ErrorAction SilentlyContinue

$startedAt = (Get-Date).ToString('o')
$resolvedPrompt = ''
if ($PromptFilePath -and (Test-Path $PromptFilePath)) {
  $resolvedPrompt = Get-Content -Raw -LiteralPath $PromptFilePath -ErrorAction SilentlyContinue
}
if (-not "$resolvedPrompt".Trim()) {
  $resolvedPrompt = $Prompt
}
if (-not "$resolvedPrompt".Trim()) {
  throw 'O runner do Codex Remote recebeu um prompt vazio.'
}

Write-JsonFile -Path $StatusFilePath -Payload @{
  sessionId = $SessionId
  state = 'running'
  pid = $PID
  childPid = $null
  startedAt = $startedAt
  finishedAt = $null
  lastHeartbeatAt = $startedAt
  lastOutput = $null
  lastError = $null
  exitCode = $null
}

$codexArgs = @(
  'exec',
  '--skip-git-repo-check',
  '--cd',
  $WorkspaceRoot,
  '--sandbox',
  ($Sandbox | ForEach-Object { if ($_ ) { $_ } else { 'workspace-write' } }),
  $resolvedPrompt
)
$argumentLine = Join-QuotedArguments -Arguments $codexArgs

$previousCodexHome = $env:CODEX_HOME
if ($CodexHome) {
  $env:CODEX_HOME = $CodexHome
}

$timedOut = $false
$exitCode = 1
$caughtError = $null
$process = $null

try {
  $process = Start-Process -FilePath $CodexCliPath `
    -ArgumentList $argumentLine `
    -WorkingDirectory $WorkspaceRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $LogFilePath `
    -RedirectStandardError $stderrFilePath `
    -PassThru

  Write-JsonFile -Path $StatusFilePath -Payload @{
    sessionId = $SessionId
    state = 'running'
    pid = $PID
    childPid = $process.Id
    startedAt = $startedAt
    finishedAt = $null
    lastHeartbeatAt = (Get-Date).ToString('o')
    lastOutput = $null
    lastError = $null
    exitCode = $null
  }

  $waitSliceMs = 2000
  $deadlineUtc = if ($MaxRuntimeSeconds -gt 0) {
    (Get-Date).ToUniversalTime().AddSeconds($MaxRuntimeSeconds)
  } else {
    $null
  }

  while ($true) {
    $waitMs = $waitSliceMs
    if ($null -ne $deadlineUtc) {
      $remainingMs = [int][Math]::Max(0, ($deadlineUtc - (Get-Date).ToUniversalTime()).TotalMilliseconds)
      if ($remainingMs -le 0) {
        $timedOut = $true
        try {
          & taskkill /PID $process.Id /T /F | Out-Null
        } catch {}
        $null = $process.WaitForExit(5000)
        break
      }
      $waitMs = [Math]::Min($waitSliceMs, $remainingMs)
    }

    if ($process.WaitForExit($waitMs)) {
      break
    }

    $heartbeatAt = (Get-Date).ToString('o')
    $liveOutput = Get-LastMeaningfulLine -Path $LogFilePath
    $liveError = Get-LastMeaningfulLine -Path $stderrFilePath
    Write-JsonFile -Path $StatusFilePath -Payload @{
      sessionId = $SessionId
      state = 'running'
      pid = $PID
      childPid = $process.Id
      startedAt = $startedAt
      finishedAt = $null
      lastHeartbeatAt = $heartbeatAt
      lastOutput = $liveOutput
      lastError = $liveError
      exitCode = $null
    }
  }

  if ($timedOut) {
    $exitCode = 124
  } else {
    $exitCode = [int]$process.ExitCode
  }
} catch {
  $caughtError = $_.Exception.Message
  Add-Content -LiteralPath $LogFilePath -Value "[runner-error] $caughtError"
  $exitCode = 1
} finally {
  if ($null -ne $previousCodexHome) {
    $env:CODEX_HOME = $previousCodexHome
  } else {
    Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
  }
}

if (Test-Path $stderrFilePath) {
  Get-Content -LiteralPath $stderrFilePath -ErrorAction SilentlyContinue | Add-Content -LiteralPath $LogFilePath
}

$lastMeaningful = Get-LastMeaningfulLine -Path $LogFilePath
if ($lastMeaningful) {
  Set-Content -LiteralPath $OutputFilePath -Value $lastMeaningful -Encoding UTF8
}

$finishedAt = (Get-Date).ToString('o')
$state = if ($timedOut) {
  'stopped'
} elseif ($exitCode -eq 0) {
  'completed'
} else {
  'failed'
}
$lastError = if ($timedOut) {
  "Sessao interrompida pelo guardrail de tempo do Codex Remote apos ${MaxRuntimeSeconds}s."
} elseif ($exitCode -ne 0) {
  if ($caughtError) { $caughtError } else { $lastMeaningful }
} else {
  $null
}

Write-JsonFile -Path $StatusFilePath -Payload @{
  sessionId = $SessionId
  state = $state
  pid = $PID
  childPid = if ($process) { $process.Id } else { $null }
  startedAt = $startedAt
  finishedAt = $finishedAt
  lastHeartbeatAt = $finishedAt
  lastOutput = $lastMeaningful
  lastError = $lastError
  exitCode = $exitCode
}
