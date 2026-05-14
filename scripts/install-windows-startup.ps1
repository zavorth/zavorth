param(
  [switch]$Remove,
  [switch]$AllowInstall
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$unifiedLauncherScriptPath = Join-Path $projectRoot 'scripts\launch-zavorth-unified.ps1'
$iconGeneratorPath = Join-Path $projectRoot 'scripts\generate-zavorth-shortcut-icon.ps1'
$iconPath = Join-Path $projectRoot 'assets\launcher\zavorth-shortcut.ico'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

if (-not (Test-Path $unifiedLauncherScriptPath)) {
  throw "Nao encontrei o launcher unificado em $unifiedLauncherScriptPath"
}

if (-not (Test-Path $powershellPath)) {
  throw "Nao encontrei o PowerShell em $powershellPath"
}

if ((Test-Path $iconGeneratorPath) -and -not (Test-Path $iconPath)) {
  & $powershellPath -ExecutionPolicy Bypass -File $iconGeneratorPath
}

$startupPath = [Environment]::GetFolderPath('Startup')
if (-not $startupPath) {
  throw 'Nao foi possivel localizar a pasta Startup do usuario atual.'
}

$shortcutPaths = @(
  (Join-Path $startupPath 'Zavorth.lnk'),
  (Join-Path $startupPath 'Zavorth Supervisionado.lnk'),
  (Join-Path $startupPath 'Zavorth Remote Keep Alive.lnk')
)

if ($Remove) {
  $removedAny = $false
  foreach ($shortcutPath in $shortcutPaths) {
    if (Test-Path $shortcutPath) {
      Remove-Item -LiteralPath $shortcutPath -Force
      $removedAny = $true
      Write-Host 'Atalho removido do Startup:'
      Write-Host $shortcutPath
    }
  }
  if (-not $removedAny) {
    Write-Host 'Nenhum atalho do Zavorth foi encontrado no Startup.'
  }
  exit 0
}

$allowStartupInstall = ''
if ($null -ne $env:ZAVORTH_ALLOW_STARTUP_INSTALL) {
  $allowStartupInstall = [string]$env:ZAVORTH_ALLOW_STARTUP_INSTALL
}

if ($allowStartupInstall.ToLowerInvariant() -ne 'true') {
  throw 'Startup automatico bloqueado por padrao. Defina ZAVORTH_ALLOW_STARTUP_INSTALL=true para instalar este atalho conscientemente.'
}

if (-not $AllowInstall) {
  throw 'Instalacao de Startup exige confirmacao explicita. Rode o script com -AllowInstall para prosseguir conscientemente.'
}

$shell = New-Object -ComObject WScript.Shell
$shortcutPath = $shortcutPaths[0]
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-ExecutionPolicy Bypass -NoLogo -WindowStyle Minimized -File `"$unifiedLauncherScriptPath`" -Headless"
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'Inicia o Zavorth oficial automaticamente ao entrar no Windows.'
$shortcut.WindowStyle = 7

if (Test-Path $iconPath) {
  $shortcut.IconLocation = $iconPath
}

$shortcut.Save()

foreach ($legacyShortcutPath in $shortcutPaths | Select-Object -Skip 1) {
  if (Test-Path $legacyShortcutPath) {
    Remove-Item -LiteralPath $legacyShortcutPath -Force
  }
}

Write-Host 'Atalho do Startup criado com sucesso:'
Write-Host $shortcutPath
