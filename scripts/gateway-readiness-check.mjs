import { spawnSync } from 'child_process';

const gateArg = process.argv.find((entry) => entry.startsWith('--gate=') || entry.startsWith('--stage='));
const gate = gateArg ? Number(gateArg.split('=')[1]) : null;

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
    console.error(`[gateway-check] failure ao run ${npmCommand} ${args.join(' ')}:`, result.error.message);
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

const webAppRuntimeRouteTests = [
  'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.control.test.ts',
  'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.experimental.test.ts',
  'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.install.test.ts',
  'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.state.test.ts',
];

const gateTests = {
  1: [
    'tests/services/ZavorthGatewayControlSocketService.test.ts',
    'tests/services/GatewaySessionLedgerService.test.ts',
    'tests/services/GatewaySessionReadModelService.test.ts',
    'tests/services/GatewaySessionService.test.ts',
  ],
  2: [
    'tests/services/GatewaySessionReadModelService.test.ts',
    'tests/services/GatewaySessionService.test.ts',
    'tests/services/WebAppGatewaySessions.test.ts',
  ],
  3: [
    'tests/services/ZavorthGatewayControlSocketService.test.ts',
    ...webAppRuntimeRouteTests,
  ],
  4: [
    'tests/services/CapabilityLifecycleService.test.ts',
    'tests/services/TrustDecisionService.test.ts',
    'tests/services/SelfModificationCommandService.test.ts',
    ...webAppRuntimeRouteTests,
  ],
  5: [
    'tests/services/GatewaySessionService.test.ts',
    'tests/services/WebConsoleAssetService.test.ts',
    'tests/services/WebAppGatewaySessions.test.ts',
  ],
  6: [
    'tests/services/WebConsoleAssetService.test.ts',
    'tests/services/WebAppGatewaySessions.test.ts',
    'tests/services/ZavorthGatewayControlSocketService.test.ts',
  ],
  7: [
    'tests/services/ContextResolverService.test.ts',
    'tests/services/WorkspaceProfileService.test.ts',
    'tests/services/EngineeringContextService.test.ts',
  ],
  8: [
    'tests/services/ExperimentalSessionV2Service.test.ts',
    'tests/services/ExperimentalSwarmV2Service.test.ts',
    ...webAppRuntimeRouteTests,
  ],
};

const gates = gate ? [gate] : [1, 2, 3, 4, 5, 6, 7, 8];

for (const selectedGate of gates) {
  const tests = gateTests[selectedGate];
  if (!tests) {
    console.error(`[gateway-check] gate invalid: ${selectedGate}`);
    process.exit(1);
  }

  console.log(`[gateway-check] gate ${selectedGate}: build`);
  const buildResult = runNpm(['run', 'build', '--silent']);
  if (buildResult.status !== 0) {
    process.exit(buildResult.status || 1);
  }

  console.log(`[gateway-check] gate ${selectedGate}: testes`);
  const testResult = runNpm(['test', '--', ...tests, '--runInBand']);
  if (testResult.status !== 0) {
    process.exit(testResult.status || 1);
  }
}

console.log('[gateway-check] todos os gates solicitados passaram.');
