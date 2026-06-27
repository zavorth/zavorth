Set WshShell = CreateObject("WScript.Shell")
Set Fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = Fso.GetParentFolderName(WScript.ScriptFullName)
ProjectRoot = Fso.GetParentFolderName(ScriptDir)
LogDir = ProjectRoot & "\logs"
If Not Fso.FolderExists(LogDir) Then
  Fso.CreateFolder(LogDir)
End If
Command = "cmd.exe /c cd /d """ & ProjectRoot & """ && npm run dev >> """ & LogDir & "\zavorth-daemon.log"" 2>&1"
WshShell.Run Command, 0, False
