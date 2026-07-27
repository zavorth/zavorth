Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $root 'assets\\telegram'
$outputPath = Join-Path $assetsDir 'zavorth-hub.png'

New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null

$width = 1600
$height = 900
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$backgroundRect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
$gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $backgroundRect,
  [System.Drawing.Color]::FromArgb(255, 14, 22, 32),
  [System.Drawing.Color]::FromArgb(255, 30, 52, 74),
  35
)
$graphics.FillRectangle($gradient, $backgroundRect)

$orbBrushA = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(54, 68, 202, 255))
$orbBrushB = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(38, 255, 94, 77))
$orbBrushC = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 255, 209, 102))
$graphics.FillEllipse($orbBrushA, 980, -140, 640, 640)
$graphics.FillEllipse($orbBrushB, -160, 560, 620, 620)
$graphics.FillEllipse($orbBrushC, 1040, 520, 420, 420)

$cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(164, 9, 14, 20))
$cardPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(86, 126, 223, 255), 2)
$cardRect = New-Object System.Drawing.Rectangle 92, 112, 1416, 676
$graphics.FillRectangle($cardBrush, $cardRect)
$graphics.DrawRectangle($cardPen, $cardRect)

$accentPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 132, 74), 8)
$graphics.DrawLine($accentPen, 120, 162, 462, 162)

$titleFont = New-Object System.Drawing.Font 'Segoe UI Semibold', 54
$subtitleFont = New-Object System.Drawing.Font 'Segoe UI', 20
$labelFont = New-Object System.Drawing.Font 'Segoe UI Semibold', 18
$bodyFont = New-Object System.Drawing.Font 'Segoe UI', 24
$smallFont = New-Object System.Drawing.Font 'Segoe UI', 16

$titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 243, 246, 249))
$mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 178, 190, 204))
$accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 158, 97))
$chipBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 19, 32, 45))
$chipTextBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 173, 229, 255))

$graphics.DrawString('ZAVORTH CONTROL', $titleFont, $titleBrush, 118, 184)
$graphics.DrawString(
  'local assistant for code, WSL, visual automation, and contained permissions.',
  $subtitleFont,
  $mutedBrush,
  122,
  264
)

$chipRects = @(
  @{ X = 122; Y = 334; W = 232; H = 58; Text = 'Codex local' },
  @{ X = 372; Y = 334; W = 262; H = 58; Text = 'Executor external' },
  @{ X = 652; Y = 334; W = 292; H = 58; Text = 'ZavorthBridge assistido' }
)

foreach ($chip in $chipRects) {
  $rect = New-Object System.Drawing.Rectangle $chip.X, $chip.Y, $chip.W, $chip.H
  $graphics.FillRectangle($chipBrush, $rect)
  $graphics.DrawString($chip.Text, $labelFont, $chipTextBrush, ($chip.X + 18), ($chip.Y + 15))
}

$bodyLines = @(
  '- Planeja before agir',
  '- Shows risks and requests approval',
  '- Divide commands por rota certa',
  '- Keeps visual and operation in the same hub'
)

$lineY = 446
foreach ($line in $bodyLines) {
  $graphics.DrawString($line, $bodyFont, $titleBrush, 124, $lineY)
  $lineY += 54
}

$graphics.DrawString('Clean hub, direct text, clear buttons, and ready recipes.', $subtitleFont, $accentBrush, 124, 688)
$graphics.DrawString('Telegram | Zavorth | 2026 redesign', $smallFont, $mutedBrush, 124, 736)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()
$gradient.Dispose()
$orbBrushA.Dispose()
$orbBrushB.Dispose()
$orbBrushC.Dispose()
$cardBrush.Dispose()
$cardPen.Dispose()
$accentPen.Dispose()
$titleFont.Dispose()
$subtitleFont.Dispose()
$labelFont.Dispose()
$bodyFont.Dispose()
$smallFont.Dispose()
$titleBrush.Dispose()
$mutedBrush.Dispose()
$accentBrush.Dispose()
$chipBrush.Dispose()
$chipTextBrush.Dispose()

Write-Output $outputPath
