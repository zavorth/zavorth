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
    ['capability route json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'capabilities', 'route', 'pesquise noticias de IA na web', '--json']],
  ],
  'task-operating-system': [
    ['task os tests', 'npx', ['jest', 'tests/services/ZavorthTaskOperatingSystemService.test.ts', 'tests/cli/ZavorthCli.test.ts', '--runInBand']],
    ['tasks json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'tasks', '--json']],
    ['artifacts task json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'artifacts', 'task', 'latest', '--json']],
  ],
  'supervisor-graph': [
    ['supervisor graph tests', 'npx', ['jest', 'tests/services/ZavorthSupervisorGraphService.test.ts', 'tests/cli/ZavorthCli.test.ts', '--runInBand']],
    ['supervisor graph json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'supervisor', 'plan', 'corrija um bug e rode os testes', '--json']],
    ['supervisor budget json', 'npx', ['tsx', 'src/zavorth-cli.ts', 'supervisor', 'plan', 'corrija um bug e rode os testes', '--max-cost', '1', '--json']],
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
    console.error(`[gate-check] gate invalido: ${gate}`);
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
      console.error(`[gate-check] falha ao executar ${label}: ${result.error.message}`);
      process.exit(1);
    }
    if (typeof result.status === 'number' && result.status !== 0) {
      if (isJsonRead) {
        try {
          const parsed = parseJsonFromOutput(String(result.stdout || '{}'));
          console.warn(`[gate-check] ${label} retornou codigo ${result.status}, mas publicou JSON valido (${parsed.status || 'ok'}).`);
          continue;
        } catch {
          process.stdout.write(String(result.stdout || '').slice(0, 4000));
          process.stderr.write(String(result.stderr || '').slice(0, 4000));
        }
      }
      console.error(`[gate-check] ${label} saiu com codigo ${result.status}`);
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
        console.error(`[gate-check] ${label} nao retornou JSON valido: ${error?.message || error}`);
        process.exit(1);
      }
    }
  }
}

console.log('\n[gate-check] gate(s) solicitado(s) concluidos com sucesso.');

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
    throw new Error('nenhum objeto JSON encontrado no output');
  }
}

