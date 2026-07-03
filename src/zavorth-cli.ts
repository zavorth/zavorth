#!/usr/bin/env node
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { formatCliHelp, resolveCliHelpTopic } from './cli/ZavorthCliSurfaceHelpers.js';
import { getCommandAliases } from './cli/locales/localeManager.js';
import {
  resolveZavorthSimpleCommand,
  type ZavorthSimpleCommandPlan,
} from './cli/SimpleCommandRouter.js';
import {
  formatZavorthCertificationHelp,
  formatZavorthConsistencyPreparedNotice,
  isZavorthConsistencyStubCommand,
} from './cli/ZavorthCliCertificationCommands.js';
import {
  isZavorthLiveNamespaceCommand,
  runZavorthLiveNamespaceCommand,
} from './cli/ZavorthCliLiveNamespaces.js';
import type { DiskMutationGateRequestedOperation } from './contracts/DiskMutationGateContract.js';
import { runDiskMutationGateCommand } from './cli/disk/ZavorthCliDiskMutationNamespace.js';
import { runProjectConstitutionCommand } from './cli/constitution/ZavorthCliConstitutionNamespace.js';

async function logCliError(message: string, title = 'Zavorth Error'): Promise<void> {
  const isTTY = process.stderr.isTTY && !process.argv.includes('--json');
  if (isTTY) {
    const { TerminalPanel } = await import('./cli/presentation/TerminalPanel.js');
    TerminalPanel.error(message, title);
  } else {
    process.stderr.write(`${title}: ${message}\n`);
  }
}

async function printCliPanel(title: string, lines: string[], type: 'default' | 'info' | 'success' | 'warning' | 'error' = 'default'): Promise<number> {
  const content = lines.join('\n');
  if (!process.argv.includes('--json')) {
    const { TerminalPanel } = await import('./cli/presentation/TerminalPanel.js');
    process.stdout.write(`${TerminalPanel.render(content, {
      title,
      type,
      padding: 1,
      width: Math.max(58, Math.min(88, Number(process.stdout.columns || 90) - 4)),
    })}\n`);
  } else {
    process.stdout.write([title, '', content, ''].join('\n'));
  }
  return 0;
}

const entryDir = path.dirname(path.resolve(process.argv[1] || process.cwd()));
const runningFromDist = path.basename(entryDir).toLowerCase() === 'dist';
const projectRoot = runningFromDist ? path.resolve(entryDir, '..') : path.resolve(entryDir, '..');

const PUBLIC_COMMANDS = [
  'chat',
  'actions',
  'channels',
  'setup',
  'home',
  'ask',
  'approve',
  'doctor',
  'status',
  'open',
  'providers',
  'models',
  'memory',
  'mnemos',
  'swarm',
  'workflows',
  'effort',
  'sandbox',
  'satellite',
  'hud',
  'tui',
  'help',
  'onboard',
  'quickstart',
  'start',
  'native',
  'diff',
  'learn',
  'inspect',
  'constitution',
  'disk',
  'disk-gate',
  'branch',
  'commit',
  'pr',
  'review',
  'acp',
  'tasks',
  'curator',
  'instance',
  'todo',
  'later',
  'work',
  'done',
  'retry',
  'cancel',
  'diagnostics',
  'mock-gateway',
];

function normalizePublicCommandAliases(rawArgs: string[]): string[] {
  const first = String(rawArgs[0] || '').trim().toLowerCase();
  const alias = getCommandAliases()[first];
  if (!alias) {
    return rawArgs;
  }
  return [alias, ...rawArgs.slice(1)];
}

const simpleCommandPlan = resolveZavorthSimpleCommand(normalizePublicCommandAliases(process.argv.slice(2)));
const args = simpleCommandPlan.kind === 'passthrough' ? simpleCommandPlan.args : process.argv.slice(2);

function spawnInherited(command: string, commandArgs: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: 'inherit',
      windowsHide: false,
    });
    child.on('exit', (code) => resolve(code || 0));
    child.on('error', reject);
  });
}

function npmInherited(commandArgs: string[], cwd: string): Promise<number> {
  const npmCli = resolveNpmCli();
  if (npmCli) {
    return spawnInherited(process.execPath, [npmCli, ...commandArgs], cwd);
  }
  return spawnInherited('npm', commandArgs, cwd);
}

async function runSimpleCommandPlan(plan: ZavorthSimpleCommandPlan): Promise<number | null> {
  if (plan.kind === 'passthrough') {
    return null;
  }
  process.stdout.write(`${plan.label}\n`);
  for (const script of plan.scripts) {
    process.stdout.write(`\n> zavorth test: ${script}\n`);
    const exitCode = await npmInherited(['run', script, '--silent'], projectRoot);
    if (exitCode !== 0) {
      await logCliError(`Zavorth test stopped at ${script}.`, 'Test Failed');
      return exitCode;
    }
  }
  process.stdout.write('\nZavorth tests passed.\n');
  return 0;
}

function resolveNpmCli(): string | null {
  const candidates = [
    path.resolve(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs', 'node_modules', 'npm', 'bin', 'npm-cli.js') : '',
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'nodejs', 'node_modules', 'npm', 'bin', 'npm-cli.js') : '',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function printBuiltinHelp(target?: string | null): number {
  process.stdout.write(`${formatCliHelp(target)}\n`);
  return 0;
}

function printGeneralHelp(): number {
  process.stdout.write(`${formatCliHelp()}\n`);
  return 0;
}

function readNumberFlag(argv: string[], name: string): number | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const raw = inline ? inline.slice(prefix.length) : null;
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const inline = readStringFlag(argv, name);
  if (inline !== null) {
    return inline;
  }
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

function readStringListFlag(argv: string[], name: string): string[] {
  const inlinePrefix = `--${name}=`;
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg.startsWith(inlinePrefix)) {
      values.push(arg.slice(inlinePrefix.length));
      continue;
    }
    if (arg === `--${name}` && argv[index + 1]) {
      values.push(argv[index + 1]);
      index += 1;
    }
  }
  return values
    .flatMap((value) => String(value || '').split(/[,\n;]/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function readTaskPositional(argv: string[], index: number): string | null {
  const flagValueIndexes = new Set<number>();
  for (let cursor = 0; cursor < argv.length; cursor += 1) {
    const arg = argv[cursor] || '';
    if (arg.startsWith('--') && !arg.includes('=') && argv[cursor + 1] && !argv[cursor + 1].startsWith('--')) {
      flagValueIndexes.add(cursor + 1);
      cursor += 1;
    }
  }
  const values = argv.filter((arg, cursor) => !flagValueIndexes.has(cursor) && !arg.startsWith('--'));
  return values[index] || null;
}

function readDurationMsFlag(argv: string[], name: string): number | null {
  const raw = readStringFlag(argv, name);
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(/^(\d+)(ms|s|m|h)?$/i);
  if (!match) {
    return readNumberFlag(argv, name);
  }
  const value = Number(match[1]);
  const unit = String(match[2] || 'ms').toLowerCase();
  const factor = unit === 'h' ? 60 * 60 * 1000 : unit === 'm' ? 60 * 1000 : unit === 's' ? 1000 : 1;
  return Number.isFinite(value) ? value * factor : null;
}

async function runRuntimeResourceDoctor(rawArgs: string[], strict: boolean): Promise<number> {
  const { RuntimeResourceBudgetService } = await import('./services/RuntimeResourceBudgetService.js');
  const service = new RuntimeResourceBudgetService();
  const asJson = rawArgs.includes('--json');
  const profileArg = rawArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
  const profile = service.resolveProfile(
    profileArg || process.env.ZAVORTH_RESOURCE_BUDGET_PROFILE || process.env.ZAVORTH_PROFILE,
  );
  const report = service.buildBudgetReport(profile, undefined, {
    ...(readNumberFlag(rawArgs, 'rss-mb') !== null ? { rssMb: readNumberFlag(rawArgs, 'rss-mb') as number } : {}),
    ...(readNumberFlag(rawArgs, 'heap-used-mb') !== null ? { heapUsedMb: readNumberFlag(rawArgs, 'heap-used-mb') as number } : {}),
    ...(readNumberFlag(rawArgs, 'active-handles') !== null ? { activeHandles: readNumberFlag(rawArgs, 'active-handles') as number } : {}),
    ...(readNumberFlag(rawArgs, 'active-requests') !== null ? { activeRequests: readNumberFlag(rawArgs, 'active-requests') as number } : {}),
    ...(readNumberFlag(rawArgs, 'loaded-cjs-modules') !== null ? { loadedCommonJsModules: readNumberFlag(rawArgs, 'loaded-cjs-modules') as number } : {}),
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const failedChecks = report.checks.filter((check) => !check.ok);
    await printCliPanel('Runtime resource doctor', [
      `profile: ${report.profile}`,
      `budget: ${report.ok ? 'ok' : 'violated'}`,
      `memory: rss ${report.snapshot.runtime.rssMb}/${report.thresholds.rssMb} MB | heap ${report.snapshot.runtime.heapUsedMb}/${report.thresholds.heapUsedMb} MB`,
      `runtime: handles ${report.snapshot.runtime.activeHandles}/${report.thresholds.activeHandles} | requests ${report.snapshot.runtime.activeRequests}/${report.thresholds.activeRequests} | cjs modules ${report.snapshot.runtime.loadedCommonJsModules}/${report.thresholds.loadedCommonJsModules}`,
      failedChecks.length > 0 ? `violated checks: ${failedChecks.map((check) => check.id).join(', ')}` : null,
      report.recommendations.length > 0 ? `recommendations: ${report.recommendations.join(' ')}` : null,
    ].filter((line): line is string => Boolean(line)), report.ok ? 'success' : 'warning');
  }

  return strict && !report.ok ? 1 : 0;
}

async function runOperationalSecurityDoctor(rawArgs: string[]): Promise<number> {
  const {
    buildOperationalSecurityDoctorReport,
    formatOperationalSecurityDoctorReport,
  } = await import('./security/OperationalSecurityDoctor.js');
  const strict = rawArgs.includes('--strict') || rawArgs.includes('--require-pass');
  const report = buildOperationalSecurityDoctorReport({
    strict,
    workspace: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
    projectRoot,
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatOperationalSecurityDoctorReport(report));
  }

  return report.ok ? 0 : 1;
}

async function runPremiumDoctor(rawArgs: string[]): Promise<number> {
  const { runZavorthDoctorPremium } = await import('./cli/doctor/index.js');
  const result = runZavorthDoctorPremium({
    projectRoot,
    json: rawArgs.includes('--json'),
    strict: rawArgs.includes('--strict') || rawArgs.includes('--require-pass'),
    verbose: rawArgs.includes('--verbose') || rawArgs.includes('--debug') || rawArgs.includes('--all'),
    fix: rawArgs.includes('--fix') || rawArgs.includes('-f') || rawArgs.includes('--repair'),
    dryRun: rawArgs.includes('--dry-run') || rawArgs.includes('--dryrun'),
  });
  process.stdout.write(result.output);
  return result.exitCode;
}

async function runDiagnosticsExport(rawArgs: string[]): Promise<number> {
  const { DiagnosticsExporterService } = await import('./services/DiagnosticsExporterService.js');

  let explicitOutput = readFlexibleStringFlag(rawArgs, 'output');
  if (!explicitOutput) {
    const oIndex = rawArgs.indexOf('-o');
    if (oIndex >= 0 && rawArgs[oIndex + 1]) {
      explicitOutput = rawArgs[oIndex + 1];
    }
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultPath = path.join(projectRoot, `diagnostics-export-${timestamp}.json`);
  const outputPath = explicitOutput ? path.resolve(explicitOutput) : defaultPath;

  try {
    const exporter = new DiagnosticsExporterService();
    const report = await exporter.export({
      projectRoot,
      outputPath,
    });

    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify({ ok: true, outputPath, report }, null, 2)}\n`);
    } else {
      await printCliPanel('Diagnostics export', [
        `Status: exported`,
        `Output path: ${outputPath}`,
        `Logs gathered: ${report.logs.length}`,
        `Exported at: ${report.exportedAt}`,
        `Sanitization: all secrets, local paths and sensitive keys have been redacted.`,
      ], 'success');
    }
    return 0;
  } catch (error: any) {
    await logCliError(`Failed to export diagnostics: ${error?.message || String(error)}`, 'Export Failed');
    return 1;
  }
}

async function runPremiumHome(rawArgs: string[]): Promise<number> {
  const { runZavorthCliHome } = await import('./cli/home/index.js');
  const result = runZavorthCliHome({
    projectRoot,
    json: rawArgs.includes('--json'),
  });
  process.stdout.write(result.output);
  return result.exitCode;
}

async function runZavorthHomeCommand(rawArgs: string[]): Promise<number> {
  const { ZavorthHomePathService } = await import('./services/ZavorthHomePathService.js');
  const subcommand = String(rawArgs[0] || 'status').trim().toLowerCase();
  const explicitHome = readFlexibleStringFlag(rawArgs, 'home');
  const approvalId = readFlexibleStringFlag(rawArgs, 'approval-id');
  const service = new ZavorthHomePathService({ projectRoot, explicitHome, env: process.env });
  const snapshot = subcommand === 'switch'
    ? service.previewSwitch({ home: explicitHome || process.env.ZAVORTH_HOME || '' })
    : subcommand === 'migrate' && rawArgs.includes('--rollback')
      ? service.rollbackMigration({ approvalId })
      : subcommand === 'migrate' && rawArgs.includes('--apply')
        ? service.applyMigration({ approvalId, overwrite: rawArgs.includes('--overwrite') })
        : subcommand === 'migrate' || rawArgs.includes('--preview')
          ? service.buildMigrationPreview()
          : service.resolveSnapshot();

  let switchResult: { written: boolean; envFile: string; key: 'ZAVORTH_HOME' } | null = null;
  if (subcommand === 'switch' && rawArgs.includes('--apply') && snapshot.isolated && snapshot.root) {
    switchResult = writeZavorthHomeEnvSelection(projectRoot, snapshot.root);
    process.env.ZAVORTH_HOME = snapshot.root;
  }

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return snapshot.migration.status === 'blocked' ? 1 : 0;
  }

  const lines = [
    `root: ${snapshot.root}`,
    `source: ${snapshot.source}`,
    `isolated: ${snapshot.isolated ? 'yes' : 'no'}`,
    `migration: ${snapshot.migration.status}`,
    `data: ${snapshot.resolvedPaths.dataDir}`,
    `runtime: ${snapshot.resolvedPaths.runtimeDir}`,
    `receipts: ${snapshot.resolvedPaths.receiptsDir}`,
    `status command: ${snapshot.dailyUse.statusCommand}`,
    `switch command: ${snapshot.dailyUse.switchCommand}`,
    snapshot.warnings.length ? `warnings: ${snapshot.warnings.join(' | ')}` : 'warnings: none',
  ];
  if (subcommand === 'switch') {
    lines.push(
      '',
      rawArgs.includes('--apply')
        ? `switched: ${switchResult?.written ? `ZAVORTH_HOME written to ${switchResult.envFile}` : 'no .env update was needed'}`
        : 'switch preview only. Add --apply to write ZAVORTH_HOME into .env.',
      'Use --home <path> for one command, or switch to persist this instance home.',
    );
  }
  if (subcommand === 'migrate') {
    lines.push(
      '',
      'migration preview:',
      ...snapshot.migration.entries.map((entry) => (
        `- ${entry.kind.padEnd(9)} ${entry.exists ? 'found' : 'missing'} ${entry.redactedSource} -> ${entry.redactedDestination} risk=${entry.risk}`
      )),
      '',
      snapshot.migration.writesPerformed
        ? `${snapshot.migration.status} with approval ${snapshot.migration.approvalId}`
        : 'no data was written without --apply --approval-id=<id>',
    );
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return snapshot.migration.status === 'blocked' ? 1 : 0;
}

function writeZavorthHomeEnvSelection(root: string, homeRoot: string): { written: boolean; envFile: string; key: 'ZAVORTH_HOME' } {
  const envFile = path.join(root, '.env');
  const key = 'ZAVORTH_HOME' as const;
  const nextLine = `${key}=${homeRoot}`;
  let current = '';
  try {
    current = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  } catch {
    current = '';
  }
  const lines = current.split(/\r?\n/u);
  let changed = false;
  let seen = false;
  const next = lines.map((line) => {
    if (!line.trim() || line.trim().startsWith('#')) {
      return line;
    }
    if (/^ZAVORTH_HOME\s*=/u.test(line)) {
      seen = true;
      if (line === nextLine) {
        return line;
      }
      changed = true;
      return nextLine;
    }
    return line;
  });
  if (!seen) {
    if (next.length > 0 && next[next.length - 1] !== '') {
      next.push('');
    }
    next.push(nextLine);
    changed = true;
  }
  if (!changed) {
    return { written: false, envFile, key };
  }
  writeFileSync(envFile, `${next.join('\n').replace(/\n+$/u, '')}\n`, 'utf8');
  return { written: true, envFile, key };
}

async function runZavorthEchoWakeCommand(rawArgs: string[]): Promise<number> {
  const { VoiceWakeRuntimeService } = await import('./services/VoiceWakeRuntimeService.js');
  const { VoiceWakeDetectorSetupService } = await import('./services/VoiceWakeDetectorSetupService.js');
  const { ZavorthHomePathService } = await import('./services/ZavorthHomePathService.js');
  const subcommand = String(rawArgs[0] || 'status').trim().toLowerCase();
  if (subcommand === 'setup' || subcommand === 'configure') {
    const setup = new VoiceWakeDetectorSetupService({ projectRoot, env: process.env });
    const snapshot = setup.buildPlan({
      choice: rawArgs.includes('--disabled')
        ? 'disabled'
        : rawArgs.includes('--custom-command')
          ? 'custom-command'
          : 'default-local',
      command: readFlexibleStringFlag(rawArgs, 'command') || readTaskPositional(rawArgs, 1),
      args: readFlexibleStringFlag(rawArgs, 'args'),
      apply: rawArgs.includes('--apply') || rawArgs.includes('--yes'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(setup.renderText(snapshot));
    }
    return 0;
  }
  const explicitHome = readFlexibleStringFlag(rawArgs, 'home');
  const home = new ZavorthHomePathService({ projectRoot, explicitHome, env: process.env }).resolveSnapshot();
  const service = new VoiceWakeRuntimeService({
    stateFile: path.join(home.resolvedPaths.runtimeDir, 'voice-wake-session.json'),
    env: process.env,
  });
  const ttlMs = readDurationMsFlag(rawArgs, 'ttl');
  const session = subcommand === 'arm'
    ? service.arm(ttlMs)
    : subcommand === 'disarm'
      ? service.disarm()
      : service.status();

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(session, null, 2)}\n`);
  } else {
    process.stdout.write([
      `wake: ${session.mode}`,
      `armedUntil: ${session.armedUntil || 'off'}`,
      `detector: ${session.detector.configured ? session.detector.kind : 'not configured'}`,
      `privacy: local wake, no raw audio persistence`,
      `receipt: ${session.lastReceipt ? `${session.lastReceipt.event} (${session.lastReceipt.id})` : 'none'}`,
    ].join('\n') + '\n');
  }
  return 0;
}

async function runZavorthTasksCommand(rawArgs: string[]): Promise<number> {
  const { TaskPlaneService } = await import('./services/TaskPlaneService.js');
  const { ZavorthHomePathService } = await import('./services/ZavorthHomePathService.js');
  const subcommand = String(rawArgs[0] || 'list').trim().toLowerCase();
  const explicitHome = readFlexibleStringFlag(rawArgs, 'home');
  const home = new ZavorthHomePathService({ projectRoot, explicitHome, env: process.env }).resolveSnapshot();
  const service = new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
  });

  let result: unknown;
  if (subcommand === 'create' || subcommand === 'add') {
    result = service.createTask({
      title: readFlexibleStringFlag(rawArgs, 'title') || readTaskPositional(rawArgs, 1) || 'Untitled task',
      source: readFlexibleStringFlag(rawArgs, 'source') || 'cli',
      approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
    });
  } else if (subcommand === 'claim') {
    result = service.claimTask(
      readTaskPositional(rawArgs, 1) || '',
      readFlexibleStringFlag(rawArgs, 'owner') || process.env.USERNAME || process.env.USER || 'operator',
      readDurationMsFlag(rawArgs, 'lease'),
    );
  } else if (subcommand === 'cancel') {
    result = service.cancelTask(readTaskPositional(rawArgs, 1) || '', 'cli', readFlexibleStringFlag(rawArgs, 'reason') || 'Cancelled from CLI.');
  } else if (subcommand === 'retry') {
    result = service.retryTask(readTaskPositional(rawArgs, 1) || '', 'cli');
  } else {
    result = service.snapshot();
  }

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result ? 0 : 1;
  }

  if (!result) {
    process.stdout.write('Task not found or not eligible for that operation.\n');
    return 1;
  }
  const snapshot = service.snapshot();
  process.stdout.write([
    `tasks: ${snapshot.items.length}`,
    `queued: ${snapshot.summary.queued}`,
    `running: ${snapshot.summary.running}`,
    `waiting_approval: ${snapshot.summary.waiting_approval}`,
    ...snapshot.items.slice(0, 12).map((task) => `- ${task.status.padEnd(16)} ${task.id} ${task.title}`),
  ].join('\n') + '\n');
  return 0;
}

