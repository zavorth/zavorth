import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { formatZavorthCertificationHelp } from './ZavorthCliCertificationCommands.js';
import { ZavorthOperationalReadinessService } from '../services/ZavorthOperationalReadinessService.js';
import {
  AutonomySchedulePlane,
  bindAutonomySchedulePlane,
} from '../services/AutonomySchedulePlane.js';
import { GoalLoopService } from '../services/GoalLoopService.js';
import { GoalLoopDaemonService } from '../services/GoalLoopDaemonService.js';
import { GoalLoopWorkerService } from '../services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../services/GoalPlaneService.js';
import { TaskBoardPlaneService } from '../services/TaskBoardPlaneService.js';
import { TaskPlaneService } from '../services/TaskPlaneService.js';
import { ZavorthHomePathService } from '../services/ZavorthHomePathService.js';
import { ZavorthBackgroundTaskService } from '../services/ZavorthBackgroundTaskService.js';
import { ZavorthCapabilityLifecycleService } from '../services/ZavorthCapabilityLifecycleService.js';
import { ZavorthCapabilityUsageSignalsService } from '../services/ZavorthCapabilityUsageSignalsService.js';
import { ZavorthCapabilityAtlasService } from '../services/ZavorthCapabilityAtlasService.js';
import { ZavorthDailyProductQuietAutonomyService } from '../services/ZavorthDailyProductQuietAutonomyService.js';
import { ZavorthActionGateway, type ZavorthActionOperation } from '../runtime/actions/index.js';
import {
  SessionContinuumService,
  resolveSessionContinuumStorePath,
} from '../services/SessionContinuumService.js';
import { ZavorthXaiRuntimeService } from '../services/ZavorthXaiRuntimeService.js';
import { ZavorthOperationalStateDbService } from '../services/ZavorthOperationalStateDbService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { runSkills as runSkillsNamespace } from './skills/ZavorthCliSkillsNamespace.js';
import { runPlugins as runPluginsNamespace } from './plugins/ZavorthCliPluginsNamespace.js';
import { AgentRunService } from '../runtime/agent/AgentRunService.js';
import { runCertify } from './certify/ZavorthCliCertifyNamespace.js';
import { runSandbox } from './sandbox/ZavorthCliSandboxNamespace.js';
import {
  firstArg,
  readFlag,
  readFlags,
  readNumberFlag,
  stateDir,
  readArray,
  writeJson,
  idWithTime,
  render,
  text,
  splitList,
} from './ZavorthCliSharedHelpers.js';
import type { ZavorthCapabilityUsageEventKind, ZavorthCapabilityUsageSurface } from '../contracts/ZavorthCapabilityUsageSignalsContract.js';
import type { ZavorthCapabilityAtlasCategory } from '../contracts/ZavorthCapabilityAtlasContract.js';
import type { ZavorthAppsSatelliteAction, ZavorthAppsSatelliteNodeKind } from '../contracts/ZavorthAppsSatelliteNodesContract.js';
import type { ZavorthTerminalBackendId } from '../contracts/runtime/ZavorthTerminalBackendsContract.js';
import type { SwarmScaleExecutionMode, SwarmScaleExecutionBackendId } from '../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { logger } from '../logger.js';

import {
  runBackup,
  runConfig,
  runCollection,
  runRunnableCollection,
  runDocs,
  runExecPolicy,
  runHealth,
  runHooks,
  runInfer,
  runLogs,
  runMcp,
  runMessage,
  runStatusLike,
  runHostPresence,
  runServiceCommand,
  runNodeHost,
  runNodesCommand,
  runDirectory,
  runPairing,
  runSystem,
  runUninstall,
} from './ZavorthCliLiveNamespaceRoutes.js';
import { firstUsageActionPosition } from './ZavorthCliHostNamespace.js';
import {
  createPairingDraft,
  postJson,
  redactPairingRecord,
  redactUrl,
  renderTerminalQr,
} from './ZavorthCliCommunicationNamespace.js';
export { normalizeRequirements, enforceRequirements } from './ZavorthCliBackupConfigNamespace.js';
export { redactCommand } from './ZavorthCliMcpNamespace.js';
export { idFromSpec, resolveNpmCommand } from './ZavorthCliCommunicationNamespace.js';

type JsonObject = Record<string, unknown>;

const LIVE_COMMANDS = new Set([
  'actions', 'atlas', 'autonomy', 'background', 'backup', 'board', 'commitments', 'config', 'cron', 'daily', 'daemon', 'devices', 'directory', 'dns',
  'docs', 'exec-policy', 'gateway', 'goals', 'health', 'hooks', 'host', 'infer', 'logs', 'mcp', 'message', 'node',
  'nodes', 'pairing', 'plugins', 'proxy', 'qr', 'reset', 'secrets', 'sessions', 'skills',
  'mnemos', 'sandbox', 'satellite', 'connect', 'learn', 'tools', 'state', 'swarm', 'system', 'taskboard', 'tasks', 'uninstall', 'webhooks', 'certify', 'xai',
]);

export function isZavorthLiveNamespaceCommand(command: string): boolean {
  return LIVE_COMMANDS.has(String(command || '').trim().toLowerCase());
}

export async function runZavorthLiveNamespaceCommand(input: {
  projectRoot: string;
  command: string;
  args: string[];
}): Promise<{ exitCode: number; output: string }> {
  const command = input.command.toLowerCase();
  const args = input.args;
  if (args.includes('--help') || args.includes('-h')) {
    return text(formatZavorthCertificationHelp(command) || '');
  }

  switch (command) {
    case 'actions': return runActions(input.projectRoot, args);
    case 'atlas': return runCapabilityAtlas(input.projectRoot, args);
    case 'autonomy': return runDailyProduct(input.projectRoot, args);
    case 'background': return runBackground(input.projectRoot, args);
    case 'backup': return runBackup(input.projectRoot, args);
    case 'board': return runTaskBoard(input.projectRoot, args);
    case 'certify': return runCertify(input.projectRoot, args);
    case 'commitments': return runCollection(input.projectRoot, 'commitments', args, 'commitment');
    case 'config': return runConfig(input.projectRoot, args);
    case 'cron': return runCronNamespace(input.projectRoot, args);
    case 'daily': return runDailyProduct(input.projectRoot, args);
    case 'daemon': return runServiceCommand(input.projectRoot, 'daemon', args);
    case 'devices': return runCollection(input.projectRoot, 'devices', args, 'device');
    case 'directory': return runDirectory(input.projectRoot, args);
    case 'dns': return runStatusLike(input.projectRoot, command, args, ['status', 'doctor']);
    case 'docs': return runDocs(input.projectRoot, args);
    case 'exec-policy': return runExecPolicy(input.projectRoot, args);
    case 'health': return runHealth(input.projectRoot, args);
    case 'goals': return runGoals(input.projectRoot, args);
    case 'hooks': return runHooks(input.projectRoot, args);
    case 'host': return runHostPresence(input.projectRoot, args);
    case 'infer': return runInfer(input.projectRoot, args);
    case 'logs': return runLogs(input.projectRoot, args);
    case 'mcp': return runMcp(input.projectRoot, args);
    case 'message': return runMessage(input.projectRoot, args);
    case 'mnemos': return runMnemos(input.projectRoot, args);
    case 'connect': return runDailySurface(input.projectRoot, args, 'connect');
    case 'learn': return runDailySurface(input.projectRoot, args, 'learn');
    case 'tools': return runDailySurface(input.projectRoot, args, 'tools');
    case 'gateway': return runServiceCommand(input.projectRoot, 'gateway', args);
    case 'node': return runNodeHost(input.projectRoot, args);
    case 'nodes': return runNodesCommand(input.projectRoot, args);
    case 'pairing': return runPairing(input.projectRoot, args);
    case 'plugin': return runPluginsNamespace(input.projectRoot, args);
    case 'plugins': return runPluginsNamespace(input.projectRoot, args);
    case 'proxy': return runStatusLike(input.projectRoot, command, args, ['status', 'start', 'captures']);
    case 'qr': return runQr(input.projectRoot, args);
    case 'reset': return runReset(input.projectRoot, args);
    case 'sandbox': return runSandbox(input.projectRoot, args);
    case 'satellite': return runSatellite(input.projectRoot, args);
    case 'state': return runState(input.projectRoot, args);
    case 'secrets': return runSecrets(input.projectRoot, args);
    case 'sessions': return runCollection(input.projectRoot, 'sessions', args, 'session');
    case 'skills': return runSkillsNamespace(input.projectRoot, args);
    case 'system': return runSystem(input.projectRoot, args);
    case 'swarm': return runSwarm(input.projectRoot, args);
    case 'taskboard': return runTaskBoard(input.projectRoot, args);
    case 'tasks': return runRunnableCollection(input.projectRoot, 'tasks', args, 'task');
    case 'uninstall': return runUninstall(input.projectRoot, args);
    case 'webhooks': return runWebhooks(input.projectRoot, args);
    case 'xai': return runXai(input.projectRoot, args);
    default: return text(formatZavorthCertificationHelp(command) || '');
  }
}

