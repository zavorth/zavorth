Set WshShell = CreateObject("WScript.Shell")
Set Fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = Fso.GetParentFolderName(WScript.ScriptFullName)
ProjectRoot = Fso.GetParentFolderName(ScriptDir)
Launcher = ScriptDir & "\launch-zavorth-unified.ps1"
If Not Fso.FileExists(Launcher) Then
  WScript.Quit 1
End If
Command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & Launcher & """ -Headless"
WshShell.Run Command, 0, False
