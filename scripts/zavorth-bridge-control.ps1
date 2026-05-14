param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('status', 'open', 'restart', 'set-model')]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [string]$ExecutablePath,

  [Parameter(Mandatory = $true)]
  [string]$AllowedModelsPath,

  [Parameter(Mandatory = $true)]
  [string]$UiScriptPath,

  [string]$AutoHotkeyPath = '',

  [string]$AutoHotkeyScriptPath = '',

  [string]$WindowTitle = 'ZavorthBridge',

  [string]$ModelKey = '',

  [string]$LogDir = '',

  [string]$WorkspacePath = '',

  [string]$ProfileName = '',

  [int]$TimeoutSeconds = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Ensure-Directory([string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return
  }

  if (-not (Test-Path -LiteralPath $PathValue)) {
    New-Item -ItemType Directory -Path $PathValue -Force | Out-Null
  }
}

$script:LogLines = New-Object System.Collections.Generic.List[string]

function Add-Log([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format o), $Message
  $script:LogLines.Add($line)
}

function Write-ExecutionLog([string]$DirectoryPath) {
  if ([string]::IsNullOrWhiteSpace($DirectoryPath)) {
    return $null
  }

  Ensure-Directory $DirectoryPath
  $filePath = Join-Path $DirectoryPath ("ag-control-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
  $script:LogLines | Set-Content -Path $filePath -Encoding UTF8
  return $filePath
}

function New-Result {
  return [ordered]@{
    ok = $false
    action = $Action
    stage = 'init'
    verified = $false
    changed = $false
    appInstalled = $false
    processFound = $false
    windowFound = $false
    processId = $null
    windowTitle = $null
    selectedModel = $null
    modelKey = if ([string]::IsNullOrWhiteSpace($ModelKey)) { $null } else { $ModelKey }
    errorCode = $null
    errorMessage = $null
    logFile = $null
    diagnostics = $null
    allowedModels = @()
    message = $null
  }
}

function Get-AllowedModels([string]$PathValue) {
  $raw = Get-Content -Path $PathValue -Raw
  $parsed = $raw | ConvertFrom-Json
  if ($null -eq $parsed.models) {
    return @()
  }

  return @($parsed.models)
}

function Get-ZavorthBridgeProcess([string]$ExpectedTitle) {
  $candidates = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.ProcessName -match 'ZavorthBridge' -or $_.MainWindowTitle -like "*$ExpectedTitle*") -and $_.MainWindowHandle -ne 0
  }

  if (-not $candidates) {
    return $null
  }

  $best = $candidates |
    Where-Object { $_.MainWindowTitle -like "*$ExpectedTitle*" } |
    Sort-Object StartTime -Descending |
    Select-Object -First 1

  if ($best) {
    return $best
  }

  return $candidates | Sort-Object StartTime -Descending | Select-Object -First 1
}

function Wait-ForZavorthBridgeWindow([string]$ExpectedTitle, [int]$TimeoutInSeconds) {
  $attempts = 0
  while ($attempts -lt $TimeoutInSeconds) {
    $process = Get-ZavorthBridgeProcess $ExpectedTitle
    if ($process) {
      return $process
    }

    Start-Sleep -Seconds 1
    $attempts++
  }

  return $null
}

function Get-ZavorthBridgeLaunchArguments() {
  $args = @()

  if (-not [string]::IsNullOrWhiteSpace($ProfileName)) {
    $args += @('--profile', $ProfileName)
  }

  if (-not [string]::IsNullOrWhiteSpace($WorkspacePath)) {
    $args += @('--reuse-window', $WorkspacePath)
  } else {
    $args += '--new-window'
  }

  $args += '--force-renderer-accessibility'
  return $args
}

function Format-ProcessArgument([string]$Value) {
  if ($null -eq $Value) {
    return '""'
  }

  if ($Value -notmatch '[\s"]') {
    return $Value
  }

  return '"' + ($Value -replace '"', '\"') + '"'
}

function Get-ZavorthBridgeLaunchArgumentString() {
  $arguments = Get-ZavorthBridgeLaunchArguments
  return ($arguments | ForEach-Object { Format-ProcessArgument ([string]$_) }) -join ' '
}

