import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { runPromotedScript } from './ZavorthCliPremiumPart2.js';
import { formatCliHelp, resolveCliHelpTopic } from '../ZavorthCliSurfaceHelpers.js';
import { getCommandAliases } from '../locales/localeManager.js';
import { resolveZavorthSimpleCommand, type ZavorthSimpleCommandPlan } from '../SimpleCommandRouter.js';
import {
  formatZavorthCertificationHelp,
  formatZavorthConsistencyPreparedNotice,
  isZavorthConsistencyStubCommand,
} from '../ZavorthCliCertificationCommands.js';
import {
  isZavorthLiveNamespaceCommand,
  runZavorthLiveNamespaceCommand,
} from '../ZavorthCliLiveNamespaces.js';
import { runDiskMutationGateCommand } from '../disk/ZavorthCliDiskMutationNamespace.js';

import { runProjectConstitutionCommand } from '../constitution/ZavorthCliConstitutionNamespace.js';
// Shared infrastructure imports
import {
  projectRoot,
  logCliError,
  printCliPanel,
  spawnInherited,
  npmInherited,
  resolveNpmCli,
  printBuiltinHelp,
  printGeneralHelp,
  readNumberFlag,
  readStringFlag,
  readFlexibleStringFlag,
  readStringListFlag,
  readTaskPositional,
  readDurationMsFlag,
  runningFromDist
} from '../ZavorthCliCommonInfrastructure.js';

// Types
import type { DiskMutationGateRequestedOperation } from '../../contracts/DiskMutationGateContract.js';
import { logger } from '../../logger.js';
import { asErrorLike, errorMessage } from '../../utils/errorLike.js';
type JsonObject = Record<string, unknown>;

