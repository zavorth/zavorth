param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('status', 'activate', 'restore')]
  [string]$Mode,

  [Parameter(Mandatory = $true)]
  [string]$StateFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Ensure-Directory {
  param([string]$FilePath)

  $directory = Split-Path -Path $FilePath -Parent
  if ($directory -and -not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }
}

function Get-LastTwoHexValues {
  param([string]$PowerCfgOutput)

  $matches = [regex]::Matches($PowerCfgOutput, '0x[0-9a-fA-F]+')
  if ($matches.Count -lt 2) {
    return @{
      ac = $null
      dc = $null
    }
  }

  $acHex = $matches[$matches.Count - 2].Value
  $dcHex = $matches[$matches.Count - 1].Value

  return @{
    ac = [Convert]::ToInt32($acHex, 16)
    dc = [Convert]::ToInt32($dcHex, 16)
  }
}

function Get-PowerSettingSnapshot {
  param(
    [string]$Subgroup,
    [string]$Setting
  )

  try {
    $output = (& powercfg /Q SCHEME_CURRENT $Subgroup $Setting 2>$null | Out-String)
    $values = Get-LastTwoHexValues -PowerCfgOutput $output
    return @{
      subgroup = $Subgroup
      setting = $Setting
      ac = $values.ac
      dc = $values.dc
    }
  } catch {
    return @{
      subgroup = $Subgroup
      setting = $Setting
      ac = $null
      dc = $null
    }
  }
}

function Set-PowerSettingExact {
  param(
    [string]$SchemeGuid,
    [string]$Subgroup,
    [string]$Setting,
    [Nullable[int]]$AcValue,
    [Nullable[int]]$DcValue,
    [switch]$Optional,
    [ref]$Warnings
  )

  if ($null -eq $AcValue -or $null -eq $DcValue) {
    if (-not $Optional) {
      $Warnings.Value += "Nao foi possivel restaurar $Setting com precisao porque o snapshot ficou incompleto."
    }
    return
  }

  try {
    & powercfg /SETACVALUEINDEX $SchemeGuid $Subgroup $Setting $AcValue | Out-Null
    & powercfg /SETDCVALUEINDEX $SchemeGuid $Subgroup $Setting $DcValue | Out-Null
  } catch {
    $Warnings.Value += "Falha ao ajustar ${Setting}: $($_.Exception.Message)"
  }
}

function Get-RegistrySnapshotValue {
  param([string]$Name)

  try {
    $value = (Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name $Name -ErrorAction Stop).$Name
    return @{
      hasValue = $true
      value = [string]$value
    }
  } catch {
    return @{
      hasValue = $false
      value = $null
    }
  }
}

function Restore-RegistrySnapshotValue {
  param(
    [string]$Name,
    $Snapshot,
    [ref]$Warnings
  )

  try {
    if ($Snapshot.hasValue) {
      New-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name $Name -PropertyType String -Value ([string]$Snapshot.value) -Force | Out-Null
      return
    }

    Remove-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name $Name -ErrorAction SilentlyContinue
  } catch {
    $Warnings.Value += "Falha ao restaurar a chave ${Name}: $($_.Exception.Message)"
  }
}

function Get-CurrentSnapshot {
  $schemeOutput = (& powercfg /GETACTIVESCHEME | Out-String)
  $schemeMatch = [regex]::Match($schemeOutput, '([0-9a-fA-F-]{36})')
  $schemeGuid = if ($schemeMatch.Success) { $schemeMatch.Groups[1].Value } else { $null }

  return @{
    schemeGuid = $schemeGuid
    power = @{
      VIDEOIDLE = Get-PowerSettingSnapshot -Subgroup 'SUB_VIDEO' -Setting 'VIDEOIDLE'
      STANDBYIDLE = Get-PowerSettingSnapshot -Subgroup 'SUB_SLEEP' -Setting 'STANDBYIDLE'
      HIBERNATEIDLE = Get-PowerSettingSnapshot -Subgroup 'SUB_SLEEP' -Setting 'HIBERNATEIDLE'
      CONSOLELOCK = Get-PowerSettingSnapshot -Subgroup 'SUB_NONE' -Setting 'CONSOLELOCK'
    }
    registry = @{
      ScreenSaveActive = Get-RegistrySnapshotValue -Name 'ScreenSaveActive'
      ScreenSaverIsSecure = Get-RegistrySnapshotValue -Name 'ScreenSaverIsSecure'
      ScreenSaveTimeOut = Get-RegistrySnapshotValue -Name 'ScreenSaveTimeOut'
    }
  }
}

function Save-State {
  param([hashtable]$State)

  Ensure-Directory -FilePath $StateFile
  ($State | ConvertTo-Json -Depth 8) | Set-Content -Path $StateFile -Encoding UTF8
}

function Load-State {
  if (-not (Test-Path -LiteralPath $StateFile)) {
    return $null
  }

  return Get-Content -Path $StateFile -Raw | ConvertFrom-Json
}

function Build-Result {
  param(
    [bool]$Ok,
    [string]$Message,
    [bool]$Active,
    [bool]$Changed,
    [string[]]$Warnings,
    $Snapshot,
    $AppliedAt
  )

  return @{
    ok = $Ok
    mode = $Mode
    active = $Active
    changed = $Changed
    message = $Message
    appliedAt = $AppliedAt
    warnings = @($Warnings)
    snapshot = $Snapshot
  }
}

$state = Load-State
$warnings = @()

