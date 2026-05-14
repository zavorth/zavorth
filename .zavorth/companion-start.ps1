param()
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
npm run companion:start -- --passcode desktop-a:PAIR123 --base-url http://127.0.0.1:33333 --node-id desktop-a
