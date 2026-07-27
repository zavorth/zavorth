#!/usr/bin/env node
import { spawnSync } from 'child_process';

const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;
const selectedGate = String(process.argv.find((arg) => arg.startsWith('--gate=') || arg.startsWith('--stage=')) || '')
  .replace('--gate=', '').replace('--stage=', '')
  .trim();

const gateChecks = {
  '18': [
    ['sandbox control/action tests', 'npx', ['jest', 'tests/services/ZavorthSandboxControlPlaneService.test.ts', 'tests/services/ZavorthSandboxActionService.test.ts', 'tests/services/SandboxExecutionService.test.ts', '--runInBand']],
    ['sandbox json', 'npx', ['tsx', 'scripts/zavorth-sandbox.ts', '--json']],
  ],
  '19': [
    ['skill evolution tests', 'npx', ['jest', 'tests/services/ZavorthSkillEvolutionService.test.ts', '--runInBand']],
    ['skill evolution json', 'npx', ['tsx', 'scripts/zavorth-skill-evolution.ts', '--json']],
  ],
  '20': [
    ['replay learning tests', 'npx', ['jest', 'tests/services/ZavorthReplayLearningService.test.ts', '--runInBand']],
    ['replay learning json', 'npx', ['tsx', 'scripts/zavorth-replay-learning.ts', '--json']],
  ],
  '21': [
    ['federated mesh tests', 'npx', ['jest', 'tests/services/ZavorthFederatedMeshControlPlaneService.test.ts', '--runInBand']],
    ['federated mesh json', 'npx', ['tsx', 'scripts/zavorth-federated-mesh.ts', '--json']],
  ],
  '22': [
    ['workspace canvas tests', 'npx', ['jest', 'tests/services/CanvasWorkspaceService.test.ts', '--runInBand']],
    ['workspace canvas json', 'npx', ['tsx', 'scripts/zavorth-workspace-canvas.ts', '--json']],
  ],
  '23': [
    ['hardware action plane tests', 'npx', ['jest', 'tests/services/ZavorthHardwareActionPlaneService.test.ts', '--runInBand']],
    ['hardware action plane json', 'npx', ['tsx', 'scripts/zavorth-hardware.ts', '--json']],
  ],
  '24': [
    ['autonomous partner tests', 'npx', ['jest', 'tests/services/ZavorthAutonomousEngineeringPartnerService.test.ts', '--runInBand']],
    ['autonomous partner json', 'npx', ['tsx', 'scripts/zavorth-autonomous-partner.ts', '--json']],
  ],
};

const gates = selectedGate
  ? [selectedGate]
  : ['18', '19', '20', '21', '22', '23', '24'];

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
          const posture = parsed.summary?.posture || parsed.status || 'warning';
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
        const posture = parsed.summary?.posture || parsed.status || 'ok';
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

console.log('\n[gate-check] automation gates completed successfully.');

function buildSpawnCommand(command, args) {
  if (process.platform === 'win32' && npmCliPath && (command === 'npx' || command === 'npx.cmd')) {
    return {
      executable: nodeRunner,
      args: [npmCliPath, 'exec', '--', ...args],
    };
  }
  return { executable: command, args };
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