async function runZavorthFriendlyWorkCommand(
  command: 'todo' | 'later' | 'work' | 'done' | 'retry' | 'cancel',
  rawArgs: string[],
): Promise<number> {
  const { ZavorthFriendlyWorkCommandService } = await import('./services/ZavorthFriendlyWorkCommandService.js');
  const service = new ZavorthFriendlyWorkCommandService({
    projectRoot,
    explicitHome: readFlexibleStringFlag(rawArgs, 'home'),
    env: process.env,
  });
  const result = service.run(command, rawArgs);
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${result.lines.join('\n')}\n`);
  }
  return result.ok ? 0 : 1;
}

async function runPremiumHatch(rawArgs: string[]): Promise<number> {
  if (rawArgs.includes('--start')) {
    return runPromotedScript('ops-go', rawArgs.filter((arg) => arg !== '--start'));
  }
  const { runZavorthCliHatch } = await import('./cli/hatch/index.js');
  const result = runZavorthCliHatch({
    projectRoot,
    json: rawArgs.includes('--json'),
  });
  process.stdout.write(result.output);
  return result.exitCode;
}

async function runPremiumQuickStart(rawArgs: string[]): Promise<number> {
  const { runZavorthCliQuickStart } = await import('./cli/quickstart/index.js');
  const result = runZavorthCliQuickStart({
    projectRoot,
    json: rawArgs.includes('--json'),
  });
  process.stdout.write(result.output);
  return result.exitCode;
}

async function runPremiumApprovalDiff(view: 'approvals' | 'diff', rawArgs: string[]): Promise<number> {
  const { runZavorthCliApprovalDiff } = await import('./cli/approval-diff/index.js');
  const result = runZavorthCliApprovalDiff({
    projectRoot,
    view,
    args: rawArgs,
    json: rawArgs.includes('--json'),
  });

  const isInteractive = !rawArgs.includes('--json') && !rawArgs.includes('--yes') && process.stdout.isTTY;
  if (view === 'approvals' && isInteractive) {
    const targetPlanId = result.snapshot.targetPlanId;
    if (targetPlanId) {
      const targetCard = result.snapshot.cards.find(c => c.id === targetPlanId);
      if (targetCard && (targetCard.status === 'waiting_approval' || targetCard.approvalStatus === 'pending')) {
        // Render current preview first
        process.stdout.write(result.output);

        const { TerminalPanel } = await import('./cli/presentation/TerminalPanel.js');
        const { TerminalPrompt } = await import('./cli/presentation/TerminalPrompt.js');

        const riskTitle = `Risk detected: level ${targetCard.riskLevel.toUpperCase()}`;
        const riskDetails = [
          `Requested action: ${targetCard.actionId} (domain: ${targetCard.domain})`,
          `Approval reason: ${targetCard.approvalReason}`,
          `Affected files: ${targetCard.files.join(' ') || 'none'}`,
          `Commands to run: ${targetCard.commands.join(' ') || 'none'}`,
          `Network/external impact: ${targetCard.resourceImpact.externalExposure}`,
        ].join('\n');

        const panelType = (targetCard.riskLevel === 'critical' || targetCard.riskLevel === 'high') ? 'error' : 'warning';
        TerminalPanel.print(riskDetails, {
          title: riskTitle,
          type: panelType,
        });

        const confirmed = await TerminalPrompt.confirm(`Approve plan '${targetCard.id}'?`, false);
        if (confirmed) {
          const approvedArgs = [...rawArgs, '--yes'];
          const approvedResult = runZavorthCliApprovalDiff({
            projectRoot,
            view,
            args: approvedArgs,
            json: false,
          });
          process.stdout.write(approvedResult.output);
          return approvedResult.exitCode;
        } else {
          TerminalPanel.error('Approval cancelled by the operator.', 'Cancelled');
          return 1;
        }
      }
    }
  }

  process.stdout.write(result.output);
  return result.exitCode;
}

async function runPremiumHud(rawArgs: string[]): Promise<number> {
  const { runZavorthCliHudInteractive } = await import('./cli/hud/index.js');
  const result = await runZavorthCliHudInteractive({
    projectRoot,
    args: rawArgs,
    json: rawArgs.includes('--json'),
  });
  if (result.snapshot.mode !== 'interactive') {
    process.stdout.write(result.output);
  }
  return result.exitCode;
}

function resolveDailyHudArgs(rawArgs: string[]): string[] {
  const first = String(rawArgs[0] || '').trim().toLowerCase();
  const hasApprovalAction = rawArgs.includes('--action')
    || rawArgs.some((arg) => arg.startsWith('--action='))
    || rawArgs.includes('--plan')
    || rawArgs.some((arg) => arg.startsWith('--plan='))
    || rawArgs.includes('--select')
    || rawArgs.some((arg) => arg.startsWith('--select='))
    || first === 'review'
    || first === 'guide';
  const explicitRuntime = first === 'runtime'
    || first === 'tui'
    || rawArgs.includes('--runtime')
    || rawArgs.includes('--tui');
  if (hasApprovalAction || explicitRuntime) {
    return rawArgs;
  }
  return ['runtime', ...rawArgs];
}

async function runPremiumSetupStudio(rawArgs: string[]): Promise<number> {
  const { runZavorthSetupStudioCommand } = await import('./cli/setup-studio/index.js');
  const result = await runZavorthSetupStudioCommand({
    projectRoot,
    args: rawArgs,
    json: rawArgs.includes('--json'),
  });
  process.stdout.write(result.output);
  return result.exitCode;
}


async function runGitWorkflowCommand(
  action: 'status' | 'branch' | 'commit' | 'pr',
  rawArgs: string[],
): Promise<number> {
  const { ZavorthGitWorkflowService } = await import('./services/ZavorthGitWorkflowService.js');
  const service = new ZavorthGitWorkflowService();
  const asJson = rawArgs.includes('--json');
  const workspaceRoot = readFlexibleStringFlag(rawArgs, 'workspace') || readFlexibleStringFlag(rawArgs, 'workspaceRoot') || process.cwd();
  const apply = rawArgs.includes('--apply') || rawArgs.includes('--yes');
  const approvalId = readFlexibleStringFlag(rawArgs, 'approval-id')
    || readFlexibleStringFlag(rawArgs, 'approval')
    || (rawArgs.includes('--yes') ? 'cli-local-owner' : null);
  const args = rawArgs
    .filter((arg) => arg !== '--json' && arg !== '--apply' && arg !== '--yes')
    .join(' ');
  const snapshot = await service.run({
    action,
    workspaceRoot,
    args,
    apply,
    approvalId,
    approvedBy: readFlexibleStringFlag(rawArgs, 'by') || 'zavorth-cli',
  });
  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    await printCliPanel(`Zavorth ${action}`, [
      snapshot.summary,
      `status: ${snapshot.status}`,
      `workspace: ${snapshot.workspaceRoot}`,
      `branch: ${snapshot.branch || 'unknown'}`,
      `dirty files: ${snapshot.dirtyFiles}`,
      snapshot.plannedCommands.length
        ? `plan: ${snapshot.plannedCommands.map((entry) => `${entry.command} ${entry.args.join(' ')}`).join(' && ')}`
        : null,
      snapshot.approval.required
        ? `approval: ${snapshot.approval.satisfied ? snapshot.approval.approvalId : 'required for --apply'}`
        : null,
      snapshot.receipt ? `receipt: ${snapshot.receipt.receiptId}` : null,
    ].filter((line): line is string => Boolean(line)), snapshot.status === 'applied' || snapshot.status === 'ready' ? 'success' : snapshot.status === 'blocked' || snapshot.status === 'failed' ? 'error' : 'warning');
  }
  return snapshot.status === 'blocked' || snapshot.status === 'failed' ? 1 : 0;
}

async function runContinuousSecurityMonitor(rawArgs: string[]): Promise<number> {
  const {
    buildContinuousSecurityMonitorReport,
    formatContinuousSecurityMonitorReport,
    writeContinuousSecurityBaseline,
  } = await import('./security/ContinuousSecurityMonitor.js');
  const strict = rawArgs.includes('--strict') || rawArgs.includes('--require-pass');
  const updateBaseline = rawArgs.includes('--update-baseline') || rawArgs[0] === 'baseline';
  const baselinePath = readFlexibleStringFlag(rawArgs, 'baseline');
  const workspace = readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot;

  if (updateBaseline) {
    const baseline = writeContinuousSecurityBaseline({
      workspace,
      projectRoot,
      baselinePath,
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify({ ok: true, baseline }, null, 2)}\n`);
    } else {
      await printCliPanel('Security baseline', [
        'Baseline updated.',
        `updated at: ${baseline.updatedAt}`,
      ], 'success');
    }
    return 0;
  }

  const report = buildContinuousSecurityMonitorReport({
    strict,
    requireBaseline: rawArgs.includes('--require-baseline'),
    workspace,
    projectRoot,
    baselinePath,
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatContinuousSecurityMonitorReport(report));
  }

  return report.ok ? 0 : 1;
}

async function runSecurityOperationalPreset(rawArgs: string[]): Promise<number> {
  const {
    applySecurityOperationalPreset,
    formatApplySecurityOperationalPresetResult,
    formatSecurityOperationalPresetInspection,
    formatSecurityOperationalPresetList,
    getSecurityOperationalPreset,
    inspectSecurityOperationalPreset,
    listSecurityOperationalPresets,
  } = await import('./security/SecurityOperationalPreset.js');
  const action = String(rawArgs[0] || '').trim().toLowerCase();
  const asJson = rawArgs.includes('--json');
  if (!action || action === 'list' || action === 'presets') {
    const presets = listSecurityOperationalPresets();
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ presets }, null, 2)}\n`);
    } else {
      process.stdout.write(formatSecurityOperationalPresetList());
    }
    return 0;
  }

  if (action === 'status') {
    const inspection = inspectSecurityOperationalPreset({ projectRoot });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
    } else {
      process.stdout.write(formatSecurityOperationalPresetInspection(inspection));
    }
    return inspection.status === 'ready' ? 0 : 1;
  }

  const preset = getSecurityOperationalPreset(action);
  if (!preset) {
    await logCliError(`Preset de seguranca desconhecido: ${action}.`, 'Security Preset Error');
    return 1;
  }

  if (!rawArgs.includes('--apply') && !rawArgs.includes('apply')) {
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ preset }, null, 2)}\n`);
    } else {
      await printCliPanel('Security preset preview', [
        `${preset.id}: ${preset.label}`,
        `profile: ${preset.securityProfile}`,
        `MCP: ${preset.mcpPolicy.profile}`,
        `skills: ${preset.skillPolicy.defaultPolicy}`,
        preset.summary,
        '',
        `Apply: zavorth security preset ${preset.id} --apply`,
      ], 'warning');
    }
    return 0;
  }

  const result = applySecurityOperationalPreset({
    preset: preset.id,
    projectRoot,
    appliedBy: 'zavorth-cli',
  });
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatApplySecurityOperationalPresetResult(result));
  }
  return 0;
}

async function runMinimalKernel(rawArgs: string[]): Promise<number> {
  const { MinimalRuntimeKernel } = await import('./core/MinimalRuntimeKernel.js');
  const asJson = rawArgs.includes('--json');
  const once = rawArgs.includes('--once') || rawArgs.includes('--dry-run') || rawArgs.includes('--snapshot');
  const profileArg = rawArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
  const kernel = new MinimalRuntimeKernel({ profile: profileArg || 'minimal' });
  const snapshot = await kernel.start();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    await printCliPanel('Minimal runtime kernel', [
      `status: ${snapshot.status}`,
      `profile: ${snapshot.profile}`,
      `budget: ${snapshot.budget.ok ? 'ok' : 'violated'}`,
      `memory: rss ${snapshot.budget.snapshot.runtime.rssMb}/${snapshot.budget.thresholds.rssMb} MB | heap ${snapshot.budget.snapshot.runtime.heapUsedMb}/${snapshot.budget.thresholds.heapUsedMb} MB`,
      `runtime profile: ${snapshot.runtimeProfile.label} | polling ${snapshot.runtimeProfile.pollingMode} | sidecars ${snapshot.runtimeProfile.maxActiveSidecars}`,
      `registry: total ${snapshot.capabilityRegistry.total} | boot ${snapshot.capabilityRegistry.activeOnBoot} | on-demand ${snapshot.capabilityRegistry.onDemand} | sidecars ${snapshot.capabilityRegistry.sidecars}`,
      `sidecars: total ${snapshot.sidecarManager.total} | launchable ${snapshot.sidecarManager.launchable} | running ${snapshot.sidecarManager.running}`,
      `scheduler: tasks ${snapshot.scheduler.taskCount} | event-first ${snapshot.scheduler.eventFirstTasks} | adaptive ${snapshot.scheduler.adaptiveTasks} | active timers ${snapshot.scheduler.activeTimers}`,
      `capabilities: ${snapshot.capabilities.map((capability) => capability.id).join(', ')}`,
    ], snapshot.budget.ok ? 'success' : 'warning');
  }

  if (once) {
    await kernel.stop('once');
    return snapshot.budget.ok ? 0 : 1;
  }

  await kernel.runUntilSignal();
  return 0;
}