export async function runRuntimeResourceDoctor(rawArgs: string[], strict: boolean): Promise<number> {
  const { RuntimeResourceBudgetService } = await import('../../services/RuntimeResourceBudgetService.js');
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

export async function runOperationalSecurityDoctor(rawArgs: string[]): Promise<number> {
  const {
    buildOperationalSecurityDoctorReport,
    formatOperationalSecurityDoctorReport,
  } = await import('../../security/OperationalSecurityDoctor.js');
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

export async function runPremiumDoctor(rawArgs: string[]): Promise<number> {
  const { runZavorthDoctorPremium } = await import('../doctor/index.js');
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

export async function runDiagnosticsExport(rawArgs: string[]): Promise<number> {
  const { DiagnosticsExporterService } = await import('../../services/DiagnosticsExporterService.js');

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
  } catch (error: unknown) {
    const err = asErrorLike(error);
    await logCliError(`Failed to export diagnostics: ${errorMessage(error)}`, 'Export Failed');
    return 1;
  }
}

export async function runPremiumHome(rawArgs: string[]): Promise<number> {
  const { runZavorthCliHome } = await import('../home/index.js');
  const result = runZavorthCliHome({
    projectRoot,
    json: rawArgs.includes('--json'),
  });
  process.stdout.write(result.output);
  return result.exitCode;
}

export async function runZavorthHomeCommand(rawArgs: string[]): Promise<number> {
  const { ZavorthHomePathService } = await import('../../services/ZavorthHomePathService.js');
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
      snapshot.migration.writesPerformed ? `${snapshot.migration.status} with approval ${snapshot.migration.approvalId}`
        : 'no data was written without --apply --approval-id=<id>',
    );
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return snapshot.migration.status === 'blocked' ? 1 : 0;
}

export function writeZavorthHomeEnvSelection(root: string, homeRoot: string): { written: boolean; envFile: string; key: 'ZAVORTH_HOME' } {
  const envFile = path.join(root, '.env');
  const key = 'ZAVORTH_HOME' as const;
  const nextLine = `${key}=${homeRoot}`;
  let current = '';
  try {
    current = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  } catch (error: unknown) {logger.warn('[Zavorth Cli Premium Part1] filesystem operation failed', error);
    current = '';
  }
  const lines = current.split(/\r...\n/u);
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

export async function runZavorthEchoWakeCommand(rawArgs: string[]): Promise<number> {
  const { VoiceWakeRuntimeService } = await import('../../services/VoiceWakeRuntimeService.js');
  const { VoiceWakeDetectorSetupService } = await import('../../services/VoiceWakeDetectorSetupService.js');
  const { ZavorthHomePathService } = await import('../../services/ZavorthHomePathService.js');
  const subcommand = String(rawArgs[0] || 'status').trim().toLowerCase();
  if (subcommand === 'setup' || subcommand === 'configure') {
    const setup = new VoiceWakeDetectorSetupService({ projectRoot, env: process.env });
    const snapshot = setup.buildPlan({
      choice: rawArgs.includes('--disabled') ? 'disabled'
        : rawArgs.includes('--custom-command') ? 'custom-command'
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

export async function runZavorthTasksCommand(rawArgs: string[]): Promise<number> {
  const { TaskPlaneService } = await import('../../services/TaskPlaneService.js');
  const { ZavorthHomePathService } = await import('../../services/ZavorthHomePathService.js');
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

export async function runZavorthFriendlyWorkCommand(
  command: 'todo' | 'later' | 'work' | 'done' | 'retry' | 'cancel',
  rawArgs: string[],
): Promise<number> {
  const { ZavorthFriendlyWorkCommandService } = await import('../../services/ZavorthFriendlyWorkCommandService.js');
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

export async function runPremiumHatch(rawArgs: string[]): Promise<number> {
  if (rawArgs.includes('--start')) {
    return runPromotedScript('ops-go', rawArgs.filter((arg) => arg !== '--start'));
  }
  const { runZavorthCliHatch } = await import('../hatch/index.js');
  const result = runZavorthCliHatch({
    projectRoot,
    json: rawArgs.includes('--json'),
  });
  process.stdout.write(result.output);
  return result.exitCode;
}

export async function runPremiumQuickStart(rawArgs: string[]): Promise<number> {
  const { runZavorthCliQuickStart } = await import('../quickstart/index.js');
  const result = await runZavorthCliQuickStart({
    projectRoot,
    json: rawArgs.includes('--json'),
  });
  process.stdout.write(result.output);
  return result.exitCode;
}

export async function runPremiumApprovalDiff(view: 'approvals' | 'diff', rawArgs: string[]): Promise<number> {
  const { runZavorthCliApprovalDiff } = await import('../approval-diff/index.js');
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
      const targetCard = result.snapshot.cards.find((c: any) => c.id === targetPlanId);
      if (targetCard && (targetCard.status === 'waiting_approval' || targetCard.approvalStatus === 'pending')) {
        // Render current preview first
        process.stdout.write(result.output);

        const { TerminalPanel } = await import('../presentation/TerminalPanel.js');
        const { TerminalPrompt } = await import('../presentation/TerminalPrompt.js');

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

        const confirmed = await TerminalPrompt.confirm(`Approve plan '${targetCard.id}'...`, false);
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

export async function runPremiumHud(rawArgs: string[]): Promise<number> {
  const { runZavorthCliHudInteractive } = await import('../hud/index.js');
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

export function resolveDailyHudArgs(rawArgs: string[]): string[] {
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

export async function runPremiumSetupStudio(rawArgs: string[]): Promise<number> {
  const { runZavorthSetupStudioCommand } = await import('../setup-studio/index.js');
  const result = await runZavorthSetupStudioCommand({
    projectRoot,
    args: rawArgs,
    json: rawArgs.includes('--json'),
  });
  process.stdout.write(result.output);
  return result.exitCode;
}

export async function runGitWorkflowCommand(
  action: 'status' | 'branch' | 'commit' | 'pr',
  rawArgs: string[],
): Promise<number> {
  const { ZavorthGitWorkflowService } = await import('../../services/ZavorthGitWorkflowService.js');
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
      snapshot.plannedCommands.length ? `plan: ${snapshot.plannedCommands.map((entry) => `${entry.command} ${entry.args.join(' ')}`).join(' && ')}`
        : null,
      snapshot.approval.required
        ? `approval: ${snapshot.approval.satisfied ? snapshot.approval.approvalId : 'required for --apply'}`
        : null,
      snapshot.receipt ? `receipt: ${snapshot.receipt.receiptId}` : null,
    ].filter((line): line is string => Boolean(line)), snapshot.status === 'applied' || snapshot.status === 'ready' ? 'success' : snapshot.status === 'blocked' || snapshot.status === 'failed' ? 'error' : 'warning');
  }
  return snapshot.status === 'blocked' || snapshot.status === 'failed' ? 1 : 0;
}

export async function runContinuousSecurityMonitor(rawArgs: string[]): Promise<number> {
  const {
    buildContinuousSecurityMonitorReport,
    formatContinuousSecurityMonitorReport,
    writeContinuousSecurityBaseline,
  } = await import('../../security/ContinuousSecurityMonitor.js');
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

export async function runSecurityOperationalPreset(rawArgs: string[]): Promise<number> {
  const {
    applySecurityOperationalPreset,
    formatApplySecurityOperationalPresetResult,
    formatSecurityOperationalPresetInspection,
    formatSecurityOperationalPresetList,
    getSecurityOperationalPreset,
    inspectSecurityOperationalPreset,
    listSecurityOperationalPresets,
  } = await import('../../security/SecurityOperationalPreset.js');
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
    await logCliError(`Unknown security preset: ${action}.`, 'Security Preset Error');
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

export async function runMinimalKernel(rawArgs: string[]): Promise<number> {
  const { MinimalRuntimeKernel } = await import('../../core/MinimalRuntimeKernel.js');
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
      `capabilities: ${snapshot.capabilities.map((capability: any) => capability.id).join(', ')}`,
    ], snapshot.budget.ok ? 'success' : 'warning');
  }

  if (once) {
    await kernel.stop('once');
    return snapshot.budget.ok ? 0 : 1;
  }

  await kernel.runUntilSignal();
  return 0;
}

export async function runAiFirstOwnerControlledDefault(rawArgs: string[]): Promise<number> {
  const { AiFirstOwnerControlledDefaultActivationService } = await import('../../services/AiFirstOwnerControlledDefaultActivationService.js');
  const action = String(rawArgs[0] || 'status').trim().toLowerCase();
  if (action === 'prepare') {
    const { AiFirstActivationPreparationService } = await import('../../services/AiFirstActivationPreparationService.js');
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
  let result: import('../../contracts/AiFirstOwnerControlledDefaultActivationContract.js').AiFirstOwnerControlledDefaultResult;
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
