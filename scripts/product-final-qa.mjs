import { spawnSync } from 'child_process';

const argv = process.argv.slice(2);
const skipBuild = argv.includes('--skip-build');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const powershellCmd = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';

function quoteWindowsArg(value) {
  const normalized = String(value ?? '');
  if (!normalized || /[\s"]/u.test(normalized)) {
    return `"${normalized.replace(/"/g, '\\"')}"`;
  }
  return normalized;
}

function runStep(label, command, args, options = {}) {
  console.log(`\n[product-final-qa] ${label}`);
  const normalizedCommand = String(command);
  const result = process.platform === 'win32' && normalizedCommand.toLowerCase().endsWith('.cmd')
    ? spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `${quoteWindowsArg(normalizedCommand)} ${args.map(quoteWindowsArg).join(' ')}`],
      {
        stdio: 'inherit',
        shell: false,
        ...options,
      },
    )
    : spawnSync(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });
  if (result.error) {
    console.error(`[product-final-qa] falha ao executar ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!skipBuild) {
  runStep('build completo', npmCmd, ['run', 'build']);
}

runStep('zavorth control cockpit gate', npmCmd, ['run', 'qa:zavorthControl']);

runStep('testes criticos de produto', npxCmd, [
  'jest',
  'tests/services/WebConsoleAssetService.test.ts',
  'tests/services/ZavorthEvalControlPlaneService.test.ts',
  'tests/services/ZavorthEvalHistoryFileService.test.ts',
  'tests/services/ZavorthTelemetryLedgerService.test.ts',
  'tests/services/WebAppChannelMesh.test.ts',
  'tests/services/ZavorthHubControlPlaneService.test.ts',
  'tests/services/ZavorthHubActionService.test.ts',
  'tests/services/ZavorthTrustPlaneService.test.ts',
  'tests/services/ZavorthTrustPlaneActionService.test.ts',
  'tests/services/ZavorthQaControlPlaneService.test.ts',
  'tests/services/ZavorthGovernanceControlPlaneService.test.ts',
  'tests/services/ZavorthReplayLearningControlPlaneService.test.ts',
  'tests/services/ZavorthEcosystemControlPlaneService.test.ts',
  'tests/services/ZavorthDistributedRuntimeControlPlaneService.test.ts',
  'tests/services/ZavorthRuntimeStabilityControlPlaneService.test.ts',
  'tests/services/ZavorthRolloutReadinessControlPlaneService.test.ts',
  'tests/services/ZavorthNaturalSetupControlPlaneService.test.ts',
  'tests/services/ZavorthAutomationIntentService.test.ts',
  'tests/services/ZavorthAutomationControlPlaneService.test.ts',
  'tests/services/ZavorthAutomationActionService.test.ts',
  'tests/services/SchedulerService.test.ts',
  'tests/services/ZavorthWatchModeControlPlaneService.test.ts',
  'tests/services/ChannelInstallScaffoldService.test.ts',
  'tests/services/ChannelProviderDoctorService.test.ts',
  'tests/services/ChannelSetupAssistantService.test.ts',
  'tests/services/ComputerUseWatchModePolicyFileService.test.ts',
  'tests/services/ComputerUseWatchModeService.test.ts',
  'tests/domain/surface/SharedSurfaceCommandService.test.ts',
  'tests/domain/surface/presentation/web-app/WebAppSurfaceRouteService.test.ts',
  'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.test.ts',
  'tests/services/WebAppPublicApi.test.ts',
  'tests/services/WebAppConversationService.test.ts',
  'tests/services/SupervisedExecutionGatewayService.test.ts',
  'tests/services/SystemOverlordControlService.test.ts',
  'tests/services/SkillTrustPolicyService.test.ts',
  'tests/telegram/TelegramCommandRoutingService.test.ts',
  'tests/telegram/controllers/TelegramSchedulerController.test.ts',
  'tests/telegram/AuthGuard.test.ts',
  'tests/mcp/McpToolPolicy.test.ts',
  'tests/sdk/ZavorthTypeScriptSdk.test.ts',
  '--runInBand',
]);

if (process.platform === 'win32') {
  runStep('sintaxe dos launchers Windows', powershellCmd, [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    "$files = @('scripts\\install-windows-launcher.ps1','scripts\\install-windows-startup.ps1','scripts\\launch-zavorth-unified.ps1'); foreach ($file in $files) { $tokens = $null; $errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $file), [ref]$tokens, [ref]$errors) | Out-Null; if ($errors.Count -gt 0) { Write-Error \"$file has parser errors: $($errors | ForEach-Object { $_.Message } | Out-String)\"; exit 1 }; Write-Host \"$file OK\" }",
  ], { shell: false });
}

console.log(
  `\n[product-final-qa] Produto validado: ${
    skipBuild ? 'build ignorado nesta execucao, ' : 'build, '
  }cockpit, trust plane, watch mode, canais, hub/MCP, QA gates, governance/policy, replay/learning, ecossistema/SDKs, runtime distribuido, estabilidade supervisionada, rollout persistente, natural-first, automations/scheduled runs e System Overlord supervisionado passaram.`,
);