function Get-ObjectValue($Object, [string]$Name, $Default = $null) {
  if ($null -eq $Object) {
    return $Default
  }

  if ($Object -is [System.Collections.IDictionary]) {
    if ($Object.Contains($Name)) {
      return $Object[$Name]
    }

    return $Default
  }

  try {
    $property = $Object.PSObject.Properties[$Name]
    if ($null -ne $property) {
      return $property.Value
    }
  } catch {
    return $Default
  }

  return $Default
}

function Invoke-UiAutomationScript([string]$ModeValue, [string]$TextValue, [string]$ExpectedTitle, [int]$ProcessIdValue) {
  $powershellPath = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  $args = @(
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    $UiScriptPath,
    '-Mode',
    $ModeValue,
    '-WindowTitle',
    $ExpectedTitle
  )

  if (-not [string]::IsNullOrWhiteSpace($TextValue)) {
    $args += @('-Text', $TextValue)
  }

  if ($ProcessIdValue -gt 0) {
    $args += @('-ProcessId', [string]$ProcessIdValue)
  }

  Add-Log ("Running UI automation mode={0} pid={1} text={2}" -f $ModeValue, $ProcessIdValue, $TextValue)
  $raw = & $powershellPath @args
  if ($LASTEXITCODE -ne 0) {
    throw "UI automation script failed for mode '$ModeValue'."
  }
  $json = ($raw | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($json)) {
    throw "UI automation script returned no JSON for mode '$ModeValue'."
  }
  return $json | ConvertFrom-Json
}

function Resolve-AutoHotkeyExecutable([string]$ConfiguredPath) {
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($ConfiguredPath)) {
    $candidates += $ConfiguredPath
  }

  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $candidates += @(
      (Join-Path $env:LOCALAPPDATA 'Programs\AutoHotkey\v2\AutoHotkey64.exe'),
      (Join-Path $env:LOCALAPPDATA 'Programs\AutoHotkey\v2\AutoHotkey.exe'),
      (Join-Path $env:LOCALAPPDATA 'Programs\AutoHotkey\AutoHotkey64.exe'),
      (Join-Path $env:LOCALAPPDATA 'Programs\AutoHotkey\AutoHotkey.exe')
    )
  }

  $candidates += @(
    'C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe',
    'C:\Program Files\AutoHotkey\v2\AutoHotkey.exe',
    'C:\Program Files\AutoHotkey\AutoHotkey64.exe',
    'C:\Program Files\AutoHotkey\AutoHotkey.exe'
  )

  foreach ($candidate in $candidates | Select-Object -Unique) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  return $null
}

function Invoke-AutoHotkeyFallback(
  [string]$Executable,
  [string]$ScriptPath,
  [string]$ExpectedTitle,
  [string]$TargetModel,
  [string]$CurrentModel
) {
  if ([string]::IsNullOrWhiteSpace($Executable) -or -not (Test-Path -LiteralPath $Executable)) {
    throw 'AutoHotkey executable not available.'
  }

  if ([string]::IsNullOrWhiteSpace($ScriptPath) -or -not (Test-Path -LiteralPath $ScriptPath)) {
    throw 'AutoHotkey fallback script not available.'
  }

  Add-Log ("Running AutoHotkey fallback target={0} current={1}" -f $TargetModel, $CurrentModel)
  $resultPath = Join-Path ([System.IO.Path]::GetTempPath()) ("zavorth-ahk-{0}.json" -f ([guid]::NewGuid().ToString()))
  if (Test-Path -LiteralPath $resultPath) {
    Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
  }

  $ahkTimeoutSeconds = [Math]::Max(5, [Math]::Min($TimeoutSeconds, 15))
  $ahkArgs = @(
    $ScriptPath,
    $ExpectedTitle,
    $TargetModel,
    $resultPath,
    $CurrentModel
  )
  $quotedArguments = ($ahkArgs | ForEach-Object {
    $value = [string]$_
    '"' + ($value -replace '"', '""') + '"'
  }) -join ' '

  $process = Start-Process -FilePath $Executable -ArgumentList $quotedArguments -PassThru -WindowStyle Hidden
  if (-not $process.WaitForExit($ahkTimeoutSeconds * 1000)) {
    Add-Log ("AutoHotkey fallback timed out after {0}s. Killing pid={1}" -f $ahkTimeoutSeconds, $process.Id)
    try {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    } catch {
      Add-Log ("Failed to kill timed out AutoHotkey pid={0}: {1}" -f $process.Id, $_.Exception.Message)
    }

    throw "AutoHotkey fallback timed out after $ahkTimeoutSeconds seconds."
  }

  if ($process.ExitCode -ne 0) {
    Add-Log ("AutoHotkey fallback exited with code {0}" -f $process.ExitCode)
    throw "AutoHotkey fallback failed with exit code $($process.ExitCode)."
  }

  if (-not (Test-Path -LiteralPath $resultPath)) {
    throw 'AutoHotkey fallback returned no JSON.'
  }

  $json = (Get-Content -Path $resultPath -Raw -ErrorAction Stop).Trim()
  Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($json)) {
    throw 'AutoHotkey fallback returned no JSON.'
  }

  return $json | ConvertFrom-Json
}