async function runActions(root: string, args: string[]) {
  const gateway = new ZavorthActionGateway({ root });
  const subcommand = firstArg(args, 'lookup');
  if (['lifecycle', 'promote', 'archive'].includes(subcommand)) {
    const service = new ZavorthCapabilityLifecycleService({
      projectRoot: root,
      env: process.env,
    });
    const input = {
      actionIds: readFlags(args, 'action').concat(readFlags(args, 'action-id')),
      apply: args.includes('--apply'),
      actor: readFlag(args, 'actor') || 'operator',
      approvalId: readFlag(args, 'approval-id') || null,
    };
    const snapshot = input.apply ? service.apply(input) : service.snapshot(input);
    return render(args, 'Zavorth capability lifecycle', service.renderText(snapshot).split('\n'), snapshot as unknown as JsonObject);
  }
  if (['usage', 'signals', 'adoption', 'performance'].includes(subcommand)) {
    const service = new ZavorthCapabilityUsageSignalsService({
      projectRoot: root,
      env: process.env,
    });
    const snapshot = args.includes('--record')
      ? service.record({
        actionId: readFlag(args, 'action') || readFlag(args, 'action-id') || firstUsageActionPosition(args),
        capabilityId: readFlag(args, 'capability') || undefined,
        title: readFlag(args, 'title') || undefined,
        kind: (readFlag(args, 'event') || readFlag(args, 'kind') || 'shown') as ZavorthCapabilityUsageEventKind,
        surface: (readFlag(args, 'surface') || 'cli') as ZavorthCapabilityUsageSurface,
        actor: readFlag(args, 'actor') || 'operator',
        status: (readFlag(args, 'status') || 'ok') as 'ok' | 'attention' | 'blocked',
        durationMs: readNumberFlag(args, 'duration-ms'),
        receiptId: readFlag(args, 'receipt') || undefined,
        metadata: readFlag(args, 'title') ? { title: readFlag(args, 'title') } : {},
      })
      : service.snapshot();
    return render(args, 'Zavorth capability usage', service.renderText(snapshot).split('\n'), snapshot as unknown as JsonObject);
  }
  if (subcommand === 'list') {
    const actions = gateway.listActions().map((action) => ({
      id: action.id,
      title: action.title,
      risk: action.risk,
      requiresPreview: action.requiresPreview,
      requiresApproval: action.requiresApproval,
      domains: action.domains,
    }));
    return render(args, 'Zavorth actions', actions.map((action) => `${action.id} | ${action.risk} | ${action.title}`), { actions });
  }

  if (subcommand === 'receipts') {
    const result = await gateway.run({
      operation: 'action.receipts',
      actionId: readFlag(args, 'id') || args[1] || null,
      sourceSurface: 'cli:actions',
      actorId: 'operator',
    });
    return render(args, 'Zavorth action receipts', result.lines, result);
  }

  const operation = resolveCliActionOperation(subcommand);
  const actionId = readFlag(args, 'id') || readFlag(args, 'action') || (operation === 'action.schema.lookup' ? '' : args[1] || '');
  const query = readFlag(args, 'query') || (operation === 'action.schema.lookup' ? args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') : '');
  const argsJson = readFlag(args, 'args-json') || readFlag(args, 'args') || '{}';
  const actionArgs = parseCliActionArgs(argsJson);
  const result = await gateway.run({
    operation,
    actionId: actionId || null,
    query: query || null,
    domain: readFlag(args, 'domain') || null,
    args: actionArgs,
    approvalId: readFlag(args, 'approval-id') || null,
    trustedOperatorConfirmation: args.includes('--apply') || args.includes('--yes'),
    sourceSurface: 'cli:actions',
    actorId: 'operator',
  });
  return render(args, 'Zavorth actions', result.lines, result);
}

async function runCapabilityAtlas(root: string, args: string[]) {
  const service = new ZavorthCapabilityAtlasService({ projectRoot: root });
  const snapshot = service.buildSnapshot({
    query: readFlag(args, 'query') || args.filter((arg) => !arg.startsWith('--')).join(' '),
    category: (readFlag(args, 'category') as ZavorthCapabilityAtlasCategory | null) || null,
    limit: Number(readFlag(args, 'limit') || 200),
  });
  return render(args, 'Zavorth Capability Atlas', service.renderText(snapshot).split('\n'), snapshot as unknown as JsonObject);
}

async function runDailyProduct(_root: string, args: string[]) {
  const service = new ZavorthDailyProductQuietAutonomyService();
  const snapshot = service.buildSnapshot({
    profileId: readFlag(args, 'profile') || process.env.ZAVORTH_PROFILE || process.env.ZAVORTH_EXPERIENCE_PROFILE || null,
  });
  return render(args, 'Zavorth daily product', service.renderText(snapshot).split('\n'), snapshot as unknown as JsonObject);
}

async function runDailySurface(root: string, args: string[], kind: 'connect' | 'learn' | 'tools') {
  if (kind === 'connect') {
    const readiness = new ZavorthOperationalReadinessService();
    const snapshot = readiness.buildSnapshot(root);
    const lines = [
      'Channel surface status (honest readiness).',
      `Operational readiness: ${String((snapshot as { status?: string }).status || 'attention')}`,
      'Live send stays blocked until credentials and proof pass.',
      'Use: zavorth message doctor',
      'Use: zavorth pairing create',
      'Use: zavorth open',
    ];
    return render(args, 'Zavorth connect', lines, {
      ok: true,
      kind,
      sideEffects: 'read-only',
      readiness: snapshot as unknown as JsonObject,
      nextCommands: ['zavorth message doctor', 'zavorth pairing create', 'zavorth open'],
    });
  }

  if (kind === 'learn') {
    const mnemos = await runMnemos(root, ['recall', '--query', 'recent preferences', ...args.filter((arg) => arg.startsWith('--'))]);
    const mnemosLines = String(mnemos.output || '')
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .slice(0, 24);
    return render(args, 'Zavorth learn', [
      'Learned memory review surface.',
      'Sensitive promotions stay approval-bound.',
      ...mnemosLines,
    ], {
      ok: mnemos.exitCode === 0,
      kind,
      sideEffects: 'read-only',
      mnemosExitCode: mnemos.exitCode,
      nextCommands: ['zavorth mnemos recall --query "recent preferences"', 'zavorth daily', 'zavorth open'],
    });
  }

  const skills = await runSkillsNamespace(root, ['list', ...args.filter((arg) => arg.startsWith('--'))]);
  const mcp = await runMcp(root, ['status', ...args.filter((arg) => arg.startsWith('--'))]);
  const skillLines = String(skills.output || '').split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(0, 16);
  const mcpLines = String(mcp.output || '').split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(0, 16);
  return render(args, 'Zavorth tools', [
    'Tools and skills catalog (live list + MCP status).',
    'Executable entries remain inactive until preview, smoke and approval when required.',
    '',
    '[skills]',
    ...skillLines,
    '',
    '[mcp]',
    ...mcpLines,
  ], {
    ok: skills.exitCode === 0 || mcp.exitCode === 0,
    kind,
    sideEffects: 'read-only',
    nextCommands: ['zavorth skills list', 'zavorth mcp status', 'zavorth open'],
  });
}

export async function runBackground(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  const service = new ZavorthBackgroundTaskService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  });
  if (['status', 'list', 'ls'].includes(action)) {
    const snapshot = service.snapshot();
    return render(args, 'Zavorth background tasks', [
      `total: ${snapshot.summary.total}`,
      `queued: ${snapshot.summary.queued}`,
      `running: ${snapshot.summary.running}`,
      `waiting approval: ${snapshot.summary.waitingApproval}`,
      ...snapshot.items.slice(-12).map((item) => `- ${item.id} | ${item.status} | ${item.title}`),
    ], snapshot as unknown as JsonObject);
  }
  const prompt = readFlag(args, 'prompt')
    || readFlag(args, 'objective')
    || (['create', 'run', 'start', 'add'].includes(action)
      ? args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ')
      : args.filter((arg) => !arg.startsWith('--')).join(' '));
  if (!prompt) {
    return render(args, 'Zavorth background tasks', [
      'Use: zavorth background "<objective>"',
      'Status: zavorth background status',
    ], { ok: false });
  }
  const task = service.createBackgroundTask({
    prompt,
    title: readFlag(args, 'title') || null,
    sessionId: readFlag(args, 'session-id') || null,
    profileId: readFlag(args, 'profile') || readFlag(args, 'profile-id') || null,
    sourceSurface: 'cli:background',
  });
  return render(args, 'Zavorth background tasks', [
    `created: ${task.id}`,
    `status: ${task.status}`,
    `title: ${task.title}`,
    'worker: separated task-plane item; no command was executed immediately',
  ], { task });
}

