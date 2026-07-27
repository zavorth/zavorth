#!/usr/bin/env node
import { spawnSync } from 'child_process';

const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;
const selectedGate = String(process.argv.find((arg) => arg.startsWith('--gate=') || arg.startsWith('--stage=')) || '')
  .replace('--gate=', '').replace('--stage=', '')
  .trim();

const gateChecks = {
  'capability-autopilot-preflight-diagnosis': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'capability autopilot tests',
      'npx',
      [
        'jest',
        'tests/services/CapabilityAutopilotReadinessService.test.ts',
        'tests/services/CapabilityAutopilotDiagnosisService.test.ts',
        'tests/services/CapabilityAutopilotRepairPlannerService.test.ts',
        'tests/services/CapabilityAutopilotReceiptService.test.ts',
        'tests/services/CapabilityAutopilotPermissionService.test.ts',
        'tests/services/CapabilityAutopilotValidationResumeService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['capability autopilot gate', 'npm', ['run', 'qa:capability-autopilot', '--silent', '--', '--json'], 240_000],
  ],
  'capability-autopilot-repair-runner': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'capability autopilot runner tests',
      'npx',
      [
        'jest',
        'tests/services/CapabilityAutopilotApprovedRepairRunnerService.test.ts',
        'tests/services/CapabilityAutopilotValidationResumeService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['capability autopilot runner gate', 'npm', ['run', 'qa:capability-autopilot-runner', '--silent', '--', '--json'], 240_000],
  ],
  'capability-autopilot-validation-resume': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'capability autopilot validation resume tests',
      'npx',
      [
        'jest',
        'tests/services/CapabilityAutopilotValidationResumeService.test.ts',
        'tests/services/CapabilityAutopilotRepairExecutionService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['capability autopilot resume gate', 'npm', ['run', 'qa:capability-autopilot-resume', '--silent', '--', '--json'], 240_000],
  ],
  'capability-autopilot-cross-surface-ux': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'capability autopilot surface ux tests',
      'npx',
      [
        'jest',
        'tests/services/CapabilityAutopilotSurfaceUxService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['capability autopilot surfaces gate', 'npm', ['run', 'qa:capability-autopilot-surfaces', '--silent', '--', '--json'], 240_000],
  ],
  'capability-autopilot-memory-replay': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'capability autopilot memory replay tests',
      'npx',
      [
        'jest',
        'tests/services/CapabilityAutopilotMemoryReplayService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['capability autopilot memory gate', 'npm', ['run', 'qa:capability-autopilot-memory', '--silent', '--', '--json'], 240_000],
  ],
  'capability-autopilot-provider-expansion': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'capability autopilot provider expansion tests',
      'npx',
      [
        'jest',
        'tests/services/CapabilityAutopilotExecutionGatewayRunnerService.test.ts',
        'tests/services/CapabilityAutopilotFallbackSelectionService.test.ts',
        'tests/services/CapabilityAutopilotProviderExpansionService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['capability autopilot providers gate', 'npm', ['run', 'qa:capability-autopilot-providers', '--silent', '--', '--json'], 240_000],
  ],
  'capability-autopilot-fallback-handoff': [
    ['runtime check', 'npm', ['run', 'runtime:check', '--silent'], 360_000],
    [
      'capability autopilot release decision tests',
      'npx',
      [
        'jest',
        'tests/services/CapabilityAutopilotFallbackHandoffService.test.ts',
        'tests/services/CapabilityAutopilotFallbackResumeRunService.test.ts',
        'tests/services/CapabilityAutopilotReleaseDecisionService.test.ts',
        '--runInBand',
      ],
      240_000,
    ],
    ['capability autopilot release decision gate', 'npm', ['run', 'qa:capability-autopilot-release-decision', '--silent', '--', '--json'], 240_000],
  ],
};

const gates = selectedGate ? [selectedGate] : Object.keys(gateChecks);

for (const gate of gates) {
  const checks = gateChecks[gate];
  if (!checks) {
    console.error(`[gate-check] invalid gate or not implemented in this cycle yet: ${gate}`);
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
