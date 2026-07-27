#!/usr/bin/env node
import { spawnSync } from 'child_process';

const nodeRunner = process.env.npm_node_execpath || process.execPath;
const npmCliPath = process.env.npm_execpath || null;
const selectedGate = String(process.argv.find((arg) => arg.startsWith('--gate=') || arg.startsWith('--stage=')) || '')
  .replace('--gate=', '').replace('--stage=', '')
  .trim();

const gateChecks = {
  'cockpit': [
    ['cockpit cli tests', 'npx', ['jest', 'tests/cli/ZavorthCli.test.ts', 'tests/cli/ZavorthCliVisualContract.test.ts', '--runInBand'], 300_000],
    ['cockpit json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'cockpit', '--json']],
  ],
  'capability-os': [
    ['capability os tests', 'npx', ['jest', 'tests/services/ZavorthCapabilityOsService.test.ts', 'tests/cli/ZavorthCli.test.ts', '--runInBand']],
    ['capabilities json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'capabilities', 'list', '--json']],
    ['capability route json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'capabilities', 'route', 'research AI news on the web', '--json']],
  ],
  'task-operating-system': [
    ['task os tests', 'npx', ['jest', 'tests/services/ZavorthTaskOperatingSystemService.test.ts', 'tests/cli/ZavorthCli.test.ts', '--runInBand']],
    ['tasks json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'tasks', '--json']],
    ['artifacts task json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'artifacts', 'task', 'latest', '--json']],
  ],
  'supervisor-graph': [
    ['supervisor graph tests', 'npx', ['jest', 'tests/services/ZavorthSupervisorGraphService.test.ts', 'tests/cli/ZavorthCli.test.ts', '--runInBand']],
    ['supervisor graph json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'supervisor', 'plan', 'fix a bug and run the tests', '--json']],
    ['supervisor budget json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'supervisor', 'plan', 'fix a bug and run the tests', '--max-cost', '1', '--json']],
  ],
  'workspace-memory-os': [
    ['workspace memory tests', 'npx', ['jest', 'tests/services/ZavorthWorkspaceMemoryOsService.test.ts', 'tests/cli/ZavorthCli.test.ts', '--runInBand']],
    ['memory review json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'memory', 'review', '--json']],
    ['memory resolve json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'memory', 'resolve', 'continua', '--json']],
  ],
  'self-heal-control-plane': [
    ['self-heal tests', 'npx', ['jest', 'tests/services/ZavorthSelfHealControlPlaneService.test.ts', 'tests/cli/ZavorthCli.test.ts', '--runInBand']],
    ['heal preview json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'heal', '--preview', '--json']],
    ['heal report json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'heal', 'report', '--json']],
  ],
  'release-presence-control-plane': [
    ['release presence tests', 'npx', ['jest', 'tests/services/ZavorthReleasePresenceControlPlaneService.test.ts', 'tests/cli/ZavorthCli.test.ts', '--runInBand']],
    ['release status json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'release', 'status', '--json']],
    ['release diff json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'release', 'diff', 'previous', 'latest', '--json']],
    ['release rollback json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'release', 'rollback', '--preview', '--json']],
    ['release presence json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'release', 'presence', '--json']],
  ],
};

const gates = selectedGate
  ? [selectedGate]
  : ['cockpit', 'capability-os', 'task-operating-system', 'supervisor-graph', 'workspace-memory-os', 'self-heal-control-plane', 'release-presence-control-plane'];

for (const gate of gates) {
  const checks = gateChecks[gate];
  if (!checks) {
    console.error(`[gate-check] gate invalid: ${gate}`);
    process.exit(1);
  }

  console.log(`\n[gate-check] gate ${gate}`);
  for (const [label, command, args, timeoutMs = 180_000] of checks) {
    console.log(`[gate-check] ${label}`);
    const isJsonRead = label.includes('json');
    const commandLine = buildSpawnCommand(command, args);
    const result = spawnSync(commandLine.executable, commandLine.args, {
      stdio: isJsonRead ? 'pipe' : 'inherit',
      encoding: isJsonRead ? 'utf8' : undefined,
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
      if (isJsonRead) {
        try {
          const parsed = parseJsonFromOutput(String(result.stdout || '{}'));
          console.warn(`[gate-check] ${label} returned code ${result.status}, but published valid JSON (${parsed.status || 'ok'}).`);
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
        validateGateJson(gate, label, parsed);
        const generatedAt = parsed.generatedAt ? ` generatedAt=${parsed.generatedAt}` : '';
        console.log(`[gate-check] ${label} ok (${parsed.status || 'ok'}${generatedAt})`);
      } catch (error) {
        process.stdout.write(String(result.stdout || '').slice(0, 4000));
        process.stderr.write(String(result.stderr || '').slice(0, 4000));
        console.error(`[gate-check] ${label} did not return valid JSON: ${error?.message || error}`);
        process.exit(1);
      }
    }
  }
}

console.log('\n[gate-check] requested gate(s) completed successfully.');

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

function validateGateJson(gate, label, parsed) {
  if (gate === 'cockpit') {
    if (parsed.surface !== 'zavorth-cockpit') {
      throw new Error('payload does not appear to be o cockpit');
    }
    return;
  }
  if (gate === 'capability-os' && label.includes('route')) {
    if (parsed.surface !== 'capability-route') {
      throw new Error('payload does not appear to be a decision de route do Capability OS');
    }
    if (!Array.isArray(parsed.fallbackChain) || parsed.fallbackChain.length === 0) {
      throw new Error('route do Capability OS did not include fallback');
    }
    return;
  }
  if (gate === 'capability-os') {
    if (parsed.surface !== 'capability-os') {
      throw new Error('payload does not appear to be o Capability OS');
    }
    if (!parsed.summary || !Array.isArray(parsed.manifests)) {
      throw new Error('Capability OS without registry/manifests');
    }
  }
  if (gate === 'task-operating-system' && label.includes('artifacts')) {
    if (parsed.surface !== 'task-artifacts') {
      throw new Error('payload does not appear to contain Task OS artifacts');
    }
    if (!Array.isArray(parsed.artifacts)) {
      throw new Error('artifact payload without an artifact list');
    }
    return;
  }
  if (gate === 'task-operating-system') {
    if (parsed.surface !== 'task-os') {
      throw new Error('payload does not appear to be o Task OS');
    }
    if (!parsed.taskLedger || !parsed.permissionLedger) {
      throw new Error('Task OS without taskLedger/permissionLedger');
    }
  }
  if (gate === 'supervisor-graph') {
    if (parsed.surface !== 'supervisor-graph') {
      throw new Error('payload does not appear to be o Supervisor Graph');
    }
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.ledger)) {
      throw new Error('Supervisor Graph without DAG/ledger');
    }
    if (!parsed.budget || typeof parsed.budget.maxRetries !== 'number' || typeof parsed.budget.maxCost !== 'number') {
      throw new Error('Supervisor Graph without budget required');
    }
    if (!parsed.contracts?.supervisorDoesNotMutate || !parsed.contracts?.everyTransitionHasEvidence) {
      throw new Error('Supervisor Graph violou contratos de supervisor/evidence');
    }
    if (label.includes('budget') && parsed.status !== 'paused') {
      throw new Error('cenario de budget deveria pausar');
    }
  }
  if (gate === 'workspace-memory-os' && label.includes('resolve')) {
    if (parsed.surface !== 'workspace-memory-resolution') {
      throw new Error('payload does not appear to be a resolucao de memory do Workspace Memory OS');
    }
    if (!parsed.target || !parsed.reason) {
      throw new Error('memory resolution without target/reason');
    }
    return;
  }
  if (gate === 'workspace-memory-os') {
    if (parsed.surface !== 'workspace-memory-os') {
      throw new Error('payload does not appear to be a memory operational do Workspace Memory OS');
    }
    if (!parsed.workspaceProfile || !parsed.preferenceLedger || !parsed.retentionPolicy) {
      throw new Error('Workspace Memory OS without profile/preferences/retention');
    }
    if (!parsed.contracts?.secretsRedactedByDefault || !parsed.contracts?.noRawLogDumpByDefault) {
      throw new Error('Workspace Memory OS violated safe redaction/retention');
    }
  }
  if (gate === 'self-heal-control-plane' && label.includes('report')) {
    if (parsed.surface !== 'self-heal-control-plane' || parsed.mode !== 'daily-report') {
      throw new Error('payload does not appear to be the daily Self-Heal report');
    }
    if (!parsed.dailyReport || !Array.isArray(parsed.dailyReport.topFailures) || !Array.isArray(parsed.dailyReport.proposedActions)) {
      throw new Error('daily Self-Heal report has no failures/proposed actions');
    }
    return;
  }
  if (gate === 'self-heal-control-plane') {
    if (parsed.surface !== 'self-heal-control-plane') {
      throw new Error('payload does not appear to be o Self-Heal');
    }
    if (!Array.isArray(parsed.probes) || !Array.isArray(parsed.plan) || !Array.isArray(parsed.outbox)) {
      throw new Error('Self-Heal without probes/plan/outbox');
    }
    if (!Array.isArray(parsed.automationBudgets) || parsed.automationBudgets.length === 0) {
      throw new Error('Self-heal has no automation budgets');
    }
    if (
      !parsed.contracts?.previewDoesNotExecute
      || !parsed.contracts?.nothingAlwaysOnWithoutExplicitConfig
      || !parsed.contracts?.everyAutomationHasBudget
      || !parsed.contracts?.brokenExecutorAttemptsStandardRecovery
    ) {
      throw new Error('Self-Heal violou contratos de preview/watchdog/budget/recovery');
    }
  }
  if (gate === 'release-presence-control-plane' && label.includes('diff')) {
    if (parsed.surface !== 'release-presence-control-plane' || parsed.mode !== 'diff') {
      throw new Error('payload does not appear to be o diff do Release Presence');
    }
    if (!parsed.diff || !parsed.diff.requested || typeof parsed.diff.summary !== 'string') {
      throw new Error('diff do Release Presence without requested/summary');
    }
    return;
  }
  if (gate === 'release-presence-control-plane' && label.includes('rollback')) {
    if (parsed.surface !== 'release-presence-control-plane' || parsed.mode !== 'rollback-preview') {
      throw new Error('payload does not appear to be o rollback preview do Release Presence');
    }
    if (!parsed.rollback?.previewOnly || !parsed.rollback?.confirmationRequired || parsed.rollback?.executed !== false) {
      throw new Error('Release Presence rollback preview executed or does not require confirmation');
    }
    if (!Array.isArray(parsed.rollback.preflight?.checks) || parsed.rollback.preflight.checks.length === 0) {
      throw new Error('rollback preview do Release Presence without preflight');
    }
    return;
  }
  if (gate === 'release-presence-control-plane' && label.includes('presence')) {
    if (parsed.surface !== 'release-presence-control-plane' || parsed.mode !== 'presence') {
      throw new Error('payload does not appear to contain Release Presence remote presence');
    }
    if (parsed.remotePresence?.cnetworkntials?.looseCnetworkntialRequired !== false) {
      throw new Error('Release Presence remote presence requires loose credential checks');
    }
    return;
  }
  if (gate === 'release-presence-control-plane') {
    if (parsed.surface !== 'release-presence-control-plane') {
      throw new Error('payload does not appear to be o Release Presence');
    }
    if (!parsed.release?.version && parsed.release?.version !== null) {
      throw new Error('Release presence has no registered version/null');
    }
    if (!parsed.release?.risk || !parsed.rollback || !parsed.remotePresence || !parsed.contracts) {
      throw new Error('Release Presence without risk/rollback/remote/contracts');
    }
    if (
      !parsed.contracts.remoteNeverRequiresLooseCnetworkntialFirstLayer
      || !parsed.contracts.rollbackPreviewDoesNotExecute
      || !parsed.contracts.remotePresenceDegradesWhenOffline
    ) {
      throw new Error('Release Presence violou contratos de remote/rollback/degradaction');
    }
  }
}