async function runGoals(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  const service = goalPlaneServiceForCli(root, args);
  if (['status', 'list', 'ls'].includes(action)) {
    const snapshot = service.snapshot();
    return render(args, 'Zavorth Goal Plane', [
      `active: ${snapshot.summary.active}`,
      `paused: ${snapshot.summary.paused}`,
      `done: ${snapshot.summary.done}`,
      ...snapshot.goals.slice(-12).map((goal) => `- ${goal.id} | ${goal.status} | ${goal.objective}`),
    ], snapshot as unknown as JsonObject);
  }
  if (['pause', 'resume', 'done', 'cancel', 'cancelled'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || '';
    const next = action === 'resume' ? 'active' : action === 'done' ? 'done' : action === 'pause' ? 'paused' : 'cancelled';
    const goal = service.transition(id, next, 'operator', readFlag(args, 'reason') || undefined);
    return render(args, 'Zavorth Goal Plane', goal
      ? [`${goal.id}: ${goal.status}`]
      : [`No goal found for id: ${id || '<missing>'}`], { goal });
  }
  if (action === 'tick' || action === 'turn') {
    const id = args[1] || readFlag(args, 'id') || '';
    const goal = service.recordTurn(id, 'operator', readFlag(args, 'detail') || undefined);
    return render(args, 'Zavorth Goal Plane', goal
      ? [`${goal.id}: turn ${goal.turnsUsed}/${goal.maxTurns}`, `status: ${goal.status}`]
      : [`No active goal found for id: ${id || '<missing>'}`], { goal });
  }
  if (['loop', 'judge', 'step', 'continue'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || readFlag(args, 'goal-id') || '';
    const loop = goalLoopServiceForCli(root, args);
    const snapshot = await loop.evaluate({
      goalId: id,
      turnSummary: readFlag(args, 'summary') || readFlag(args, 'detail') || readFlag(args, 'result') || null,
      lastAssistantText: readFlag(args, 'last') || readFlag(args, 'last-assistant') || null,
      userIntervened: args.includes('--user-intervened'),
      force: args.includes('--force'),
      actor: 'operator',
      sourceSurface: 'cli:goals',
    });
    return render(args, 'Zavorth Goal Loop', [
      `goal: ${snapshot.goal?.id || id || '<missing>'}`,
      `verdict: ${snapshot.verdict.status}`,
      `judge: ${snapshot.verdict.judge}`,
      `reason: ${snapshot.verdict.reason}`,
      snapshot.continuationTask ? `queued: ${snapshot.continuationTask.id}` : 'queued: none',
      snapshot.receipt ? `receipt: ${snapshot.receipt.id}` : 'receipt: none',
      'execution: not started automatically',
    ], snapshot as unknown as JsonObject);
  }
  if (['worker', 'work', 'run-worker', 'drain'].includes(action)) {
    const worker = goalLoopWorkerServiceForCli(root, args);
    const taskArg = args[1] && !args[1].startsWith('--') ? args[1] : null;
    const snapshot = await worker.drain({
      taskId: readFlag(args, 'task-id') || readFlag(args, 'id') || taskArg,
      workerId: readFlag(args, 'worker-id') || 'cli-goal-loop-worker',
      leaseMs: readNumberFlag(args, 'lease-ms') || null,
      maxItems: readNumberFlag(args, 'max-items') || (action === 'drain' ? 5 : 1),
      dryRun: args.includes('--dry-run') || args.includes('--preview'),
    });
    return render(args, 'Zavorth Goal Loop Worker', [
      `worker: ${snapshot.workerId}`,
      `processed: ${snapshot.processed}/${snapshot.maxItems}`,
      ...snapshot.runs.slice(0, 8).map((run) => [
        `- task: ${run.task?.id || 'none'}`,
        `status: ${run.task?.status || 'idle'}`,
        `agent: ${run.agentRun?.status || 'not-run'}`,
        `verdict: ${run.loop?.verdict.status || 'not-judged'}`,
        run.loop?.continuationTask ? `next: ${run.loop.continuationTask.id}` : 'next: none',
      ].join(' | ')),
    ], snapshot as unknown as JsonObject);
  }
  if (['daemon', 'scheduler', 'background-loop'].includes(action)) {
    const daemon = goalLoopDaemonServiceForCli(root, args);
    const subcommand = args[1] && !args[1].startsWith('--') ? args[1] : 'status';
    const input = {
      daemonId: readFlag(args, 'daemon-id') || 'cli-goal-loop-daemon',
      intervalMs: readNumberFlag(args, 'interval-ms') || null,
      leaseMs: readNumberFlag(args, 'lease-ms') || null,
      staleAfterMs: readNumberFlag(args, 'stale-after-ms') || null,
      maxItems: readNumberFlag(args, 'max-items') || null,
      maxTicks: readNumberFlag(args, 'max-ticks') || null,
      stopWhenIdle: args.includes('--stop-when-idle'),
      dryRun: args.includes('--dry-run') || args.includes('--preview'),
    };
    const snapshot = subcommand === 'tick'
      ? await daemon.tick(input)
      : subcommand === 'run'
        ? await daemon.run({ ...input, maxTicks: input.maxTicks || 3 })
        : subcommand === 'start'
          ? daemon.start(input)
          : subcommand === 'stop'
            ? daemon.stop(input)
            : daemon.snapshot(input);
    return render(args, 'Zavorth Goal Loop Daemon', [
      `daemon: ${snapshot.daemonId}`,
      `status: ${snapshot.status}`,
      `pending: ${snapshot.pendingContinuations}`,
      `running: ${snapshot.runningContinuations}`,
      `heartbeat: ${snapshot.lastHeartbeatAt || 'none'}`,
      `last run: ${snapshot.lastRunAt || 'none'}`,
      `backoff: ${snapshot.backoffMs}ms`,
      `stale recovered: ${snapshot.staleRecovered}`,
      snapshot.receipt ? `receipt: ${snapshot.receipt.id}` : 'receipt: none',
    ], snapshot as unknown as JsonObject);
  }
  const objective = readFlag(args, 'objective')
    || (action === 'create' || action === 'start'
      ? args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ')
      : args.filter((arg) => !arg.startsWith('--')).join(' '));
  if (!objective) {
    return render(args, 'Zavorth Goal Plane', [
      'Use: zavorth go "<objective>"',
      'Status: zavorth goals status',
    ], { ok: false });
  }
  const goal = service.createGoal({
    objective,
    sessionId: readFlag(args, 'session-id') || null,
    profileId: readFlag(args, 'profile') || readFlag(args, 'profile-id') || null,
    maxTurns: readNumberFlag(args, 'max-turns') || 12,
    actor: 'operator',
  });
  return render(args, 'Zavorth Goal Plane', [
    `created: ${goal.id}`,
    `status: ${goal.status}`,
    `task-plane: ${goal.taskPlaneItemId || 'not linked'}`,
    `turns: ${goal.turnsUsed}/${goal.maxTurns}`,
  ], { goal });
}

export async function runTaskBoard(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  const service = taskBoardServiceForCli(root, args);
  if (['status', 'list', 'ls'].includes(action)) {
    const snapshot = service.snapshot();
    return render(args, 'Zavorth TaskBoard', [
      `boards: ${snapshot.summary.boards}`,
      `tasks: ${snapshot.summary.tasks}`,
      `ready: ${snapshot.summary.ready}`,
      `running: ${snapshot.summary.running}`,
      `review: ${snapshot.summary.review}`,
      `blocked: ${snapshot.summary.blocked}`,
    ], snapshot as unknown as JsonObject);
  }
  if (action === 'create-board' || action === 'new') {
    const board = service.createBoard(readFlag(args, 'title') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || 'Daily work');
    return render(args, 'Zavorth TaskBoard', [`created board: ${board.id}`, `title: ${board.title}`], { board });
  }
  if (action === 'note') {
    const note = readFlag(args, 'text') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
    const board = service.addBlackboardNote({
      boardId: readFlag(args, 'board-id') || null,
      text: note,
      actor: 'operator',
    });
    return render(args, 'Zavorth TaskBoard', [`blackboard updated: ${board.id}`, `notes: ${board.blackboard.length}`], { board });
  }
  if (action === 'decompose' || action === 'split') {
    const objective = readFlag(args, 'objective') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
    if (!objective) return render(args, 'Zavorth TaskBoard', ['Missing objective for decompose.'], { ok: false });
    const parts = splitList(readFlag(args, 'parts') || '').filter(Boolean);
    const tasks = service.decompose({
      boardId: readFlag(args, 'board-id') || null,
      objective,
      parts: parts.length ? parts : null,
      includeReview: !args.includes('--no-review'),
      actor: 'operator',
    });
    return render(args, 'Zavorth TaskBoard', [
      `created tasks: ${tasks.length}`,
      ...tasks.map((task) => `- ${task.id} | ${String(task.payload.role || 'worker')} | ${task.title}`),
    ], { tasks });
  }
  const title = readFlag(args, 'title')
    || (['triage', 'add', 'card'].includes(action)
      ? args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ')
      : args.filter((arg) => !arg.startsWith('--')).join(' '));
  if (!title) {
    return render(args, 'Zavorth TaskBoard', [
      'Use: zavorth taskboard triage "<task>"',
      'Or: zavorth taskboard decompose "<objective>"',
    ], { ok: false });
  }
  const task = service.triage({
    boardId: readFlag(args, 'board-id') || null,
    title,
    body: readFlag(args, 'body') || null,
    actor: 'operator',
  });
  return render(args, 'Zavorth TaskBoard', [
    `created card: ${task.id}`,
    `lane: ${String(task.payload.lane || 'backlog')}`,
    `status: ${task.status}`,
  ], { task });
}

async function runXai(root: string, args: string[]) {
  const action = firstArg(args, 'doctor');
  const service = new ZavorthXaiRuntimeService({ env: process.env });
  if (action === 'doctor' || action === 'status') {
    const snapshot = args.includes('--live') ? await service.liveDoctor() : service.doctor();
    return render(args, 'Zavorth xAI provider', [
      `configured: ${snapshot.configured ? 'yes' : 'no'}`,
      `model: ${snapshot.model}`,
      `auth: ${snapshot.authMode}`,
      `native search: ${snapshot.capabilities.nativeSearch ? 'yes' : 'no'}`,
      args.includes('--live') ? `live ready: ${snapshot.liveReady ? 'yes' : 'no'}` : 'live check: skipped',
      snapshot.error ? `error: ${snapshot.error}` : '',
    ].filter(Boolean), snapshot as unknown as JsonObject);
  }
  if (action === 'search') {
    const query = readFlag(args, 'query') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
    const snapshot = await service.search({ query, live: args.includes('--live') });
    return render(args, 'Zavorth xAI native search', snapshot.lines, snapshot as unknown as JsonObject);
  }
  return render(args, 'Zavorth xAI provider', [
    'Supported: doctor, search',
  ], { ok: true });
}

async function runState(root: string, args: string[]) {
  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  const stateDb = stateDbForHome(home);
  const snapshot = stateDb.snapshot();
  stateDb.close();
  return render(args, 'Zavorth Operational StateDB', [
    `db: ${snapshot.dbPath}`,
    `journal: ${snapshot.journalMode}`,
    `fts: ${snapshot.ftsAvailable ? 'enabled' : 'fallback'}`,
    `sessions: ${snapshot.counts.sessions}`,
    `messages: ${snapshot.counts.messages}`,
    `tasks: ${snapshot.counts.tasks}`,
    `goals: ${snapshot.counts.goals}`,
    `boards: ${snapshot.counts.boards}`,
    `events: ${snapshot.counts.events}`,
  ], snapshot as unknown as JsonObject);
}

export function taskPlaneServiceForCli(root: string, args: string[]): TaskPlaneService {
  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  return new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
    stateDbPath: home.resolvedPaths.dbPath,
  });
}

