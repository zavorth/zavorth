#!/usr/bin/env node
import { spawnSync } from 'child_process';

const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;
const selectedGate = String(process.argv.find((arg) => arg.startsWith('--gate=') || arg.startsWith('--stage=')) || '')
  .replace('--gate=', '').replace('--stage=', '')
  .trim();

const gateChecks = {
  'public-adoption-readiness': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'public adoption readiness tests',
      'npx',
      [
        'jest',
        'tests/services/PublicAdoptionReadinessService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['public adoption gate', 'npm', ['run', 'qa:public-adoption', '--silent', '--', '--json'], 240_000],
  ],
  'hosted-site-operations': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'hosted site operations tests',
      'npx',
      [
        'jest',
        'tests/services/HostedSiteOperationsService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['hosted site operations gate', 'npm', ['run', 'qa:hosted-site', '--silent', '--', '--json'], 600_000],
  ],
  'distribution-hardening': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'distribution hardening tests',
      'npx',
      [
        'jest',
        'tests/services/DistributionHardeningService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['distribution hardening gate', 'npm', ['run', 'qa:distribution-hardening', '--silent', '--', '--json'], 360_000],
  ],
  'public-docs-recipes': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'public docs recipes tests',
      'npx',
      [
        'jest',
        'tests/services/PublicDocsRecipesService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['public docs recipes gate', 'npm', ['run', 'qa:public-docs-recipes', '--silent', '--', '--json'], 240_000],
  ],
  'pilot-loop': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'pilot loop tests',
      'npx',
      [
        'jest',
        'tests/services/PilotLoopService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['pilot loop gate', 'npm', ['run', 'qa:pilot-loop', '--silent', '--', '--json'], 240_000],
  ],
  'integration-showcase': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'integration showcase tests',
      'npx',
      [
        'jest',
        'tests/services/IntegrationShowcaseService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['integration showcase gate', 'npm', ['run', 'qa:integration-showcase', '--silent', '--', '--json'], 240_000],
  ],
  'release-train': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'release train tests',
      'npx',
      [
        'jest',
        'tests/services/ReleaseTrainService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['release train gate', 'npm', ['run', 'qa:release-train', '--silent', '--', '--json'], 240_000],
  ],
};

const gates = selectedGate ? [selectedGate] : Object.keys(gateChecks);

for (const gate of gates) {
  const checks = gateChecks[gate];
  if (!checks) {
    console.error(`[gate-check] gate invalido ou ainda nao implementado neste ciclo: ${gate}`);
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
        NEXT_TELEMETRY_DISABLED: '1',
      },
    });

    if (result.error) {
      console.error(`[gate-check] falha ao executar ${label}: ${result.error.message}`);
      process.exit(1);
    }
    if (typeof result.status === 'number' && result.status !== 0) {
      console.error(`[gate-check] ${label} saiu com codigo ${result.status}`);
      process.exit(result.status);
    }
    if (result.signal) {
      console.error(`[gate-check] ${label} encerrado por sinal ${result.signal}`);
      process.exit(1);
    }
  }
}

console.log('\n[gate-check] gate(s) solicitado(s) concluidas com sucesso.');

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
