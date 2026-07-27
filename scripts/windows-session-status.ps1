Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class DesktopApi {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool CloseDesktop(IntPtr hDesktop);

  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
  public static extern bool GetUserObjectInformation(
    IntPtr hObj,
    int nIndex,
    StringBuilder pvInfo,
    int nLength,
    ref int lpnLengthNeeded
  );
}
"@

$DESKTOP_READOBJECTS = 0x0001
$UOI_NAME = 2

function Get-InputDesktopName {
  $handle = [DesktopApi]::OpenInputDesktop(0, $false, $DESKTOP_READOBJECTS)
  if ($handle -eq [IntPtr]::Zero) {
    return @{
      desktopName = $null
      errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    }
  }

  try {
    $sb = New-Object System.Text.StringBuilder 256
    $needed = 0
    $ok = [DesktopApi]::GetUserObjectInformation($handle, $UOI_NAME, $sb, $sb.Capacity, [ref]$needed)
    if (-not $ok) {
      return @{
        desktopName = $null
        errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      }
    }

    return @{
      desktopName = $sb.ToString()
      errorCode = $null
    }
  } finally {
    [void][DesktopApi]::CloseDesktop($handle)
  }
}

$sessionId = (Get-Process -Id $PID).SessionId
$desktopInfo = Get-InputDesktopName
$desktopName = if ($desktopInfo.desktopName) { [string]$desktopInfo.desktopName } else { $null }
$explorerRunning = @(Get-Process explorer -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $sessionId }).Count -gt 0
$accessible = $desktopName -eq 'Default'
$lockedLikely = $desktopName -and $desktopName -ne 'Default'

$message =
  if ($accessible) {
    'Windows session is accessible for UI automation.'
  } elseif ($lockedLikely) {
    "A session parece estar outside do desktop interactive (desktop current: $desktopName)."
  } elseif (-not $explorerRunning) {
    'explorer.exe was not found in this session; the desktop may not be ready.'
  } else {
    'Could not confirm that the Windows session is accessible for automation.'
  }

[pscustomobject]@{
  ok = $true
  accessible = $accessible
  lockedLikely = [bool]$lockedLikely
  desktopName = $desktopName
  explorerRunning = $explorerRunning
  sessionId = $sessionId
  errorCode = $desktopInfo.errorCode
  message = $message
} | ConvertTo-Json -Compress
