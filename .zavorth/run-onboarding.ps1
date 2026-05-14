param()
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
npm run onboarding:start -- --profile operator --base-url http://127.0.0.1:33333
