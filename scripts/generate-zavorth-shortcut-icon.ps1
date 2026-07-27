$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$assetDir = Join-Path $projectRoot 'assets\launcher'
$pngPath = Join-Path $assetDir 'zavorth-shortcut.png'
$icoPath = Join-Path $assetDir 'zavorth-shortcut.ico'

New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rect,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2

  $path.AddArc($Rect.X, $Rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rect.X, $Rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  return $path
}

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)

$backgroundRect = New-Object System.Drawing.RectangleF 14, 14, 228, 228
$backgroundPath = New-RoundedRectanglePath -Rect $backgroundRect -Radius 52
$backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
  (New-Object System.Drawing.Point 0, 0),
  (New-Object System.Drawing.Point $size, $size),
  ([System.Drawing.ColorTranslator]::FromHtml('#0C1F1C')),
  ([System.Drawing.ColorTranslator]::FromHtml('#174C40'))
)
$graphics.FillPath($backgroundBrush, $backgroundPath)

$glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 110, 255, 200))
$graphics.FillEllipse($glowBrush, 30, 28, 150, 150)

$accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(26, 255, 215, 140))
$graphics.FillEllipse($accentBrush, 110, 120, 110, 88)

$fontShadow = New-Object System.Drawing.Font 'Segoe UI Black', 132, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$fontMain = New-Object System.Drawing.Font 'Segoe UI Black', 126, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
$letterBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225, 214, 197, 136))
$graphics.DrawString('B', $fontShadow, $shadowBrush, 49, 44)
$graphics.DrawString('B', $fontMain, $letterBrush, 42, 36)

$eyePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$eyePath.AddBezier(
  (New-Object System.Drawing.Point 122, 122),
  (New-Object System.Drawing.Point 154, 96),
  (New-Object System.Drawing.Point 208, 104),
  (New-Object System.Drawing.Point 222, 128)
)
$eyePath.AddBezier(
  (New-Object System.Drawing.Point 222, 128),
  (New-Object System.Drawing.Point 204, 154),
  (New-Object System.Drawing.Point 152, 162),
  (New-Object System.Drawing.Point 122, 122)
)
$eyePath.CloseFigure()

$eyeBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
  (New-Object System.Drawing.Point 122, 122),
  (New-Object System.Drawing.Point 222, 128),
  ([System.Drawing.ColorTranslator]::FromHtml('#F3D873')),
  ([System.Drawing.ColorTranslator]::FromHtml('#C9921F'))
)
$graphics.FillPath($eyeBrush, $eyePath)

$eyeBorder = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#4B3407'), 3)
$graphics.DrawPath($eyeBorder, $eyePath)

$pupilBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#111111'))
$graphics.FillEllipse($pupilBrush, 165, 108, 17, 39)

$highlightBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(170, 255, 248, 220))
$graphics.FillEllipse($highlightBrush, 151, 113, 18, 9)

$borderPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#D3A83E'), 4)
$graphics.DrawPath($borderPen, $backgroundPath)

$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
$memoryStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($memoryStream)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]1)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]32)
$writer.Write([UInt32]$pngBytes.Length)
$writer.Write([UInt32]22)
$writer.Write($pngBytes)
[System.IO.File]::WriteAllBytes($icoPath, $memoryStream.ToArray())

$writer.Dispose()
$memoryStream.Dispose()
$backgroundBrush.Dispose()
$glowBrush.Dispose()
$accentBrush.Dispose()
$shadowBrush.Dispose()
$letterBrush.Dispose()
$eyeBrush.Dispose()
$eyeBorder.Dispose()
$pupilBrush.Dispose()
$highlightBrush.Dispose()
$borderPen.Dispose()
$fontShadow.Dispose()
$fontMain.Dispose()
$backgroundPath.Dispose()
$eyePath.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Host 'Icones do launcher generated com success:'
Write-Host $pngPath
Write-Host $icoPath