function validateGateJson(gate, label, parsed) {
  if (gate === 'cockpit') {
    if (parsed.surface !== 'zavorth-cockpit') {
      throw new Error('payload nao parece ser o cockpit');
    }
    return;
  }
  if (gate === 'capability-os' && label.includes('route')) {
    if (parsed.surface !== 'capability-route') {
      throw new Error('payload nao parece ser a decisao de route do Capability OS');
    }
    if (!Array.isArray(parsed.fallbackChain) || parsed.fallbackChain.length === 0) {
      throw new Error('route do Capability OS nao trouxe fallback');
    }
    return;
  }
  if (gate === 'capability-os') {
    if (parsed.surface !== 'capability-os') {
      throw new Error('payload nao parece ser o Capability OS');
    }
    if (!parsed.summary || !Array.isArray(parsed.manifests)) {
      throw new Error('Capability OS sem registry/manifests');
    }
  }
  if (gate === 'task-operating-system' && label.includes('artifacts')) {
    if (parsed.surface !== 'task-artifacts') {
      throw new Error('payload nao parece ser os artefatos do Task OS');
    }
    if (!Array.isArray(parsed.artifacts)) {
      throw new Error('artifact payload sem lista de artefatos');
    }
    return;
  }
  if (gate === 'task-operating-system') {
    if (parsed.surface !== 'task-os') {
      throw new Error('payload nao parece ser o Task OS');
    }
    if (!parsed.taskLedger || !parsed.permissionLedger) {
      throw new Error('Task OS sem taskLedger/permissionLedger');
    }
  }
  if (gate === 'supervisor-graph') {
    if (parsed.surface !== 'supervisor-graph') {
      throw new Error('payload nao parece ser o Supervisor Graph');
    }
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.ledger)) {
      throw new Error('Supervisor Graph sem DAG/ledger');
    }
    if (!parsed.budget || typeof parsed.budget.maxRetries !== 'number' || typeof parsed.budget.maxCost !== 'number') {
      throw new Error('Supervisor Graph sem budget obrigatorio');
    }
    if (!parsed.contracts?.supervisorDoesNotMutate || !parsed.contracts?.everyTransitionHasEvidence) {
      throw new Error('Supervisor Graph violou contratos de supervisor/evidencia');
    }
    if (label.includes('budget') && parsed.status !== 'paused') {
      throw new Error('cenario de budget deveria pausar');
    }
  }
  if (gate === 'workspace-memory-os' && label.includes('resolve')) {
    if (parsed.surface !== 'workspace-memory-resolution') {
      throw new Error('payload nao parece ser a resolucao de memoria do Workspace Memory OS');
    }
    if (!parsed.target || !parsed.reason) {
      throw new Error('resolucao de memoria sem alvo/razao');
    }
    return;
  }
  if (gate === 'workspace-memory-os') {
    if (parsed.surface !== 'workspace-memory-os') {
      throw new Error('payload nao parece ser a memoria operacional do Workspace Memory OS');
    }
    if (!parsed.workspaceProfile || !parsed.preferenceLedger || !parsed.retentionPolicy) {
      throw new Error('Workspace Memory OS sem perfil/preferencias/retencao');
    }
    if (!parsed.contracts?.secretsRedactedByDefault || !parsed.contracts?.noRawLogDumpByDefault) {
      throw new Error('Workspace Memory OS violou redacao/retencao segura');
    }
  }
  if (gate === 'self-heal-control-plane' && label.includes('report')) {
    if (parsed.surface !== 'self-heal-control-plane' || parsed.mode !== 'daily-report') {
      throw new Error('payload nao parece ser o relatorio diario do Self-Heal');
    }
    if (!parsed.dailyReport || !Array.isArray(parsed.dailyReport.topFailures) || !Array.isArray(parsed.dailyReport.proposedActions)) {
      throw new Error('relatorio diario do Self-Heal sem falhas/acoes propostas');
    }
    return;
  }
  if (gate === 'self-heal-control-plane') {
    if (parsed.surface !== 'self-heal-control-plane') {
      throw new Error('payload nao parece ser o Self-Heal');
    }
    if (!Array.isArray(parsed.probes) || !Array.isArray(parsed.plan) || !Array.isArray(parsed.outbox)) {
      throw new Error('Self-Heal sem probes/plano/outbox');
    }
    if (!Array.isArray(parsed.automationBudgets) || parsed.automationBudgets.length === 0) {
      throw new Error('Self-Heal sem budgets de automacao');
    }
    if (
      !parsed.contracts?.previewDoesNotExecute
      || !parsed.contracts?.nothingAlwaysOnWithoutExplicitConfig
      || !parsed.contracts?.everyAutomationHasBudget
      || !parsed.contracts?.brokenExecutorAttemptsStandardRecovery
    ) {
      throw new Error('Self-Heal violou contratos de preview/watchdog/budget/recuperacao');
    }
  }
  if (gate === 'release-presence-control-plane' && label.includes('diff')) {
    if (parsed.surface !== 'release-presence-control-plane' || parsed.mode !== 'diff') {
      throw new Error('payload nao parece ser o diff do Release Presence');
    }
    if (!parsed.diff || !parsed.diff.requested || typeof parsed.diff.summary !== 'string') {
      throw new Error('diff do Release Presence sem requested/summary');
    }
    return;
  }
  if (gate === 'release-presence-control-plane' && label.includes('rollback')) {
    if (parsed.surface !== 'release-presence-control-plane' || parsed.mode !== 'rollback-preview') {
      throw new Error('payload nao parece ser o rollback preview do Release Presence');
    }
    if (!parsed.rollback?.previewOnly || !parsed.rollback?.confirmationRequired || parsed.rollback?.executed !== false) {
      throw new Error('rollback preview do Release Presence executou ou nao exige confirmacao');
    }
    if (!Array.isArray(parsed.rollback.preflight?.checks) || parsed.rollback.preflight.checks.length === 0) {
      throw new Error('rollback preview do Release Presence sem preflight');
    }
    return;
  }
  if (gate === 'release-presence-control-plane' && label.includes('presence')) {
    if (parsed.surface !== 'release-presence-control-plane' || parsed.mode !== 'presence') {
      throw new Error('payload nao parece ser a presenca remota do Release Presence');
    }
    if (parsed.remotePresence?.credentials?.looseCredentialRequired !== false) {
      throw new Error('presenca remota do Release Presence exige credencial solta');
    }
    return;
  }
  if (gate === 'release-presence-control-plane') {
    if (parsed.surface !== 'release-presence-control-plane') {
      throw new Error('payload nao parece ser o Release Presence');
    }
    if (!parsed.release?.version && parsed.release?.version !== null) {
      throw new Error('Release Presence sem versao registrada/null');
    }
    if (!parsed.release?.risk || !parsed.rollback || !parsed.remotePresence || !parsed.contracts) {
      throw new Error('Release Presence sem risk/rollback/remote/contracts');
    }
    if (
      !parsed.contracts.remoteNeverRequiresLooseCredentialFirstLayer
      || !parsed.contracts.rollbackPreviewDoesNotExecute
      || !parsed.contracts.remotePresenceDegradesWhenOffline
    ) {
      throw new Error('Release Presence violou contratos de remoto/rollback/degradacao');
    }
  }
}