switch ($Mode) {
  'status' {
    $result = if ($state) {
      Build-Result -Ok $true -Message 'Modo remoto carregado a partir do snapshot salvo.' -Active ([bool]$state.active) -Changed $false -Warnings @($state.warnings) -Snapshot $state.snapshot -AppliedAt $state.appliedAt
    } else {
      Build-Result -Ok $true -Message 'Modo remoto desativado. Nenhum snapshot salvo.' -Active $false -Changed $false -Warnings @() -Snapshot $null -AppliedAt $null
    }
  }

  'activate' {
    if ($state -and $state.active) {
      $result = Build-Result -Ok $true -Message 'Modo remoto ja estava ativo. Nada foi alterado.' -Active $true -Changed $false -Warnings @($state.warnings) -Snapshot $state.snapshot -AppliedAt $state.appliedAt
      break
    }

    $snapshot = Get-CurrentSnapshot
    $schemeGuid = if ($snapshot.schemeGuid) { $snapshot.schemeGuid } else { 'SCHEME_CURRENT' }

    Set-PowerSettingExact -SchemeGuid $schemeGuid -Subgroup 'SUB_VIDEO' -Setting 'VIDEOIDLE' -AcValue 0 -DcValue 0 -Warnings ([ref]$warnings)
    Set-PowerSettingExact -SchemeGuid $schemeGuid -Subgroup 'SUB_SLEEP' -Setting 'STANDBYIDLE' -AcValue 0 -DcValue 0 -Warnings ([ref]$warnings)
    Set-PowerSettingExact -SchemeGuid $schemeGuid -Subgroup 'SUB_SLEEP' -Setting 'HIBERNATEIDLE' -AcValue 0 -DcValue 0 -Warnings ([ref]$warnings)
    Set-PowerSettingExact -SchemeGuid $schemeGuid -Subgroup 'SUB_NONE' -Setting 'CONSOLELOCK' -AcValue 0 -DcValue 0 -Warnings ([ref]$warnings)

    try {
      New-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveActive' -PropertyType String -Value '0' -Force | Out-Null
      New-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaverIsSecure' -PropertyType String -Value '0' -Force | Out-Null
      New-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveTimeOut' -PropertyType String -Value '0' -Force | Out-Null
      & rundll32.exe user32.dll,UpdatePerUserSystemParameters | Out-Null
    } catch {
      $warnings += "Falha ao ajustar o protetor de tela: $($_.Exception.Message)"
    }

    try {
      & powercfg /SETACTIVE $schemeGuid | Out-Null
    } catch {
      $warnings += "Falha ao reativar o plano de energia atual: $($_.Exception.Message)"
    }

    $appliedAt = (Get-Date).ToString('o')
    $newState = @{
      active = $true
      appliedAt = $appliedAt
      warnings = @($warnings)
      snapshot = $snapshot
    }
    Save-State -State $newState
    $result = Build-Result -Ok $true -Message 'Modo remoto ativado: tela, sono, hibernacao e bloqueios foram afrouxados para automacao.' -Active $true -Changed $true -Warnings $warnings -Snapshot $snapshot -AppliedAt $appliedAt
  }

  'restore' {
    if (-not $state) {
      $result = Build-Result -Ok $true -Message 'Nao havia snapshot salvo. Nada para restaurar.' -Active $false -Changed $false -Warnings @() -Snapshot $null -AppliedAt $null
      break
    }

    $snapshot = $state.snapshot
    $schemeGuid = if ($snapshot.schemeGuid) { [string]$snapshot.schemeGuid } else { 'SCHEME_CURRENT' }

    Set-PowerSettingExact -SchemeGuid $schemeGuid -Subgroup 'SUB_VIDEO' -Setting 'VIDEOIDLE' -AcValue $snapshot.power.VIDEOIDLE.ac -DcValue $snapshot.power.VIDEOIDLE.dc -Warnings ([ref]$warnings)
    Set-PowerSettingExact -SchemeGuid $schemeGuid -Subgroup 'SUB_SLEEP' -Setting 'STANDBYIDLE' -AcValue $snapshot.power.STANDBYIDLE.ac -DcValue $snapshot.power.STANDBYIDLE.dc -Warnings ([ref]$warnings)
    Set-PowerSettingExact -SchemeGuid $schemeGuid -Subgroup 'SUB_SLEEP' -Setting 'HIBERNATEIDLE' -AcValue $snapshot.power.HIBERNATEIDLE.ac -DcValue $snapshot.power.HIBERNATEIDLE.dc -Warnings ([ref]$warnings)
    Set-PowerSettingExact -SchemeGuid $schemeGuid -Subgroup 'SUB_NONE' -Setting 'CONSOLELOCK' -AcValue $snapshot.power.CONSOLELOCK.ac -DcValue $snapshot.power.CONSOLELOCK.dc -Optional -Warnings ([ref]$warnings)

    Restore-RegistrySnapshotValue -Name 'ScreenSaveActive' -Snapshot $snapshot.registry.ScreenSaveActive -Warnings ([ref]$warnings)
    Restore-RegistrySnapshotValue -Name 'ScreenSaverIsSecure' -Snapshot $snapshot.registry.ScreenSaverIsSecure -Warnings ([ref]$warnings)
    Restore-RegistrySnapshotValue -Name 'ScreenSaveTimeOut' -Snapshot $snapshot.registry.ScreenSaveTimeOut -Warnings ([ref]$warnings)

    try {
      & powercfg /SETACTIVE $schemeGuid | Out-Null
      & rundll32.exe user32.dll,UpdatePerUserSystemParameters | Out-Null
    } catch {
      $warnings += "Falha ao reativar o plano original durante a restauracao: $($_.Exception.Message)"
    }

    Remove-Item -Path $StateFile -Force -ErrorAction SilentlyContinue
    $result = Build-Result -Ok $true -Message 'Modo remoto desativado e configuracoes anteriores restauradas.' -Active $false -Changed $true -Warnings $warnings -Snapshot $snapshot -AppliedAt $null
  }
}

$result | ConvertTo-Json -Depth 8 -Compress
