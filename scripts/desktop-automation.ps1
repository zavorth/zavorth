param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('focus-window', 'click-element', 'type-text', 'press-key', 'screenshot', 'list-elements')]
  [string]$Action,

  [string]$WindowTitle = '',

  [int]$ProcessId = 0,

  [string]$TargetText = '',

  [string]$Payload = '',

  [string]$OutputPath = '',

  [int]$TimeoutMs = 10000
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
using System;
using System.Runtime.InteropServices;

public static class DesktopAutomationNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll", CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
Add-Type -TypeDefinition $signature -Language CSharp -ErrorAction SilentlyContinue

$MOUSEEVENTF_LEFTDOWN = 0x02
$MOUSEEVENTF_LEFTUP = 0x04

# ── Helpers ──

function Find-TargetProcess([string]$Title, [int]$TargetPid) {
  if ($TargetPid -gt 0) {
    $candidate = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 }
    if ($candidate) { return $candidate }
  }

  if (-not [string]::IsNullOrWhiteSpace($Title)) {
    $candidates = Get-Process -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowTitle -like "*$Title*" -and $_.MainWindowHandle -ne 0 }

    if ($candidates) {
      return $candidates |
        Sort-Object StartTime -Descending |
        Select-Object -First 1
    }
  }

  return $null
}

function Activate-Window($TargetProcess) {
  try {
    [DesktopAutomationNative]::ShowWindow($TargetProcess.MainWindowHandle, 9) | Out-Null
    [DesktopAutomationNative]::SetForegroundWindow($TargetProcess.MainWindowHandle) | Out-Null
    Start-Sleep -Milliseconds 300
    return $true
  } catch {
    try {
      [Microsoft.VisualBasic.Interaction]::AppActivate($TargetProcess.Id)
      Start-Sleep -Milliseconds 300
      return $true
    } catch {
      return $false
    }
  }
}

function Get-UiRoot($TargetProcess) {
  return [System.Windows.Automation.AutomationElement]::FromHandle($TargetProcess.MainWindowHandle)
}

function Click-AtElement($Element) {
  if ($null -eq $Element) { return $false }
  try {
    $rect = $Element.Current.BoundingRectangle
    $x = [int]($rect.Left + ($rect.Width / 2))
    $y = [int]($rect.Top + ($rect.Height / 2))
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
    Start-Sleep -Milliseconds 80
    [DesktopAutomationNative]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
    [DesktopAutomationNative]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
    return $true
  } catch {
    return $false
  }
}

function Find-ElementByText($Root, [string]$Text) {
  if ($null -eq $Root -or [string]::IsNullOrWhiteSpace($Text)) { return $null }

  # Exact match first
  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    $Text
  )
  $exact = $Root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
  if ($exact) { return $exact }

  # Partial / case-insensitive scan
  $trueCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::IsEnabledProperty,
    $true
  )
  $all = $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $trueCondition)
  if ($null -eq $all) { return $null }

  $lowerText = $Text.ToLowerInvariant()
  $bestMatch = $null
  $bestArea = [double]::MaxValue

  for ($i = 0; $i -lt $all.Count; $i++) {
    $el = $all.Item($i)
    try {
      $name = [string]$el.Current.Name
      if ([string]::IsNullOrWhiteSpace($name)) { continue }

      $rect = $el.Current.BoundingRectangle
      if ($rect.Width -le 2 -or $rect.Height -le 2) { continue }

      if ($name.ToLowerInvariant() -like "*$lowerText*") {
        $area = [double]($rect.Width * $rect.Height)
        if ($area -lt $bestArea) {
          $bestArea = $area
          $bestMatch = $el
        }
      }
    } catch { continue }
  }

  return $bestMatch
}

function Get-VisibleElements($Root) {
  $results = @()
  if ($null -eq $Root) { return $results }

  $trueCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::IsEnabledProperty,
    $true
  )
  $all = $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $trueCondition)
  if ($null -eq $all) { return $results }

  for ($i = 0; $i -lt $all.Count; $i++) {
    $el = $all.Item($i)
    try {
      $name = [string]$el.Current.Name
      if ([string]::IsNullOrWhiteSpace($name)) { continue }

      $rect = $el.Current.BoundingRectangle
      if ($rect.Width -le 2 -or $rect.Height -le 2) { continue }

      $controlType = [string]$el.Current.ControlType.ProgrammaticName
      $results += [pscustomobject]@{
        Name = $name
        ControlType = $controlType
        Left = [int]$rect.Left
        Top = [int]$rect.Top
        Width = [int]$rect.Width
        Height = [int]$rect.Height
      }
    } catch { continue }
  }

  return $results
}

function Capture-WindowScreenshot($TargetProcess, [string]$Path) {
  $rect = New-Object DesktopAutomationNative+RECT
  if (-not [DesktopAutomationNative]::GetWindowRect($TargetProcess.MainWindowHandle, [ref]$rect)) {
    throw "Could not get window rectangle."
  }

  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  if ($width -lt 50 -or $height -lt 50) {
    throw "Window too small to capture."
  }

  $parent = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }

  Start-Sleep -Milliseconds 350

  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($width, $height)))
  } finally {
    $graphics.Dispose()
  }
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()

  return @{
    width = $width
    height = $height
  }
}

# ── Main ──

