#!/usr/bin/env node
import { spawnSync } from 'child_process';

const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;
const selectedPhase = String(process.argv.find((arg) => arg.startsWith('--phase=')) || '')
  .replace('--phase=', '')
  .trim();

const phaseChecks = {
  '39': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'product quality contract tests',
      'npx',
      [
        'jest',
        'tests/services/ProductQualityContractService.test.ts',
        'tests/cli/ZavorthCliVisualContract.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['product quality gate', 'npm', ['run', 'qa:product-quality', '--silent', '--', '--json'], 180_000],
  ],
  '40': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    ['web surface syntax', 'npm', ['run', 'web-surface:check', '--silent'], 240_000],
    [
      'web/app polish tests',
      'npx',
      [
        'jest',
        'tests/services/WebAppPolishContractService.test.ts',
        'tests/domain/surface/presentation/dashboard/DashboardService.web-app.test.ts',
        '--runInBand',
      ],
      300_000,
    ],
    ['web/app polish gate', 'npm', ['run', 'qa:web-app-polish', '--silent', '--', '--json'], 180_000],
  ],
  '41': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'deterministic QA matrix tests',
      'npx',
      [
        'jest',
        'tests/services/DeterministicQaMatrixService.test.ts',
        'tests/services/ProductQualityContractService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['product quality gate', 'npm', ['run', 'qa:product-quality', '--silent', '--', '--json'], 180_000],
    ['deterministic QA gate', 'npm', ['run', 'qa:deterministic', '--silent', '--', '--json', '--tier=quick'], 180_000],
  ],
  '42': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'tenant/team ops tests',
      'npx',
      [
        'jest',
        'tests/services/TenantTeamOpsService.test.ts',
        'tests/services/ZavorthTenantGovernanceService.test.ts',
        '--runInBand',
      ],
      300_000,
    ],
    ['tenant/team ops gate', 'npm', ['run', 'qa:tenant-team-ops', '--silent', '--', '--json'], 180_000],
  ],
  '43': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'artifact/replay workbench tests',
      'npx',
      [
        'jest',
        'tests/services/ArtifactReplayWorkbenchService.test.ts',
        'tests/services/ZavorthReplayLearningControlPlaneService.test.ts',
        '--runInBand',
      ],
      300_000,
    ],
    ['artifact/replay workbench gate', 'npm', ['run', 'qa:artifact-workbench', '--silent', '--', '--json'], 180_000],
  ],
  '44': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'release UX tests',
      'npx',
      [
        'jest',
        'tests/services/ReleaseUxWizardService.test.ts',
        'tests/services/ZavorthReleasePresenceControlPlaneService.test.ts',
        '--runInBand',
      ],
      300_000,
    ],
    ['release UX gate', 'npm', ['run', 'qa:release-ux', '--silent', '--', '--json'], 180_000],
  ],
  '45': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'idle budget tests',
      'npx',
      [
        'jest',
        'tests/services/RuntimeIdleBudgetService.test.ts',
        'tests/services/DeterministicQaMatrixService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['deterministic QA gate', 'npm', ['run', 'qa:deterministic', '--silent', '--', '--json', '--tier=quick'], 180_000],
    ['idle budget gate', 'npm', ['run', 'qa:idle-budget', '--silent', '--', '--json'], 180_000],
  ],
};

const phases = selectedPhase ? [selectedPhase] : Object.keys(phaseChecks);

for (const phase of phases) {
  const checks = phaseChecks[phase];
  if (!checks) {
    console.error(`[phase-check] fase invalida: ${phase}`);
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
