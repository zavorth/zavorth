#Requires AutoHotkey v2.0
#SingleInstance Force

if (A_Args.Length < 1) {
    ExitApp 2
}

resultPath := A_Args[1]
FileAppend '{"ok":true,"message":"write"}', resultPath, "UTF-8"
ExitApp 0