export function autonomySchedulePlaneForCli(root: string, args: string[]): AutonomySchedulePlane {
  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  // Same canonical plane as action catalog, cron tool, and goal-loop daemon.
  return bindAutonomySchedulePlane({
    runtimeDir: home.resolvedPaths.runtimeDir,
    taskPlane: taskPlaneServiceForCli(root, args),
  });
}

function goalPlaneServiceForCli(root: string, args: string[]): GoalPlaneService {
  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  return new GoalPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'goal-plane.json'),
    taskPlane: taskPlaneServiceForCli(root, args),
    stateDbPath: home.resolvedPaths.dbPath,
  });
}

function goalLoopServiceForCli(root: string, args: string[]): GoalLoopService {
  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  const taskPlane = new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const goalPlane = new GoalPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'goal-plane.json'),
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  return new GoalLoopService({
    goalPlane,
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
}

function goalLoopWorkerServiceForCli(root: string, args: string[]): GoalLoopWorkerService {
  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  const taskPlane = new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const goalPlane = new GoalPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'goal-plane.json'),
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const loop = new GoalLoopService({
    goalPlane,
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const agentRunner = new AgentRunService({
    llmRuntime: args.includes('--live-llm')
      ? new LlmRuntimeService(readFlag(args, 'provider') || undefined)
      : null,
    defaultProviderLabel: args.includes('--live-llm') ? 'Zavorth configured LLM' : 'Zavorth Goal Loop Worker',
    defaultModelLabel: args.includes('--live-llm') ? 'configured-runtime' : 'policy-fallback',
  });
  return new GoalLoopWorkerService({
    goalPlane,
    taskPlane,
    loop,
    agentRunner,
    stateDbPath: home.resolvedPaths.dbPath,
  });
}

export function goalLoopDaemonServiceForCli(root: string, args: string[]): GoalLoopDaemonService {
  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  const taskPlane = new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const schedulePlane = bindAutonomySchedulePlane({
    runtimeDir: home.resolvedPaths.runtimeDir,
    taskPlane,
  });
  const goalPlane = new GoalPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'goal-plane.json'),
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const loop = new GoalLoopService({
    goalPlane,
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const agentRunner = new AgentRunService({
    llmRuntime: args.includes('--live-llm')
      ? new LlmRuntimeService(readFlag(args, 'provider') || undefined)
      : null,
    defaultProviderLabel: args.includes('--live-llm') ? 'Zavorth configured LLM' : 'Zavorth Goal Loop Daemon',
    defaultModelLabel: args.includes('--live-llm') ? 'configured-runtime' : 'policy-fallback',
  });
  const worker = new GoalLoopWorkerService({
    goalPlane,
    taskPlane,
    loop,
    agentRunner,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  return new GoalLoopDaemonService({
    taskPlane,
    worker,
    schedulePlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
}

async function runCronNamespace(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const planeActions = new Set([
    'create-routine',
    'routines',
    'enable-routine',
    'disable-routine',
    'run-now',
    'process-due',
    'kill-switch',
    'clear-kill-switch',
    'freeze-scope',
    'unfreeze-scope',
    'plane',
    'schedule-plane',
  ]);
  const bridgeActions = new Set(['list', 'status', 'add', 'create', 'schedule', 'create-routine']);
  const forceLegacy = args.includes('--legacy-cron') || args.includes('--legacy');
  const forcePlane = args.includes('--schedule-plane') || planeActions.has(action);
  const plane = autonomySchedulePlaneForCli(root, args);
  const legacyFile = path.join(stateDir(root), 'cron-jobs.json');
  const planePresent = existsSync(plane.getStorageDir());
  const legacyPresent = existsSync(legacyFile);
  const preferPlane = !forceLegacy && (
    forcePlane
    || (planePresent && legacyPresent)
    || (planePresent && !legacyPresent)
  );

  if (!preferPlane && !forcePlane) {
    return runRunnableCollection(root, 'cron-jobs', args, 'job');
  }

  if (preferPlane && bridgeActions.has(action) && !planeActions.has(action)) {
    if (action === 'list' || action === 'status') {
      const snapshot = plane.snapshot();
      return render(args, 'Zavorth Autonomy Schedule Plane', [
        `source: autonomy-schedule-plane (preferred over legacy .zavorth/cron-jobs.json)`,
        `routines: ${snapshot.summary.total}`,
        `enabled: ${snapshot.summary.enabled}`,
        `due: ${snapshot.summary.due}`,
        `kill-switch: ${snapshot.killSwitchActive ? 'ACTIVE' : 'off'}`,
        `task-plane-backed: ${snapshot.safety.taskPlaneBacked}`,
        `legacy-cron-jobs-present: ${legacyPresent}`,
        ...snapshot.routines.slice(0, 20).map((routine) => (
          `- ${routine.id} | ${routine.enabled ? 'enabled' : 'disabled'} | next ${routine.nextRunAt || 'none'} | ${routine.taskDescription.slice(0, 80)}`
        )),
      ], {
        ...(snapshot as unknown as JsonObject),
        preferredSource: 'autonomy-schedule-plane',
        legacyPresent,
      });
    }
    if (action === 'add' || action === 'create' || action === 'schedule') {
      const result = plane.createRoutine({
        name: readFlag(args, 'name') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || undefined,
        schedule: readFlag(args, 'schedule') || readFlag(args, 'cron') || readFlag(args, 'every-ms') || '60000',
        scheduleType: readFlag(args, 'schedule-type') as 'cron' | 'interval' | 'once' | 'natural_language' | undefined,
        intervalMs: readNumberFlag(args, 'every-ms') || readNumberFlag(args, 'interval-ms') || undefined,
        taskDescription: readFlag(args, 'task') || readFlag(args, 'command') || readFlag(args, 'cmd') || readFlag(args, 'description') || 'Scheduled autonomy routine',
        channel: readFlag(args, 'channel') || undefined,
        riskLevel: readFlag(args, 'risk') as 'low' | 'medium' | 'high' | 'critical' | undefined,
        scopeTags: splitList(readFlag(args, 'scope') || ''),
        actor: 'cli:cron',
        enabled: !args.includes('--disabled'),
      });
      return render(args, 'Zavorth Autonomy Schedule Plane', [
        'source: autonomy-schedule-plane (list/create bridged from default cron path)',
        result.summary,
        result.routine ? `id: ${result.routine.id}` : 'id: none',
        result.routine ? `next: ${result.routine.nextRunAt || 'none'}` : 'next: none',
        result.receipt ? `receipt: ${result.receipt.receiptId}` : 'receipt: none',
      ], result as unknown as JsonObject);
    }
  }

  if (action === 'plane' || action === 'schedule-plane' || action === 'routines') {
    const snapshot = plane.snapshot();
    return render(args, 'Zavorth Autonomy Schedule Plane', [
      `routines: ${snapshot.summary.total}`,
      `enabled: ${snapshot.summary.enabled}`,
      `due: ${snapshot.summary.due}`,
      `kill-switch: ${snapshot.killSwitchActive ? 'ACTIVE' : 'off'}`,
      `task-plane-backed: ${snapshot.safety.taskPlaneBacked}`,
      ...snapshot.routines.slice(0, 20).map((routine) => (
        `- ${routine.id} | ${routine.enabled ? 'enabled' : 'disabled'} | next ${routine.nextRunAt || 'none'} | ${routine.taskDescription.slice(0, 80)}`
      )),
    ], snapshot as unknown as JsonObject);
  }
  if (action === 'create-routine') {
    const result = plane.createRoutine({
      name: readFlag(args, 'name') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || undefined,
      schedule: readFlag(args, 'schedule') || readFlag(args, 'cron') || readFlag(args, 'every-ms') || '60000',
      scheduleType: readFlag(args, 'schedule-type') as 'cron' | 'interval' | 'once' | 'natural_language' | undefined,
      intervalMs: readNumberFlag(args, 'every-ms') || readNumberFlag(args, 'interval-ms') || undefined,
      taskDescription: readFlag(args, 'task') || readFlag(args, 'command') || readFlag(args, 'description') || 'Scheduled autonomy routine',
      channel: readFlag(args, 'channel') || undefined,
      riskLevel: readFlag(args, 'risk') as 'low' | 'medium' | 'high' | 'critical' | undefined,
      scopeTags: splitList(readFlag(args, 'scope') || ''),
      actor: 'cli:cron',
      enabled: !args.includes('--disabled'),
    });
    return render(args, 'Zavorth Autonomy Schedule Plane', [
      result.summary,
      result.routine ? `id: ${result.routine.id}` : 'id: none',
      result.routine ? `next: ${result.routine.nextRunAt || 'none'}` : 'next: none',
      result.receipt ? `receipt: ${result.receipt.receiptId}` : 'receipt: none',
    ], result as unknown as JsonObject);
  }
  if (action === 'enable-routine' || action === 'disable-routine') {
    const id = args[1] || readFlag(args, 'id') || '';
    const result = action === 'enable-routine'
      ? plane.enableRoutine({ routineId: id, actor: 'cli:cron' })
      : plane.disableRoutine({ routineId: id, actor: 'cli:cron' });
    return render(args, 'Zavorth Autonomy Schedule Plane', [
      result.summary,
      result.receipt ? `receipt: ${result.receipt.receiptId}` : 'receipt: none',
    ], result as unknown as JsonObject);
  }
  if (action === 'run-now') {
    const id = args[1] || readFlag(args, 'id') || '';
    const result = plane.runNow({ routineId: id, actor: 'cli:cron' });
    return render(args, 'Zavorth Autonomy Schedule Plane', [
      result.summary,
      result.task ? `task-plane: ${result.task.id}` : 'task-plane: none',
      result.routine ? `next: ${result.routine.nextRunAt || 'none'}` : 'next: none',
      result.receipt ? `receipt: ${result.receipt.receiptId}` : 'receipt: none',
    ], result as unknown as JsonObject);
  }
  if (action === 'process-due') {
    const result = plane.processDue({
      actor: 'cli:cron',
      maxItems: readNumberFlag(args, 'limit') || 25,
      dryRun: args.includes('--dry-run') || args.includes('--preview'),
    });
    return render(args, 'Zavorth Autonomy Schedule Plane', [
      result.summary,
      `processed: ${result.processed}`,
      ...result.materialized.slice(0, 20).map((entry) => `- ${entry.routineId} -> ${entry.taskId || 'preview'}`),
      result.receipt ? `receipt: ${result.receipt.receiptId}` : 'receipt: none',
    ], result as unknown as JsonObject);
  }
  if (action === 'kill-switch') {
    const result = plane.activateKillSwitch('cli:cron');
    return render(args, 'Zavorth Autonomy Schedule Plane', [result.summary], result as unknown as JsonObject);
  }
  if (action === 'clear-kill-switch') {
    const result = plane.clearKillSwitch('cli:cron');
    return render(args, 'Zavorth Autonomy Schedule Plane', [result.summary], result as unknown as JsonObject);
  }
  if (action === 'freeze-scope') {
    const result = plane.freezeScope(args[1] || readFlag(args, 'scope') || '', 'cli:cron');
    return render(args, 'Zavorth Autonomy Schedule Plane', [result.summary], result as unknown as JsonObject);
  }
  if (action === 'unfreeze-scope') {
    const result = plane.unfreezeScope(args[1] || readFlag(args, 'scope') || '', 'cli:cron');
    return render(args, 'Zavorth Autonomy Schedule Plane', [result.summary], result as unknown as JsonObject);
  }
  return runRunnableCollection(root, 'cron-jobs', args, 'job');
}

function taskBoardServiceForCli(root: string, args: string[]): TaskBoardPlaneService {
  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  return new TaskBoardPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-board.json'),
    taskPlane: taskPlaneServiceForCli(root, args),
    stateDbPath: home.resolvedPaths.dbPath,
  });
}

function stateDbForHome(home: ReturnType<ZavorthHomePathService['resolveSnapshot']>): ZavorthOperationalStateDbService {
  return new ZavorthOperationalStateDbService({ dbPath: home.resolvedPaths.dbPath });
}

function resolveCliActionOperation(value: string): ZavorthActionOperation {
  switch (value) {
    case 'lookup':
    case 'search':
      return 'action.schema.lookup';
    case 'status':
      return 'action.status';
    case 'preview':
      return 'action.preview';
    case 'apply':
      return 'action.apply';
    case 'receipts':
      return 'action.receipts';
    default:
      return 'action.schema.lookup';
  }
}

function parseCliActionArgs(value: string): Record<string, unknown> {
  const textValue = String(value || '').trim();
  if (!textValue) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(textValue);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch (error: unknown) {logger.warn('[Zavorth Cli Live Namespaces] JSON parse failed', error);
    return { query: textValue };
  }
}

async function runMnemos(root: string, args: string[]) {
  const action = firstArg(args, 'recall');
  const gateway = new ZavorthActionGateway({ root });
  if (action === 'unify' || action === 'unified' || action === 'index-all') {
    const { ZavorthMnemosUnifiedMemoryService } = await import('../services/ZavorthMnemosUnifiedMemoryService.js');
    const service = new ZavorthMnemosUnifiedMemoryService({ projectRoot: root });
    const snapshot = service.buildSnapshot({ apply: args.includes('--apply') || args.includes('--yes') });
    return render(args, 'Zavorth Mnemos unified memory', [
      `Status: ${snapshot.status}`,
      `Documents: ${snapshot.documentsIndexed}`,
      `Apply: ${snapshot.applyPerformed ? 'yes' : 'no'}`,
      `Output: ${snapshot.outputPath}`,
      ...snapshot.sources.map((source) => `${source.id}: ${source.documents} (${source.status})`),
    ], snapshot as unknown as JsonObject);
  }
  if (['recall', 'search', 'query'].includes(action)) {
    const query = readFlag(args, 'query') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || 'recent workflow';
    const result = await gateway.run({
      operation: 'action.preview',
      actionId: 'memory.search',
      args: {
        query,
        limit: readNumberFlag(args, 'limit') || 8,
      },
      sourceSurface: 'cli:mnemos',
      actorId: 'operator',
    });
    return render(args, 'Zavorth Mnemos recall', result.lines, result);
  }
  if (['session-recall', 'session_recall', 'sessions', 'session-search'].includes(action)) {
    const query = readFlag(args, 'query')
      || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
    const result = await gateway.run({
      operation: 'action.preview',
      actionId: 'mnemos.session_recall',
      args: {
        query,
        sessionId: readFlag(args, 'session-id') || null,
        currentSessionId: readFlag(args, 'current-session-id') || null,
        aroundMessageId: readFlag(args, 'around-message-id') || null,
        limit: readNumberFlag(args, 'limit') || 8,
      },
      sourceSurface: 'cli:mnemos',
      actorId: 'operator',
    });
    return render(args, 'Zavorth Mnemos session recall', result.lines, result);
  }
  if (action === 'session-append') {
    const home = new ZavorthHomePathService({
      projectRoot: root,
      explicitHome: readFlag(args, 'home') || null,
      env: process.env,
    }).resolveSnapshot();
    const continuum = new SessionContinuumService({
      storePath: resolveSessionContinuumStorePath(home.resolvedPaths.runtimeDir),
      stateDbPath: home.resolvedPaths.dbPath,
    });
    const content = readFlag(args, 'text') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
    if (!content) return render(args, 'Zavorth Mnemos session recall', ['Missing --text for session-append.'], { ok: false });
    const session = continuum.appendMessage({
      sessionId: readFlag(args, 'session-id') || null,
      title: readFlag(args, 'title') || null,
      role: readFlag(args, 'role') || 'user',
      content,
    });
    return render(args, 'Zavorth Mnemos session recall', [
      `session: ${session.id}`,
      `messages: ${session.messages.length}`,
      `store: ${continuum.getStorePath()}`,
    ], { session, storePath: continuum.getStorePath() });
  }
  if (action === 'forget') {
    const memoryId = readFlag(args, 'id') || args[1] || '';
    const result = await gateway.run({
      operation: args.includes('--apply') || args.includes('--yes') ? 'action.apply' : 'action.preview',
      actionId: 'memory.forget',
      args: { memoryId, id: memoryId },
      trustedOperatorConfirmation: args.includes('--apply') || args.includes('--yes'),
      approvalId: readFlag(args, 'approval-id') || null,
      sourceSurface: 'cli:mnemos',
      actorId: 'operator',
    });
    return render(args, 'Zavorth Mnemos forget', result.lines, result);
  }
  if (action === 'correct' || action === 'promote') {
    const { ZavorthNativeLearningLoopService } = await import('../services/ZavorthNativeLearningLoopService.js');
    const observation = readFlag(args, 'observation')
      || readFlag(args, 'text')
      || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ')
      || `${action} memory proposal`;
    const snapshot = await new ZavorthNativeLearningLoopService().buildSnapshot({
      observation,
      query: observation,
      workspace: root,
      sourceSurface: `cli:mnemos:${action}`,
      limit: readNumberFlag(args, 'limit') || 5,
    });
    const lines = [
      `proposal mode: ${action}`,
      `candidates: ${snapshot.summary.candidates}`,
      `approval required: ${snapshot.summary.requiresApproval}`,
      ...snapshot.candidates.slice(0, 5).map((candidate) => `- ${candidate.kind}: ${candidate.title} | ${candidate.state}`),
    ];
    return render(args, `Zavorth Mnemos ${action}`, lines, snapshot);
  }
  return render(args, 'Zavorth Mnemos', [
    'Supported: recall, unify, forget, correct, promote',
  ], { ok: true });
}

async function runSatellite(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  if (action === 'approvals' || action === 'daily') {
    const { ZavorthSatelliteApprovalDailyService } = await import('../services/ZavorthSatelliteApprovalDailyService.js');
    const service = new ZavorthSatelliteApprovalDailyService({ projectRoot: root });
    const snapshot = service.buildSnapshot({ applyReceipt: args.includes('--apply-receipt') });
    return render(args, 'Zavorth Satellite approvals', [
      `Status: ${snapshot.status}`,
      `Route: ${snapshot.route}`,
      `Approval cards: ${snapshot.approvalCards}`,
      `Offline queue: ${snapshot.offlineQueueSupported ? 'ready' : 'needs configuration'}`,
      `Push plan: ${snapshot.pushPlanReady ? 'ready' : 'not ready'}`,
      `Execution authority: ${snapshot.executionAuthority ? 'yes' : 'no'}`,
    ], snapshot as unknown as JsonObject);
  }
  if (action === 'foundation' || action === 'device-foundation' || action === 'devices-foundation') {
    const { ZavorthPairedDeviceFoundationService } = await import('../services/ZavorthPairedDeviceFoundationService.js');
    const snapshot = new ZavorthPairedDeviceFoundationService().buildSnapshot();
    return render(args, 'Zavorth Satellite foundation', [
      `status: ${snapshot.status}`,
      `native mobile app required now: ${snapshot.summary.nativeMobileAppRequiredNow ? 'yes' : 'no'}`,
      `future native targets: ${snapshot.summary.futureNativeTargets.join(', ')}`,
      `canonical capabilities: ${snapshot.summary.canonicalCapabilities}`,
      `sensitive capabilities: ${snapshot.summary.sensitiveCapabilities}`,
      `pairing: ${snapshot.pairing.draftCommand}`,
      `heartbeat: ${snapshot.heartbeat.endpoint}`,
      `invocation: ${snapshot.invocation.queueMode}`,
    ], snapshot as unknown as JsonObject);
  }
  const { ZavorthAppsSatelliteNodesService } = await import('../services/ZavorthAppsSatelliteNodesService.js');
  const service = new ZavorthAppsSatelliteNodesService({ cwd: root });
  const satelliteAction = action === 'pair' || action === 'pairing'
    ? 'pairing.qr'
    : action === 'push-plan' || action === 'push'
      ? 'push.plan'
      : 'status';
  const snapshot = service.execute({
    action: satelliteAction as ZavorthAppsSatelliteAction,
    nodeKind: (readFlag(args, 'kind') || readFlag(args, 'node-kind') || 'mobile') as ZavorthAppsSatelliteNodeKind,
    label: readFlag(args, 'label') || null,
    actorId: readFlag(args, 'actor') || 'operator',
    workspace: root,
    materialize: args.includes('--apply') || args.includes('--materialize'),
    approvalId: readFlag(args, 'approval-id') || null,
    ttlSeconds: readNumberFlag(args, 'ttl-seconds') || undefined,
  });
  return render(args, 'Zavorth Satellite', service.formatSnapshotText(snapshot).split('\n'), snapshot);
}

async function runSwarm(root: string, args: string[]) {
  const action = firstArg(args, 'plan');
  const { SwarmScalePlaneService } = await import('../domain/execution/infrastructure/SwarmScalePlaneService.js');
  const stateFilePath = path.join(stateDir(root), 'swarm-scale-plane.json');
  const service = new SwarmScalePlaneService({ stateFilePath });
  if (action === 'cloud-pool' || action === 'cloud' || action === 'backends') {
    const { ZavorthCloudSandboxPoolService } = await import('../services/ZavorthCloudSandboxPoolService.js');
    const snapshot = new ZavorthCloudSandboxPoolService().buildSnapshot({
      preferredBackend: (readFlag(args, 'backend') || readFlag(args, 'execution-backend') || null) as ZavorthTerminalBackendId | null,
    });
    return render(args, 'Zavorth Swarm cloud pool', [
      `status: ${snapshot.status}`,
      `ready cloud backends: ${snapshot.summary.readyCloudBackends}/${snapshot.summary.totalPoolBackends}`,
      `preferred backend: ${snapshot.preferredBackend?.id || 'none'}`,
      `configure: ${snapshot.swarmIntegration.configureCommand}`,
      ...snapshot.backends.map((backend) =>
        `- ${backend.id}: ${backend.status} ${backend.liveReady ? 'ready' : 'not-ready'} ${backend.remoteTier}`),
    ], snapshot as unknown as JsonObject);
  }
  if (action === 'configure' || action === 'config' || action === 'reconfigure') {
    const runId = readFlag(args, 'run-id') || args[1] || '';
    if (!runId) return render(args, 'Zavorth Swarm configure', ['Missing --run-id for configure.'], { ok: false });
    const snapshot = service.configureRun({
      runId,
      sourceSurface: 'cli',
      actorId: readFlag(args, 'actor') || 'operator',
      reason: readFlag(args, 'reason') || null,
      persistState: !args.includes('--no-persist'),
      patch: {
        maxConcurrency: readNumberFlag(args, 'concurrency') || readNumberFlag(args, 'max-concurrency') || undefined,
        maxSteps: readNumberFlag(args, 'max-steps') || readNumberFlag(args, 'steps') || undefined,
        executionMode: (readFlag(args, 'execution-mode') || readFlag(args, 'mode') || undefined) as SwarmScaleExecutionMode,
        executionBackend: (readFlag(args, 'execution-backend') || readFlag(args, 'backend') || undefined) as SwarmScaleExecutionBackendId,
        cloudSandboxEnabled: readSwarmToggleFlag(args, 'cloud-sandbox') ?? readSwarmToggleFlag(args, 'cloud'),
        deviceNodeRouting: readSwarmToggleFlag(args, 'device-routing')
          ?? readSwarmToggleFlag(args, 'device-node-routing')
          ?? readSwarmToggleFlag(args, 'devices'),
        pauseReason: readFlag(args, 'pause-reason') || undefined,
      },
    });
    return render(args, 'Zavorth Swarm configure', renderSwarmLines(snapshot), snapshot);
  }
  if (action === 'resume') {
    const runId = readFlag(args, 'run-id') || args[1] || '';
    if (!runId) return render(args, 'Zavorth Swarm', ['Missing --run-id for resume.'], { ok: false });
    const snapshot = await service.resume({
      runId,
      stopAfterSteps: readNumberFlag(args, 'stop-after-steps') || undefined,
      persistState: !args.includes('--no-persist'),
    });
    return render(args, 'Zavorth Swarm resume', renderSwarmLines(snapshot), snapshot);
  }
  if (action === 'cancel') {
    const runId = readFlag(args, 'run-id') || args[1] || '';
    const cancelled = await cancelSwarmRun(stateFilePath, runId);
    return render(args, 'Zavorth Swarm cancel', [
      cancelled ? `Cancelled run: ${runId}` : `Run not found: ${runId || '<missing>'}`,
    ], { ok: cancelled, runId });
  }
  const objective = readFlag(args, 'objective')
    || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ')
    || 'Plan a governed large task.';
  const snapshot = await service.launch({
    objective,
    desiredAgents: readNumberFlag(args, 'agents') || readNumberFlag(args, 'desired-agents') || (action === 'plan' ? 5 : 12),
    maxAgents: readNumberFlag(args, 'max-agents') || 4000,
    maxSteps: readNumberFlag(args, 'max-steps') || 4000,
    maxConcurrency: readNumberFlag(args, 'concurrency') || 30,
    stopAfterSteps: action === 'plan' ? 1 : readNumberFlag(args, 'stop-after-steps') || undefined,
    persistState: action !== 'plan' && !args.includes('--no-persist'),
    approvalId: readFlag(args, 'approval-id') || null,
    allowMutatingTools: args.includes('--allow-mutating-tools'),
    executionBackend: (readFlag(args, 'execution-backend') || readFlag(args, 'backend') || undefined) as SwarmScaleExecutionBackendId,
    cloudSandboxEnabled: readSwarmToggleFlag(args, 'cloud-sandbox') ?? readSwarmToggleFlag(args, 'cloud'),
    deviceNodeRouting: readSwarmToggleFlag(args, 'device-routing')
      ?? readSwarmToggleFlag(args, 'device-node-routing')
      ?? readSwarmToggleFlag(args, 'devices'),
  });
  return render(args, `Zavorth Swarm ${action === 'run' ? 'run' : 'plan'}`, renderSwarmLines(snapshot), snapshot);
}

function renderSwarmLines(snapshot: {
  runId: string;
  status: string;
  planner: { plannedAgents: number; requestedAgents: number; mode: string };
  workerPool: { maxConcurrency: number; actualMaxConcurrency: number; mode: string };
  ledger: { usedSteps: number; maxSteps: number };
  reducer: { conflictCount: number; confidence: number; synthesis: string };
  dynamicConfig?: {
    revision: number;
    sourceSurface: string;
    executionBackend: string;
    cloudSandboxEnabled: boolean;
    deviceNodeRouting: boolean;
    maxConcurrency: number;
    maxSteps: number;
  };
}): string[] {
  return [
    `run: ${snapshot.runId}`,
    `status: ${snapshot.status}`,
    `agents: ${snapshot.planner.plannedAgents}/${snapshot.planner.requestedAgents} (${snapshot.planner.mode})`,
    `workers: ${snapshot.workerPool.mode} concurrency=${snapshot.workerPool.actualMaxConcurrency || snapshot.workerPool.maxConcurrency}`,
    `ledger: ${snapshot.ledger.usedSteps}/${snapshot.ledger.maxSteps}`,
    snapshot.dynamicConfig
      ? `config: rev=${snapshot.dynamicConfig.revision} source=${snapshot.dynamicConfig.sourceSurface} backend=${snapshot.dynamicConfig.executionBackend} cloud=${snapshot.dynamicConfig.cloudSandboxEnabled ? 'on' : 'off'} devices=${snapshot.dynamicConfig.deviceNodeRouting ? 'on' : 'off'}`
      : 'config: legacy',
    `conflicts: ${snapshot.reducer.conflictCount}`,
    `confidence: ${snapshot.reducer.confidence}`,
    snapshot.reducer.synthesis ? `synthesis: ${snapshot.reducer.synthesis.slice(0, 240)}` : 'synthesis: pending',
  ];
}

function readSwarmToggleFlag(args: string[], name: string): boolean | undefined {
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === exact) {
      const next = args[index + 1];
      if (!next || next.startsWith('--')) return true;
      return parseSwarmToggle(next);
    }
    if (arg.startsWith(prefix)) {
      return parseSwarmToggle(arg.slice(prefix.length));
    }
  }
  return undefined;
}

function parseSwarmToggle(value: string): boolean | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'enabled', 'enable'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled', 'disable'].includes(normalized)) return false;
  return undefined;
}

async function cancelSwarmRun(stateFilePath: string, runId: string): Promise<boolean> {
  const normalized = String(runId || '').trim();
  if (!normalized) return false;
  try {
    const parsed = JSON.parse(await fs.readFile(stateFilePath, 'utf8')) as { runs?: Array<Record<string, unknown>> };
    const runs = Array.isArray(parsed.runs) ? parsed.runs : [];
    const index = runs.findIndex((run) => String(run.runId || '') === normalized);
    if (index < 0) return false;
    const current = runs[index];
    runs[index] = {
      ...current,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(stateFilePath), { recursive: true });
    await fs.writeFile(stateFilePath, `${JSON.stringify({ runs }, null, 2)}\n`, 'utf8');
    return true;
  } catch (error: unknown) {logger.warn('[Zavorth Cli Live Namespaces] filesystem operation failed', error); return false; }
}

async function runWebhooks(root: string, args: string[]) {
  const file = path.join(stateDir(root), 'webhooks.json');
  const action = firstArg(args, 'list');
  const items = await readArray(file);
  if (action === 'add') {
    const id = args[1] || idWithTime('webhook');
    const url = readFlag(args, 'url') || args[2] || '';
    if (!url) return render(args, 'Zavorth webhooks', ['Usage: zavorth webhooks add <id> --url <url>'], { ok: false });
    const item = { id, url, status: 'configured', createdAt: new Date().toISOString() };
    items.push(item);
    await writeJson(file, items);
    return render(args, 'Zavorth webhooks', [`Added webhook: ${id}`], { item: { ...item, url: redactUrl(url) } });
  }
  if (action === 'test') {
    const id = args[1];
    const item = items.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!item) return render(args, 'Zavorth webhooks', [`No webhook found for id: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth webhooks', [`Test preview: ${redactUrl(String(item.url || ''))}`, 'Add --yes to POST a test event.'], { dryRun: true });
    const response = await postJson(String(item.url), { source: 'zavorth-cli', event: 'test', at: new Date().toISOString() });
    item.lastTest = response;
    item.updatedAt = new Date().toISOString();
    await writeJson(file, items);
    return render(args, 'Zavorth webhooks', [`Test ${response.ok ? 'passed' : 'failed'}: ${id}`], { response: { ...response, url: redactUrl(String(item.url)) } });
  }
  return render(args, 'Zavorth webhooks', items.length ? items.map((item) => `- ${String((item as JsonObject).id)} | ${redactUrl(String((item as JsonObject).url || ''))}`) : ['No webhooks configured yet.'], { webhooks: items.map((item) => ({ ...(item as JsonObject), url: redactUrl(String((item as JsonObject).url || '')) })) });
}

async function runQr(root: string, args: string[]) {
  const action = firstArg(args, 'pairing');
  if (action === 'status') {
    const pairings = await readArray(path.join(stateDir(root), 'pairings.json'));
    const active = pairings.filter((item) => String((item as JsonObject).status) === 'pending');
    return render(args, 'Zavorth qr', [
      `pending pairing QR payloads: ${active.length}`,
      'Run: zavorth qr pairing --channel telegram',
    ], { pending: active.length, pairings: active.map(redactPairingRecord) });
  }
  const channel = readFlag(args, 'channel') || 'device';
  const draft = await createPairingDraft(root, {
    channel,
    target: readFlag(args, 'target') || '',
    label: args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || `${channel} pairing`,
    ttlMinutes: readNumberFlag(args, 'ttl-minutes') || 15,
  });
  const qr = await renderTerminalQr(String(draft.uri));
  return render(args, 'Zavorth qr', [
    `Pairing id: ${draft.id}`,
    `Pairing code: ${draft.code}`,
    `Expires: ${draft.expiresAt}`,
    `URI: ${draft.uri}`,
    qr || 'QR rendering is unavailable; use the URI above.',
    'Share only with the operator/device you are pairing.',
  ], { record: redactPairingRecord(draft), qrRendered: Boolean(qr) });
}

async function runReset(root: string, args: string[]) {
  const targets = ['cli-config.json', 'mcp.json', 'messages.json', 'tasks.json'].map((file) => path.join(stateDir(root), file));
  if (!args.includes('--yes')) {
    return render(args, 'Zavorth reset', ['Preview only. Add --yes to remove local non-secret CLI state.', ...targets.map((file) => `- ${file}`)], { dryRun: true, targets });
  }
  for (const target of targets) {
    if (existsSync(target)) await fs.rm(target, { force: true });
  }
  return render(args, 'Zavorth reset', ['Removed local non-secret CLI state files.'], { removed: targets });
}

async function runSecrets(root: string, args: string[]) {
  const envFiles = ['.env', '.env.local', path.join('.zavorth', 'secrets.env')].map((file) => path.join(root, file));
  const found: string[] = [];
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const raw = await fs.readFile(file, 'utf8');
    for (const line of raw.split(/\r?\n/u)) {
      const match = line.match(/^([A-Z0-9_]+)\s*=/u);
      if (match) found.push(`${path.relative(root, file)}:${match[1]}=***`);
    }
  }
  return render(args, 'Zavorth secrets', found.length ? found : ['No local secret references found. Values are never printed.'], { secretRefs: found });
}
