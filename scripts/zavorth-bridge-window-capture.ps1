param(
  [string]$WindowTitle = 'ZavorthBridge',
  [int]$ProcessId = 0,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

$signature = @"
using System;
using System.Runtime.InteropServices;

public static class Win32Capture {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@

Add-Type -TypeDefinition $signature -Language CSharp

function Get-ZavorthBridgeProcess([int]$ExpectedPid, [string]$ExpectedTitle) {
  if ($ExpectedPid -gt 0) {
    $candidate = Get-Process -Id $ExpectedPid -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
    if ($candidate) {
      return $candidate
    }
  }

  $candidates = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.ProcessName -match 'ZavorthBridge' -or $_.MainWindowTitle -like "*$ExpectedTitle*") -and $_.MainWindowHandle -ne 0
  }

  if (-not $candidates) {
    return $null
  }

  $best = $candidates |
    Where-Object { $_.MainWindowTitle -like "*$ExpectedTitle*" } |
    Sort-Object StartTime -Descending |
    Select-Object -First 1

  if ($best) {
    return $best
  }

  return $candidates | Sort-Object StartTime -Descending | Select-Object -First 1
}

function Activate-TargetWindow($TargetProcess) {
  try {
    [Microsoft.VisualBasic.Interaction]::AppActivate($TargetProcess.Id) | Out-Null
    Start-Sleep -Milliseconds 250
  } catch {
    Start-Sleep -Milliseconds 250
  }
}

function Ensure-ParentDirectory([string]$PathValue) {
  $parent = Split-Path -Parent $PathValue
  if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
}

$result = [ordered]@{
  ok = $false
  screenshotPath = $OutputPath
  captureMethod = $null
  processId = $null
  windowTitle = $null
  width = 0
  height = 0
  error = $null
}

try {
  $targetProcess = Get-ZavorthBridgeProcess -ExpectedPid $ProcessId -ExpectedTitle $WindowTitle
  if (-not $targetProcess) {
    throw "ZavorthBridge window not found."
  }

  Activate-TargetWindow $targetProcess

  $rect = New-Object Win32Capture+RECT
  if (-not [Win32Capture]::GetWindowRect($targetProcess.MainWindowHandle, [ref]$rect)) {
    throw "Could not get ZavorthBridge window rect."
  }

  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  if ($width -lt 50 -or $height -lt 50) {
    throw "ZavorthBridge window rect is too small to capture."
  }

  Ensure-ParentDirectory $OutputPath

  Start-Sleep -Milliseconds 500

  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen(
      $rect.Left,
      $rect.Top,
      0,
      0,
      (New-Object System.Drawing.Size($width, $height))
    )
  } finally {
    $graphics.Dispose()
  }
  $result.captureMethod = 'CopyFromScreen'

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()

  $result.ok = $true
  $result.processId = $targetProcess.Id
  $result.windowTitle = $targetProcess.MainWindowTitle
  $result.width = $width
  $result.height = $height
} catch {
  $result.error = $_.Exception.Message
}

$result | ConvertTo-Json -Depth 5 -Compress
