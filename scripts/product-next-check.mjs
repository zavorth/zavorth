import { spawnSync } from 'child_process';

const suiteArg = process.argv.find((entry) => entry.startsWith('--suite='));
const selectedSuite = suiteArg ? String(suiteArg.split('=')[1] || '').trim() : 'all';
const skipBuild = process.argv.includes('--skip-build');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runNpm(args) {
  const result = process.platform === 'win32'
    ? spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `npm ${args.map(escapeWindowsArg).join(' ')}`],
      {
        stdio: 'inherit',
        shell: false,
        cwd: process.cwd(),
        env: process.env,
      },
    )
    : spawnSync(npmCommand, args, {
      stdio: 'inherit',
      shell: false,
      cwd: process.cwd(),
      env: process.env,
    });
  if (result.error) {
    console.error(`[product-next-check] falha ao executar ${npmCommand} ${args.join(' ')}:`, result.error.message);
  }
  return result;
}

function escapeWindowsArg(value) {
  const normalized = String(value);
  if (!/[ \t"]/u.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`;
}

const suites = {
  'product-modes': [
    'tests/services/ProductModeService.test.ts',
    'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.test.ts',
    'tests/services/ZavorthGatewayControlSocketService.test.ts',
  ],
  'mode-escalation': [
    'tests/services/ModeEscalationService.test.ts',
    'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.test.ts',
    'tests/services/ZavorthGatewayControlSocketService.test.ts',
  ],
  desktop: [
    'tests/services/DesktopResourcePlaneService.test.ts',
    'tests/services/TaskResourcePlannerService.test.ts',
  ],
  companions: [
    'tests/services/CompanionControlService.test.ts',
    'tests/services/CompanionWorkspaceOptimizerService.test.ts',
    'tests/domain/surface/SharedSurfaceCommandService.test.ts',
  ],
  'runtime-hardened': [
    'tests/services/RuntimeInstallJourneyService.test.ts',
    'tests/services/RuntimeLauncherInstallService.test.ts',
    'tests/services/RuntimeAccessManifestService.test.ts',
    'tests/services/LocalCloudflareRolloutService.test.ts',
    'tests/apps/onboarding/cli-guide.test.ts',
  ],
  'ui-control': [
    'tests/services/WebConsoleAssetService.test.ts',
    'tests/services/WebAppGatewaySessions.test.ts',
    'tests/services/ZavorthGatewayControlSocketService.test.ts',
  ],
  'control-ui': [
    'tests/services/WebConsoleAssetService.test.ts',
    'tests/services/WebAppGatewaySessions.test.ts',
    'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.test.ts',
    'tests/services/ZavorthGatewayControlSocketService.test.ts',
  ],
  'telegram-web-parity': [
    'tests/integration/CrossSurfaceContinuity.test.ts',
    'tests/services/WebAppGatewaySessions.test.ts',
    'tests/telegram/TelegramChannelContractService.test.ts',
    'tests/telegram/controllers/TelegramConversationStateService.test.ts',
  ],
  'memory-hybrid': [
    'tests/services/HybridMemoryService.test.ts',
    'tests/storage/MemoryVectorStore.test.ts',
    'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.test.ts',
    'tests/services/ZavorthGatewayControlSocketService.test.ts',
  ],
  'legacy-compat': [
    'tests/services/LegacySurfaceContainmentService.test.ts',
    'tests/services/RuntimeAccessManifestService.test.ts',
    'tests/services/WebConsoleAssetService.test.ts',
  ],
  'selfmod-optimization': [
    'tests/services/SelfmodImpactAnalyzer.test.ts',
    'tests/services/SelfModificationCommandService.test.ts',
    'tests/domain/surface/SharedSurfaceCommandService.test.ts',
    'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.test.ts',
  ],
};

const aggregateSuites = {
  'product-experience': [
    'tests/services/ProductModeService.test.ts',
    'tests/services/ModeEscalationService.test.ts',
    'tests/services/WebConsoleAssetService.test.ts',
    'tests/services/WebAppGatewaySessions.test.ts',
    'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.test.ts',
    'tests/services/ZavorthGatewayControlSocketService.test.ts',
    'tests/integration/CrossSurfaceContinuity.test.ts',
    'tests/services/HybridMemoryService.test.ts',
    'tests/storage/MemoryVectorStore.test.ts',
    'tests/services/LegacySurfaceContainmentService.test.ts',
    'tests/services/RuntimeAccessManifestService.test.ts',
  ],
};

const requestedSuites = selectedSuite === 'all'
  ? Object.keys(suites)
  : [selectedSuite];

for (const suiteName of requestedSuites) {
  const tests = suites[suiteName] || aggregateSuites[suiteName];
  if (!tests) {
    console.error(`[product-next-check] suite invalida: ${suiteName}`);
    process.exit(1);
  }
}

if (!skipBuild) {
  console.log('[product-next-check] build');
  const buildResult = runNpm(['run', 'build', '--silent']);
  if (buildResult.status !== 0) {
    process.exit(buildResult.status || 1);
  }
} else {
  console.log('[product-next-check] build ignorado (--skip-build)');
}

for (const suiteName of requestedSuites) {
  const tests = suites[suiteName] || aggregateSuites[suiteName];
  console.log(`[product-next-check] suite ${suiteName}`);
  const testResult = runNpm(['test', '--', ...tests, '--runInBand']);
  if (testResult.status !== 0) {
    process.exit(testResult.status || 1);
  }
}

console.log('[product-next-check] todas as suites solicitadas passaram.');
