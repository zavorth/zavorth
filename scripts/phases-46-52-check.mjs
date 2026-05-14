#!/usr/bin/env node
import { spawnSync } from 'child_process';

const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;
const selectedPhase = String(process.argv.find((arg) => arg.startsWith('--phase=')) || '')
  .replace('--phase=', '')
  .trim();

const phaseChecks = {
  '46': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'website public contract tests',
      'npx',
      [
        'jest',
        'tests/services/WebsitePublicContractService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['website public gate', 'npm', ['run', 'qa:website-public', '--silent', '--', '--json'], 420_000],
  ],
  '47': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'public demo contract tests',
      'npx',
      [
        'jest',
        'tests/services/PublicDemoContractService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['public demo gate', 'npm', ['run', 'qa:public-demo', '--silent', '--', '--json'], 420_000],
  ],
  '48': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'first-run onboarding contract tests',
      'npx',
      [
        'jest',
        'tests/services/FirstRunOnboardingContractService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['first-run onboarding gate', 'npm', ['run', 'qa:first-run', '--silent', '--', '--json'], 420_000],
  ],
  '49': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'external docs contract tests',
      'npx',
      [
        'jest',
        'tests/services/ExternalDocsContractService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['external docs gate', 'npm', ['run', 'qa:external-docs', '--silent', '--', '--json'], 420_000],
  ],
  '50': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'distribution policy contract tests',
      'npx',
      [
        'jest',
        'tests/services/DistributionPolicyContractService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['distribution policy gate', 'npm', ['run', 'qa:distribution-policy', '--silent', '--', '--json'], 420_000],
  ],
  '51': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'release bundle contract tests',
      'npx',
      [
        'jest',
        'tests/services/PublicReleaseBundleContractService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['release bundle gate', 'npm', ['run', 'qa:release-bundle', '--silent', '--', '--json'], 420_000],
  ],
  '52': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'feedback telemetry contract tests',
      'npx',
      [
        'jest',
        'tests/services/FeedbackTelemetryContractService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['feedback loop gate', 'npm', ['run', 'qa:feedback-loop', '--silent', '--', '--json'], 420_000],
  ],
};

const phases = selectedPhase ? [selectedPhase] : Object.keys(phaseChecks);

for (const phase of phases) {
  const checks = phaseChecks[phase];
  if (!checks) {
    console.error(`[phase-check] fase invalida ou ainda nao implementada neste ciclo: ${phase}`);
    process.exit(1);
  }

  console.log(`\n[phase-check] fase ${phase}`);
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
        NEXT_TELEMETRY_DISABLED: '1',
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

console.log('\n[phase-check] fase(s) solicitada(s) concluidas com sucesso.');

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
