# register-zavorth-daemon.ps1
# Script para registrar o Zavorth para iniciar automaticamente no Windows em segundo plano.

$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$ShortcutPath = Join-Path $StartupFolder "ZavorthDaemon.lnk"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LauncherPath = Join-Path $PSScriptRoot "launch-daemon.vbs"

# Criar atalho para o VBS launcher
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$LauncherPath`""
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.Description = "Inicializador em segundo plano para o daemon do Zavorth"
$Shortcut.Save()

Write-Host "Zavorth Daemon registrado com sucesso na pasta de Inicializacao do Windows!"
Write-Host "Atalho criado em: $ShortcutPath"