async function runAiFirstOwnerControlledDefault(rawArgs: string[]): Promise<number> {
  const { AiFirstOwnerControlledDefaultActivationService } = await import('./services/AiFirstOwnerControlledDefaultActivationService.js');
  const action = String(rawArgs[0] || 'status').trim().toLowerCase();
  if (action === 'prepare') {
    const { AiFirstActivationPreparationService } = await import('./services/AiFirstActivationPreparationService.js');
    const service = new AiFirstActivationPreparationService({
      outputDir: readFlexibleStringFlag(rawArgs, 'output-dir') || undefined,
    });
    const result = service.prepare({
      ownerApprovalId: readFlexibleStringFlag(rawArgs, 'owner-approval-id'),
      outputPath: readFlexibleStringFlag(rawArgs, 'output'),
      write: !rawArgs.includes('--no-write'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${service.renderText(result)}\n`);
    }
    return rawArgs.includes('--require-pass') && result.status !== 'ready' ? 1 : 0;
  }
  const service = new AiFirstOwnerControlledDefaultActivationService({
    dataDir: readFlexibleStringFlag(rawArgs, 'data-dir') || undefined,
    statePath: readFlexibleStringFlag(rawArgs, 'state-path') || undefined,
    ledgerPath: readFlexibleStringFlag(rawArgs, 'ledger-path') || undefined,
  });
  let result: import('./contracts/AiFirstOwnerControlledDefaultActivationContract.js').AiFirstOwnerControlledDefaultResult;
  if (action === 'plan' || action === 'activate') {
    const snapshotPath = readFlexibleStringFlag(rawArgs, 'snapshot');
    const snapshot = snapshotPath ? service.readSnapshotFile(snapshotPath) : null;
    const input = {
      snapshot,
      ownerApprovalId: readFlexibleStringFlag(rawArgs, 'owner-approval-id'),
      apply: rawArgs.includes('--apply'),
      confirmOwnerControlledDefault: rawArgs.includes('--confirm-owner-controlled-default'),
    };
    result = action === 'activate' ? service.activate(input) : service.plan(input);
  } else if (action === 'rollback') {
    result = service.rollback({
      ownerApprovalId: readFlexibleStringFlag(rawArgs, 'owner-approval-id'),
      apply: rawArgs.includes('--apply'),
      confirmRollback: rawArgs.includes('--confirm-rollback'),
      reason: readFlexibleStringFlag(rawArgs, 'reason'),
    });
  } else if (action === 'status') {
    result = service.status(readNumberFlag(rawArgs, 'limit') || 20);
  } else {
    await logCliError('Use: zavorth ai-first plan|activate|status|rollback', 'Usage Error');
    return 1;
  }

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(result)}\n`);
  }

  return rawArgs.includes('--require-pass') && ['blocked', 'missing'].includes(result.status) ? 1 : 0;
}

async function runPromotedScript(
  scriptBaseName: 'setup-v3' | 'ops-go',
  forwardedArgs: string[] = [],
): Promise<number> {
  const distScript = path.join(projectRoot, 'dist-ops', 'scripts', `${scriptBaseName}.js`);
  if (runningFromDist && existsSync(distScript)) {
    return spawnInherited(process.execPath, [distScript, ...forwardedArgs], projectRoot);
  }

  return npmInherited(['exec', 'tsx', '--', `scripts/${scriptBaseName}.ts`, ...forwardedArgs], projectRoot);
}

function buildQuickSandboxHostReadiness() {
  return {
    inspect: () => {
      const generatedAt = new Date().toISOString();
      return {
        phase: '38' as const,
        generatedAt,
        platform: process.platform,
        osRelease: 'quick-projection',
        summary: {
          ok: true,
          readyTiers: ['local-jail' as const],
          dormantTiers: ['docker' as const, 'gvisor' as const, 'firecracker' as const],
          unavailableStrongTiers: ['docker' as const, 'gvisor' as const, 'firecracker' as const],
          blockingIssues: [],
        },
        defaultPolicy: {
          strongSandboxReady: false,
          liveMutationDefault: 'dry-run-only' as const,
          safeWithoutStrongSandbox: ['read-only' as const, 'preview' as const, 'doctor' as const, 'receipt' as const],
          blockedWithoutStrongSandbox: [
            'workspace-write' as const,
            'host-command' as const,
            'network-write' as const,
            'channel-send' as const,
            'live-skill-apply' as const,
          ],
          explanation: 'Quick projection never claims live mutations; use advanced doctor to confirm Docker, gVisor or Firecracker.',
        },
        tiers: [
          {
            id: 'local-jail' as const,
            label: 'Local jail sandbox',
            status: 'ready' as const,
            canRun: true,
            strongBoundary: false,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Quick projection keeps read-only and preview available without probing Docker.'],
            checks: [],
          },
          {
            id: 'docker' as const,
            label: 'Docker hardened sandbox',
            status: 'dormant' as const,
            canRun: false,
            strongBoundary: true,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Run zavorth doctor --advanced or zavorth product --view=sandbox --probe to inspect Docker.'],
            checks: [],
          },
          {
            id: 'gvisor' as const,
            label: 'gVisor runsc sandbox',
            status: 'dormant' as const,
            canRun: false,
            strongBoundary: true,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Run the advanced sandbox doctor for runtime-specific details.'],
            checks: [],
          },
          {
            id: 'firecracker' as const,
            label: 'Firecracker MicroVM sandbox',
            status: 'dormant' as const,
            canRun: false,
            strongBoundary: true,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Run the advanced sandbox doctor on a Linux/KVM-capable host.'],
            checks: [],
          },
        ],
        actions: ['Run zavorth doctor --advanced for a live sandbox probe.'],
        contracts: [
          'Quick product projections do not start Docker, VM, sidecar or persistent process.',
          'Mutable actions remain dry-run unless a strong sandbox is confirmed.',
        ],
      };
    },
  };
}

async function runProductizationProtectedRuntime(
  view: 'all' | 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox',
  rawArgs: string[] = [],
): Promise<number> {
  const { ZavorthProductizationProtectedRuntimeService } = await import('./services/ZavorthProductizationProtectedRuntimeService.js');
  const shouldProbeSandbox = rawArgs.includes('--advanced') || rawArgs.includes('--probe');
  const service = new ZavorthProductizationProtectedRuntimeService(
    shouldProbeSandbox ? {} : { sandboxHostReadiness: buildQuickSandboxHostReadiness() },
  );
  const detailMode = rawArgs.includes('--advanced')
    ? 'advanced'
    : rawArgs.includes('--simple')
      ? 'simple'
      : readFlexibleStringFlag(rawArgs, 'detail');
  const snapshot = service.buildSnapshot({
    dailyMode: readFlexibleStringFlag(rawArgs, 'mode'),
    detailMode,
    selectedTemplateId: readFlexibleStringFlag(rawArgs, 'template'),
    request: readFlexibleStringFlag(rawArgs, 'request'),
  });

  if (rawArgs.includes('--json')) {
    const payload =
      view === 'journey' ? snapshot.firstRun
        : view === 'templates' ? snapshot.templates
          : view === 'missions' ? snapshot.mission
            : view === 'receipts' ? snapshot.receipt
              : view === 'sandbox' ? snapshot.sandbox
                : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot, view));
  }

  return 0;
}

async function runExperienceProfiles(rawArgs: string[] = []): Promise<number> {
  const { ZavorthExperienceProfileService } = await import('./services/ZavorthExperienceProfileService.js');
  const service = new ZavorthExperienceProfileService();
  const positionalIntent = rawArgs.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  const contract = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    intent: readFlexibleStringFlag(rawArgs, 'intent') || positionalIntent,
    dailyMode: readFlexibleStringFlag(rawArgs, 'mode') || readFlexibleStringFlag(rawArgs, 'daily-mode'),
    detailMode: readFlexibleStringFlag(rawArgs, 'detail') || readFlexibleStringFlag(rawArgs, 'detail-mode'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(contract, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(contract));
  }

  return 0;
}

