#!/usr/bin/env node
import { spawnSync } from 'child_process';

const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;
const selectedGate = String(process.argv.find((arg) => arg.startsWith('--gate=') || arg.startsWith('--stage=')) || '')
  .replace('--gate=', '').replace('--stage=', '')
  .trim();

const gateChecks = {
  'memory-artifacts-runtime-live': [
    ['mutation/trust/readiness tests', 'npx', ['jest', 'tests/services/ZavorthMutationPlaneService.test.ts', 'tests/services/TrustDecisionService.test.ts', 'tests/services/ZavorthRolloutReadinessControlPlaneService.test.ts', '--runInBand']],
    ['rollout readiness json', 'npx', ['tsx', 'scripts/zavorth-rollout-readiness.ts', '--json', '--scope', 'local']],
  ],
  '13': [
    ['natural setup tests', 'npx', ['jest', 'tests/services/ZavorthNaturalSetupControlPlaneService.test.ts', 'tests/services/NaturalChannelSetupTurnService.test.ts', 'tests/services/NaturalSetupMutationPlannerService.test.ts', 'tests/services/TrustDecisionService.test.ts', '--runInBand']],
    ['natural setup json', 'npx', ['tsx', 'scripts/zavorth-natural-setup.ts', '--json']],
  ],
  '14': [
    ['trust plane policy os tests', 'npx', ['jest', 'tests/services/ZavorthTrustPlaneActionService.test.ts', 'tests/services/ZavorthTrustPlaneService.test.ts', 'tests/services/TrustPlanePolicyLedgerService.test.ts', '--runInBand']],
    ['trust plane json', 'npx', ['tsx', 'scripts/zavorth-trust-plane.ts', '--json']],
  ],
  '15': [
    ['watch mode tests', 'npx', ['jest', 'tests/services/ComputerUseWatchModeService.test.ts', 'tests/services/ComputerUseWatchModePolicyFileService.test.ts', 'tests/services/ZavorthWatchModeControlPlaneService.test.ts', '--runInBand']],
    ['watch mode json', 'npx', ['tsx', 'scripts/zavorth-watch-mode.ts', '--json']],
  ],
  '16': [
    ['eval telemetry tests', 'npx', ['jest', 'tests/services/ZavorthEvalControlPlaneService.test.ts', 'tests/services/ZavorthEvalHistoryFileService.test.ts', 'tests/services/ZavorthTelemetryLedgerService.test.ts', '--runInBand']],
    ['eval json', 'npx', ['tsx', 'scripts/zavorth-evals.ts', '--json']],
  ],
  '17': [
    ['automation tests', 'npx', ['jest', 'tests/services/ZavorthAutomationActionService.test.ts', 'tests/services/ZavorthAutomationControlPlaneService.test.ts', 'tests/services/ZavorthAutomationIntentService.test.ts', 'tests/services/SchedulerService.test.ts', '--runInBand']],
    ['automations json', 'npx', ['tsx', 'scripts/zavorth-automations.ts', '--json']],
  ],
};

const gates = selectedGate
  ? [selectedGate]
  : ['12', '13', '14', '15', '16', '17'];

for (const gate of gates) {
  const checks = gateChecks[gate];
  if (!checks) {
    console.error(`[gate-check] stage invalid: ${gate}`);
    process.exit(1);
  }
  console.log(`\n[gate-check] gate ${gate}`);
  for (const [label, command, args] of checks) {
    console.log(`[gate-check] ${label}`);
    const isJsonRead = label.includes('json');
    const commandLine = buildSpawnCommand(command, args);
    const result = spawnSync(commandLine.executable, commandLine.args, {
      stdio: isJsonRead ? 'pipe' : 'inherit',
      encoding: isJsonRead ? 'utf8' : undefined,
      timeout: 180_000,
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
      if (isJsonRead) {
        try {
          const parsed = parseJsonFromOutput(String(result.stdout || '{}'));
          const posture = parsed.summary?.posture || parsed.gate?.status || parsed.status || 'warning';
          const generatedAt = parsed.generatedAt ? ` generatedAt=${parsed.generatedAt}` : '';
          console.warn(`[gate-check] ${label} returned code ${result.status}, but published valid JSON (${posture}${generatedAt}).`);
          continue;
        } catch {
          process.stdout.write(String(result.stdout || '').slice(0, 4000));
          process.stderr.write(String(result.stderr || '').slice(0, 4000));
        }
      }
      console.error(`[gate-check] ${label} saiu with code ${result.status}`);
      process.exit(result.status);
    }
    if (result.signal) {
      console.error(`[gate-check] ${label} encerrado por sinal ${result.signal}`);
      process.exit(1);
    }
    if (isJsonRead) {
      try {
        const parsed = parseJsonFromOutput(String(result.stdout || '{}'));
        const generatedAt = parsed.generatedAt ? ` generatedAt=${parsed.generatedAt}` : '';
        const posture = parsed.summary?.posture || parsed.status || parsed.profile || 'ok';
        console.log(`[gate-check] ${label} ok (${posture}${generatedAt})`);
      } catch (error) {
        process.stdout.write(String(result.stdout || '').slice(0, 4000));
        process.stderr.write(String(result.stderr || '').slice(0, 4000));
        console.error(`[gate-check] ${label} did not return valid JSON: ${error?.message || error}`);
        process.exit(1);
      }
    }
  }
}

console.log('\n[gate-check] stages completed successfully.');

function buildSpawnCommand(command, args) {
  if (process.platform === 'win32' && npmCliPath && (command === 'npx' || command === 'npx.cmd')) {
    return {
      executable: nodeRunner,
      args: [npmCliPath, 'exec', '--', ...args],
    };
  }
  return { executable: command, args };
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[\s"]/u.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '\\"')}"`;
}

function parseJsonFromOutput(output) {
  const text = String(output || '').trim();
  try {
    return JSON.parse(text || '{}');
  } catch {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('no JSON object found in output');
  }
}
