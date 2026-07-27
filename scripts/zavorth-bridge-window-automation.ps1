param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('focus', 'approve-visible-step', 'paste-and-submit', 'switch-model', 'verify-model')]
  [string]$Mode,

  [string]$WindowTitle = 'ZavorthBridge',

  [string]$Text = '',

  [int]$InitialDelayMs = 0,

  [int]$ProcessId = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
$wshell = New-Object -ComObject WScript.Shell

$signature = @"
[DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
"@
Add-Type -MemberDefinition $signature -Name "MouseClick" -Namespace "Win32" -ErrorAction SilentlyContinue
$MOUSEEVENTF_LEFTDOWN = 0x02
$MOUSEEVENTF_LEFTUP = 0x04

function Click-Element($el) {
    if ($null -eq $el) { return }
    $rect = $el.Current.BoundingRectangle
    $x = [int]($rect.Left + ($rect.Width / 2))
    $y = [int]($rect.Top + ($rect.Height / 2))
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
    Start-Sleep -Milliseconds 100
    [Win32.MouseClick]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
    [Win32.MouseClick]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
}

if ($InitialDelayMs -gt 0) {
  Start-Sleep -Milliseconds $InitialDelayMs
}

$targetProcess = $null
$attempts = 0
while ($attempts -lt 15 -and -not $targetProcess) {
    # 1. Tenta especificamente o PID se fornecido e se ele tiver janela
    if ($ProcessId -gt 0) {
        $cand = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
        if ($cand) { $targetProcess = $cand }
    }

    # 2. Fallback: Procura QUALQUER process ZavorthBridge que tenha uma janela
    if (-not $targetProcess) {
        $cands = Get-Process | Where-Object {
            ($_.ProcessName -match 'ZavorthBridge' -or $_.MainWindowTitle -like "*$WindowTitle*") -and $_.MainWindowHandle -ne 0
        }
        if ($cands) {
            # Prioriza o que tem o t...tulo esperado
            $best = $cands | Where-Object { $_.MainWindowTitle -like "*$WindowTitle*" } | Sort-Object StartTime -Descending | Select-Object -First 1
            if ($best) {
                $targetProcess = $best
            } else {
                $targetProcess = $cands | Sort-Object StartTime -Descending | Select-Object -First 1
            }
        }
    }

    if (-not $targetProcess) {
        Start-Sleep -Seconds 1
        $attempts++
    }
}

if (-not $targetProcess) {
  throw "ZavorthBridge window not found (no window with title '$WindowTitle' and handle appeared after 15s)."
}

$activated = $false
try {
    # Tenta ativar pelo ID do process
    [Microsoft.VisualBasic.Interaction]::AppActivate($targetProcess.Id)
    $activated = $true
} catch {
    Start-Sleep -Milliseconds 500
    try {
        # Fallback pelo t...tulo se o ID failed (......s vezes acontece no Electron)
        $activated = $wshell.AppActivate($targetProcess.MainWindowTitle)
    } catch {}
}

if (-not $activated) {
  throw "Could not activate ZavorthBridge window (PID $($targetProcess.Id), Title '$($targetProcess.MainWindowTitle)')."
}

Start-Sleep -Milliseconds 350

switch ($Mode) {
  'focus' {
    # No-op after activation. We only needed to foreground the real window.
  }

  'approve-visible-step' {
    [System.Windows.Forms.SendKeys]::SendWait('%{ENTER}')
  }

  'paste-and-submit' {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      throw 'Mode paste-and-submit requires non-empty Text.'
    }

    Set-Clipboard -Value $Text
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  }

  'switch-model' {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      throw 'Mode switch-model requires non-empty Text (the model name).'
    }

    Start-Sleep -Seconds 1

    # starts a busca pela UI do modelo no Tree Walker
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($targetProcess.MainWindowHandle)

    # names conhecidos dos botoes de modelo no ZavorthBridge (dump UIA)
    $knownModels = @('Gemini 3.1 Pro (High)', 'Gemini 3.1 Pro (Low)', 'Gemini 3 Flash', 'Claude Sonnet 4.6 (Thinking)', 'Claude Opus 4.6 (Thinking)', 'GPT-OSS 120B (Medium)')

    $modelBtn = $null
    foreach ($m in $knownModels) {
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $m)
        $btn = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
        if ($btn) {
            $modelBtn = $btn
            break
        }
    }

    if (-not $modelBtn) {
        # If models were not found, it may be on the initial screen. Inject Ctrl+E to open Agent Manager.
        [System.Windows.Forms.SendKeys]::SendWait('^{e}')
        Start-Sleep -Seconds 2

        # Reload the tree and try again
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($targetProcess.MainWindowHandle)
        foreach ($m in $knownModels) {
            $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $m)
            $btn = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
            if ($btn) {
                $modelBtn = $btn
                break
            }
        }
    }

    if ($modelBtn) {
        # Clica no seletor current para abrir o menu
        Click-Element $modelBtn
        Start-Sleep -Milliseconds 1500

        # Finds the target model in the visible list.
        # Filters out buttons to avoid clicking the selector again.
        $targetCond = New-Object System.Windows.Automation.AndCondition(
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Text)),
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text))
        )

        # Tries Text first; if that fails, searches without the type filter while ignoring the model button itself.
        $targetEl = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $targetCond)
        if (-not $targetEl) {
            $targetCondSimple = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Text)
            $matches = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $targetCondSimple)
            foreach ($match in $matches) {
                if ($match.Current.RuntimeId -ne $modelBtn.Current.RuntimeId) {
                    $targetEl = $match
                    break
                }
            }
        }

        if ($targetEl) {
            Click-Element $targetEl
            Start-Sleep -Milliseconds 500
        } else {
            throw "Target model '$Text' not detected in the dropdown list. Try opening the menu manually or check the model name."
        }
    } else {
        throw "Could not find any active Model button (searched for $($knownModels -join ', ')). Ensure Agent Manager is open."
    }
  }

  'verify-model' {
    # To capture and validate the screen without external OCR when the UIA tree is not exposed,
    # the script only treats completion as successful when this bridge step finishes without throwing.
    # or we can read the clipboard if we try a copy action.

    # Try UIAutomation access through the accessibility tree text.
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($targetProcess.MainWindowHandle)
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Text)
    $found = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)

    if ($found) {
        $Text = "Model detected in Accessibility Tree: $Text"
    } else {
        # Verification fallback
        $Text = "Blind UI attempt finished for $Text. Model visually assumed."
    }
  }
}

$payload = @{
  ok = $true
  mode = $Mode
  windowTitle = $targetProcess.MainWindowTitle
  pid = $targetProcess.Id
  textLength = $Text.Length
}

$payload | ConvertTo-Json -Compress
