#!/usr/bin/env node
import { spawnSync } from 'child_process';

const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;
const selectedPhase = String(process.argv.find((arg) => arg.startsWith('--phase=')) || '')
  .replace('--phase=', '')
  .trim();

const phaseChecks = {
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
  '33': [
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
        'tests/domain/surface/presentation/dashboard/DashboardService.hardening.test.ts',
        'tests/orchestrator/RealZavorthBridgeWatcher.test.ts',
        'tests/orchestrator/RealZavorthBridgeWatcher.hardening.test.ts',
        'tests/skills/SkillRouter.test.ts',
        '--runInBand',
      ],
    ],
  ],
  '35': [
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
  '38': [
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

const phases = selectedPhase ? [selectedPhase] : Object.keys(phaseChecks);

for (const phase of phases) {
  const checks = phaseChecks[phase];
  if (!checks) {
    console.error(`[phase-check] etapa invalida: ${phase}`);
    process.exit(1);
  }

  console.log(`\n[phase-check] etapa ${phase}`);
  for (const [label, command, args, timeoutMs = 180_000] of checks) {
    console.log(`[phase-check] ${label}`);
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
      console.error(`[phase-check] falha ao executar ${label}: ${result.error.message}`);
      process.exit(1);
    }
    if (typeof result.status === 'number' && result.status !== 0) {
      console.error(`[phase-check] ${label} saiu com codigo ${result.status}`);
      process.exit(result.status);
    }
    if (result.signal) {
      console.error(`[phase-check] ${label} encerrado por sinal ${result.signal}`);
      process.exit(1);
    }
  }
}

console.log('\n[phase-check] etapa(s) solicitada(s) concluidas com sucesso.');

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