$result = New-Result
try {
  Add-Log ("Action requested: {0}" -f $Action)

  $allowedModels = Get-AllowedModels $AllowedModelsPath
  $result.allowedModels = @($allowedModels | ForEach-Object { $_.key })
  $result.appInstalled = Test-Path -LiteralPath $ExecutablePath

  if (-not $result.appInstalled) {
    throw "ZavorthBridge executable not found at $ExecutablePath"
  }

  switch ($Action) {
    'status' {
      $result.stage = 'status'
      $process = Get-ZavorthBridgeProcess $WindowTitle
      if ($process) {
        $result.processFound = $true
        $result.windowFound = $true
        $result.processId = $process.Id
        $result.windowTitle = $process.MainWindowTitle
        $result.ok = $true
        $result.message = 'ZavorthBridge window detected.'
      } else {
        $result.ok = $true
        $result.message = 'ZavorthBridge is not open.'
      }
    }

    'open' {
      $result.stage = 'open'
      $process = Get-ZavorthBridgeProcess $WindowTitle
      if (-not $process) {
        Add-Log 'Opening ZavorthBridge window.'
        Start-Process -FilePath $ExecutablePath -ArgumentList (Get-ZavorthBridgeLaunchArgumentString) | Out-Null
        $process = Wait-ForZavorthBridgeWindow $WindowTitle $TimeoutSeconds
        $result.changed = $true
      }

      if (-not $process) {
        $result.errorCode = 'window_not_found'
        throw 'ZavorthBridge window did not appear before timeout.'
      }

      $result.ok = $true
      $result.processFound = $true
      $result.windowFound = $true
      $result.processId = $process.Id
      $result.windowTitle = $process.MainWindowTitle
      $result.message = 'ZavorthBridge window is ready.'
    }

    'restart' {
      $result.stage = 'restart'
      Add-Log 'Restarting ZavorthBridge processes.'
      Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -match 'ZavorthBridge' -or $_.MainWindowTitle -like "*$WindowTitle*"
      } | Stop-Process -Force -ErrorAction SilentlyContinue

      Start-Sleep -Seconds 1
      Start-Process -FilePath $ExecutablePath -ArgumentList (Get-ZavorthBridgeLaunchArgumentString) | Out-Null
      $process = Wait-ForZavorthBridgeWindow $WindowTitle $TimeoutSeconds

      if (-not $process) {
        $result.errorCode = 'window_not_found'
        throw 'ZavorthBridge window did not appear after restart.'
      }

      $result.ok = $true
      $result.changed = $true
      $result.processFound = $true
      $result.windowFound = $true
      $result.processId = $process.Id
      $result.windowTitle = $process.MainWindowTitle
      $result.message = 'ZavorthBridge restarted successfully.'
    }

    'set-model' {
      $result.stage = 'validation'
      if ([string]::IsNullOrWhiteSpace($ModelKey)) {
        $result.errorCode = 'model_key_required'
        throw 'ModelKey is required for set-model.'
      }

      $targetModel = $allowedModels | Where-Object { $_.key -eq $ModelKey } | Select-Object -First 1
      if (-not $targetModel) {
        $result.errorCode = 'model_not_allowed'
        throw "Model '$ModelKey' is not in the allowlist."
      }

      $result.selectedModel = [string]$targetModel.label
      $process = Get-ZavorthBridgeProcess $WindowTitle
      if (-not $process) {
        $result.stage = 'open'
        Add-Log 'ZavorthBridge not open. Launching before model switch.'
        Start-Process -FilePath $ExecutablePath -ArgumentList (Get-ZavorthBridgeLaunchArgumentString) | Out-Null
        $process = Wait-ForZavorthBridgeWindow $WindowTitle $TimeoutSeconds
        $result.changed = $true
      }

      if (-not $process) {
        $result.errorCode = 'window_not_found'
        throw 'ZavorthBridge window did not appear before model switch.'
      }

      $result.processFound = $true
      $result.windowFound = $true
      $result.processId = $process.Id
      $result.windowTitle = $process.MainWindowTitle

      $result.stage = 'switch-model'
      $switchResult = Invoke-UiAutomationScript 'switch-model' ([string]$targetModel.label) $WindowTitle $process.Id
      $result.diagnostics = Get-ObjectValue $switchResult 'diagnostics' $result.diagnostics
      $switchMessage = [string](Get-ObjectValue $switchResult 'message' '')
      $switchOk = [bool](Get-ObjectValue $switchResult 'ok' $false)
      Add-Log ("Switch result ok={0} message={1}" -f $switchOk, $switchMessage)

      $result.stage = 'verify-model'
      $verifyResult = Invoke-UiAutomationScript 'verify-model' ([string]$targetModel.label) $WindowTitle $process.Id
      $result.diagnostics = Get-ObjectValue $verifyResult 'diagnostics' $result.diagnostics
      $result.verified = [bool](Get-ObjectValue $verifyResult 'verified' $false)
      $result.message = [string](Get-ObjectValue $verifyResult 'message' 'Verification did not return a message.')
      Add-Log ("Verify result verified={0} message={1}" -f $result.verified, $result.message)

      if (-not $result.verified) {
        $ahkExecutable = Resolve-AutoHotkeyExecutable $AutoHotkeyPath
        if ($ahkExecutable -and -not [string]::IsNullOrWhiteSpace($AutoHotkeyScriptPath)) {
          $result.stage = 'ahk-fallback'
          $currentModelHint = [string](Get-ObjectValue $result.diagnostics 'matchedText' '')
          $ahkResult = Invoke-AutoHotkeyFallback $ahkExecutable $AutoHotkeyScriptPath $WindowTitle ([string]$targetModel.label) $currentModelHint
          Add-Log ("AutoHotkey fallback ok={0} message={1}" -f (Get-ObjectValue $ahkResult 'ok' $false), (Get-ObjectValue $ahkResult 'message' ''))

          $result.stage = 'verify-model'
          $verifyResult = Invoke-UiAutomationScript 'verify-model' ([string]$targetModel.label) $WindowTitle $process.Id
          $result.diagnostics = Get-ObjectValue $verifyResult 'diagnostics' $result.diagnostics
          $result.verified = [bool](Get-ObjectValue $verifyResult 'verified' $false)
          $result.message = [string](Get-ObjectValue $verifyResult 'message' 'Verification did not return a message.')
          Add-Log ("Post-AHK verify result verified={0} message={1}" -f $result.verified, $result.message)
        } else {
          Add-Log 'AutoHotkey fallback unavailable on this machine.'
        }
      }

      if ($result.verified) {
        $result.ok = $true
        $result.stage = 'completed'
      } else {
        $result.ok = $false
        $result.stage = 'verification_failed'
        $result.errorCode = 'verification_failed'
        $result.errorMessage = 'The model switch was attempted but could not be confirmed.'
      }
    }
  }
} catch {
  $result.ok = $false
  if (-not $result.errorCode) {
    $result.errorCode = 'execution_failed'
  }
  $result.errorMessage = $_.Exception.Message
  if (-not $result.message) {
    $result.message = $_.Exception.Message
  }
  Add-Log ("Error: {0}" -f $_.Exception.Message)
} finally {
  $result.logFile = Write-ExecutionLog $LogDir
}

$result | ConvertTo-Json -Compress -Depth 8
