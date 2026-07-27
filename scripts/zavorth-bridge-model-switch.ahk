#Requires AutoHotkey v2.0
#SingleInstance Force

SetTitleMatchMode 2
CoordMode "Mouse", "Window"

WriteJson(json) {
    FileAppend json, "*"
}

DeleteFileIfExists(path) {
    if (path != "" && FileExist(path))
        FileDelete path
}

Fail(message, extra := "") {
    payload := '{"ok":false,"message":"' . EscapeJson(message) . '","extra":"' . EscapeJson(extra) . '"}'
    try {
        global resultPath
        if (resultPath != "") {
            DeleteFileIfExists(resultPath)
            FileAppend payload, resultPath, "UTF-8"
        } else {
            WriteJson(payload)
        }
    }
    ExitApp 1
}

EscapeJson(text) {
    value := String(text)
    value := StrReplace(value, "\", "\\")
    value := StrReplace(value, '"', '\"')
    value := StrReplace(value, "`r", "\r")
    value := StrReplace(value, "`n", "\n")
    return value
}

if (A_Args.Length < 3) {
    Fail("Missing required arguments.")
}

windowTitle := A_Args[1]
targetModel := A_Args[2]
resultPath := A_Args[3]
currentModel := A_Args.Length >= 4 - A_Args[4] : ""

WriteJsonToFile(json) {
    global resultPath
    DeleteFileIfExists(resultPath)
    FileAppend json, resultPath, "UTF-8"
}

SelectFromTop(targetIndex) {
    Send "{Home}"
    Sleep 180
    if (targetIndex > 0) {
        Loop targetIndex {
            Send "{Down}"
            Sleep 150
        }
    }
    Send "{Enter}"
    Sleep 500
}

AttemptChipClickSelection(targetIndex, winH) {
    chipX := 110
    chipY := winH - 65
    MouseMove chipX, chipY, 0
    Click
    Sleep 400
    SelectFromTop(targetIndex)
}

AttemptComposerTabSelection(targetIndex, winW, winH) {
    composerX := Floor(winW * 0.55)
    composerY := winH - 70
    MouseMove composerX, composerY, 0
    Click
    Sleep 250
    Send "+{Tab}"
    Sleep 200
    Send "+{Tab}"
    Sleep 200
    Send "{Enter}"
    Sleep 350
    SelectFromTop(targetIndex)
}

allowedModels := Map(
    "Gemini 3.1 Pro (High)", 0,
    "Gemini 3.1 Pro (Low)", 1,
    "Gemini 3 Flash", 2
)

if !allowedModels.Has(targetModel) {
    Fail("Target model is not supported by the AutoHotkey fallback.", targetModel)
}

if !WinExist(windowTitle) {
    Fail("ZavorthBridge window not found.", windowTitle)
}

WinActivate windowTitle
if !WinWaitActive(windowTitle, , 3) {
    Fail("Failed to activate ZavorthBridge window.", windowTitle)
}

Send "{Esc}"
Sleep 200

WinGetPos &winX, &winY, &winW, &winH, windowTitle
if (winW <= 0 || winH <= 0) {
    Fail("Invalid ZavorthBridge window bounds.")
}

targetIndex := allowedModels[targetModel]
AttemptChipClickSelection(targetIndex, winH)
Send "{Esc}"
Sleep 250
AttemptComposerTabSelection(targetIndex, winW, winH)

payload := '{"ok":true,"message":"AutoHotkey fallback attempted model switch.","targetModel":"' . EscapeJson(targetModel) . '","currentModelHint":"' . EscapeJson(currentModel) . '","strategy":"chip-click-then-tab"}'
WriteJsonToFile(payload)
ExitApp 0
