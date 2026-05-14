$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$unifiedLauncherPath = Join-Path $projectRoot 'Iniciar Zavorth.bat'
$unifiedLauncherScriptPath = Join-Path $projectRoot 'scripts\launch-zavorth-unified.ps1'
$iconGeneratorPath = Join-Path $projectRoot 'scripts\generate-zavorth-shortcut-icon.ps1'
$iconPath = Join-Path $projectRoot 'assets\launcher\zavorth-shortcut.ico'

if (-not (Test-Path $unifiedLauncherPath)) {
  throw "Nao encontrei o launcher unificado em $unifiedLauncherPath"
}

if (-not (Test-Path $unifiedLauncherScriptPath)) {
  throw "Nao encontrei o script unificado em $unifiedLauncherScriptPath"
}

$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path $powershellPath)) {
  throw "Nao encontrei o PowerShell em $powershellPath"
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
  -Description 'Inicia o Zavorth oficial em modo supervisionado; habilite perfil full por variavel quando precisar.'

New-LauncherShortcut `
  -ShortcutFile $unifiedStartMenuShortcutPath `
  -LauncherScriptPath $unifiedLauncherScriptPath `
  -Description 'Inicia o Zavorth oficial em modo supervisionado; habilite perfil full por variavel quando precisar.'

$removedLegacy = @()
foreach ($legacyShortcutPath in $legacyShortcutPaths) {
  if (Test-Path $legacyShortcutPath) {
    Remove-Item -LiteralPath $legacyShortcutPath -Force
    $removedLegacy += $legacyShortcutPath
  }
}

Write-Host 'Atalho criado com sucesso:'
Write-Host $unifiedShortcutPath
Write-Host $unifiedStartMenuShortcutPath
if ($removedLegacy.Count -gt 0) {
  Write-Host 'Atalhos antigos removidos:'
  $removedLegacy | ForEach-Object { Write-Host $_ }
}
