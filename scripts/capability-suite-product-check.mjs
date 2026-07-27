#!/usr/bin/env node
import { spawnSync } from 'child_process';

const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;
const selectedGate = String(process.argv.find((arg) => arg.startsWith('--gate=') || arg.startsWith('--stage=')) || '')
  .replace('--gate=', '').replace('--stage=', '')
  .trim();

const gateChecks = {
  '32': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent']],
    [
      'gateway modularization tests',
      'npx',
      [
        'jest',
        'tests/telegram/bot-gateway/GatewayCommandRouters.test.ts',
        'tests/telegram/bot-gateway/GatewayCallbackRouter.test.ts',
        'tests/telegram/TelegramCommandRoutingService.test.ts',
        'tests/telegram/controllers/TelegramCallbackController.test.ts',
        'tests/telegram/TelegramCallbackController.echo.test.ts',
        '--runInBand',
      ],
    ],
  ],
  'end-to-end-flow': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent']],
    ['end-to-end flow harness', 'npm', ['run', 'qa:flows', '--silent']],
    ['cross-surface continuity', 'npm', ['run', 'test:cross-surface', '--silent']],
  ],
  '34': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent']],
    [
      'legacy module hardening tests',
      'npx',
      [
        'jest',
        'tests/telegram/VideoHandler.test.ts',
        'tests/telegram/VideoHandler.hardening.test.ts',
        'tests/domain/surface/presentation/zavorthControl/ZavorthControlService.hardening.test.ts',
        'tests/orchestrator/RealZavorthBridgeWatcher.test.ts',
        'tests/orchestrator/RealZavorthBridgeWatcher.hardening.test.ts',
        'tests/skills/SkillRouter.test.ts',
        '--runInBand',
      ],
    ],
  ],
  'boot-integrity': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent']],
    [
      'boot integrity and correlation tests',
      'npx',
      [
        'jest',
        'tests/services/BootIntegrityService.test.ts',
        'tests/services/ZavorthCorrelationTraceService.test.ts',
        'tests/services/ZavorthTelemetryLedgerService.test.ts',
        'tests/services/telemetry/ExecutionGateway.telemetry.test.ts',
        'tests/services/telemetry/PermissionService.telemetry.test.ts',
        'tests/services/telemetry/ToolExecutor.telemetry.test.ts',
        'tests/telegram/BotGateway.telemetry.test.ts',
        'tests/telegram/controllers/TelegramPermissionController.telemetry.test.ts',
        '--runInBand',
      ],
    ],
    ['boot smoke', 'npm', ['run', 'qa:boot', '--silent']],
    ['public flow alias', 'npm', ['run', 'qa:flows', '--silent']],
    [
      'product experience public aggregate',
      'npm',
      ['run', 'qa:product-experience', '--silent', '--', '--skip-build', '--json'],
      300_000,
    ],
  ],
  '36': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent']],
    ['technical debt guard', 'npm', ['run', 'qa:tech-debt', '--silent']],
    [
      'routing contract tests',
      'npx',
      [
        'jest',
        'tests/telegram/CommandParser.test.ts',
        'tests/telegram/TelegramCommandRoutingService.test.ts',
        'tests/telegram/TelegramPriorityCommandService.test.ts',
        '--runInBand',
      ],
    ],
  ],
  '37': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent']],
    ['gateway surface conformance', 'npm', ['run', 'qa:gateway-surfaces', '--silent']],
    [
      'telegram and web gateway contracts',
      'npx',
      [
        'jest',
        'tests/telegram/TelegramChannelContractService.test.ts',
        'tests/services/WebAppGatewaySessions.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
  ],
  'sandbox-host-readiness': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent']],
    [
      'sandbox host readiness tests',
      'npx',
      [
        'jest',
        'tests/services/SandboxHostReadinessService.test.ts',
        'tests/services/SandboxExecutionService.test.ts',
        '--runInBand',
      ],
    ],
    ['sandbox doctor smoke', 'npm', ['run', 'sandbox:doctor:smoke', '--silent', '--', '--json']],
  ],
};

const gates = selectedGate ? [selectedGate] : Object.keys(gateChecks);

for (const gate of gates) {
  const checks = gateChecks[gate];
  if (!checks) {
    console.error(`[gate-check] stage invalid: ${gate}`);
    process.exit(1);
  }

  console.log(`\n[gate-check] gate ${gate}`);
  for (const [label, command, args, timeoutMs = 180_000] of checks) {
    console.log(`[gate-check] ${label}`);
    const commandLine = buildSpawnCommand(command, args);
    const result = spawnSync(commandLine.executable, commandLine.args, {
      stdio: 'inherit',
      timeout: timeoutMs,
      env: {
        ...process.env,
        ZAVORTH_PROFILE: process.env.ZAVORTH_PROFILE || 'core',
        ZAVORTH_CAPABILITY_POLICY: process.env.ZAVORTH_CAPABILITY_POLICY || 'ask-on-demand',
      },
    });

    if (result.error) {
      console.error(`[gate-check] failure ao run ${label}: ${result.error.message}`);
      process.exit(1);
    }
    if (typeof result.status === 'number' && result.status !== 0) {
      console.error(`[gate-check] ${label} saiu with code ${result.status}`);
      process.exit(result.status);
    }
    if (result.signal) {
      console.error(`[gate-check] ${label} encerrado por sinal ${result.signal}`);
      process.exit(1);
    }
  }
}

console.log('\n[gate-check] requested gate(s) completed successfully.');

function buildSpawnCommand(command, args) {
  if (process.platform === 'win32' && npmCliPath) {
    if (command === 'npx' || command === 'npx.cmd') {
      return {
        executable: nodeRunner,
        args: [npmCliPath, 'exec', '--', ...args],
      };
    }
    if (command === 'npm' || command === 'npm.cmd') {
      return {
        executable: nodeRunner,
        args: [npmCliPath, ...args],
      };
    }
  }
  return { executable: command, args };
}
