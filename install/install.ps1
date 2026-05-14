param (
    [ValidateSet("Dev", "Operator")]
    [string]$Profile = "Dev",
    [string]$Workspace = "",
    [string]$BaseUrl = "http://127.0.0.1:33333",
    [string]$PairingToken = "",
    [string]$NodeId = "",
    [switch]$SkipDependencies,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-Section([string]$Message) {
    Write-Host ""
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Step([string]$Message) {
    Write-Host ("- " + $Message) -ForegroundColor Gray
}

function Require-Command([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Dependencia obrigatoria ausente: $Name"
    }
    return $command.Source
}

function Invoke-WorkspaceCommand([string]$Executable, [string[]]$Arguments, [string]$WorkingDirectory) {
    Write-Step ("Executando: " + $Executable + " " + ($Arguments -join " "))
    Push-Location $WorkingDirectory
    try {
        & $Executable @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao executar: $Executable $($Arguments -join ' ')"
        }
    } finally {
        Pop-Location
    }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = if ($Workspace) { (Resolve-Path $Workspace).Path } else { (Resolve-Path (Join-Path $scriptRoot "..")).Path }
$runtimeRoot = Join-Path $repoRoot "data\\runtime"
$localConfigRoot = Join-Path $repoRoot ".zavorth"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Zavorth - Ecosystem Installer v2.0      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Section "Preflight"
Write-Step ("Workspace: " + $repoRoot)
Write-Step ("Perfil: " + $Profile)
Write-Step ("Base URL: " + $BaseUrl)

$normalizedProfile = $Profile.ToLowerInvariant()
$shellUrl = ($BaseUrl.TrimEnd('/')) + '/control'
$legacyShellUrl = ($BaseUrl.TrimEnd('/')) + '/app'

if (-not (Test-Path (Join-Path $repoRoot "package.json"))) {
    throw "Nao encontrei package.json no workspace informado."
}

$nodeExe = Require-Command "node"
$npmExe = Require-Command "npm"
Write-Step ("Node: " + $nodeExe)
Write-Step ("npm: " + $npmExe)

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $localConfigRoot | Out-Null
Write-Step "Diretorios de runtime e configuracao prontos."

if (-not $SkipDependencies) {
    Write-Section "Dependencias"
    if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
        Invoke-WorkspaceCommand $npmExe @("install") $repoRoot
    } else {
        Write-Step "node_modules ja presente; pulando npm install."
    }
} else {
    Write-Section "Dependencias"
    Write-Step "SkipDependencies ativo; npm install nao sera executado."
}

if (-not $SkipBuild) {
    Write-Section "Build"
    Invoke-WorkspaceCommand $npmExe @("run", "build", "--silent") $repoRoot
} else {
    Write-Section "Build"
    Write-Step "SkipBuild ativo; compilacao pulada."
}

$guideFile = Join-Path $localConfigRoot "onboarding-guide.txt"
$guideLines = @(
    "Zavorth Onboarding Guide",
    "Workspace: <repo-root>",
    "Profile: $Profile",
    "Base URL: $BaseUrl",
    "Control UI URL: $shellUrl",
    "Legacy shell URL: $legacyShellUrl",
    "",
    "Comando guiado:",
    "  npm run onboarding:start -- --profile $normalizedProfile --base-url $BaseUrl",
    ""
)
if ($Profile -eq "Dev") {
    $guideLines += @(
        "Passos sugeridos:",
        "  1. npm run cli:fast -- status --json",
        "  2. npm run test:smoke",
        "  3. npm run qa:bench:boot",
        "  4. npm run qa:regression",
        "  5. Abra $BaseUrl/control"
    )
} else {
    $guideLines += @(
        "Passos sugeridos:",
        "  1. npm run ops:ready",
        "  2. npm run cli:fast -- doctor --json",
        "  3. npm run cli:fast -- nodepair desktop MeuDesktop",
        "  4. Use .zavorth\\companion-start.ps1 quando houver PairingToken",
        "  5. npm run test:nodes:smoke"
    )
}
$guideLines | Set-Content -Path $guideFile -Encoding UTF8

$escapedRepoRoot = $repoRoot.Replace("'", "''")
$onboardingScriptPath = Join-Path $localConfigRoot "run-onboarding.ps1"
@(
    "param()",
    '$ErrorActionPreference = "Stop"',
    '$repoRoot = Split-Path -Parent $PSScriptRoot',
    'Set-Location -LiteralPath $repoRoot',
    "npm run onboarding:start -- --profile $normalizedProfile --base-url $BaseUrl"
) | Set-Content -Path $onboardingScriptPath -Encoding UTF8

$openShellScriptPath = Join-Path $localConfigRoot "open-web-shell.ps1"
@(
    "param()",
    '$ErrorActionPreference = "Stop"',
    "Start-Process '$shellUrl'"
) | Set-Content -Path $openShellScriptPath -Encoding UTF8

Write-Section "Perfil"
if ($Profile -eq "Dev") {
    Write-Step "CLI rapida pronta: npm run cli:fast -- status --json"
    Write-Step "Smoke principal: npm run test:smoke"
    Write-Step "Control UI: npm run ops:start"
} else {
    Write-Step "Daemon supervisionado: npm run launcher:supervised"
    Write-Step "Health operacional: npm run ops:ready"
    Write-Step "Node Mesh doctor: npm run nodes:doctor"
}

$companionScriptPath = Join-Path $localConfigRoot "companion-start.ps1"
if ($PairingToken) {
    Write-Section "Companion"
    $resolvedNodeId = if ($NodeId) { $NodeId } else { (($PairingToken -split '[:|#]')[0]) }
    $companionArgs = @(
        "run", "companion:start", "--",
        "--passcode", $PairingToken,
        "--base-url", $BaseUrl
    )
    if ($resolvedNodeId) {
        $companionArgs += @("--node-id", $resolvedNodeId)
    }
    $renderedArgs = $companionArgs | ForEach-Object {
        if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
    }
    $companionCommand = "npm " + ($renderedArgs -join " ")

    $escapedRepoRoot = $repoRoot.Replace("'", "''")

    @(
        "param()",
        '$ErrorActionPreference = "Stop"',
        '$repoRoot = Split-Path -Parent $PSScriptRoot',
        'Set-Location -LiteralPath $repoRoot',
        $companionCommand
    ) | Set-Content -Path $companionScriptPath -Encoding UTF8

    Write-Step ("Companion pronto para bootstrap: " + $companionCommand)
    Write-Step ("Launcher salvo em: " + $companionScriptPath)
} else {
    Write-Section "Companion"
    Write-Step "Nenhum PairingToken informado."
    Write-Step "Quando gerar um pairing draft, rode:"
    Write-Host '  npm run companion:start -- --passcode "<nodeId:pairingCode>" --base-url http://127.0.0.1:33333' -ForegroundColor White
}

$installSummary = [ordered]@{
    profile = $Profile
    workspace = $repoRoot
    baseUrl = $BaseUrl
    shellUrl = $shellUrl
    pairingToken = if ($PairingToken) { $PairingToken } else { $null }
    nodeId = if ($NodeId) { $NodeId } else { $null }
    guideFile = $guideFile
    onboardingCommand = "npm run onboarding:start -- --profile $normalizedProfile --base-url $BaseUrl"
    onboardingScript = $onboardingScriptPath
    openShellScript = $openShellScriptPath
    companionLauncher = if (Test-Path $companionScriptPath) { $companionScriptPath } else { $null }
    installedAt = (Get-Date).ToString("o")
}
$summaryFile = Join-Path $runtimeRoot "install-last.json"
$installSummary | ConvertTo-Json -Depth 4 | Set-Content -Path $summaryFile -Encoding UTF8

Write-Section "Resumo"
Write-Step ("Resumo salvo em: " + $summaryFile)
Write-Step ("Guia salvo em: " + $guideFile)
Write-Step ("Atalho onboarding: " + $onboardingScriptPath)
Write-Step ("Atalho Control UI: " + $openShellScriptPath)
Write-Host ""
Write-Host "Instalacao concluida." -ForegroundColor Green
Write-Host "Proximo passo sugerido:" -ForegroundColor White
if ($Profile -eq "Dev") {
    Write-Host "  npm run cli:fast -- status --json" -ForegroundColor White
} else {
    Write-Host "  npm run ops:ready" -ForegroundColor White
}
Write-Host "Guia interativo:" -ForegroundColor White
Write-Host ("  npm run onboarding:start -- --profile " + $normalizedProfile + " --base-url " + $BaseUrl) -ForegroundColor White
Write-Host "Abrir Control UI:" -ForegroundColor White
Write-Host ("  " + $shellUrl) -ForegroundColor White
