#Requires AutoHotkey v2.0
#SingleInstance Force

if (A_Args.Length < 1) {
    ExitApp 1
}

resultPath := A_Args[1]
if FileExist(resultPath)
    FileDelete resultPath
FileAppend '{"ok":true,"message":"smoke"}', resultPath, "UTF-8"
ExitApp 0