async function runConversationalSetup(rawArgs: string[] = []): Promise<number> {
  const { ZavorthConversationalSetupService } = await import('./services/ZavorthConversationalSetupService.js');
  const service = new ZavorthConversationalSetupService();
  const positionalIntent = rawArgs.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  const snapshot = service.buildSnapshot({
    agentName: readFlexibleStringFlag(rawArgs, 'agent-name'),
    userName: readFlexibleStringFlag(rawArgs, 'user-name'),
    preferredAddress: readFlexibleStringFlag(rawArgs, 'call-me') || readFlexibleStringFlag(rawArgs, 'preferred-address'),
    language: readFlexibleStringFlag(rawArgs, 'language') || readFlexibleStringFlag(rawArgs, 'lang'),
    primaryUse: readFlexibleStringFlag(rawArgs, 'primary-use')
      || readFlexibleStringFlag(rawArgs, 'use-case')
      || readFlexibleStringFlag(rawArgs, 'intent')
      || positionalIntent,
    intent: readFlexibleStringFlag(rawArgs, 'intent') || positionalIntent,
    experienceProfile: readFlexibleStringFlag(rawArgs, 'profile') || readFlexibleStringFlag(rawArgs, 'experience-profile'),
    detailLevel: readFlexibleStringFlag(rawArgs, 'detail') || readFlexibleStringFlag(rawArgs, 'detail-level'),
    approvalChannel: readFlexibleStringFlag(rawArgs, 'approval-channel') || readFlexibleStringFlag(rawArgs, 'approvals'),
    firstSafeMission: readFlexibleStringFlag(rawArgs, 'first-mission') || readFlexibleStringFlag(rawArgs, 'mission'),
    preferredTone: readFlexibleStringFlag(rawArgs, 'tone'),
    apply: rawArgs.includes('--apply'),
    confirmLocalProfile: rawArgs.includes('--confirm-local-profile') || rawArgs.includes('--yes'),
    completeBootstrap: rawArgs.includes('--complete-bootstrap'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return snapshot.status === 'blocked' ? 2 : 0;
}

async function runGuidedMissions(rawArgs: string[] = []): Promise<number> {
  const { ZavorthGuidedMissionsService } = await import('./services/ZavorthGuidedMissionsService.js');
  const service = new ZavorthGuidedMissionsService();
  const positionalIntent = rawArgs.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  const snapshot = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    intent: readFlexibleStringFlag(rawArgs, 'intent') || positionalIntent,
    missionId: readFlexibleStringFlag(rawArgs, 'mission') || readFlexibleStringFlag(rawArgs, 'template'),
    category: readFlexibleStringFlag(rawArgs, 'category'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runCapabilityStore(rawArgs: string[] = []): Promise<number> {
  const { ZavorthCapabilityStoreService } = await import('./services/ZavorthCapabilityStoreService.js');
  const service = new ZavorthCapabilityStoreService();
  const positionalQuery = rawArgs.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  const snapshot = service.buildContract({
    query: readFlexibleStringFlag(rawArgs, 'query') || positionalQuery,
    category: readFlexibleStringFlag(rawArgs, 'category'),
    selectedId: readFlexibleStringFlag(rawArgs, 'select') || readFlexibleStringFlag(rawArgs, 'id'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runDoItWithMe(rawArgs: string[] = []): Promise<number> {
  const { ZavorthDoItWithMeService } = await import('./services/ZavorthDoItWithMeService.js');
  const service = new ZavorthDoItWithMeService();
  const positionalRequest = rawArgs.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  const snapshot = service.buildContract({
    request: readFlexibleStringFlag(rawArgs, 'request') || positionalRequest,
    capabilityId: readFlexibleStringFlag(rawArgs, 'capability') || readFlexibleStringFlag(rawArgs, 'select'),
    missionId: readFlexibleStringFlag(rawArgs, 'mission'),
    category: readFlexibleStringFlag(rawArgs, 'category'),
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runTrustPanel(rawArgs: string[] = []): Promise<number> {
  const { ZavorthTrustPanelService } = await import('./services/ZavorthTrustPanelService.js');
  const service = new ZavorthTrustPanelService();
  const positionalQuery = rawArgs.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  const snapshot = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    query: readFlexibleStringFlag(rawArgs, 'query') || positionalQuery,
    category: readFlexibleStringFlag(rawArgs, 'category'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runTrustApprovalUxFinal(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-trust-approval-ux-final.ts', ...rawArgs], projectRoot);
}

async function runAutonomySlider(rawArgs: string[] = []): Promise<number> {
  const { ZavorthAutonomySliderService } = await import('./services/ZavorthAutonomySliderService.js');
  const service = new ZavorthAutonomySliderService();
  const positionalIntent = rawArgs.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  const snapshot = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    level: readFlexibleStringFlag(rawArgs, 'level') || readFlexibleStringFlag(rawArgs, 'autonomy'),
    intent: readFlexibleStringFlag(rawArgs, 'intent') || positionalIntent,
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runModelCostGuard(rawArgs: string[] = []): Promise<number> {
  const { ZavorthModelCostGuardService } = await import('./services/ZavorthModelCostGuardService.js');
  const service = new ZavorthModelCostGuardService();
  const positionalRequest = rawArgs.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  const snapshot = service.buildContract({
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    autonomy: readFlexibleStringFlag(rawArgs, 'autonomy') || readFlexibleStringFlag(rawArgs, 'level'),
    request: readFlexibleStringFlag(rawArgs, 'request') || positionalRequest,
    maxCents: readFlexibleStringFlag(rawArgs, 'max-cents') || readFlexibleStringFlag(rawArgs, 'budget-cents'),
    provider: readFlexibleStringFlag(rawArgs, 'provider'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runVisualReceiptsV2(rawArgs: string[] = []): Promise<number> {
  const { ZavorthVisualReceiptsV2Service } = await import('./services/ZavorthVisualReceiptsV2Service.js');
  const service = new ZavorthVisualReceiptsV2Service();
  const snapshot = service.buildSnapshot({
    includeAdvanced: rawArgs.includes('--advanced'),
    includeAdvancedStory: rawArgs.includes('--advanced-story') || rawArgs.includes('--advanced'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runSatelliteApprovalCompanion(rawArgs: string[] = []): Promise<number> {
  const { ZavorthSatelliteApprovalCompanionService } = await import('./services/ZavorthSatelliteApprovalCompanionService.js');
  const service = new ZavorthSatelliteApprovalCompanionService();
  const snapshot = service.buildSnapshot({
    user: readFlexibleStringFlag(rawArgs, 'user') || 'local-operator',
    missionId: readFlexibleStringFlag(rawArgs, 'mission'),
    includeAdvanced: rawArgs.includes('--advanced'),
    includeAdvancedStory: rawArgs.includes('--advanced-story') || rawArgs.includes('--advanced'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runNaturalRuntimeQuestions(rawArgs: string[] = []): Promise<number> {
  const { ZavorthNaturalRuntimeQuestionsService } = await import('./services/ZavorthNaturalRuntimeQuestionsService.js');
  const service = new ZavorthNaturalRuntimeQuestionsService();
  const positionalQuestion = rawArgs.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  const snapshot = service.buildSnapshot({
    question: readFlexibleStringFlag(rawArgs, 'question') || positionalQuestion,
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runZavorthControlExperienceHome(rawArgs: string[] = []): Promise<number> {
  const { ZavorthControlExperienceHomeService } = await import('./services/ZavorthControlExperienceHomeService.js');
  const service = new ZavorthControlExperienceHomeService();
  const snapshot = service.buildSnapshot();

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runRuntimeReadiness(rawArgs: string[] = []): Promise<number> {
  const action = String(rawArgs[0] || '').trim().toLowerCase();
  if (action === 'fixes' || rawArgs.includes('--fixes')) {
    return runRuntimeGuidedFixes(action === 'fixes' ? rawArgs.slice(1) : rawArgs);
  }
  if (action === 'fix') {
    return runRuntimeReadinessFix(rawArgs.slice(1));
  }
  const { ZavorthRuntimeReadinessService } = await import('./services/ZavorthRuntimeReadinessService.js');
  const { ZavorthRuntimeReadinessUxService } = await import('./services/ZavorthRuntimeReadinessUxService.js');
  const service = new ZavorthRuntimeReadinessService();
  const uxService = new ZavorthRuntimeReadinessUxService();
  const snapshot = await service.buildSnapshot({
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'operator',
    sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'runtime-readiness',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });
  const operatorUx = uxService.buildSnapshot(snapshot);

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ ...snapshot, operatorUx }, null, 2)}\n`);
  } else if (rawArgs.includes('--technical') || rawArgs.includes('--raw')) {
    process.stdout.write(service.renderText(snapshot));
  } else {
    process.stdout.write(uxService.renderCli(operatorUx));
  }

  return snapshot.status === 'blocked' || ((rawArgs.includes('--require-pass') || rawArgs.includes('--strict')) && snapshot.status !== 'ready')
    ? 1
    : 0;
}

async function runReadyToGo(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--watch') || rawArgs.includes('watch')) {
    return runStayOnline(rawArgs);
  }
  if (rawArgs.includes('--product') || rawArgs.includes('--certification') || rawArgs.includes('--final')) {
    const { ZavorthProductCertificationService } = await import('./services/ZavorthProductCertificationService.js');
    const service = new ZavorthProductCertificationService({
      projectRoot,
      includeDeepProductCheck: rawArgs.includes('--deep'),
    });
    const snapshot = await service.buildSnapshot();
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderCli(snapshot));
    }
    return snapshot.status === 'blocked'
      || ((rawArgs.includes('--require-pass') || rawArgs.includes('--strict')) && snapshot.status !== 'ready')
      ? 1
      : 0;
  }
  const { ZavorthReadyToGoService } = await import('./services/ZavorthReadyToGoService.js');
  const service = new ZavorthReadyToGoService();
  const snapshot = await service.buildSnapshot({
    refreshProviders: !rawArgs.includes('--offline') || rawArgs.includes('--refresh-providers'),
    includeAdvancedProviders: rawArgs.includes('--advanced'),
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'operator',
    sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'ready-to-go',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }
  return snapshot.status === 'blocked' || ((rawArgs.includes('--require-pass') || rawArgs.includes('--strict')) && snapshot.status !== 'ready')
    ? 1
    : 0;
}

async function runOneCommandOperatorCheck(rawArgs: string[] = []): Promise<number> {
  const { ZavorthOneCommandOperatorCheckService } = await import('./services/ZavorthOneCommandOperatorCheckService.js');
  const service = new ZavorthOneCommandOperatorCheckService();
  const snapshot = await service.buildSnapshot({
    live: rawArgs.includes('--live'),
    strict: rawArgs.includes('--strict') || rawArgs.includes('--require-pass'),
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'operator',
    sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'operator-check',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }
  return snapshot.status === 'blocked' || ((rawArgs.includes('--strict') || rawArgs.includes('--require-pass')) && snapshot.strictPass !== true)
    ? 1
    : 0;
}

async function runStayOnline(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-stay-online.ts', ...rawArgs], projectRoot);
}

async function runSmartCommands(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-smart-commands.ts', ...rawArgs], projectRoot);
}

async function runExternalAgentOnboarding(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-external-agent-onboarding.ts', ...rawArgs], projectRoot);
}

async function runExternalAgentMigrationPack(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-external-agent-migration-pack.ts', ...rawArgs], projectRoot);
}

async function runExternalAgentGateway(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-external-agent-gateway.ts', ...rawArgs], projectRoot);
}

async function runCapabilityMesh(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-capability-mesh.ts', ...rawArgs], projectRoot);
}

async function runAgentReview(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-agent-review.ts', ...rawArgs], projectRoot);
}

async function runSkillCurator(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-skill-curator-live-loop.ts', ...rawArgs], projectRoot);
}

async function runPersistentApprovals(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-persistent-approval-policy.ts', ...rawArgs], projectRoot);
}

async function runSkillExpansionPack(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-skill-expansion-pack.ts', ...rawArgs], projectRoot);
}

async function runCapabilityCertification(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-capability-certification.ts', ...rawArgs], projectRoot);
}

async function runProviderConsistency(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-provider-certification.ts', ...rawArgs], projectRoot);
}

async function runProviderCapabilityCatalog(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-provider-capability-catalog.ts', ...rawArgs], projectRoot);
}

async function runProviderCapabilityMatrix(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-provider-capability-matrix.ts', ...rawArgs], projectRoot);
}

async function runNativeIntegrations(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-native-integrations.ts', ...rawArgs], projectRoot);
}

async function runProviderChannelWizard(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-provider-channel-wizard.ts', ...rawArgs], projectRoot);
}

async function runChannelCapabilityCatalog(rawArgs: string[] = []): Promise<number> {
  const forwarded = rawArgs.includes('--json') ? ['--json'] : [];
  return npmInherited(['exec', 'tsx', '--', 'scripts/channel-long-tail-activation.ts', ...forwarded], projectRoot);
}

async function runChannelCapabilityAtlas(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-channel-capability-atlas.ts', ...rawArgs], projectRoot);
}

async function runChannelDeepening(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-channel-deepening.ts', ...rawArgs], projectRoot);
}

async function runNativeLearningLoop(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-native-learning-loop.ts', ...rawArgs], projectRoot);
}

async function runZavorthConvergenceDoctor(rawArgs: string[] = []): Promise<number> {
  const { ZavorthNativeConvergenceService } = await import('./services/ZavorthNativeConvergenceService.js');
  const restoreConsole = rawArgs.includes('--json') ? silenceConsoleLogToStderr() : () => undefined;
  const service = new ZavorthNativeConvergenceService({ projectRoot });
  const snapshot = await service.buildSnapshot();
  restoreConsole();
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }
  return (rawArgs.includes('--strict') || rawArgs.includes('--require-pass')) && snapshot.status !== 'ready' ? 1 : 0;
}

async function runZavorthProductHardeningDoctor(rawArgs: string[] = []): Promise<number> {
  const { ZavorthProductHardeningService } = await import('./services/ZavorthProductHardeningService.js');
  const restoreConsole = rawArgs.includes('--json') ? silenceConsoleLogToStderr() : () => undefined;
  const service = new ZavorthProductHardeningService({ projectRoot });
  const snapshot = await service.buildSnapshot();
  restoreConsole();
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }
  return (rawArgs.includes('--strict') || rawArgs.includes('--require-pass')) && snapshot.status !== 'ready' ? 1 : 0;
}

function silenceConsoleLogToStderr(): () => void {
  const originalLog = console.log;
  console.log = (...values: unknown[]) => {
    process.stderr.write(`${values.map((value) => String(value)).join(' ')}\n`);
  };
  return () => {
    console.log = originalLog;
  };
}

async function runGatewayMatrix(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-gateway-matrix.ts', ...rawArgs], projectRoot);
}

async function runExecutionBackends(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-execution-backends.ts', ...rawArgs], projectRoot);
}

async function runSkillEcosystem(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-skill-ecosystem-pack.ts', ...rawArgs], projectRoot);
}

async function runAcp(rawArgs: string[] = []): Promise<number> {
  const action = String(rawArgs[0] || 'live').trim().toLowerCase();
  if (action === 'channel' || action === 'adapter' || action === 'generic-channel') {
    const nextArgs = rawArgs.slice(1);
    const channelAction = String(nextArgs[0] || 'status').trim().toLowerCase();
    const channelArgs = ['status', 'list', 'inspect'].includes(channelAction) ? nextArgs.slice(1) : nextArgs;
    const { AcpGenericChannelAdapterService } = await import('./services/AcpGenericChannelAdapterService.js');
    const service = new AcpGenericChannelAdapterService();
    if (channelAction === 'status' || channelAction === 'list' || channelAction === 'inspect') {
      const snapshot = service.buildSnapshot();
      if (channelArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
      } else {
        process.stdout.write(`${service.renderText(snapshot)}\n`);
      }
      return 0;
    }

    if (channelAction === 'ingest' || channelAction === 'receive' || channelAction === 'message') {
      const frame = buildAcpGenericChannelFrame(channelArgs);
      const receipt = service.ingest(frame, {
        receiptPath: readFlexibleStringFlag(channelArgs, 'receipt-path'),
      });
      if (channelArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
      } else {
        process.stdout.write(`${service.renderText(receipt)}\n`);
      }
      return receipt.status === 'blocked' || receipt.status === 'failed'
        || ((channelArgs.includes('--strict') || channelArgs.includes('--require-pass')) && receipt.status !== 'accepted')
        ? 1
        : 0;
    }

    await logCliError(`Unknown ACP channel action: ${channelAction}`, 'Zavorth ACP');
    return 1;
  }

  if (action === 'session' || action === 'run') {
    const nextArgs = rawArgs.slice(1);
    const { AcpLiveSessionService } = await import('./services/AcpLiveSessionService.js');
    const service = new AcpLiveSessionService();
    const receipt = await service.run({
      prompt: readFlexibleStringFlag(nextArgs, 'prompt') || nextArgs.find((arg) => !arg.startsWith('--')) || 'ping',
      serverId: readFlexibleStringFlag(nextArgs, 'server') || 'local-acp',
      transport: nextArgs.includes('--stdio') || nextArgs.includes('--acp-sdk-stdio') ? 'acp-sdk-stdio' : 'mock-jsonrpc',
      stdioCommand: readFlexibleStringFlag(nextArgs, 'stdio-command') || undefined,
      stdioArgs: readFlexibleStringFlag(nextArgs, 'stdio-args')?.split(/\s+/).filter(Boolean),
      timeoutMs: Number(readFlexibleStringFlag(nextArgs, 'timeout-ms') || 0) || undefined,
    });
    if (nextArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    } else {
      process.stdout.write(`${service.renderText(receipt)}\n`);
    }
    return receipt.status === 'failed'
      || receipt.status === 'blocked'
      || ((nextArgs.includes('--require-pass') || nextArgs.includes('--strict')) && receipt.status !== 'completed')
      ? 1
      : 0;
  }
  const nextArgs = action === 'live' || action === 'status' || action === 'bridge'
    ? rawArgs.slice(1)
    : rawArgs;
  const { AcpLiveBridgeService } = await import('./services/AcpLiveBridgeService.js');
  const service = new AcpLiveBridgeService();
  const snapshot = service.buildSnapshot();
  if (nextArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\n`);
  }
  return snapshot.status === 'blocked' || ((nextArgs.includes('--require-pass') || nextArgs.includes('--strict')) && snapshot.status !== 'ready')
    ? 1
    : 0;
}

function buildAcpGenericChannelFrame(rawArgs: string[]): Record<string, unknown> {
  const frameFile = readFlexibleStringFlag(rawArgs, 'frame-file');
  const frameJson = readFlexibleStringFlag(rawArgs, 'frame');
  if (frameFile) {
    return JSON.parse(readFileSync(path.resolve(projectRoot, frameFile), 'utf8')) as Record<string, unknown>;
  }
  if (frameJson) {
    return JSON.parse(frameJson) as Record<string, unknown>;
  }

  const kind = readFlexibleStringFlag(rawArgs, 'kind') || 'message';
  const requestedTools = readStringListFlag(rawArgs, 'tool');
  const text = readFlexibleStringFlag(rawArgs, 'text')
    || readFlexibleStringFlag(rawArgs, 'prompt')
    || rawArgs.find((arg) => !arg.startsWith('--') && !['ingest', 'receive', 'message'].includes(arg))
    || '';
  return {
    kind,
    id: readFlexibleStringFlag(rawArgs, 'id') || undefined,
    idempotencyKey: readFlexibleStringFlag(rawArgs, 'idempotency-key') || undefined,
    runtimeId: readFlexibleStringFlag(rawArgs, 'runtime') || readFlexibleStringFlag(rawArgs, 'runtime-id') || 'acp-cli-runtime',
    sessionId: readFlexibleStringFlag(rawArgs, 'session') || readFlexibleStringFlag(rawArgs, 'session-id') || 'acp-cli-session',
    actor: {
      id: readFlexibleStringFlag(rawArgs, 'actor') || 'operator',
      role: readFlexibleStringFlag(rawArgs, 'role') || 'user',
    },
    handshake: kind === 'handshake'
      ? {
        clientId: readFlexibleStringFlag(rawArgs, 'client-id') || 'acp-cli-client',
        role: readFlexibleStringFlag(rawArgs, 'client-role') || 'external-agent',
        scopes: readStringListFlag(rawArgs, 'scope'),
        tokenPresent: rawArgs.includes('--token-present'),
      }
      : undefined,
    tool: requestedTools.length === 1
      ? { name: requestedTools[0] }
      : undefined,
    payload: {
      text,
      channel: readFlexibleStringFlag(rawArgs, 'channel') || 'api',
      workspace: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
      requestedTools,
    },
    source: {
      runtimeName: readFlexibleStringFlag(rawArgs, 'source-runtime') || 'cli-acp-compatible-agent',
      runtimeVersion: readFlexibleStringFlag(rawArgs, 'source-version') || undefined,
      paths: ['zavorth-cli:acp-channel'],
    },
  };
}

async function runRuntimeGuidedFixes(rawArgs: string[] = []): Promise<number> {
  const { ZavorthRuntimeGuidedFixesService } = await import('./services/ZavorthRuntimeGuidedFixesService.js');
  const { ZavorthRuntimeReadinessService } = await import('./services/ZavorthRuntimeReadinessService.js');
  const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'operator',
    sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'runtime-guided-fixes',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });
  const service = new ZavorthRuntimeGuidedFixesService();
  const snapshot = service.buildSnapshot(readiness);
  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }
  return readiness.status === 'blocked' ? 1 : 0;
}

async function runRuntimeReadinessFix(rawArgs: string[] = []): Promise<number> {
  const target = String(rawArgs[0] || '').trim().toLowerCase();
  if (target === 'provider') {
    return runRuntimeReadinessFixProvider(rawArgs.slice(1));
  }
  await logCliError('Fix desconhecido. Use: zavorth readiness fix provider --live-proof --provider <id>', 'Usage Error');
  return 1;
}

async function runRuntimeReadinessFixProvider(rawArgs: string[] = []): Promise<number> {
  const { ZavorthProviderLiveProofStoreService } = await import('./services/ZavorthProviderLiveProofStoreService.js');
  const { ZavorthProviderReadinessMatrixService } = await import('./services/ZavorthProviderReadinessMatrixService.js');
  const { ZavorthRuntimeReadinessService } = await import('./services/ZavorthRuntimeReadinessService.js');
  const asJson = rawArgs.includes('--json');
  const baseService = new ZavorthProviderReadinessMatrixService();
  const baseSnapshot = baseService.buildSnapshot({ includeAdvanced: rawArgs.includes('--advanced') });
  const providerId = readFlexibleStringFlag(rawArgs, 'provider')
    || rawArgs.find((arg) => !arg.startsWith('--') && arg !== 'live-proof' && arg !== 'provider')
    || baseSnapshot.activeProvider
    || baseSnapshot.entries.find((entry) => entry.status === 'ready')?.id
    || 'gemini';
  const liveProofStore = new ZavorthProviderLiveProofStoreService();
  const service = new ZavorthProviderReadinessMatrixService({ liveProofStore });
  const snapshot = await service.buildLiveSnapshot({
    includeAdvanced: rawArgs.includes('--advanced'),
    providerId,
    probe: true,
    live: true,
  });
  const selected = snapshot.entries.find((entry) => entry.id === providerId || entry.familyIds.includes(providerId))
    || snapshot.entries[0]
    || null;
  const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
    userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'operator',
    sessionId: 'runtime-readiness-provider-fix',
    workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      providerLiveProof: snapshot,
      selected,
      proofStore: {
        path: liveProofStore.filePath,
        rawSecretsSerialized: false,
      },
      runtimeReadiness: readiness,
    }, null, 2)}\n`);
  } else {
    const passed = selected?.probe.status === 'passed';
    await printCliPanel('Provider live proof', [
      `provider=${selected?.id || providerId}`,
      `probe=${selected?.probe.status || 'not_found'}`,
      `default_route=${selected?.defaultRouteAllowed ? 'allowed' : 'blocked'}`,
      `runtime=${readiness.status}`,
      `proof_store=${liveProofStore.filePath}`,
      '',
      passed
        ? 'Provider validado com prova live persistida. Rode zavorth readiness para conferir o estado diario.'
        : selected?.probe.summary || 'Probe live nao conseguiu validar o provider.',
    ], passed ? 'success' : 'warning');
  }

  return selected?.defaultRouteAllowed ? 0 : 1;
}

async function runCliExperienceConsistency(rawArgs: string[] = []): Promise<number> {
  if (!rawArgs.includes('--legacy')) {
    const { ZavorthCliTuiPolishService } = await import('./services/ZavorthCliTuiPolishService.js');
    const service = new ZavorthCliTuiPolishService();
    const snapshot = await service.buildSnapshot({
      refreshProviders: rawArgs.includes('--refresh-providers') || rawArgs.includes('--live'),
      includeAdvancedProviders: rawArgs.includes('--advanced'),
      userId: readFlexibleStringFlag(rawArgs, 'user-id') || 'operator',
      sessionId: readFlexibleStringFlag(rawArgs, 'session-id') || 'cli-home',
      workspaceHint: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderCli(snapshot));
    }
    return snapshot.status === 'blocked' || ((rawArgs.includes('--require-pass') || rawArgs.includes('--strict')) && snapshot.status !== 'ready')
      ? 1
      : 0;
  }

  const { ZavorthCliExperienceCertificationService } = await import('./services/ZavorthCliExperienceCertificationService.js');
  const service = new ZavorthCliExperienceCertificationService();
  const snapshot = service.buildSnapshot();

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runExperienceLayerDailyUseCertification(rawArgs: string[] = []): Promise<number> {
  const { ZavorthExperienceLayerDailyUseCertificationService } = await import('./services/ZavorthExperienceLayerDailyUseCertificationService.js');
  const service = new ZavorthExperienceLayerDailyUseCertificationService();
  const snapshot = service.buildSnapshot();

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return snapshot.result === 'passed' ? 0 : 1;
}

async function runGatewaySpine(rawArgs: string[] = []): Promise<number> {
  const { GatewayChannelRegistryService } = await import('./services/GatewayChannelRegistryService.js');
  const { GatewaySpineService } = await import('./services/GatewaySpineService.js');
  const view = String(rawArgs[0] || 'status').trim().toLowerCase();
  const asJson = rawArgs.includes('--json');
  const service = new GatewaySpineService({
    channelRegistry: new GatewayChannelRegistryService({
      hasDispatcher: true,
      canSpawnWeb: true,
    }),
  });
  const snapshot = service.buildSnapshot({
    gatewayRuntimeSnapshot: {
      lifecycle: {
        status: 'attached',
      },
      route: 'gateway-runtime',
      sessions: [],
    },
    approvals: {
      source: 'GatewayApprovalPlane',
      total: 0,
      pending: 0,
    },
    receipts: {
      source: 'GatewayReceiptPlane',
      total: 0,
      pending: 0,
    },
    artifacts: {
      source: 'GatewayArtifactPlane',
      total: 0,
      pending: 0,
    },
  });

  if (asJson) {
    const payload =
      view === 'sessions' ? snapshot.sessions
        : view === 'channels' ? snapshot.channels
          : view === 'approvals' ? snapshot.approvals
            : view === 'receipts' ? snapshot.receipts
              : view === 'artifacts' ? snapshot.artifacts
                : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  if (view === 'sessions') {
    return printCliPanel('Gateway sessions', [
      `total: ${snapshot.sessions.total}`,
      `active: ${snapshot.sessions.active}`,
      `source: ${snapshot.sessions.source}`,
    ], 'info');
  }
  if (view === 'channels') {
    return printCliPanel('Gateway channels', [
      `total: ${snapshot.channels.summary.total}`,
      `ready: ${snapshot.channels.summary.ready}`,
      `partial: ${snapshot.channels.summary.partial}`,
      '',
      ...snapshot.channels.entries.map((entry) => `- ${entry.id}: ${entry.readiness} | ${entry.transport}`),
    ], 'info');
  }
  if (view === 'approvals') {
    return printCliPanel('Gateway approvals', [
      `pending: ${snapshot.approvals.pending}`,
      `total: ${snapshot.approvals.total}`,
      `source: ${snapshot.approvals.source}`,
    ], snapshot.approvals.pending > 0 ? 'warning' : 'success');
  }
  if (view === 'receipts') {
    return printCliPanel('Gateway receipts', [
      `total: ${snapshot.receipts.total}`,
      `source: ${snapshot.receipts.source}`,
    ], 'info');
  }
  if (view === 'artifacts') {
    return printCliPanel('Gateway artifacts', [
      `total: ${snapshot.artifacts.total}`,
      `source: ${snapshot.artifacts.source}`,
    ], 'info');
  }

  process.stdout.write(service.renderText(snapshot));
  return 0;
}

async function runUnifiedOnboarding(rawArgs: string[] = []): Promise<number> {
  const { ProviderDoctorService } = await import('./services/ProviderDoctorService.js');
  const { ZavorthUnifiedOnboardingService } = await import('./services/ZavorthUnifiedOnboardingService.js');
  const service = new ZavorthUnifiedOnboardingService({
    providerDoctor: new ProviderDoctorService(),
  });
  const snapshot = service.buildSnapshot({
    dailyMode: readFlexibleStringFlag(rawArgs, 'mode'),
    detailMode: rawArgs.includes('--advanced') ? 'advanced' : rawArgs.includes('--simple') ? 'simple' : readFlexibleStringFlag(rawArgs, 'detail'),
    selectedTemplateId: readFlexibleStringFlag(rawArgs, 'template'),
    request: readFlexibleStringFlag(rawArgs, 'request'),
    includeAdvanced: rawArgs.includes('--advanced'),
  });
  const view = String(rawArgs.find((arg) => !arg.startsWith('--')) || 'journey').trim().toLowerCase();

  if (rawArgs.includes('--json')) {
    const payload =
      view === 'templates' ? snapshot.templates
        : view === 'doctor' ? {
            status: snapshot.status,
            provider: snapshot.provider,
            sandbox: snapshot.sandbox,
            nextAction: snapshot.nextAction,
          }
          : view === 'first-mission' ? snapshot.safeDemo
            : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  if (view === 'templates') {
    return printCliPanel('Onboarding templates', [
      ...snapshot.templates.map((template) =>
        `- ${template.id}: ${template.label} | risk=${template.defaultRisk} | mutate=${template.requiresMutation ? 'yes' : 'no'}`,
      ),
    ], 'info');
  }
  if (view === 'doctor') {
    return printCliPanel('Onboarding doctor', [
      `status: ${snapshot.status}`,
      `provider: ${snapshot.provider.status}`,
      `provider ready: ${snapshot.provider.ready}`,
      `missing auth: ${snapshot.provider.missingAuth}`,
      `needs probe: ${snapshot.provider.needsProbe}`,
      `sandbox: ${snapshot.sandbox.status}`,
      `mutation mode: ${snapshot.sandbox.mutationMode}`,
      `next: ${snapshot.nextAction}`,
    ], snapshot.status === 'ready' ? 'success' : 'warning');
  }
  if (view === 'first-mission') {
    return printCliPanel('Onboarding first mission', [
      snapshot.safeDemo.command,
      snapshot.safeDemo.summary,
    ], 'info');
  }

  process.stdout.write(service.renderText(snapshot));
  return 0;
}

async function runSensitiveActionFlow(rawArgs: string[] = []): Promise<number> {
  const { ZavorthSensitiveActionFlowService } = await import('./services/ZavorthSensitiveActionFlowService.js');
  const service = new ZavorthSensitiveActionFlowService();
  const request = readFlexibleStringFlag(rawArgs, 'request')
    || rawArgs.filter((arg) => !arg.startsWith('--')).join(' ')
    || 'Review this workspace in read-only mode.';
  const snapshot = service.buildSnapshot({
    request,
    decision: readFlexibleStringFlag(rawArgs, 'decision') as any,
    approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
    sandboxReady: rawArgs.includes('--sandbox-ready'),
    source: 'cli',
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runProviderReadiness(rawArgs: string[] = []): Promise<number> {
  const action = String(rawArgs[0] || 'matrix').trim().toLowerCase();
  if (action === 'cockpit' || action === 'zavorthControl') {
    const { ZavorthControlProviderCockpitService } = await import('./services/ZavorthControlProviderCockpitService.js');
    const service = new ZavorthControlProviderCockpitService();
    const projection = await service.buildProjection({
      includeAdvanced: rawArgs.includes('--advanced'),
      providerId: readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      selectedProviderId: readFlexibleStringFlag(rawArgs, 'selected-provider') || readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      live: rawArgs.includes('--live'),
      allowAllLive: rawArgs.includes('--all'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(projection, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(projection));
    }
    return 0;
  }
  if (action === 'select' || action === 'use' || action === 'choose' || action === 'switch') {
    const { ZavorthProviderSelectionUxService } = await import('./services/ZavorthProviderSelectionUxService.js');
    const service = new ZavorthProviderSelectionUxService();
    const target = readFlexibleStringFlag(rawArgs, 'provider')
      || readFlexibleStringFlag(rawArgs, 'target')
      || rawArgs[1];
    const snapshot = await service.buildSnapshot({
      includeAdvanced: rawArgs.includes('--advanced'),
      target,
      providerId: target,
      intent: readFlexibleStringFlag(rawArgs, 'intent') || readFlexibleStringFlag(rawArgs, 'profile') || rawArgs[2],
      requireLiveEvidence: rawArgs.includes('--require-live') || rawArgs.includes('--live-proof'),
      live: rawArgs.includes('--live'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(snapshot));
    }
    return 0;
  }
  if (action === 'apply' || action === 'persist' || action === 'save') {
    const { ZavorthProviderPreferencePersistenceService } = await import('./services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const target = readFlexibleStringFlag(rawArgs, 'provider')
      || readFlexibleStringFlag(rawArgs, 'target')
      || rawArgs[1];
    const snapshot = await service.apply({
      includeAdvanced: rawArgs.includes('--advanced'),
      target,
      providerId: target,
      modelId: readFlexibleStringFlag(rawArgs, 'model'),
      intent: readFlexibleStringFlag(rawArgs, 'intent') || readFlexibleStringFlag(rawArgs, 'profile') || rawArgs[2],
      requireLiveEvidence: rawArgs.includes('--require-live') || rawArgs.includes('--live-proof'),
      live: rawArgs.includes('--live'),
      approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
      confirm: rawArgs.includes('--confirm') || rawArgs.includes('--yes'),
      dryRun: rawArgs.includes('--dry-run') || rawArgs.includes('--preview'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(snapshot));
    }
    return snapshot.status === 'denied' ? 2 : 0;
  }
  if (action === 'preference' || action === 'current') {
    const { ZavorthProviderPreferencePersistenceService } = await import('./services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const preference = await service.readPreference();
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify({
        surface: 'provider-preference',
        preference,
        safety: {
          rawSecretsSerialized: false,
          mutatesConfig: false,
        },
      }, null, 2)}\n`);
    } else {
      await printCliPanel('Provider preference', [
        `provider: ${preference?.providerId || 'none'}`,
        `model: ${preference?.modelId || 'none'}`,
        `receipt: ${preference?.receiptId || 'none'}`,
      ], preference ? 'success' : 'info');
    }
    return 0;
  }
  if (action === 'rollback') {
    const { ZavorthProviderPreferencePersistenceService } = await import('./services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const snapshot = await service.rollback({
      receiptId: readFlexibleStringFlag(rawArgs, 'receipt') || rawArgs[1],
      approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
      confirm: rawArgs.includes('--confirm') || rawArgs.includes('--yes'),
      dryRun: rawArgs.includes('--dry-run') || rawArgs.includes('--preview'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(snapshot));
    }
    return snapshot.status === 'denied' ? 2 : 0;
  }
  if (action === 'visual-approval' || action === 'visual-pack' || action === 'approval-pack') {
    const { ZavorthControlVisualApprovalPackService } = await import('./services/ZavorthControlVisualApprovalPackService.js');
    const service = new ZavorthControlVisualApprovalPackService();
    const pack = await service.buildPack({
      includeAdvanced: rawArgs.includes('--advanced'),
      providerId: readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      selectedProviderId: readFlexibleStringFlag(rawArgs, 'selected-provider') || readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      includeDetailsDrawer: rawArgs.includes('--details-drawer'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(pack, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(pack));
    }
    return 0;
  }
  const { ZavorthProviderReadinessMatrixService } = await import('./services/ZavorthProviderReadinessMatrixService.js');
  const { ZavorthProviderLiveProofStoreService } = await import('./services/ZavorthProviderLiveProofStoreService.js');
  const providerId = readFlexibleStringFlag(rawArgs, 'provider')
    || (action === 'test' ? rawArgs[1] : rawArgs.find((arg) => !arg.startsWith('--') && arg !== 'matrix' && arg !== 'live'));
  const live = rawArgs.includes('--live') || action === 'live';
  const service = new ZavorthProviderReadinessMatrixService({
    liveProofStore: live ? new ZavorthProviderLiveProofStoreService() : null,
  });
  const snapshot = await service.buildLiveSnapshot({
    includeAdvanced: rawArgs.includes('--advanced'),
    providerId: providerId && providerId !== 'test' ? providerId : null,
    probe: action === 'test' || rawArgs.includes('--probe'),
    live,
    allowAllLive: rawArgs.includes('--all'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runDynamicWorkflows(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    return printCliPanel('Zavorth Dynamic Workflows', [
      'Usage: zavorth workflows "<objective>" [options]',
      '       zavorth workflows preview "<objective>" [options]',
      '       zavorth workflows launch <workflowId> --approval-id <approvalId>',
      '',
      'Creates a governed wide-work plan: cheap fanout workers, bounded concurrency, cost guard, saved preview and final synthesis through Swarm V2.',
      '',
      'Options:',
      '  --fanout <n>              Number of workers, capped by policy',
      '  --max-concurrency <n>     Parallel worker cap',
      '  --worker-model <class>    cheap, standard or premium',
      '  --synthesis-model <class> cheap, standard or premium',
      '  --max-cents <n>           Budget cap in cents',
      '  --storage-dir <path>      Preview/receipt storage override',
      '  --json                    Output machine-readable JSON',
    ], 'info');
  }
  const { ZavorthDynamicWorkflowService } = await import('./services/ZavorthDynamicWorkflowService.js');
  const service = new ZavorthDynamicWorkflowService({
    storageDir: readFlexibleStringFlag(rawArgs, 'storage-dir'),
  });
  const positionalValues: string[] = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index] || '';
    if (arg.startsWith('--')) {
      if (!arg.includes('=') && rawArgs[index + 1] && !rawArgs[index + 1].startsWith('--')) {
        index += 1;
      }
      continue;
    }
    positionalValues.push(arg);
  }
  const dynamicPositionals = positionalValues[0] === 'preview'
    ? positionalValues.slice(1)
    : positionalValues;
  const positionalObjective = dynamicPositionals.join(' ').trim();
  if (positionalValues[0] === 'launch') {
    const result = service.launchSavedWorkflow(
      readFlexibleStringFlag(rawArgs, 'workflow-id') || positionalValues[1] || '',
      { approvalId: readFlexibleStringFlag(rawArgs, 'approval-id') || readFlexibleStringFlag(rawArgs, 'approval') },
    );
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write([
        'Zavorth Dynamic Workflow Launch',
        `status: ${result.status}`,
        `workflow: ${result.workflowId}`,
        `receipt: ${result.receiptId || 'none'}`,
        result.reason ? `reason: ${result.reason}` : null,
      ].filter((line): line is string => Boolean(line)).join('\n'));
      process.stdout.write('\n');
    }
    return result.status === 'blocked' && rawArgs.includes('--require-pass') ? 1 : 0;
  }
  const toNumber = (value: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const snapshot = service.buildPreview({
    objective: readFlexibleStringFlag(rawArgs, 'objective')
      || readFlexibleStringFlag(rawArgs, 'request')
      || positionalObjective,
    requestedFanout: toNumber(readFlexibleStringFlag(rawArgs, 'fanout') || readFlexibleStringFlag(rawArgs, 'workers')),
    maxConcurrency: toNumber(readFlexibleStringFlag(rawArgs, 'max-concurrency') || readFlexibleStringFlag(rawArgs, 'concurrency')),
    maxCents: toNumber(readFlexibleStringFlag(rawArgs, 'max-cents') || readFlexibleStringFlag(rawArgs, 'budget-cents')),
    workerModelClass: readFlexibleStringFlag(rawArgs, 'worker-model') || readFlexibleStringFlag(rawArgs, 'worker-model-class'),
    synthesisModelClass: readFlexibleStringFlag(rawArgs, 'synthesis-model') || readFlexibleStringFlag(rawArgs, 'synthesis-model-class'),
  });
  const previewRegistry = service.savePreview(snapshot);

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ ...snapshot, previewRegistry }, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\npreview: ${previewRegistry.status} ${previewRegistry.receiptId || ''}\n`);
  }

  return snapshot.status === 'blocked' && rawArgs.includes('--require-pass') ? 1 : 0;
}

async function runEffortControl(rawArgs: string[] = []): Promise<number> {
  const { ZavorthEffortControlService } = await import('./services/ZavorthEffortControlService.js');
  const service = new ZavorthEffortControlService();
  const positional = collectEffortControlPositionals(rawArgs);
  const knownLevel = /^(low|light|fast|standard|high|deep|heavy|ultra|ultra-code|ultra_code|ultracode|max|massive)$/i;
  const first = positional[0] || null;
  const level = readFlexibleStringFlag(rawArgs, 'level') || (first && knownLevel.test(first) ? first : null);
  const positionalRequest = positional.slice(level ? 1 : 0).join(' ').trim();
  const snapshot = service.buildSnapshot({
    level,
    request: readFlexibleStringFlag(rawArgs, 'request') || positionalRequest,
    profile: readFlexibleStringFlag(rawArgs, 'profile'),
    maxCents: readFlexibleStringFlag(rawArgs, 'max-cents') || readFlexibleStringFlag(rawArgs, 'budget-cents'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\n`);
  }

  return 0;
}

function collectEffortControlPositionals(rawArgs: string[]): string[] {
  const flagsWithValues = new Set(['level', 'request', 'profile', 'max-cents', 'budget-cents']);
  const positional: string[] = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index] || '';
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const flagName = arg.slice(2).split('=')[0]?.toLowerCase() || '';
    if (!arg.includes('=') && flagsWithValues.has(flagName) && rawArgs[index + 1] && !rawArgs[index + 1].startsWith('--')) {
      index += 1;
    }
  }
  return positional;
}

async function runProviderLongTailActivation(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/provider-long-tail-activation.ts', ...rawArgs], projectRoot);
}

async function runChannelLongTailActivation(rawArgs: string[] = []): Promise<number> {
  return npmInherited(['exec', 'tsx', '--', 'scripts/channel-long-tail-activation.ts', ...rawArgs], projectRoot);
}

function normalizeMeshActivationArgs(kind: 'provider' | 'channel', action: string, args: string[]): string[] {
  const profile = action === 'canary' ? 'staging-live' : 'configured';
  const forwarded = ['--profile', profile, ...args.slice(1)];
  const hasTargetFlag = forwarded.some((arg) => arg === `--${kind}` || arg.startsWith(`--${kind}=`));
  const positional = args.slice(1).find((arg) => !arg.startsWith('--'));
  if (!hasTargetFlag && positional) {
    forwarded.push(`--${kind}`, positional);
  }
  return forwarded;
}

function resolveProductizationView(rawArgs: string[]): 'all' | 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox' {
  const view = String(readFlexibleStringFlag(rawArgs, 'view') || rawArgs[0] || '').trim().toLowerCase();
  if (['journey', 'templates', 'missions', 'receipts', 'sandbox'].includes(view)) {
    return view as 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox';
  }
  return 'all';
}

async function runInstanceCommand(rawArgs: string[]): Promise<number> {
  const { listInstances, createInstance, deleteInstance, getInstanceName, instanceExists } = await import('./services/ZavorthInstanceService.js');
  const { tCli, tCommon } = await import('./i18n/cli.js');
  const action = String(rawArgs[0] || 'list').trim().toLowerCase();
  const asJson = rawArgs.includes('--json');
  const name = readFlexibleStringFlag(rawArgs, 'name') || rawArgs[1] || null;

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    await printCliPanel(tCli('instance.title'), [
      tCli('instance.description'),
      '',
      tCli('instance.usage'),
      `  zavorth instance list                ${tCli('instance.commands.list')}`,
      `  zavorth instance current             ${tCli('instance.commands.current')}`,
      `  zavorth instance create <name>       ${tCli('instance.commands.create')}`,
      `  zavorth instance delete <name>       ${tCli('instance.commands.delete')}`,
      '',
      tCli('instance.env_hint'),
      '',
      tCli('instance.examples'),
      tCli('instance.example_1'),
      tCli('instance.example_2'),
      tCli('instance.example_3'),
    ], 'info');
    return 0;
  }

  if (action === 'current' || action === 'status') {
    const current = getInstanceName(process.env);
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ instance: current, isDefault: current === 'default' })}\n`);
    } else {
      const label = current === 'default' ? tCli('instance.current_default', { name: current }) : tCli('instance.current_instance', { name: current });
      process.stdout.write(`${label}\n`);
      process.stdout.write(`${tCli('instance.switch_hint')}\n`);
    }
    return 0;
  }

  if (action === 'list') {
    const instances = listInstances(projectRoot);
    if (asJson) {
      process.stdout.write(`${JSON.stringify(instances, null, 2)}\n`);
    } else {
      const lines = instances.map((inst) => {
        const marker = inst.name === getInstanceName(process.env) ? ' *' : '';
        const created = inst.createdAt ? ` ${tCli('instance.created_at', { date: inst.createdAt })}` : '';
        const flags = [
          inst.hasMemory ? tCli('instance.has_memory') : null,
          inst.hasConfig ? tCli('instance.has_config') : null,
          inst.hasCredentials ? tCli('instance.has_creds') : null,
        ].filter(Boolean).join(', ');
        return `  ${inst.name.padEnd(20)}${created}${flags ? ` [${flags}]` : ''}${marker}`;
      });
      process.stdout.write(`${tCli('instance.list_header', { count: String(instances.length) })}\n${lines.join('\n')}\n`);
      process.stdout.write(`\n${tCli('instance.list_marker')}\n`);
    }
    return 0;
  }

  if (action === 'create') {
    if (!name) {
      await logCliError(tCli('instance.name_required'), tCommon('errors.generic.unexpected'));
      return 1;
    }
    try {
      const info = createInstance(projectRoot, name);
      if (asJson) {
        process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
      } else {
        process.stdout.write(`${tCli('instance.created', { name, path: info.homeRoot })}\n`);
        process.stdout.write(`${tCli('instance.use_hint', { name })}\n`);
      }
      return 0;
    } catch (err: any) {
      await logCliError(err.message || String(err), 'Instance Error');
      return 1;
    }
  }

  if (action === 'delete' || action === 'remove') {
    if (!name) {
      await logCliError(tCli('instance.name_required'), tCommon('errors.generic.unexpected'));
      return 1;
    }
    if (name === getInstanceName(process.env)) {
      await logCliError(tCli('instance.delete_active'), 'Instance Error');
      return 1;
    }
    try {
      deleteInstance(projectRoot, name, rawArgs.includes('--force'));
      if (asJson) {
        process.stdout.write(`${JSON.stringify({ deleted: name })}\n`);
      } else {
        process.stdout.write(`${tCli('instance.deleted', { name })}\n`);
      }
      return 0;
    } catch (err: any) {
      await logCliError(err.message || String(err), 'Instance Error');
      return 1;
    }
  }

  if (action === 'switch') {
    if (!name) {
      await logCliError(tCli('instance.name_required'), tCli('instance.unknown_action', { action: 'switch' }));
      return 1;
    }
    if (!instanceExists(projectRoot, name)) {
      await logCliError(tCli('instance.switch_not_found', { name }), 'Instance Error');
      return 1;
    }
    const current = getInstanceName(process.env);
    if (current === name) {
      if (asJson) {
        process.stdout.write(`${JSON.stringify({ switched: name, changed: false })}\n`);
      } else {
        process.stdout.write(`${tCli('instance.switch_no_change', { name })}\n`);
      }
      return 0;
    }
    const result = writeInstanceEnv(projectRoot, name);
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ switched: name, changed: result.written, envFile: result.envFile })}\n`);
    } else {
      if (result.written) {
        process.stdout.write(`${tCli('instance.switched', { name, path: result.envFile })}\n`);
        process.stdout.write(`${tCli('instance.use_hint', { name })}\n`);
      } else {
        process.stdout.write(`${tCli('instance.switched', { name, path: result.envFile })}\n`);
      }
    }
    return 0;
  }

  await logCliError(tCli('instance.unknown_action', { action }), 'Usage Error');
  return 1;
}

function writeInstanceEnv(root: string, instanceName: string): { written: boolean; envFile: string; key: string } {
  const envFile = path.join(root, '.env');
  const key = 'ZAVORTH_INSTANCE';
  const nextLine = `${key}=${instanceName}`;
  let current = '';
  try {
    current = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  } catch {
    current = '';
  }
  const lines = current.split(/\r?\n/u);
  let changed = false;
  let seen = false;
  const next = lines.map((line) => {
    if (!line.trim() || line.trim().startsWith('#')) {
      return line;
    }
    if (/^ZAVORTH_INSTANCE\s*=/u.test(line)) {
      seen = true;
      if (line === nextLine) {
        return line;
      }
      changed = true;
      return nextLine;
    }
    return line;
  });
  if (!seen) {
    if (next.length > 0 && next[next.length - 1] !== '') {
      next.push('');
    }
    next.push(nextLine);
    changed = true;
  }
  if (!changed) {
    return { written: false, envFile, key };
  }
  writeFileSync(envFile, `${next.join('\n').replace(/\n+$/u, '')}\n`, 'utf8');
  return { written: true, envFile, key };
}

async function runBuiltinLauncher(rawArgs: string[]): Promise<number | null> {
  const command = String(rawArgs[0] || '').trim().toLowerCase();
  const restArgs = rawArgs.slice(1);
  if (!command) {
    return null;
  }

  if (command === '--version' || command === '-v' || command === 'version') {
    process.stdout.write(`Zavorth ${readPackageVersion()}\n`);
    return 0;
  }

  if (command === '--help' || command === '-h' || command === 'help') {
    if (restArgs.includes('--json')) {
      return null;
    }
    return printBuiltinHelp(restArgs[0]);
  }

  if (command === 'workflows' && (restArgs.includes('--help') || restArgs.includes('-h'))) {
    return runDynamicWorkflows(['--help']);
  }

  const helpTopic = resolveCliHelpTopic(command);
  if (helpTopic !== 'root' && (restArgs.includes('--help') || restArgs.includes('-h'))) {
    return printBuiltinHelp(command);
  }

  if (command === 'advanced') {
    if (restArgs.length === 0 || restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('advanced');
    }
    return runBuiltinLauncher(restArgs);
  }

  if (command === 'ops') {
    if (restArgs.length === 0 || restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('ops');
    }
    return runBuiltinLauncher(restArgs);
  }

  if (command === 'dev') {
    if (restArgs.length === 0 || restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth dev', [
        'Usage: zavorth dev [command]',
        '',
        'Developer and local QA helpers for maintainers.',
        '',
        'Commands:',
        '  test              Run the default CLI/runtime checks',
        '  test cli          Run CLI checks',
        '  test runtime      Run TypeScript runtime checks',
        '  build             Build the local package',
        '  install           Install local dependencies',
        '',
        'Examples:',
        '  zavorth dev test',
        '  zavorth dev build',
      ], 'info');
    }
    return runBuiltinLauncher(restArgs);
  }

  if (command === 'gateway') {
    const gatewayControlSubcommand = String(restArgs[0] || 'status').trim().toLowerCase();
    if ([
      'status',
      'providers',
      'models',
      'combos',
      'combo',
      'cache',
      'rate-limits',
      'rate-limit',
      'ratelimits',
      'doctor',
    ].includes(gatewayControlSubcommand)) {
      const { runZavorthCli } = await import('./cli/ZavorthCli.js');
      return runZavorthCli(['gateway', ...restArgs]);
    }
  }

  if (['todo', 'later', 'work', 'done', 'retry', 'cancel'].includes(command)) {
    return runZavorthFriendlyWorkCommand(command as 'todo' | 'later' | 'work' | 'done' | 'retry' | 'cancel', restArgs);
  }

  if (command === 'tasks' || command === 'task') {
    return runZavorthTasksCommand(restArgs);
  }

  if (command === 'memory' && ['encryption', 'encrypt', 'privacy', 'status', 'migrate', 'migration', 'preview', 'plan', 'apply', 'enable', 'rollback', 'restore'].includes(String(restArgs[0] || 'status').trim().toLowerCase())) {
    const { runZavorthMemoryEncryptionCommand } = await import('./cli/ZavorthMemoryEncryptionCommand.js');
    const memoryArgs = ['encryption', 'encrypt', 'privacy'].includes(String(restArgs[0] || '').trim().toLowerCase())
      ? restArgs.slice(1)
      : restArgs;
    return runZavorthMemoryEncryptionCommand(memoryArgs);
  }

  if (isZavorthLiveNamespaceCommand(command)) {
    const result = await runZavorthLiveNamespaceCommand({ projectRoot, command, args: restArgs });
    process.stdout.write(result.output);
    return result.exitCode;
  }

  if (isZavorthConsistencyStubCommand(command)) {
    const help = formatZavorthCertificationHelp(command);
    if (restArgs.length === 0 || restArgs.includes('--help') || restArgs.includes('-h')) {
      process.stdout.write(help || '');
      return 0;
    }
    const notice = formatZavorthConsistencyPreparedNotice(command, restArgs);
    process.stdout.write(notice || help || '');
    return 0;
  }

  if (command === 'home') {
    const homeSubcommand = String(restArgs[0] || '').trim().toLowerCase();
    if (['status', 'doctor', 'migrate', 'switch'].includes(homeSubcommand) || restArgs.includes('--home') || restArgs.some((arg) => arg.startsWith('--home='))) {
      return runZavorthHomeCommand(restArgs);
    }
    return runPremiumHome(restArgs);
  }

  if (command === 'ask' || command === 'edit' || command === 'apply') {
    const { runZavorthCliActionMode } = await import('./cli/ZavorthCliActionMode.js');
    return runZavorthCliActionMode({ command, args: restArgs, cwd: process.cwd() });
  }

  if (command === 'chat' && restArgs.length > 0 && !restArgs.includes('--help') && !restArgs.includes('-h')) {
    const { runZavorthCliActionMode } = await import('./cli/ZavorthCliActionMode.js');
    return runZavorthCliActionMode({ command: 'chat', args: restArgs, cwd: process.cwd() });
  }

  if (command === 'chat' || command === 'session') {
    const { runZavorthCli } = await import('./cli/ZavorthCli.js');
    return runZavorthCli(restArgs);
  }

  if (command === 'tui') {
    return runPremiumHud(['runtime', ...restArgs]);
  }

  if (command === 'hud' || command === 'cockpit') {
    return runPremiumHud(resolveDailyHudArgs(restArgs));
  }

  if (command === 'hatch') {
    return runPremiumHatch(restArgs);
  }

  if (command === 'quickstart' || command === 'configure') {
    return runPremiumQuickStart(restArgs);
  }

  if (command === 'constitution' || command === 'project-constitution') {
    return runProjectConstitutionCommand(restArgs);
  }

  if (command === 'disk' || command === 'disk-gate' || command === 'mutation-gate') {
    return runDiskMutationGateCommand(restArgs);
  }

  if (command === 'git-status') {
    return runGitWorkflowCommand('status', restArgs);
  }

  if (command === 'branch') {
    return runGitWorkflowCommand('branch', restArgs);
  }

  if (command === 'commit') {
    return runGitWorkflowCommand('commit', restArgs);
  }

  if (command === 'pr' || command === 'pull-request') {
    return runGitWorkflowCommand('pr', restArgs);
  }

  if (command === 'approve' || command === 'approval' || command === 'approvals') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth approvals', [
        'Usage: zavorth approve [options] [approvalId]',
        '',
        'Review and decide governed actions. Approval never applies host changes by itself.',
        '',
        'Options:',
        '  -h, --help       Display help for command',
        '  --json           Output JSON when supported',
        '  --yes            Confirm the approval/rejection action',
        '',
        'Commands:',
        '  list             Show pending approvals',
        '  approve          Approve a plan only',
        '  reject           Reject a plan',
        '  diff             Inspect associated sandbox diff',
        '',
        'Examples:',
        '  zavorth approve',
        '    Show pending approvals.',
        '  zavorth approve <id> --yes',
        '    Approve a plan only; host application still follows policy.',
        '  zavorth diff <id>',
        '    Inspect the diff before deciding.',
        '',
        'Docs: zavorth help reference',
      ], 'warning');
    }
    const firstApprovalArg = String(restArgs[0] || '').trim().toLowerCase();
    if (command === 'approvals' && ['always', 'auto', 'policy', 'permito-sempre', 'break-glass'].includes(firstApprovalArg)) {
      return runPersistentApprovals(restArgs.slice(1));
    }
    return runPremiumApprovalDiff('approvals', restArgs);
  }

  if (command === 'diff' || command === 'diffs') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth diff', [
        'Usage: zavorth diff [approvalId]',
        '',
        'Inspect sandbox changes before approving sensitive work.',
        '',
        'Examples:',
        '  zavorth diff',
        '    Show available governed diff previews.',
        '  zavorth diff <id>',
        '    Inspect one pending plan before deciding.',
        '  zavorth approve <id> --yes',
        '    Approve the plan after review.',
      ], 'info');
    }
    return runPremiumApprovalDiff('diff', restArgs);
  }

  if (command === 'onboard' || command === 'onboarding') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('onboard');
    }
    if (['conversation', 'conversational', 'calibrate', 'profile'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      return runConversationalSetup(restArgs.slice(1));
    }
    if (['journey', 'legacy', 'overview', 'doctor', 'templates', 'first-mission'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      const forwarded = String(restArgs[0] || '').trim().toLowerCase() === 'journey'
        ? restArgs.slice(1)
        : restArgs;
      return runUnifiedOnboarding(forwarded);
    }
    if (['apply', 'run', 'setup'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      return runPremiumSetupStudio(restArgs.slice(1));
    }
    return runPremiumSetupStudio(restArgs);
  }

  if (command === 'setup' || command === 'init') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('onboard');
    }
    if (String(restArgs[0] || '').trim().toLowerCase() === 'legacy') {
      return runPromotedScript('setup-v3', restArgs.slice(1));
    }
    return runPremiumSetupStudio(restArgs);
  }

  if (command === 'instance') {
    return runInstanceCommand(restArgs);
  }

  if (command === 'go') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('go');
    }
    return runPromotedScript('ops-go', restArgs);
  }

  if (command === 'open' || command === 'control') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('control');
    }
    return runPromotedScript('ops-go', restArgs);
  }

  if (command === 'start' || command === 'quickstart') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('go');
    }
    return runPromotedScript('ops-go', restArgs);
  }

  if (command === 'demo') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('demo');
    }
    return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-product-demo.ts', ...restArgs], projectRoot);
  }

  if (command === 'connectors' || command === 'connector') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('connectors');
    }
    return npmInherited(['exec', 'tsx', '--', 'scripts/zavorth-connectors.ts', ...restArgs], projectRoot);
  }

  if (command === 'channels' || command === 'channel') {
    // [gateway channels] Product mirror for channel setup, proofs and readiness.
    const channelAction = String(restArgs[0] || '').trim().toLowerCase();
    const channelSubAction = String(restArgs[1] || '').trim().toLowerCase();
    const phase2Channels = new Set([
      'api',
      'bluebubbles',
      'cli',
      'clickclack',
      'discord',
      'email',
      'feishu',
      'googlechat',
      'home-assistant',
      'imessage',
      'instagram',
      'irc',
      'lark',
      'line',
      'matrix',
      'mattermost',
      'msteams',
      'nextcloud-talk',
      'nostr',
      'qqbot',
      'signal',
      'slack',
      'sms',
      'synology-chat',
      'telegram',
      'tlon',
      'twitch',
      'web',
      'webhooks',
      'wecom',
      'weixin',
      'whatsapp',
      'whatsapp-baileys',
      'whatsapp-cloud',
      'yuanbao',
      'zalo',
      'zalouser',
    ]);
    const phase2Actions = new Set([
      'doctor',
      'health',
      'inspect',
      'outbox',
      'pair',
      'pairing',
      'proof',
      'read',
      'send',
      'send-test',
      'setup',
      'status',
      'test',
    ]);
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('channels');
    }
    if (['atlas', 'matrix', 'capability-atlas', 'capabilities', 'coverage'].includes(channelAction)) {
      return runChannelCapabilityAtlas(restArgs.slice(1));
    }
    if (['doctor', 'canary', 'activate'].includes(channelAction)) {
      return runChannelLongTailActivation(normalizeMeshActivationArgs('channel', channelAction, restArgs));
    }
    if (['catalog', 'list', 'all', 'inventory', 'status', 'coverage', 'deepening'].includes(channelAction)) {
      return runChannelDeepening(restArgs);
    }
    if (phase2Channels.has(channelAction) && (channelSubAction === '' || phase2Actions.has(channelSubAction))) {
      return runChannelDeepening(restArgs);
    }
    if ([
      'add',
      'setup',
      'configure',
      'telegram',
      'discord',
      'slack',
      'whatsapp',
      'signal',
      'email',
    ].includes(channelAction)) {
      return runProviderChannelWizard(['channels', ...restArgs]);
    }
    return runGatewayMatrix(restArgs);
  }

  if (command === 'templates') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('templates');
    }
    if (restArgs.includes('--guided') || restArgs.includes('--experience')) {
      return runGuidedMissions(restArgs);
    }
    return runProductizationProtectedRuntime('templates', restArgs);
  }

  if (command === 'missions') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('missions');
    }
    if (['guide', 'guided', 'catalog', 'recommend'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      return runGuidedMissions(restArgs.slice(1));
    }
    return runProductizationProtectedRuntime('missions', restArgs);
  }

  if (command === 'receipts') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('receipts');
    }
    return runProductizationProtectedRuntime('receipts', restArgs);
  }

  if (command === 'product' || command === 'daily-use') {
    return runProductizationProtectedRuntime(resolveProductizationView(restArgs), restArgs);
  }

  if (command === 'experience' || command === 'profile' || command === 'profiles') {
    return runExperienceProfiles(restArgs);
  }

  if (command === 'learn' || command === 'learning' || command === 'mnemos-learning' || command === 'native-learning-loop') {
    const first = String(restArgs[0] || '').trim().toLowerCase();
    const forwarded = first === 'loop' || first === 'status' || first === 'native' ? restArgs.slice(1) : restArgs;
    return runNativeLearningLoop(forwarded);
  }

  if (command === 'conversation' || command === 'conversational-setup' || command === 'calibrate') {
    return runConversationalSetup(restArgs);
  }

  if (command === 'guided-missions' || command === 'mission-guide') {
    return runGuidedMissions(restArgs);
  }

  if (command === 'capability-store' || command === 'store') {
    return runCapabilityStore(restArgs);
  }

  if (command === 'do-it-with-me' || command === 'with-me' || command === 'guide-me') {
    return runDoItWithMe(restArgs);
  }

  if (command === 'trust' || command === 'trust-approval' || command === 'approval-ux') {
    return runTrustApprovalUxFinal(restArgs);
  }

  if (command === 'trust-panel' || command === 'safety-panel') {
    return runTrustPanel(restArgs);
  }

  if (command === 'autonomy' || command === 'autonomy-slider') {
    return runAutonomySlider(restArgs);
  }

  if (command === 'model-cost' || command === 'cost-guard' || command === 'budget-guard') {
    return runModelCostGuard(restArgs);
  }

  if (command === 'workflows' || command === 'dynamic-workflows' || command === 'workflow') {
    if (command === 'workflows' && ['status', 'process'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      const { runZavorthCli } = await import('./cli/ZavorthCli.js');
      return runZavorthCli(['workflows', ...restArgs]);
    }
    return runDynamicWorkflows(restArgs);
  }

  if (command === 'effort' || command === 'reasoning-effort' || command === 'thinking-effort') {
    return runEffortControl(restArgs);
  }

  if (command === 'visual-receipts' || command === 'receipts-v2') {
    return runVisualReceiptsV2(restArgs);
  }

  if (command === 'satellite-approvals' || command === 'satellite-approval' || command === 'mobile-approvals') {
    return runSatelliteApprovalCompanion(restArgs);
  }

  if (command === 'ask-runtime' || command === 'runtime-question' || command === 'runtime-ask') {
    return runNaturalRuntimeQuestions(restArgs);
  }

  if (command === 'zavorthControl-home' || command === 'experience-home' || command === 'zavorthControl-home') {
    return runZavorthControlExperienceHome(restArgs);
  }

  if (command === 'status' || command === 'ready' || command === 'ready-to-go') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('status');
    }
    return runReadyToGo(restArgs);
  }

  if (
    command === 'operator-check'
    || command === 'operator'
    || command === 'opcheck'
    || command === 'one-check'
  ) {
    return runOneCommandOperatorCheck(restArgs);
  }

  if (command === 'stay-online' || command === 'stayonline') {
    return runStayOnline(restArgs);
  }

  if (
    command === 'smart-command'
    || command === 'smart-commands'
    || command === 'slash'
    || command === 'slash-command'
    || command === 'commands-certification'
  ) {
    return runSmartCommands(restArgs);
  }

  if ([
    'new',
    'reset',
    'model',
    'personality',
    'persona',
    'retry',
    'undo',
    'compress',
    'usage',
    'insights',
    'skills',
    'skill',
    'stop',
    'platforms',
    'sethome',
  ].includes(command)) {
    return runSmartCommands([`/${command}`, ...restArgs]);
  }

  if (command === 'acp' || command === 'acpx') {
    return runAcp(restArgs);
  }

  // agent import -> governed external agent migration pack
  if (
    (command === 'agent' || command === 'agents')
    && ['import', 'migrate', 'migration'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runExternalAgentMigrationPack(restArgs.slice(1));
  }

  if (
    command === 'external-agent-migration'
    || command === 'external-agent-migration-pack'
    || command === 'agent-import'
    || command === 'agent-migrate'
    || command === 'agents-import'
  ) {
    return runExternalAgentMigrationPack(restArgs);
  }

  if (
    command === 'external-agent-onboarding'
    || command === 'agent-onboarding'
    || command === 'agents-onboarding'
  ) {
    return runExternalAgentOnboarding(restArgs);
  }

  if (
    command === 'external-agent'
    || command === 'external-agents'
    || command === 'agent-gateway'
    || command === 'agents-gateway'
  ) {
    return runExternalAgentGateway(restArgs);
  }

  if (
    command === 'capability-mesh'
    || command === 'capabilities-mesh'
    || command === 'skill-broker'
    || command === 'capability-broker'
  ) {
    return runCapabilityMesh(restArgs);
  }

  if (
    command === 'agent-review'
    || command === 'review'
    || command === 'code-review'
    || command === 'repo-review'
  ) {
    return runAgentReview(restArgs);
  }

  if (
    command === 'skill-curator'
    || command === 'skills-curator'
    || command === 'curator'
    || command === 'curate-skills'
  ) {
    return runSkillCurator(restArgs);
  }

  if (
    command === 'persistent-approvals'
    || command === 'approval-policy'
    || command === 'auto-approval'
    || command === 'always-allow'
    || command === 'permito-sempre'
    || command === 'break-glass'
    || command === 'modo-extremo'
    || command === 'responsabilidade-total'
  ) {
    return runPersistentApprovals(restArgs);
  }

  if (command === 'approvals' && ['always', 'auto', 'policy', 'permito-sempre', 'break-glass'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    return runPersistentApprovals(restArgs.slice(1));
  }

  if (
    command === 'skill-expansion-pack'
    || command === 'skills-expansion-pack'
    || command === 'expand-skills'
    || command === 'absorb-skills'
  ) {
    return runSkillExpansionPack(restArgs);
  }

  if (command === 'capability-certification' || command === 'native-certification' || command === 'certification-pack') {
    return runCapabilityCertification(restArgs);
  }

  if (command === 'provider-certification' || command === 'providers-certification') {
    return runProviderConsistency(restArgs);
  }

  if (command === 'gateway-matrix' || command === 'channels-matrix') {
    return runGatewayMatrix(restArgs);
  }

  if (command === 'execution-backends' || command === 'backends' || command === 'sandbox-backends') {
    return runExecutionBackends(restArgs);
  }

  if (command === 'skill-ecosystem' || command === 'skills-ecosystem') {
    return runSkillEcosystem(restArgs);
  }

  if (command === 'readiness' || command === 'runtime-readiness') {
    return runRuntimeReadiness(restArgs);
  }

  if (command === 'daily' || command === 'cli-home' || command === 'start-here' || command === 'home') {
    return runCliExperienceConsistency(restArgs);
  }

  if (command === 'experience-certify' || command === 'daily-certify') {
    return runExperienceLayerDailyUseCertification(restArgs);
  }

  if (command === 'gateway') {
    const gatewayControlSubcommand = String(restArgs[0] || 'status').trim().toLowerCase();
    if ([
      'status',
      'providers',
      'models',
      'combos',
      'combo',
      'cache',
      'rate-limits',
      'rate-limit',
      'ratelimits',
      'doctor',
    ].includes(gatewayControlSubcommand)) {
      const { runZavorthCli } = await import('./cli/ZavorthCli.js');
      return runZavorthCli(['gateway', ...restArgs]);
    }
    if (String(restArgs[0] || '').trim().toLowerCase() === 'matrix') {
      return runGatewayMatrix(restArgs.slice(1));
    }
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth AI Gateway', [
        'Usage:',
        '  zavorth gateway status',
        '  zavorth gateway providers',
        '  zavorth gateway models',
        '  zavorth gateway combos',
        '  zavorth gateway cache stats',
        '  zavorth gateway rate-limits',
        '  zavorth gateway doctor',
        '  zavorth gateway matrix',
        '',
        'Legacy runtime projections:',
        '  zavorth gateway sessions',
        '  zavorth gateway channels',
        '  zavorth gateway approvals',
        '  zavorth gateway receipts',
        '  zavorth gateway artifacts',
        '',
        'Shows provider readiness, active route, fallback, cache, cost, latency and health.',
        '',
        'Options:',
        '  --json    Print the same AI Gateway projection as JSON.',
      ], 'info');
    }
    return runGatewaySpine(restArgs);
  }

  if (command === 'preview' || command === 'sensitive-flow' || command === 'sensitive-action') {
    return runSensitiveActionFlow(restArgs);
  }

  if (command === 'providers' || command === 'models') {
    const providerAction = String(restArgs[0] || '').trim().toLowerCase();
    if (['doctor', 'canary', 'activate'].includes(providerAction)) {
      return runProviderLongTailActivation(normalizeMeshActivationArgs('provider', providerAction, restArgs));
    }
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth models', [
        'Usage: zavorth models [options] [command]',
        '',
        'Model/provider discovery, readiness and configuration',
        '',
        'Options:',
        '  -h, --help       Display help for command',
        '  --json           Output JSON when supported',
        '',
        'Commands:',
        '  status           Show configured provider readiness',
        '  catalog          Show provider catalog and capabilities',
        '  matrix           Show canonical provider capability matrix',
        '  add              Configure a provider',
        '  add --discover   Auto-discover models from provider API',
        '  setup            Guided provider setup',
        '  switch           Change active provider/model',
        '  consistency           Show provider readiness inventory',
        '',
        'Examples:',
        '  zavorth models status',
        '  zavorth models catalog',
        '  zavorth models add --provider openai --model gpt-4.1',
        '  zavorth models add --discover --provider groq --base-url https://api.groq.com/openai/v1',
      ], 'info');
    }
    if (providerAction === 'consistency') {
      return runProviderConsistency(restArgs.slice(1));
    }
    if (['catalog', 'capabilities', 'capability-catalog', 'all', 'inventory'].includes(providerAction)) {
      return runProviderCapabilityCatalog(restArgs.slice(1));
    }
    if (['matrix', 'capability-matrix', 'coverage'].includes(providerAction)) {
      return runProviderCapabilityMatrix(restArgs.slice(1));
    }
    if (['add', 'setup', 'configure', 'switch'].includes(providerAction)) {
      return runProviderChannelWizard(['providers', ...restArgs]);
    }
    return runProviderReadiness(restArgs);
  }

  if (command === 'native' || command === 'integrations') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth native', [
        'Usage: zavorth native [options] [command]',
        '',
        'Inspect native provider, channel and capability inventory.',
        '',
        'Options:',
        '  -h, --help       Display help for command',
        '  --json           Output JSON when supported',
        '',
        'Commands:',
        '  catalog          Show native-ready providers, channels and capabilities',
        '  list             Alias for catalog',
        '  ready            Show readiness-oriented inventory',
        '',
        'Examples:',
        '  zavorth native catalog',
        '    Inspect native adapters.',
        '  zavorth native catalog --json',
        '    Print machine-readable inventory.',
        '',
        'Docs: zavorth help reference',
      ], 'info');
    }
    const action = String(restArgs[0] || 'catalog').trim().toLowerCase();
    if (['catalog', 'list', 'inventory', 'ready'].includes(action)) {
      return runNativeIntegrations(restArgs.slice(1));
    }
  }

  if (command === 'diagnostics') {
    const action = String(restArgs[0] || '').trim().toLowerCase();
    if (action === 'export') {
      return runDiagnosticsExport(restArgs.slice(1));
    }
    return printCliPanel('Zavorth diagnostics', [
      'Usage: zavorth diagnostics export [options]',
      '',
      'Exports system diagnostics in a sanitized format.',
      '',
      'Options:',
      '  -o, --output=<path>   Custom output path for the JSON export file.',
      '  --json                Output raw JSON response to stdout.',
    ], 'info');
  }

  if (command === 'mock-gateway') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printCliPanel('Zavorth mock-gateway', [
        'Usage: zavorth mock-gateway [options]',
        '',
        'Simulates a channel gateway dialogue session offline using stub adapters.',
        '',
        'Options:',
        '  -h, --help           Display help for command',
        '  --channel=<channel>  Channel to mock (slack, whatsapp, teams, imessage, signal, email, instagram, discord). Default: slack',
        '  --userId=<userId>    Simulated sender user ID. Default: mock-user',
        '  --chatId=<chatId>    Simulated conversation/channel ID. Default: mock-chat',
        '  --isGroup            Simulate a group message (defaults to false)',
        '',
        'Examples:',
        '  zavorth mock-gateway --channel=slack',
        '  zavorth mock-gateway --channel=whatsapp --userId=operator',
      ], 'info');
    }
    const { runZavorthMockGatewayCommand } = await import('./cli/ZavorthMockGatewayCommand.js');
    return runZavorthMockGatewayCommand(restArgs);
  }

  if (command === 'doctor' && ['convergence', 'native-convergence'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    return runZavorthConvergenceDoctor(restArgs.slice(1));
  }

  if (command === 'doctor' && ['product-hardening', 'hardening', 'maturity', 'product-maturity'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    return runZavorthProductHardeningDoctor(restArgs.slice(1));
  }

  if (command === 'doctor') {
    const firstDoctorArg = String(restArgs.find((arg) => !arg.startsWith('--')) || '').trim().toLowerCase();
    const specializedDoctorTopics = new Set([
      'runtime',
      'security',
      'seguranca',
      'capabilities',
      'capability-registry',
      'profiles',
      'runtime-profiles',
      'contracts',
      'runtime-contracts',
      'activation',
      'capability-activation',
      'activation-ledger',
      'activation-receipts',
      'receipts',
      'activation-replay',
      'activation-rollback',
      'replay',
      'retention',
      'runtime-retention',
      'mode',
      'runtime-mode',
      'mode-governor',
      'sidecars',
      'sidecar-manager',
    ]);
    if (!firstDoctorArg || firstDoctorArg === 'premium') {
      return runPremiumDoctor(firstDoctorArg === 'premium' ? restArgs.slice(1) : restArgs);
    }
    if (!specializedDoctorTopics.has(firstDoctorArg) && !restArgs.includes('--simple') && !restArgs.includes('--advanced')) {
      return runPremiumDoctor(restArgs);
    }
  }

  if (
    command === 'doctor'
    && (restArgs.includes('--simple') || restArgs.includes('--advanced'))
  ) {
    return runProductizationProtectedRuntime('all', restArgs);
  }

  if (command === 'doctor' && String(restArgs[0] || '').trim().toLowerCase() === 'runtime') {
    return runRuntimeResourceDoctor(restArgs.slice(1), restArgs.includes('--budget') || restArgs.includes('--strict'));
  }

  if (
    command === 'doctor'
    && ['security', 'seguranca', 'seguranÃ§a'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runOperationalSecurityDoctor(restArgs.slice(1));
  }

  if (
    command === 'security'
    && ['continuous', 'monitor', 'baseline'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runContinuousSecurityMonitor(restArgs);
  }

  if (
    command === 'security'
    && ['preset', 'presets'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runSecurityOperationalPreset(restArgs.slice(1));
  }

  if (
    command === 'security'
    && ['doctor', 'status', 'check'].includes(String(restArgs[0] || 'doctor').trim().toLowerCase())
  ) {
    return runOperationalSecurityDoctor(restArgs.slice(1));
  }

  if (command === 'budget' && String(restArgs[0] || '').trim().toLowerCase() === 'runtime') {
    return runRuntimeResourceDoctor(restArgs.slice(1), true);
  }

  if (
    (command === 'core' || command === 'start')
    && ['minimal', 'kernel'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runMinimalKernel(restArgs.slice(1));
  }

  if (command === 'ai-first' || command === 'aifirst') {
    return runAiFirstOwnerControlledDefault(restArgs);
  }

  if (command === 'doctor' && ['capabilities', 'capability-registry'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityRegistry } = await import('./core/MinimalCapabilityRegistry.js');
    const { MinimalRuntimeProfileRegistry } = await import('./core/MinimalRuntimeProfileRegistry.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const profileSnapshot = new MinimalRuntimeProfileRegistry({ profileDir }).load(profileArg);
    const manifestDir = restArgs.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'capability-manifests');
    const snapshot = new MinimalCapabilityRegistry({
      manifestDir,
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      await printCliPanel('Capability registry doctor', [
        `profile: ${profileSnapshot.selectedProfile.id}`,
        `budget: ${profileSnapshot.selectedProfile.budgetProfile}`,
        `total: ${snapshot.total}`,
        `boot: ${snapshot.activeOnBoot}`,
        `on-demand: ${snapshot.onDemand}`,
        `sidecars: ${snapshot.sidecars}`,
        `disabled: ${snapshot.disabled}`,
        `invalid: ${snapshot.invalid}`,
        '',
        `capabilities: ${snapshot.capabilities.map((capability) => `${capability.id}:${capability.boot}`).join(', ')}`,
      ], snapshot.invalid > 0 ? 'warning' : 'success');
    }
    return snapshot.invalid > 0 ? 1 : 0;
  }

  if (command === 'doctor' && ['profiles', 'runtime-profiles'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeProfileRegistry } = await import('./core/MinimalRuntimeProfileRegistry.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const snapshot = new MinimalRuntimeProfileRegistry({ profileDir }).load(profileArg);
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      const selected = snapshot.selectedProfile;
      await printCliPanel('Runtime profile doctor', [
        `selected: ${selected.id}`,
        `budget: ${selected.budgetProfile}`,
        `posture: ${selected.resourcePosture}`,
        `polling: ${selected.pollingMode}`,
        `maintenance: ${selected.maintenanceMode}`,
        `sidecars: ${selected.maxActiveSidecars}`,
        '',
        `overrides: ${Object.entries(selected.capabilityBootOverrides).map(([id, boot]) => `${id}:${boot}`).join(', ')}`,
      ], snapshot.invalid > 0 ? 'warning' : 'success');
    }
    return snapshot.invalid > 0 ? 1 : 0;
  }

  if (command === 'doctor' && ['contracts', 'runtime-contracts'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeContractService } = await import('./core/MinimalRuntimeContractService.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const manifestDir = restArgs.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'capability-manifests');
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const report = new MinimalRuntimeContractService({
      projectRoot,
      manifestDir,
      profileDir,
    }).buildReport(profileArg);
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      await printCliPanel('Runtime contract doctor', [
        `status: ${report.status}`,
        `selected profile: ${report.selectedProfileId}`,
        `capabilities: declared ${report.capabilitySummary.declared} | manifest ${report.capabilitySummary.manifest} | boot ${report.capabilitySummary.activeOnBoot} | sidecars ${report.capabilitySummary.sidecars}`,
        `profiles: total ${report.profileSummary.total} | invalid ${report.profileSummary.invalid}`,
        '',
        ...report.issues.slice(0, 12).map((issue) => `! ${issue.severity} ${issue.id} ${issue.subject}: ${issue.message}`),
      ], report.status === 'failed' ? 'error' : report.status === 'warning' ? 'warning' : 'success');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.status === 'warning') ? 1 : 0;
  }

  if (command === 'doctor' && ['activation', 'capability-activation'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityActivationPlanner } = await import('./core/MinimalCapabilityActivationPlanner.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const manifestDir = restArgs.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'capability-manifests');
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const capabilityId = restArgs.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=');
    const planner = new MinimalCapabilityActivationPlanner({
      projectRoot,
      manifestDir,
      profileDir,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
    });
    if (capabilityId) {
      const result = await planner.activate(capabilityId, {
        profile: profileArg,
        apply: restArgs.includes('--apply'),
        operation: restArgs.includes('--apply') ? 'activate' : 'plan',
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        await printCliPanel('Capability activation doctor', [
          `profile: ${result.plan.profileId}`,
          `capability: ${result.plan.capabilityId}`,
          `status: ${result.plan.status}`,
          `mode: ${result.plan.mode}`,
          `action: ${result.plan.action}`,
          `result: ${result.message}`,
        ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
      }
      return restArgs.includes('--strict') && ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    }
    const report = planner.buildReport(profileArg);
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      await printCliPanel('Capability activation doctor', [
        `status: ${report.status}`,
        `profile: ${report.profileId}`,
        `contract: ${report.contractStatus}`,
        `plans: total ${report.total} | active ${report.active} | ready ${report.ready} | manual ${report.manual} | disabled ${report.disabled} | invalid enabled ${report.invalidEnabled}`,
      ], report.status === 'failed' ? 'error' : report.invalidEnabled > 0 ? 'warning' : 'success');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.invalidEnabled > 0) ? 1 : 0;
  }

  if (command === 'doctor' && ['activation-ledger', 'activation-receipts', 'receipts'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityActivationLedger } = await import('./core/MinimalCapabilityActivationLedger.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
    const capabilityId = restArgs.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=');
    const ledgerFile = restArgs.find((arg) => arg.startsWith('--ledger-file='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'data', 'runtime', 'capability-activation-ledger.jsonl');
    const limit = readNumberFlag(restArgs, 'limit') || 20;
    const snapshot = new MinimalCapabilityActivationLedger({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      ledgerFile,
    }).buildSnapshot({ profile: profileArg || null, capability: capabilityId || null, limit });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      await printCliPanel('Capability activation ledger', [
        `status: ${snapshot.status}`,
        `exists: ${snapshot.exists}`,
        `total: ${snapshot.total}`,
        `returned: ${snapshot.returned}`,
        `invalid lines: ${snapshot.invalidLines}`,
        `counts: plan ${snapshot.counts.plan} | activate ${snapshot.counts.activate} | dry-run ${snapshot.counts.dryRun} | applied ${snapshot.counts.applied}`,
        '',
        ...snapshot.receipts.slice(0, 10).map((receipt) =>
          `- ${receipt.createdAt} ${receipt.operation}/${receipt.profileId}/${receipt.capabilityId}: ${receipt.status}/${receipt.mode}`,
        ),
      ], snapshot.invalidLines > 0 ? 'warning' : 'success');
    }
    return restArgs.includes('--strict') && snapshot.invalidLines > 0 ? 1 : 0;
  }

  if (command === 'doctor' && ['activation-replay', 'activation-rollback', 'replay'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityActivationReplayService } = await import('./core/MinimalCapabilityActivationReplayService.js');
    const action = String(restArgs[0] || '').trim().toLowerCase() === 'activation-rollback' || restArgs.includes('--rollback')
      ? 'rollback'
      : 'replay';
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
    const capabilityId = restArgs.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=');
    const receiptId = restArgs.find((arg) => arg.startsWith('--receipt-id='))?.split('=').slice(1).join('=');
    const ledgerFile = restArgs.find((arg) => arg.startsWith('--ledger-file='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'data', 'runtime', 'capability-activation-ledger.jsonl');
    const limit = readNumberFlag(restArgs, 'limit') || 20;
    const service = new MinimalCapabilityActivationReplayService({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      ledgerFile,
    });
    if (restArgs.includes('--execute') || restArgs.includes('--apply')) {
      const result = await service.execute(action, {
        profile: profileArg || null,
        capability: capabilityId || null,
        receiptId: receiptId || null,
        limit,
        apply: restArgs.includes('--apply'),
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        await printCliPanel('Capability activation replay', [
          `action: ${result.action}`,
          `apply: ${result.apply}`,
          `status: ${result.plan.status}`,
          `executable: ${result.plan.executable}`,
          `command: ${result.plan.command}`,
          `result: ${result.message}`,
        ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
      }
      return restArgs.includes('--strict') && ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    }
    const report = service.buildReport(action, {
      profile: profileArg || null,
      capability: capabilityId || null,
      receiptId: receiptId || null,
      limit,
    });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      await printCliPanel('Capability activation replay', [
        `action: ${report.action}`,
        `status: ${report.status}`,
        `total: ${report.total}`,
        `ready: ${report.ready}`,
        `noop: ${report.noop}`,
        `manual: ${report.manual}`,
        '',
        ...report.plans.slice(0, 10).map((plan) => `- ${plan.profileId}/${plan.capabilityId}: ${plan.status} | ${plan.message}`),
      ], report.status === 'failed' || report.blocked > 0 ? 'warning' : 'success');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.blocked > 0) ? 1 : 0;
  }

  if (command === 'doctor' && ['retention', 'runtime-retention'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeRetentionService } = await import('./core/MinimalRuntimeRetentionService.js');
    const dataDir = restArgs.find((arg) => arg.startsWith('--data-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'data', 'runtime');
    const report = new MinimalRuntimeRetentionService({
      projectRoot,
      dataDir,
      policy: {
        ...(readNumberFlag(restArgs, 'max-activation-receipts') !== null
          ? { maxActivationReceipts: readNumberFlag(restArgs, 'max-activation-receipts') as number }
          : {}),
        ...(readNumberFlag(restArgs, 'max-jsonl-kb') !== null
          ? { maxGenericJsonlBytes: (readNumberFlag(restArgs, 'max-jsonl-kb') as number) * 1024 }
          : {}),
      },
    }).buildReport({ apply: restArgs.includes('--apply') });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      await printCliPanel('Runtime retention doctor', [
        `status: ${report.status}`,
        `applied: ${report.applied}`,
        `files: ${report.totals.files}`,
        `bytes: ${report.totals.bytes}`,
        `actions: planned ${report.totals.planned} | manual ${report.totals.manual} | applied ${report.totals.applied} | skipped ${report.totals.skipped} | errors ${report.totals.errors}`,
        '',
        ...report.actions.filter((action) => action.status !== 'kept').slice(0, 12)
          .map((action) => `- ${action.status} ${path.basename(action.filePath)}: ${action.message}`),
      ], report.status === 'failed' || report.totals.errors > 0 ? 'warning' : 'success');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.totals.errors > 0) ? 1 : 0;
  }

  if (command === 'doctor' && ['mode', 'runtime-mode', 'mode-governor'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeModeGovernor } = await import('./core/MinimalRuntimeModeGovernor.js');
    const governor = new MinimalRuntimeModeGovernor({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    });
    if (restArgs.includes('--ledger')) {
      const snapshot = governor.buildLedgerSnapshot({
        limit: readNumberFlag(restArgs, 'limit') || 20,
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
      } else {
        await printCliPanel('Runtime mode ledger', [
          `status: ${snapshot.status}`,
          `total: ${snapshot.total}`,
          `active: ${snapshot.active}`,
          `released: ${snapshot.released}`,
          `dry-run: ${snapshot.dryRun}`,
          '',
          ...snapshot.leases.slice(0, 10).map((lease) => `- ${lease.id}: ${lease.status} ${lease.fromProfile}->${lease.toProfile} ${lease.capabilityId} expires=${lease.expiresAt}`),
        ], snapshot.status === 'failed' ? 'error' : 'success');
      }
      return snapshot.status === 'failed' ? 1 : 0;
    }
    const plan = governor.plan({
      fromProfile: readStringFlag(restArgs, 'from') || readStringFlag(restArgs, 'profile') || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb',
      toProfile: readStringFlag(restArgs, 'to'),
      capability: readStringFlag(restArgs, 'capability') || String(restArgs[1] || 'browser'),
      reason: readStringFlag(restArgs, 'reason'),
      ttlMs: readDurationMsFlag(restArgs, 'ttl'),
    });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    } else {
      await printCliPanel('Runtime mode governor', [
        `status: ${plan.status}`,
        `action: ${plan.action}`,
        `profile: ${plan.fromProfile} -> ${plan.toProfile}`,
        `capability: ${plan.capabilityId}`,
        `ttl: ${plan.ttlMs}ms`,
        `expires: ${plan.expiresAt}`,
        `budget: ${plan.budgetOk ? 'ok' : 'blocked'}`,
        `result: ${plan.message}`,
      ], ['blocked', 'missing'].includes(plan.status) ? 'warning' : 'success');
    }
    return ['blocked', 'missing'].includes(plan.status) ? 1 : 0;
  }

  if (command === 'capability' && ['plan', 'activate', 'replay', 'rollback'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    if (['replay', 'rollback'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      const { MinimalCapabilityActivationReplayService } = await import('./core/MinimalCapabilityActivationReplayService.js');
      const action = String(restArgs[0] || '').trim().toLowerCase() === 'rollback' ? 'rollback' : 'replay';
      const capabilityId = String(restArgs[1] || '').trim();
      const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
        || process.env.ZAVORTH_RUNTIME_PROFILE
        || process.env.ZAVORTH_PROFILE
        || null;
      const result = await new MinimalCapabilityActivationReplayService({
        projectRoot,
        dataDir: path.join(projectRoot, 'data', 'runtime'),
        ledgerFile: path.join(projectRoot, 'data', 'runtime', 'capability-activation-ledger.jsonl'),
      }).execute(action, {
        profile: profileArg,
        capability: capabilityId || null,
        apply: restArgs.includes('--apply'),
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        await printCliPanel('Capability replay', [
          `action: ${result.action}`,
          `profile: ${result.plan.profileId}`,
          `capability: ${result.plan.capabilityId}`,
          `status: ${result.plan.status}`,
          `command: ${result.plan.command}`,
          `result: ${result.message}`,
        ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
      }
      return ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    }
    const { MinimalCapabilityActivationPlanner } = await import('./core/MinimalCapabilityActivationPlanner.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const capabilityId = String(restArgs[1] || '').trim();
    if (!capabilityId) {
      await logCliError('Informe o id da capability.', 'Usage Error');
      return 1;
    }
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const planner = new MinimalCapabilityActivationPlanner({
      projectRoot,
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
      dataDir: path.join(projectRoot, 'data', 'runtime'),
    });
    const result = action === 'activate'
      ? await planner.activate(capabilityId, {
        profile: profileArg,
        apply: restArgs.includes('--apply'),
        operation: 'activate',
      })
      : await planner.activate(capabilityId, {
        profile: profileArg,
        apply: false,
        operation: 'plan',
      });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      await printCliPanel('Capability activation', [
        `profile: ${result.plan.profileId}`,
        `capability: ${result.plan.capabilityId}`,
        `status: ${result.plan.status}`,
        `mode: ${result.plan.mode}`,
        `action: ${result.plan.action}`,
        `result: ${result.message}`,
      ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
    }
    return ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
  }

  if (command === 'mode' && ['plan', 'elevate', 'release'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeModeGovernor } = await import('./core/MinimalRuntimeModeGovernor.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const governor = new MinimalRuntimeModeGovernor({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    });
    if (action === 'plan') {
      const plan = governor.plan({
        fromProfile: readStringFlag(restArgs, 'from') || readStringFlag(restArgs, 'profile') || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb',
        toProfile: readStringFlag(restArgs, 'to'),
        capability: readStringFlag(restArgs, 'capability') || String(restArgs[1] || 'browser'),
        reason: readStringFlag(restArgs, 'reason'),
        ttlMs: readDurationMsFlag(restArgs, 'ttl'),
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      } else {
        await printCliPanel('Runtime mode plan', [
          `status: ${plan.status}`,
          `action: ${plan.action}`,
          `profile: ${plan.fromProfile} -> ${plan.toProfile}`,
          `capability: ${plan.capabilityId}`,
          `result: ${plan.message}`,
        ], ['blocked', 'missing'].includes(plan.status) ? 'warning' : 'success');
      }
      return ['blocked', 'missing'].includes(plan.status) ? 1 : 0;
    }
    const result = action === 'release'
      ? governor.release(String(restArgs[1] || readStringFlag(restArgs, 'lease') || '').trim(), {
        apply: restArgs.includes('--apply'),
        reason: readStringFlag(restArgs, 'reason'),
      })
      : governor.elevate({
        fromProfile: readStringFlag(restArgs, 'from') || readStringFlag(restArgs, 'profile') || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb',
        toProfile: readStringFlag(restArgs, 'to'),
        capability: readStringFlag(restArgs, 'capability') || String(restArgs[1] || 'browser'),
        reason: readStringFlag(restArgs, 'reason'),
        ttlMs: readDurationMsFlag(restArgs, 'ttl'),
        apply: restArgs.includes('--apply'),
      });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      await printCliPanel('Runtime mode', [
        `applied: ${result.applied}`,
        `dry-run: ${result.dryRun}`,
        `status: ${result.plan.status}`,
        `action: ${result.plan.action}`,
        `lease: ${result.lease?.id || 'none'}`,
        `profile: ${result.plan.fromProfile} -> ${result.plan.toProfile}`,
        `return profile: ${result.plan.returnProfile}`,
        `result: ${result.message}`,
      ], ['blocked', 'missing'].includes(result.plan.status) ? 'warning' : 'success');
    }
    return ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
  }

  if (command === 'doctor' && ['sidecars', 'sidecar-manager'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityRegistry } = await import('./core/MinimalCapabilityRegistry.js');
    const { MinimalRuntimeProfileRegistry } = await import('./core/MinimalRuntimeProfileRegistry.js');
    const { MinimalSidecarManager } = await import('./core/MinimalSidecarManager.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const profileSnapshot = new MinimalRuntimeProfileRegistry({
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    }).load(profileArg);
    const capabilityRegistry = new MinimalCapabilityRegistry({
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    const snapshot = await new MinimalSidecarManager({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      runtimeProfile: profileSnapshot.selectedProfile,
      capabilityRegistry,
    }).inspectLive();
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      await printCliPanel('Sidecar manager doctor', [
        `profile: ${snapshot.profileId}`,
        `total: ${snapshot.total}`,
        `launchable: ${snapshot.launchable}`,
        `running: ${snapshot.running}`,
        `ready: ${snapshot.ready}`,
        '',
        ...snapshot.sidecars.map((sidecar) => `- ${sidecar.id}: ${sidecar.state} | launchable=${sidecar.launchable} | ${sidecar.message}`),
      ], snapshot.ready === snapshot.total ? 'success' : 'warning');
    }
    return 0;
  }

  if (command === 'sidecar' && ['start', 'stop'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityRegistry } = await import('./core/MinimalCapabilityRegistry.js');
    const { MinimalRuntimeProfileRegistry } = await import('./core/MinimalRuntimeProfileRegistry.js');
    const { MinimalSidecarManager } = await import('./core/MinimalSidecarManager.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const sidecarId = String(restArgs[1] || '').trim();
    if (!sidecarId) {
      await logCliError('Informe o id do sidecar.', 'Usage Error');
      return 1;
    }
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'desktop';
    const profileSnapshot = new MinimalRuntimeProfileRegistry({
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    }).load(profileArg);
    const capabilityRegistry = new MinimalCapabilityRegistry({
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    const manager = new MinimalSidecarManager({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      runtimeProfile: profileSnapshot.selectedProfile,
      capabilityRegistry,
    });
    const result = action === 'start'
      ? await manager.start(sidecarId, { dryRun: !restArgs.includes('--apply') })
      : await manager.stop(sidecarId, { dryRun: !restArgs.includes('--apply') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  if (command === 'browser' && [
    'health',
    'navigate',
    'screenshot',
    'extract-text',
    'click',
    'type',
    'close',
    'shutdown',
  ].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalBrowserSidecarClient } = await import('./core/MinimalBrowserSidecarClient.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const baseUrl = restArgs.find((arg) => arg.startsWith('--base-url='))?.split('=').slice(1).join('=');
    const timeoutMs = Number(restArgs.find((arg) => arg.startsWith('--timeout-ms='))?.split('=').slice(1).join('=') || 30_000);
    const client = new MinimalBrowserSidecarClient({ baseUrl, timeoutMs });
    let result: unknown;
    if (action === 'health') {
      result = await client.health();
    } else if (action === 'navigate') {
      const url = restArgs[1] || restArgs.find((arg) => arg.startsWith('--url='))?.split('=').slice(1).join('=');
      if (!url) {
        await logCliError('Informe a URL para navegar.', 'Browser Sidecar Error');
        return 1;
      }
      result = await client.navigate(url, {
        waitUntil: restArgs.find((arg) => arg.startsWith('--wait-until='))?.split('=').slice(1).join('='),
        timeoutMs,
      });
    } else if (action === 'screenshot') {
      result = await client.screenshot({
        fullPage: !restArgs.includes('--viewport-only'),
        base64: restArgs.includes('--base64'),
      });
    } else if (action === 'extract-text') {
      result = await client.extractText({
        maxChars: Number(restArgs.find((arg) => arg.startsWith('--max-chars='))?.split('=').slice(1).join('=') || 20_000),
        timeoutMs,
      });
    } else if (action === 'click') {
      const selector = restArgs[1] || restArgs.find((arg) => arg.startsWith('--selector='))?.split('=').slice(1).join('=');
      if (!selector) {
        await logCliError('Informe o selector para clicar.', 'Browser Sidecar Error');
        return 1;
      }
      result = await client.click(selector, { timeoutMs });
    } else if (action === 'type') {
      const selector = restArgs[1] || restArgs.find((arg) => arg.startsWith('--selector='))?.split('=').slice(1).join('=');
      const text = restArgs[2] || restArgs.find((arg) => arg.startsWith('--text='))?.split('=').slice(1).join('=') || '';
      if (!selector) {
        await logCliError('Informe o selector para digitar.', 'Browser Sidecar Error');
        return 1;
      }
      result = await client.type(selector, text, { timeoutMs });
    } else if (action === 'close') {
      result = await client.close();
    } else {
      result = await client.shutdown();
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  if (command === 'echo' || command === 'voice' || command === 'voz') {
    if (String(restArgs[0] || '').trim().toLowerCase() === 'wake') {
      return runZavorthEchoWakeCommand(restArgs.slice(1));
    }
    return npmInherited(['start'], path.join(projectRoot, 'agent'));
  }

  if (command === 'serve' || command === 'server' || command === 'api') {
    if (runningFromDist) {
      return spawnInherited(process.execPath, [path.join(entryDir, 'gateway', 'index.js')], projectRoot);
    }
    return npmInherited(['exec', 'tsx', '--', 'src/gateway/index.ts'], projectRoot);
  }

  if (command === 'ui') {
    return spawnInherited(process.execPath, [path.join(projectRoot, 'scripts', 'start-echo-stack.mjs')], projectRoot);
  }

  if (isZavorthLiveNamespaceCommand(command)) {
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot,
      command,
      args: restArgs,
    });
    process.stdout.write(result.output);
    return result.exitCode;
  }

  const suggestion = resolveCommandSuggestion(command);
  if (suggestion) {
    return printCommandSuggestion(command, suggestion);
  }

  return null;
}

function readPackageVersion(): string {
  try {
    const parsed = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as { version?: string };
    return String(parsed.version || 'local');
  } catch {
    return 'local';
  }
}

function resolveCommandSuggestion(command: string): string[] | null {
  const normalized = String(command || '').trim().toLowerCase();
  if (normalized.length < 2 || normalized.includes(' ') || normalized.startsWith('-')) {
    return null;
  }
  if (PUBLIC_COMMANDS.includes(normalized)) {
    return null;
  }
  const prefixMatches = PUBLIC_COMMANDS
    .filter((item) => item.startsWith(normalized))
    .slice(0, 5);
  if (prefixMatches.length > 0) {
    return prefixMatches;
  }
  const nearMatches = PUBLIC_COMMANDS
    .map((item) => ({ item, distance: levenshtein(normalized, item) }))
    .filter((entry) => entry.distance <= 2)
    .sort((a, b) => a.distance - b.distance || a.item.localeCompare(b.item))
    .slice(0, 4)
    .map((entry) => entry.item);
  return nearMatches.length > 0 ? nearMatches : null;
}

async function printCommandSuggestion(command: string, suggestions: string[]): Promise<number> {
  const lines = [
    `Unknown command: ${command}`,
    '',
    'Did you mean?',
    ...suggestions.map((item) => `  zavorth ${item}`),
    '',
    `To send "${command}" as a message, use:`,
    `  zavorth ask "${command}"`,
  ].join('\n');
  if (process.stdout.isTTY && !process.argv.includes('--json')) {
    const { TerminalPanel } = await import('./cli/presentation/TerminalPanel.js');
    process.stdout.write(`${TerminalPanel.render(lines, {
      title: 'Command hint',
      type: 'warning',
      padding: 1,
      width: Math.max(56, Math.min(84, Number(process.stdout.columns || 86) - 4)),
    })}\n`);
  } else {
    process.stdout.write(`${lines}\n`);
  }
  return 1;
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = temp;
    }
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

void runSimpleCommandPlan(simpleCommandPlan)
  .then((simpleExitCode) => simpleExitCode !== null ? simpleExitCode : runBuiltinLauncher(args))
  .then(async (handledExitCode) => {
    if (handledExitCode !== null) {
      return handledExitCode;
    }
    const { runZavorthCli } = await import('./cli/ZavorthCli.js');
    return runZavorthCli(args);
  })
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    const isTTY = process.stderr.isTTY && !process.argv.includes('--json');
    const isDebug = process.env.ZAVORTH_DEBUG === '1' || process.argv.includes('--debug') || process.argv.includes('--verbose');

    if (isTTY) {
      try {
        const { ZavorthSelfHealingUxService } = await import('./services/ZavorthSelfHealingUxService.js');
        const { formatZavorthSelfHealingProjection } = await import('./cli/ZavorthCliSelfHealingRenderer.js');
        const projection = new ZavorthSelfHealingUxService().buildProjection({
          attempted: `Run ${args.join(' ') || 'zavorth'}`,
          commandName: args[0] || null,
          commandText: args.join(' '),
          error,
          debug: isDebug,
        });
        process.stderr.write(`${formatZavorthSelfHealingProjection(projection)}\n`);
        if (isDebug && error instanceof Error && error.stack) {
          process.stderr.write(`\nDebug Stack Trace:\n${error.stack}\n`);
        }
      } catch (e) {
        console.error([
          'Zavorth could not finish this command.',
          `Cause: ${message}`,
          'Zavorth can inspect the failure and propose a narrow repair before applying anything.',
          isDebug && error instanceof Error && error.stack ? `Debug:\n${error.stack}` : null,
        ].filter(Boolean).join('\n'));
      }
    } else {
      console.error([
        'Zavorth could not finish this command.',
        `Cause: ${message}`,
        'Zavorth can inspect the failure and propose a narrow repair before applying anything.',
        isDebug && error instanceof Error && error.stack
          ? `Debug:\n${error.stack}`
          : null,
      ].filter(Boolean).join('\n'));
    }
    process.exit(1);
  });
