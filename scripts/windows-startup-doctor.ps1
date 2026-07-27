param(
  [switch]$Remove,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRootNormalized = $projectRoot.ToLowerInvariant().Replace('/', '\')
$startupPath = [Environment]::GetFolderPath('Startup')
$shell = $null

function Get-ShortcutShell {
  if ($null -eq $script:shell) {
    $script:shell = New-Object -ComObject WScript.Shell
  }

  return $script:shell
}

function Normalize-Text {
  param([string]$Value)

  if ($null -eq $Value) {
    return ''
  }

  return ([string]$Value).ToLowerInvariant().Replace('/', '\')
}

function Test-ZavorthText {
  param([string]$Value)

  $normalized = Normalize-Text $Value
  if (-not $normalized) {
    return $false
  }

  return (
    $normalized.Contains($projectRootNormalized) -or
    $normalized.Contains('launch-zavorth') -or
    $normalized.Contains('zavorth-core\zavorth') -or
    $normalized.Contains('ops-remote-keepalive')
  )
}

function Get-StartupShortcutMatches {
  $results = @()
  if (-not (Test-Path $startupPath)) {
    return $results
  }

  foreach ($file in Get-ChildItem -LiteralPath $startupPath -Filter '*.lnk' -Force -ErrorAction SilentlyContinue) {
    try {
      $shortcut = (Get-ShortcutShell).CreateShortcut($file.FullName)
      $target = [string]$shortcut.TargetPath
      $arguments = [string]$shortcut.Arguments
      $workingDirectory = [string]$shortcut.WorkingDirectory
      $matched = (
        Test-ZavorthText $file.Name
      ) -or (
        Test-ZavorthText $target
      ) -or (
        Test-ZavorthText $arguments
      ) -or (
        Test-ZavorthText $workingDirectory
      )

      if ($matched) {
        $results += [pscustomobject]@{
          type = 'startup-shortcut'
          path = $file.FullName
          name = $file.Name
          target = $target
          arguments = $arguments
          workingDirectory = $workingDirectory
        }
      }
    } catch {
      if ((Test-ZavorthText $file.FullName) -or (Test-ZavorthText $file.Name)) {
        $results += [pscustomobject]@{
          type = 'startup-shortcut'
          path = $file.FullName
          name = $file.Name
          target = ''
          arguments = ''
          workingDirectory = ''
        }
      }
    }
  }

  return $results
}

function Get-RegistryMatches {
  $results = @()
  $keys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce'
  )

  foreach ($key in $keys) {
    if (-not (Test-Path $key)) {
      continue
    }

    try {
      $item = Get-ItemProperty -Path $key -ErrorAction Stop
      foreach ($property in $item.PSObject.Properties) {
        if ($property.Name -in @('PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider')) {
          continue
        }

        $value = [string]$property.Value
        if (Test-ZavorthText $property.Name -or Test-ZavorthText $value) {
          $results += [pscustomobject]@{
            type = 'registry'
            key = $key
            name = $property.Name
            value = $value
          }
        }
      }
    } catch {
      continue
    }
  }

  return $results
}

function Get-ScheduledTaskMatches {
  $results = @()

  try {
    foreach ($task in Get-ScheduledTask -ErrorAction Stop) {
      $actions = @($task.Actions)
      $combined = @(
        [string]$task.TaskName,
        [string]$task.TaskPath,
        ($actions | ForEach-Object { [string]$_.Execute }),
        ($actions | ForEach-Object { [string]$_.Arguments })
      ) -join ' '

      if (-not (Test-ZavorthText $combined)) {
        continue
      }

      $results += [pscustomobject]@{
        type = 'scheduled-task'
        taskName = $task.TaskName
        taskPath = $task.TaskPath
        state = [string]$task.State
      }
    }
  } catch {
    return @()
  }

  return $results
}

function Remove-Matches {
  param(
    [object[]]$StartupShortcuts,
    [object[]]$RegistryEntries,
    [object[]]$ScheduledTasks
  )

  $removed = @()

  foreach ($entry in $StartupShortcuts) {
    if (Test-Path $entry.path) {
      Remove-Item -LiteralPath $entry.path -Force -ErrorAction SilentlyContinue
      $removed += [pscustomobject]@{
        type = 'startup-shortcut'
        path = $entry.path
      }
    }
  }

  foreach ($entry in $RegistryEntries) {
    try {
      Remove-ItemProperty -Path $entry.key -Name $entry.name -Force -ErrorAction Stop
      $removed += [pscustomobject]@{
        type = 'registry'
        key = $entry.key
        name = $entry.name
      }
    } catch {
      continue
    }
  }

  foreach ($entry in $ScheduledTasks) {
    try {
      Unregister-ScheduledTask -TaskName $entry.taskName -TaskPath $entry.taskPath -Confirm:$false -ErrorAction Stop
      $removed += [pscustomobject]@{
        type = 'scheduled-task'
        taskName = $entry.taskName
        taskPath = $entry.taskPath
      }
    } catch {
      continue
    }
  }

  return $removed
}

$startupShortcuts = @(Get-StartupShortcutMatches)
$registryEntries = @(Get-RegistryMatches)
$scheduledTasks = @(Get-ScheduledTaskMatches)
$removed = @()

if ($Remove) {
  $removed = @(Remove-Matches -StartupShortcuts $startupShortcuts -RegistryEntries $registryEntries -ScheduledTasks $scheduledTasks)
  $startupShortcuts = @(Get-StartupShortcutMatches)
  $registryEntries = @(Get-RegistryMatches)
  $scheduledTasks = @(Get-ScheduledTaskMatches)
}

$report = [ordered]@{
  generatedAt = (Get-Date).ToString('o')
  projectRoot = $projectRoot
  removeApplied = [bool]$Remove
  autoStartEnabled = ($startupShortcuts.Count + $registryEntries.Count + $scheduledTasks.Count) -gt 0
  startupShortcuts = $startupShortcuts
  registryEntries = $registryEntries
  scheduledTasks = $scheduledTasks
  removed = $removed
}

if ($Json) {
  $report | ConvertTo-Json -Depth 6
  exit 0
}

Write-Host '==========================================='
Write-Host '  Zavorth Windows Startup Doctor'
Write-Host '==========================================='
Write-Host ("Project: {0}" -f $projectRoot)
Write-Host ("Autorun active: {0}" -f ($(if ($report.autoStartEnabled) { 'yes' } else { 'no' })))
Write-Host ''

Write-Host 'Startup shortcuts:'
if ($startupShortcuts.Count -eq 0) {
  Write-Host '- none'
} else {
  foreach ($entry in $startupShortcuts) {
    Write-Host ("- {0}" -f $entry.path)
  }
}

Write-Host ''
Write-Host 'Registry autorun entries:'
if ($registryEntries.Count -eq 0) {
  Write-Host '- none'
} else {
  foreach ($entry in $registryEntries) {
    Write-Host ("- {0} :: {1}" -f $entry.key, $entry.name)
  }
}

Write-Host ''
Write-Host 'Scheduled tasks:'
if ($scheduledTasks.Count -eq 0) {
  Write-Host '- nonea'
} else {
  foreach ($entry in $scheduledTasks) {
    Write-Host ("- {0}{1}" -f $entry.taskPath, $entry.taskName)
  }
}

if ($Remove) {
  Write-Host ''
  Write-Host 'Removed items:'
  if ($removed.Count -eq 0) {
    Write-Host '- none'
  } else {
    foreach ($entry in $removed) {
      if ($entry.type -eq 'startup-shortcut') {
        Write-Host ("- startup shortcut: {0}" -f $entry.path)
      } elseif ($entry.type -eq 'registry') {
        Write-Host ("- registry: {0} :: {1}" -f $entry.key, $entry.name)
      } else {
        Write-Host ("- scheduled task: {0}{1}" -f $entry.taskPath, $entry.taskName)
      }
    }
  }
}