function Test-BlockedWindowTitle([string]$Title) {
  if ([string]::IsNullOrWhiteSpace($Title)) { return $false }
  $patterns = @(
    '\bexecutar\b',
    '\brun\b',
    '\bwindows\s+power\s*shell\b',
    '\bpowershell\b',
    '\bpwsh\b',
    '\bprompt\s+de\s+comando\b',
    '\bcommand\s+prompt\b',
    '\bcmd(...:\.exe)...\b',
    '\bwindows\s+terminal\b',
    '\bterminal\b',
    '\bconhost\b',
    '\bwsl\b',
    '\bbash\b'
  )
  foreach ($pattern in $patterns) {
    if ($Title -match $pattern) { return $true }
  }
  return $false
}

function Test-BlockedPressKeyPayload([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  $patterns = @(
    '\bwin(...:dows)...\s*\+\s*r\b',
    '\{(...:lwin|rwin|win|windows)\}',
    '#\s*r',
    '^\s*\^\s*\{...esc(...:ape)...\}...\s*$'
  )
  foreach ($pattern in $patterns) {
    if ($Value -match $pattern) { return $true }
  }
  return $false
}

$result = [ordered]@{
  ok = $false
  action = $Action
  windowTitle = $null
  pid = $null
  message = $null
  details = $null
}

try {
  $targetProcess = Find-TargetProcess -Title $WindowTitle -Pid $ProcessId
  if (-not $targetProcess) {
    throw "Window not found: WindowTitle='$WindowTitle', ProcessId=$ProcessId"
  }

  $result.windowTitle = $targetProcess.MainWindowTitle
  $result.pid = $targetProcess.Id

  if (Test-BlockedWindowTitle $targetProcess.MainWindowTitle) {
    throw "Desktop automation blocked: sensitive window or console cannot be targeted ('$($targetProcess.MainWindowTitle)')."
  }

  if ($Action -eq 'press-key' -and (Test-BlockedPressKeyPayload $Payload)) {
    throw "Desktop automation blocked: launcher/shell shortcut is not allowed."
  }

  $activated = Activate-Window $targetProcess
  if (-not $activated) {
    throw "Could not activate window '$($targetProcess.MainWindowTitle)'."
  }

  switch ($Action) {
    'focus-window' {
      $result.ok = $true
      $result.message = "Janela '$($targetProcess.MainWindowTitle)' ativada com success."
    }

    'click-element' {
      if ([string]::IsNullOrWhiteSpace($TargetText)) {
        throw "Parametro TargetText required para click-element."
      }

      $root = Get-UiRoot $targetProcess
      $element = Find-ElementByText $root $TargetText
      if (-not $element) {
        throw "Element with text '$TargetText' not found in window '$($targetProcess.MainWindowTitle)'."
      }

      $clicked = Click-AtElement $element
      if (-not $clicked) {
        throw "Failure ao clicar no elemento '$TargetText'."
      }

      $result.ok = $true
      $result.message = "Clique executado no elemento '$TargetText'."
      $result.details = @{
        elementName = [string]$element.Current.Name
        controlType = [string]$element.Current.ControlType.ProgrammaticName
      }
    }

    'type-text' {
      if ([string]::IsNullOrWhiteSpace($Payload)) {
        throw "Parametro Payload required para type-text."
      }

      Set-Clipboard -Value $Payload
      Start-Sleep -Milliseconds 150
      [System.Windows.Forms.SendKeys]::SendWait('^v')
      Start-Sleep -Milliseconds 100

      $result.ok = $true
      $result.message = "Texto colado com success ($($Payload.Length) caracteres)."
    }

    'press-key' {
      if ([string]::IsNullOrWhiteSpace($Payload)) {
        throw "Parametro Payload required para press-key (ex: '{ENTER}', '^s', '%{F4}')."
      }

      [System.Windows.Forms.SendKeys]::SendWait($Payload)
      Start-Sleep -Milliseconds 100

      $result.ok = $true
      $result.message = "Tecla '$Payload' enviada com success."
    }

    'screenshot' {
      $screenshotPath = $OutputPath
      if ([string]::IsNullOrWhiteSpace($screenshotPath)) {
        $screenshotPath = [System.IO.Path]::Combine(
          [System.IO.Path]::GetTempPath(),
          "zavorth-desktop-capture-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).png"
        )
      }

      $dimensions = Capture-WindowScreenshot $targetProcess $screenshotPath

      $result.ok = $true
      $result.message = "Screenshot salvo em '$screenshotPath'."
      $result.details = @{
        screenshotPath = $screenshotPath
        width = $dimensions.width
        height = $dimensions.height
      }
    }

    'list-elements' {
      $root = Get-UiRoot $targetProcess
      $elements = Get-VisibleElements $root

      $result.ok = $true
      $result.message = "$($elements.Count) elementos visiveis encontrados."
      $result.details = @{
        elementCount = $elements.Count
        elements = @($elements | Select-Object -First 60 | ForEach-Object {
          @{
            name = $_.Name
            type = $_.ControlType
            x = $_.Left
            y = $_.Top
            w = $_.Width
            h = $_.Height
          }
        })
      }
    }
  }
} catch {
  $result.message = $_.Exception.Message
}

$result | ConvertTo-Json -Depth 5 -Compress
