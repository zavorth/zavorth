$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$unifiedLauncherPath = Join-Path $projectRoot 'Iniciar Zavorth.bat'
$unifiedLauncherScriptPath = Join-Path $projectRoot 'scripts\launch-zavorth-unified.ps1'
$iconGeneratorPath = Join-Path $projectRoot 'scripts\generate-zavorth-shortcut-icon.ps1'
$iconPath = Join-Path $projectRoot 'assets\launcher\zavorth-shortcut.ico'

if (-not (Test-Path $unifiedLauncherPath)) {
  throw "Could not find the unified launcher at $unifiedLauncherPath"
}

if (-not (Test-Path $unifiedLauncherScriptPath)) {
  throw "Could not find the unified script at $unifiedLauncherScriptPath"
}

$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path $powershellPath)) {
  throw "Could not find PowerShell at $powershellPath"
}

& $powershellPath -ExecutionPolicy Bypass -File $iconGeneratorPath

$desktopPath = [Environment]::GetFolderPath('Desktop')
$unifiedShortcutPath = Join-Path $desktopPath 'Zavorth.lnk'
$programsPath = [Environment]::GetFolderPath('Programs')
$startMenuDir = Join-Path $programsPath 'Zavorth'
$unifiedStartMenuShortcutPath = Join-Path $startMenuDir 'Zavorth.lnk'
$legacyShortcutPaths = @(
  (Join-Path $desktopPath 'Zavorth Completo.lnk'),
  (Join-Path $desktopPath 'Zavorth Supervisionado.lnk'),
  (Join-Path $desktopPath 'Zavorth Remote Keep Alive.lnk'),
  (Join-Path $startMenuDir 'Zavorth Completo.lnk'),
  (Join-Path $startMenuDir 'Zavorth Supervisionado.lnk'),
  (Join-Path $startMenuDir 'Zavorth Remote Keep Alive.lnk')
)

$shell = New-Object -ComObject WScript.Shell
New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null

function New-LauncherShortcut {
  param(
    [string]$ShortcutFile,
    [string]$LauncherScriptPath,
    [string]$Description
  )

  $shortcut = $shell.CreateShortcut($ShortcutFile)
  $shortcut.TargetPath = $powershellPath
  $shortcut.Arguments = "-ExecutionPolicy Bypass -NoLogo -WindowStyle Minimized -File `"$LauncherScriptPath`""
  $shortcut.WorkingDirectory = $projectRoot
  $shortcut.IconLocation = $iconPath
  $shortcut.Description = $Description
  $shortcut.WindowStyle = 7
  $shortcut.Save()
}

New-LauncherShortcut `
  -ShortcutFile $unifiedShortcutPath `
  -LauncherScriptPath $unifiedLauncherScriptPath `
  -Description 'starts o Zavorth oficial em modo supervised; enable perfil full por variable when need.'

New-LauncherShortcut `
  -ShortcutFile $unifiedStartMenuShortcutPath `
  -LauncherScriptPath $unifiedLauncherScriptPath `
  -Description 'starts o Zavorth oficial em modo supervised; enable perfil full por variable when need.'

$removedLegacy = @()
foreach ($legacyShortcutPath in $legacyShortcutPaths) {
  if (Test-Path $legacyShortcutPath) {
    Remove-Item -LiteralPath $legacyShortcutPath -Force
    $removedLegacy += $legacyShortcutPath
  }
}

Write-Host 'shortcut created com success:'
Write-Host $unifiedShortcutPath
Write-Host $unifiedStartMenuShortcutPath
if ($removedLegacy.Count -gt 0) {
  Write-Host 'shortcuts antigos removidos:'
  $removedLegacy | ForEach-Object { Write-Host $_ }
}
