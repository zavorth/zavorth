import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { formatZavorthCertificationHelp } from './ZavorthCliCertificationCommands.js';
import { ZavorthOperationalReadinessService } from '../services/ZavorthOperationalReadinessService.js';
import { ZavorthNativeCapabilityCertificationService } from '../services/ZavorthNativeCapabilityCertificationService.js';
import { ZavorthProductExcellenceService } from '../services/ZavorthProductExcellenceService.js';
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
import { ZavorthSessionRecallService } from '../services/ZavorthSessionRecallService.js';
import { ZavorthXaiRuntimeService } from '../services/ZavorthXaiRuntimeService.js';
import { ZavorthOperationalStateDbService } from '../services/ZavorthOperationalStateDbService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import { AgentRunService } from '../runtime/agent/AgentRunService.js';
import { TerminalPanel } from './presentation/TerminalPanel.js';

type JsonObject = Record<string, unknown>;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const LIVE_COMMANDS = new Set([
  'actions', 'atlas', 'autonomy', 'background', 'backup', 'board', 'commitments', 'config', 'cron', 'daily', 'daemon', 'devices', 'directory', 'dns',
  'docs', 'exec-policy', 'gateway', 'go', 'goals', 'health', 'hooks', 'infer', 'logs', 'mcp', 'message', 'node',
  'nodes', 'pairing', 'plugins', 'proxy', 'qr', 'reset', 'secrets', 'sessions', 'skills',
  'mnemos', 'sandbox', 'satellite', 'start', 'setup', 'connect', 'learn', 'tools', 'state', 'swarm', 'system', 'taskboard', 'tasks', 'uninstall', 'webhooks', 'certify', 'xai',
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
    case 'cron': return runRunnableCollection(input.projectRoot, 'cron-jobs', args, 'job');
    case 'daily': return runDailyProduct(input.projectRoot, args);
    case 'daemon': return runServiceCommand(input.projectRoot, 'daemon', args);
    case 'devices': return runCollection(input.projectRoot, 'devices', args, 'device');
    case 'directory': return runDirectory(input.projectRoot, args);
    case 'dns': return runStatusLike(input.projectRoot, command, args, ['status', 'doctor']);
    case 'docs': return runDocs(input.projectRoot, args);
    case 'exec-policy': return runExecPolicy(input.projectRoot, args);
    case 'health': return runHealth(input.projectRoot, args);
    case 'go': return runGoals(input.projectRoot, args);
    case 'goals': return runGoals(input.projectRoot, args);
    case 'hooks': return runHooks(input.projectRoot, args);
    case 'infer': return runInfer(input.projectRoot, args);
    case 'logs': return runLogs(input.projectRoot, args);
    case 'mcp': return runMcp(input.projectRoot, args);
    case 'message': return runMessage(input.projectRoot, args);
    case 'mnemos': return runMnemos(input.projectRoot, args);
    case 'start': return runHappyPath(input.projectRoot, args, 'start');
    case 'setup': return runHappyPath(input.projectRoot, args, 'setup');
    case 'connect': return runHappyPath(input.projectRoot, args, 'connect');
    case 'learn': return runHappyPath(input.projectRoot, args, 'learn');
    case 'tools': return runHappyPath(input.projectRoot, args, 'tools');
    case 'gateway': return runServiceCommand(input.projectRoot, 'gateway', args);
    case 'node': return runNodeHost(input.projectRoot, args);
    case 'nodes': return runNodesCommand(input.projectRoot, args);
    case 'pairing': return runPairing(input.projectRoot, args);
    case 'plugins': return runPlugins(input.projectRoot, args);
    case 'proxy': return runStatusLike(input.projectRoot, command, args, ['status', 'start', 'captures']);
    case 'qr': return runQr(input.projectRoot, args);
    case 'reset': return runReset(input.projectRoot, args);
    case 'sandbox': return runSandbox(input.projectRoot, args);
    case 'satellite': return runSatellite(input.projectRoot, args);
    case 'state': return runState(input.projectRoot, args);
    case 'secrets': return runSecrets(input.projectRoot, args);
    case 'sessions': return runCollection(input.projectRoot, 'sessions', args, 'session');
    case 'skills': return runSkills(input.projectRoot, args);
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

async function runCertify(root: string, args: string[]) {
  const target = firstArg(args, 'operational');
  const operationalTargets = new Set(['operational', 'readiness', 'ops']);
  if (['product-excellence', 'product', 'excellence'].includes(target)) {
    const service = new ZavorthProductExcellenceService({
      projectRoot: root,
      ...(readFlag(args, 'evidence-root') ? { evidenceRoot: readFlag(args, 'evidence-root') } : {}),
      env: process.env,
    });
    const snapshot = await service.buildSnapshot();
    const output = args.includes('--json')
      ? `${JSON.stringify(snapshot, null, 2)}\n`
      : `${service.renderText(snapshot)}\n`;
    return {
      exitCode: args.includes('--strict') && snapshot.status !== 'ready' ? 1 : 0,
      output,
    };
  }
  if (['native-capability', 'native', 'capability'].includes(target)) {
    const service = new ZavorthNativeCapabilityCertificationService({
      projectRoot: root,
      ...(readFlag(args, 'evidence-root') ? { evidenceRoot: readFlag(args, 'evidence-root') } : {}),
      env: process.env,
    });
    const snapshot = await service.buildSnapshot();
    const output = args.includes('--json')
      ? `${JSON.stringify(snapshot, null, 2)}\n`
      : `${service.renderText(snapshot)}\n`;
    return {
      exitCode: args.includes('--strict') && snapshot.status !== 'ready' ? 1 : 0,
      output,
    };
  }
  if (!operationalTargets.has(target)) {
    const payload = {
      ok: false,
      error: `Unknown certify target: ${target}`,
      allowedTargets: ['operational', 'product-excellence', 'native-capability'],
    };
    if (args.includes('--json')) {
      return {
        exitCode: 1,
        output: `${JSON.stringify(payload, null, 2)}\n`,
      };
    }
    return {
      exitCode: 1,
      output: [
        `Unknown certify target: ${target}`,
        'Allowed targets: operational, product-excellence, native-capability',
      ].join('\n') + '\n',
    };
  }
  const service = new ZavorthOperationalReadinessService();
  const snapshot = service.buildSnapshot(root);
  const output = args.includes('--json')
    ? `${JSON.stringify(snapshot, null, 2)}\n`
    : `${service.renderText(snapshot)}\n`;
  return {
    exitCode: args.includes('--strict') && snapshot.status !== 'pass' ? 1 : 0,
    output,
  };
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
        kind: (readFlag(args, 'event') || readFlag(args, 'kind') || 'shown') as any,
        surface: (readFlag(args, 'surface') || 'cli') as any,
        actor: readFlag(args, 'actor') || 'operator',
        status: (readFlag(args, 'status') || 'ok') as any,
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
    category: readFlag(args, 'category') as any || null,
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

async function runHappyPath(_root: string, args: string[], kind: 'start' | 'setup' | 'connect' | 'learn' | 'tools') {
  const flows: Record<typeof kind, { title: string; lines: string[]; commands: string[] }> = {
    start: {
      title: 'Zavorth start',
      lines: [
        'Start here for a clean first run.',
        '1. Choose an experience profile: zavorth setup profile',
        '2. Test the model route: zavorth setup provider',
        '3. Connect channels when ready: zavorth connect channels',
        '4. Review learned memory anytime: zavorth learn memory',
        '5. Open tools and skills: zavorth tools catalog',
      ],
      commands: ['zavorth setup profile', 'zavorth setup provider', 'zavorth connect channels', 'zavorth learn memory', 'zavorth tools catalog'],
    },
    setup: {
      title: 'Zavorth setup',
      lines: [
        'Set up the local experience in small steps.',
        'Profile: choose personal, creator, developer, business or power.',
        'Provider: add a key or local model, then run a probe.',
        'Runtime: pick VPS, safe-8GB, developer or full and run the doctor.',
        'Dashboard: open the setup checklist for the next useful action.',
      ],
      commands: ['zavorth setup profile', 'zavorth setup provider', 'zavorth setup runtime', 'zavorth health'],
    },
    connect: {
      title: 'Connect channels',
      lines: [
        'Connect channels with honest readiness.',
        'Telegram can become live with bot token and chat proof.',
        'Slack, WhatsApp, Signal, Email and Discord show required credentials and live probes.',
        'Outbox-only routes stay marked as outbox until their bridge passes a smoke test.',
        'No message is sent from this guide.',
      ],
      commands: ['zavorth connect channels', 'zavorth message doctor', 'zavorth pairing create'],
    },
    learn: {
      title: 'Review learned memory',
      lines: [
        'Review what Zavorth learned and keep it reversible.',
        'Show evidence, confidence, expiry and receipts before promoting anything.',
        'Approve, edit, reject or forget candidates from the learning surface.',
        'Sensitive profile, secrets, shell, channel and provider changes stay approval-bound.',
      ],
      commands: ['zavorth learn memory', 'zavorth mnemos status', 'zavorth daily'],
    },
    tools: {
      title: 'Zavorth tools catalog',
      lines: [
        'Browse tools, MCP entries and skills before installing.',
        'Safe entries start as preview with risk, smoke status and required setup.',
        'Executable support files stay inactive until wrapped and approved.',
        'Installed skills report usage signals so the curator can promote or retire them.',
      ],
      commands: ['zavorth tools catalog', 'zavorth mcp status', 'zavorth skills list'],
    },
  };
  const flow = flows[kind];
  return render(args, flow.title, flow.lines, {
    ok: true,
    kind,
    commands: flow.commands,
    sideEffects: 'none',
  });
}

async function runBackground(root: string, args: string[]) {
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

async function runTaskBoard(root: string, args: string[]) {
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

function taskPlaneServiceForCli(root: string, args: string[]): TaskPlaneService {
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

function goalLoopDaemonServiceForCli(root: string, args: string[]): GoalLoopDaemonService {
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
    stateDbPath: home.resolvedPaths.dbPath,
  });
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
  } catch {
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
    const service = new ZavorthSessionRecallService({
      storePath: path.join(home.resolvedPaths.runtimeDir, 'mnemos-session-recall.json'),
      stateDbPath: home.resolvedPaths.dbPath,
    });
    const content = readFlag(args, 'text') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
    if (!content) return render(args, 'Zavorth Mnemos session recall', ['Missing --text for session-append.'], { ok: false });
    const session = service.appendMessage({
      sessionId: readFlag(args, 'session-id') || null,
      title: readFlag(args, 'title') || null,
      role: readFlag(args, 'role') || 'user',
      content,
    });
    return render(args, 'Zavorth Mnemos session recall', [
      `session: ${session.id}`,
      `messages: ${session.messages.length}`,
    ], { session });
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
  const { ZavorthAppsSatelliteNodesService } = await import('../services/ZavorthAppsSatelliteNodesService.js');
  const service = new ZavorthAppsSatelliteNodesService({ cwd: root });
  const satelliteAction = action === 'pair' || action === 'pairing'
    ? 'pairing.qr'
    : action === 'push-plan' || action === 'push'
      ? 'push.plan'
      : 'status';
  const snapshot = service.execute({
    action: satelliteAction as any,
    nodeKind: (readFlag(args, 'kind') || readFlag(args, 'node-kind') || 'mobile') as any,
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
}): string[] {
  return [
    `run: ${snapshot.runId}`,
    `status: ${snapshot.status}`,
    `agents: ${snapshot.planner.plannedAgents}/${snapshot.planner.requestedAgents} (${snapshot.planner.mode})`,
    `workers: ${snapshot.workerPool.mode} concurrency=${snapshot.workerPool.actualMaxConcurrency || snapshot.workerPool.maxConcurrency}`,
    `ledger: ${snapshot.ledger.usedSteps}/${snapshot.ledger.maxSteps}`,
    `conflicts: ${snapshot.reducer.conflictCount}`,
    `confidence: ${snapshot.reducer.confidence}`,
    snapshot.reducer.synthesis ? `synthesis: ${snapshot.reducer.synthesis.slice(0, 240)}` : 'synthesis: pending',
  ];
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
  } catch {
    return false;
  }
}

async function runBackup(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const dir = path.join(stateDir(root), 'backups');
  await ensureDir(dir);
  if (action === 'create') {
    const id = idWithTime('backup');
    const archiveFiles = await collectBackupFiles(root, args);
    const manifest: JsonObject = {
      id,
      version: 2,
      createdAt: new Date().toISOString(),
      root,
      format: 'zavorth-backup/v2',
      scope: args.includes('--full') ? 'full-state' : 'core-state',
      files: archiveFiles,
    };
    const payload = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    const encrypted = args.includes('--encrypt');
    const archive = path.join(dir, `${id}.${encrypted ? 'zavbak.enc' : 'zavbak.gz'}`);
    const archiveBytes = encrypted ? encryptBackupPayload(payload, readBackupPassphrase(args)) : await gzipAsync(payload);
    await fs.writeFile(archive, archiveBytes);
    const sidecar = backupSidecar(manifest, archive, encrypted);
    await writeJson(path.join(dir, `${id}.json`), sidecar);
    return render(args, 'Zavorth backup', [
      `Created archive: ${archive}`,
      `Tracked files: ${archiveFiles.filter((file) => file.exists).length}`,
      `Mode: ${encrypted ? 'encrypted' : 'compressed'}`,
      `Scope: ${String(manifest.scope)}`,
    ], sidecar);
  }
  const files = (await listAnyFiles(dir)).filter((file) => file.endsWith('.zavbak.gz') || file.endsWith('.zavbak.enc') || file.endsWith('.json')).map((file) => path.basename(file)).sort();
  if (action === 'verify') {
    const target = args.find((arg) => arg.endsWith('.zavbak.gz') || arg.endsWith('.zavbak.enc') || arg.endsWith('.json')) || files.find((file) => file.endsWith('.zavbak.gz') || file.endsWith('.zavbak.enc')) || files.at(-1);
    if (!target) return render(args, 'Zavorth backup', ['No backup manifest found. Run: zavorth backup create'], { ok: false });
    const targetPath = path.isAbsolute(target) ? target : path.join(dir, target);
    const manifest = await loadBackupArchive(targetPath, args);
    const verification = verifyBackupManifest(manifest);
    return render(args, 'Zavorth backup', [
      `Verified manifest: ${String((manifest as JsonObject).id || target)}`,
      `Format: ${String((manifest as JsonObject).format || 'unknown')}`,
      `Files: ${String(verification.files)}`,
      `Checksums: ${verification.ok ? 'valid' : 'invalid'}`,
      ...verification.errors,
    ], { ok: verification.ok, manifest: backupSidecar(manifest as JsonObject, targetPath, targetPath.endsWith('.enc')), verification });
  }
  if (action === 'restore') {
    const target = args.find((arg) => arg.endsWith('.zavbak.gz') || arg.endsWith('.zavbak.enc')) || files.find((file) => file.endsWith('.zavbak.gz') || file.endsWith('.zavbak.enc')) || '';
    if (!target) return render(args, 'Zavorth backup', ['No backup archive found. Run: zavorth backup create'], { ok: false });
    const targetPath = path.isAbsolute(target) ? target : path.join(dir, target);
    const manifest = await loadBackupArchive(targetPath, args) as { files?: Array<JsonObject> };
    const restorable = selectBackupFiles((manifest.files || []).filter((file) => Boolean(file.exists && file.contentBase64)), args);
    const safeRestorable = args.includes('--include-secrets')
      ? restorable
      : restorable.filter((file) => !String(file.file).includes('.env'));
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth backup', [
        'Restore preview only. Add --yes to write files.',
        'Secrets are excluded unless --include-secrets is provided.',
        ...safeRestorable.map((file) => `- ${String(file.file)} (${String(file.bytes || 0)} bytes)`),
      ], { dryRun: true, files: safeRestorable.map(({ contentBase64, ...file }) => file) });
    }
    for (const file of safeRestorable) {
      const relative = String(file.file);
      const destination = path.resolve(root, relative);
      if (!isInside(root, destination)) continue;
      await ensureDir(path.dirname(destination));
      await fs.writeFile(destination, Buffer.from(String(file.contentBase64), 'base64'));
    }
    return render(args, 'Zavorth backup', [`Restored files: ${safeRestorable.length}`], { restored: safeRestorable.map((file) => file.file) });
  }
  if (action === 'migrate') {
    const target = args.find((arg) => arg.endsWith('.zavbak.gz') || arg.endsWith('.zavbak.enc')) || files.find((file) => file.endsWith('.zavbak.gz') || file.endsWith('.zavbak.enc')) || '';
    if (!target) return render(args, 'Zavorth backup migrate', ['No backup archive found.'], { ok: false });
    const targetPath = path.isAbsolute(target) ? target : path.join(dir, target);
    const manifest = await loadBackupArchive(targetPath, args) as JsonObject;
    const migrated = migrateBackupManifest(manifest, Number(readFlag(args, 'to-version') || 2));
    if (!args.includes('--yes')) return render(args, 'Zavorth backup migrate', ['Migration preview only. Add --yes to write a migrated archive.', `From: ${String(manifest.version || 1)}`, `To: ${String(migrated.version)}`], { dryRun: true, migrated: backupSidecar(migrated, '', false) });
    const id = idWithTime('backup-migrated');
    const archive = path.join(dir, `${id}.zavbak.gz`);
    await fs.writeFile(archive, await gzipAsync(Buffer.from(JSON.stringify(migrated, null, 2), 'utf8')));
    await writeJson(path.join(dir, `${id}.json`), backupSidecar(migrated, archive, false));
    return render(args, 'Zavorth backup migrate', [`Migrated archive: ${archive}`], backupSidecar(migrated, archive, false));
  }
  if (action === 'import') {
    const source = readFlag(args, 'source') || args[1] || '';
    if (!source || !existsSync(source)) return render(args, 'Zavorth backup import', [`Import source not found: ${source || '<missing>'}`], { ok: false });
    const imported = await importAgentState(root, source, args);
    if (!args.includes('--yes')) return render(args, 'Zavorth backup import', ['Import preview only. Add --yes to write mapped state.', ...imported.lines], { dryRun: true, mapped: imported.mapped });
    for (const file of imported.files) {
      await ensureDir(path.dirname(file.destination));
      await fs.writeFile(file.destination, file.content);
    }
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'backup-imports.json'), { id: idWithTime('backup-import'), source, agent: readFlag(args, 'agent') || 'generic', createdAt: new Date().toISOString(), files: imported.files.map((file) => path.relative(root, file.destination)) });
    return render(args, 'Zavorth backup import', ['Imported mapped agent state.', ...imported.lines], { imported: imported.files.map((file) => path.relative(root, file.destination)) });
  }
  return render(args, 'Zavorth backup', files.length ? files.map((file) => `- ${file}`) : ['No backups yet. Run: zavorth backup create'], { backups: files });
}

async function collectBackupFiles(root: string, args: string[]): Promise<JsonObject[]> {
  const defaults = ['package.json', 'package-lock.json', '.env', '.env.local', '.zavorth/cli-config.json', '.zavorth/mcp.json', '.zavorth/plugins.json', '.zavorth/tasks.json', '.zavorth/sessions.json'];
  const stateFiles = args.includes('--full')
    ? (await walkFiles(stateDir(root), 2000)).filter((file) => !file.includes(`${path.sep}backups${path.sep}`)).map((file) => path.relative(root, file))
    : [];
  const requested = readFlags(args, 'include').concat(readFlags(args, 'file'));
  const files = Array.from(new Set([...defaults, ...stateFiles, ...requested])).filter(Boolean);
  return Promise.all(files.map(async (file) => {
    const absolute = path.resolve(root, file);
    if (!isInside(root, absolute) || !existsSync(absolute)) return { file, exists: false };
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) return { file, exists: false };
    const raw = await fs.readFile(absolute);
    return { file: path.relative(root, absolute), exists: true, bytes: raw.byteLength, sha256: sha256(raw), contentBase64: raw.toString('base64') };
  }));
}

function backupSidecar(manifest: JsonObject, archive: string, encrypted: boolean): JsonObject {
  const files = Array.isArray(manifest.files) ? manifest.files as JsonObject[] : [];
  return {
    ...manifest,
    encrypted,
    archive,
    files: files.map(({ contentBase64, ...file }) => file),
  };
}

async function loadBackupArchive(targetPath: string, args: string[]): Promise<JsonObject> {
  if (targetPath.endsWith('.json')) return readJson(targetPath, {}) as Promise<JsonObject>;
  const raw = await fs.readFile(targetPath);
  const payload = targetPath.endsWith('.enc') ? decryptBackupPayload(raw, readBackupPassphrase(args)) : await gunzipAsync(raw);
  return JSON.parse(payload.toString('utf8')) as JsonObject;
}

function verifyBackupManifest(manifest: unknown): { ok: boolean; files: number; errors: string[] } {
  const item = manifest as JsonObject;
  const files = Array.isArray(item.files) ? item.files as JsonObject[] : [];
  const errors: string[] = [];
  if (!String(item.format || '').startsWith('zavorth-backup/')) errors.push('Unsupported backup format.');
  for (const file of files) {
    if (!file.exists) continue;
    const content = String(file.contentBase64 || '');
    if (!content) {
      errors.push(`Missing content for ${String(file.file)}`);
      continue;
    }
    const raw = Buffer.from(content, 'base64');
    if (Number(file.bytes || 0) !== raw.byteLength) errors.push(`Size mismatch for ${String(file.file)}`);
    if (String(file.sha256 || '') !== sha256(raw)) errors.push(`Checksum mismatch for ${String(file.file)}`);
  }
  return { ok: errors.length === 0, files: files.filter((file) => file.exists).length, errors };
}

function selectBackupFiles(files: JsonObject[], args: string[]): JsonObject[] {
  const includes = readFlags(args, 'file').concat(readFlags(args, 'include'));
  const excludes = readFlags(args, 'exclude');
  return files.filter((file) => {
    const name = String(file.file || '');
    if (includes.length && !includes.some((pattern) => backupPatternMatches(name, pattern))) return false;
    if (excludes.some((pattern) => backupPatternMatches(name, pattern))) return false;
    return true;
  });
}

function backupPatternMatches(file: string, pattern: string): boolean {
  const normalized = file.replace(/\\/gu, '/');
  const wanted = pattern.replace(/\\/gu, '/');
  if (wanted.includes('*')) {
    const regex = new RegExp(`^${wanted.split('*').map(escapeRegex).join('.*')}$`, 'u');
    return regex.test(normalized);
  }
  return normalized === wanted || normalized.endsWith(`/${wanted}`);
}

function migrateBackupManifest(manifest: JsonObject, toVersion: number): JsonObject {
  const files = Array.isArray(manifest.files) ? manifest.files as JsonObject[] : [];
  return {
    ...manifest,
    id: idWithTime('backup-migrated'),
    version: toVersion,
    format: `zavorth-backup/v${toVersion}`,
    migratedAt: new Date().toISOString(),
    files: files.map((file) => ({ ...file, file: String(file.file || '').replace(/\\/gu, '/') })),
  };
}

async function importAgentState(root: string, source: string, args: string[]): Promise<{ lines: string[]; mapped: JsonObject; files: Array<{ destination: string; content: string }> }> {
  const stat = await fs.stat(source);
  const rawFiles = stat.isDirectory()
    ? await Promise.all((await walkFiles(source, 200)).map(async (file) => ({ file, content: await fs.readFile(file, 'utf8').catch(() => '') })))
    : [{ file: source, content: await fs.readFile(source, 'utf8') }];
  const agent = idFromSpec(readFlag(args, 'agent') || 'generic-agent');
  const mapped: JsonObject = {
    version: 1,
    sourceAgent: agent,
    importedAt: new Date().toISOString(),
    source: path.resolve(source),
    files: rawFiles.map((file) => ({ file: path.basename(file.file), sha256: sha256(Buffer.from(file.content, 'utf8')) })),
  };
  const destination = path.join(stateDir(root), 'imports', `${agent}.json`);
  return {
    lines: [`Source agent: ${agent}`, `Mapped files: ${rawFiles.length}`, `Destination: ${path.relative(root, destination)}`],
    mapped,
    files: [{ destination, content: JSON.stringify(mapped, null, 2) }],
  };
}

function readBackupPassphrase(args: string[]): string {
  const envName = readFlag(args, 'passphrase-env');
  const value = readFlag(args, 'passphrase') || (envName ? process.env[envName] : undefined) || process.env.ZAVORTH_BACKUP_PASSPHRASE || '';
  if (!value) throw new Error('Encrypted backup requires --passphrase, --passphrase-env or ZAVORTH_BACKUP_PASSPHRASE.');
  return value;
}

function encryptBackupPayload(payload: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope = {
    format: 'zavorth-backup-encrypted/v1',
    kdf: 'scrypt',
    cipher: 'aes-256-gcm',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
  return Buffer.from(JSON.stringify(envelope), 'utf8');
}

function decryptBackupPayload(payload: Buffer, passphrase: string): Buffer {
  const envelope = JSON.parse(payload.toString('utf8')) as JsonObject;
  const salt = Buffer.from(String(envelope.salt || ''), 'base64');
  const iv = Buffer.from(String(envelope.iv || ''), 'base64');
  const tag = Buffer.from(String(envelope.tag || ''), 'base64');
  const encrypted = Buffer.from(String(envelope.data || ''), 'base64');
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

async function runConfig(root: string, args: string[]) {
  const profile = readFlag(args, 'profile') || process.env.ZAVORTH_PROFILE || 'default';
  const file = configFileForProfile(root, profile);
  await ensureDir(path.dirname(file));
  const action = firstArg(args, 'validate');
  const cfg = await readJson(file, defaultConfig(profile));
  if (action === 'file') return render(args, 'Zavorth config', [file], { file });
  if (action === 'profile' || action === 'profiles') {
    return runConfigProfiles(root, args);
  }
  if (action === 'export') {
    const output = readFlag(args, 'output') || path.join(stateDir(root), `config-export-${profile}.json`);
    const payload = { profile, exportedAt: new Date().toISOString(), config: redactConfigSecrets(cfg as JsonObject) };
    await writeJson(output, payload);
    return render(args, 'Zavorth config', [`Exported config: ${output}`], { output, payload });
  }
  if (action === 'import') {
    const input = args[1] || readFlag(args, 'file') || '';
    if (!input || !existsSync(input)) return render(args, 'Zavorth config', [`Import file not found: ${input || '<missing>'}`], { ok: false });
    const imported = await readJson(input, {}) as JsonObject;
    const next = normalizeConfig((imported.config || imported) as JsonObject, profile);
    const preview = previewConfigPolicy(cfg as JsonObject, next);
    if (!args.includes('--yes')) return render(args, 'Zavorth config import', ['Import preview only. Add --yes to apply.', ...preview.lines], { dryRun: true, preview });
    await writeJson(file, next);
    return render(args, 'Zavorth config import', ['Imported config.', ...preview.lines], { config: redactConfigSecrets(next), preview });
  }
  if (action === 'requirements') {
    const requirements = normalizeRequirements(((cfg as JsonObject).requirements || []) as unknown[]);
    const result = enforceRequirements(requirements);
    return render(args, 'Zavorth config requirements', result.lines, result);
  }
  if (action === 'managed') {
    return runManagedConfig(root, profile, cfg as JsonObject, args);
  }
  if (action === 'get') {
    const key = args[1] || '';
    const value = key ? getPath(cfg, key) : cfg;
    return render(args, 'Zavorth config', [`${key || 'config'}: ${safeString(redactConfigSecrets(value as JsonObject))}`], { key, value: redactConfigSecrets(value as JsonObject) });
  }
  if (action === 'set') {
    const key = args[1];
    const value = args.slice(2).filter((arg, index, list) => {
      if (arg.startsWith('--')) return false;
      return index === 0 || list[index - 1] !== '--profile';
    }).join(' ');
    if (!key || !value) return render(args, 'Zavorth config', ['Usage: zavorth config set <key> <value>'], { ok: false });
    setPath(cfg as JsonObject, key, value);
    const next = normalizeConfig(cfg as JsonObject, profile);
    const validation = validateConfigSchema(next);
    if (!validation.ok) return render(args, 'Zavorth config', ['Config schema validation failed.', ...validation.errors], { ok: false, errors: validation.errors });
    await writeJson(file, next);
    return render(args, 'Zavorth config', [`Set ${key}`, `Profile: ${profile}`], { ok: true, file, config: redactConfigSecrets(next) });
  }
  if (action === 'unset') {
    const key = args[1];
    if (!key) return render(args, 'Zavorth config', ['Usage: zavorth config unset <key>'], { ok: false });
    unsetPath(cfg as JsonObject, key);
    await writeJson(file, cfg);
    return render(args, 'Zavorth config', [`Unset ${key}`], { ok: true, file });
  }
  const normalized = normalizeConfig(cfg as JsonObject, profile);
  const validation = validateConfigSchema(normalized);
  const requirements = enforceRequirements(normalizeRequirements((normalized.requirements || []) as unknown[]));
  return render(args, 'Zavorth config', [
    existsSync(file) ? 'Config file exists.' : 'No config file yet.',
    `Profile: ${profile}`,
    `Schema: ${validation.ok ? 'valid' : 'invalid'}`,
    `Requirements: ${requirements.ok ? 'satisfied' : 'missing'}`,
    ...validation.errors,
    ...requirements.lines,
  ], { ok: validation.ok && requirements.ok, file, exists: existsSync(file), validation, requirements, config: redactConfigSecrets(normalized) });
}

function configFileForProfile(root: string, profile: string): string {
  const safe = profile.replace(/[^a-z0-9._-]+/giu, '-').toLowerCase() || 'default';
  return safe === 'default'
    ? path.join(stateDir(root), 'cli-config.json')
    : path.join(stateDir(root), 'profiles', safe, 'cli-config.json');
}

function defaultConfig(profile: string): JsonObject {
  return {
    version: 2,
    profile: { id: profile, mode: 'balanced' },
    provider: { name: '', model: '' },
    trust: { approvalMode: 'balanced', sandboxDefault: 'local', redactSecrets: true },
    requirements: [],
    managed: { enabled: false },
  };
}

function normalizeConfig(value: JsonObject, profile: string): JsonObject {
  return {
    ...defaultConfig(profile),
    ...value,
    version: Number(value.version || 2),
    profile: { ...(defaultConfig(profile).profile as JsonObject), ...((value.profile || {}) as JsonObject), id: String(((value.profile || {}) as JsonObject).id || profile) },
    provider: { ...(defaultConfig(profile).provider as JsonObject), ...((value.provider || {}) as JsonObject) },
    trust: { ...(defaultConfig(profile).trust as JsonObject), ...((value.trust || {}) as JsonObject) },
    requirements: normalizeRequirements((value.requirements || []) as unknown[]),
    managed: { ...(defaultConfig(profile).managed as JsonObject), ...((value.managed || {}) as JsonObject) },
  };
}

function validateConfigSchema(config: JsonObject): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (Number(config.version || 0) < 1) errors.push('version must be >= 1.');
  if (!config.profile || typeof config.profile !== 'object') errors.push('profile object is required.');
  if (!config.trust || typeof config.trust !== 'object') errors.push('trust object is required.');
  const trust = (config.trust || {}) as JsonObject;
  const approvalMode = String(trust.approvalMode || '');
  if (approvalMode && !['ask-every-time', 'balanced', 'trusted-local', 'manual', 'governed', 'speculative'].includes(approvalMode)) errors.push(`unknown trust.approvalMode: ${approvalMode}`);
  return { ok: errors.length === 0, errors };
}

async function runConfigProfiles(root: string, args: string[]) {
  const action = args[1] || 'list';
  const dir = path.join(stateDir(root), 'profiles');
  await ensureDir(dir);
  if (action === 'create') {
    const profile = args[2] || readFlag(args, 'profile') || '';
    if (!profile) return render(args, 'Zavorth config profiles', ['Usage: zavorth config profile create <name>'], { ok: false });
    const file = configFileForProfile(root, profile);
    if (!existsSync(file)) await writeJson(file, defaultConfig(profile));
    return render(args, 'Zavorth config profiles', [`Created profile: ${profile}`, `File: ${file}`], { profile, file });
  }
  if (action === 'use') {
    const profile = args[2] || readFlag(args, 'profile') || '';
    if (!profile) return render(args, 'Zavorth config profiles', ['Usage: zavorth config profile use <name>'], { ok: false });
    await writeJson(path.join(stateDir(root), 'active-profile.json'), { profile, updatedAt: new Date().toISOString() });
    return render(args, 'Zavorth config profiles', [`Active profile: ${profile}`], { profile });
  }
  const profiles = ['default']
    .concat((await listAnyFiles(dir)).filter((entry) => existsSync(path.join(entry, 'cli-config.json'))).map((entry) => path.basename(entry)));
  const active = await readJson(path.join(stateDir(root), 'active-profile.json'), { profile: process.env.ZAVORTH_PROFILE || 'default' }) as JsonObject;
  return render(args, 'Zavorth config profiles', profiles.map((profile) => `${String(active.profile) === profile ? '*' : '-'} ${profile}`), { profiles, active: active.profile });
}

async function runManagedConfig(root: string, profile: string, current: JsonObject, args: string[]) {
  const source = readFlag(args, 'file') || readFlag(args, 'url') || process.env.ZAVORTH_MANAGED_CONFIG_URL || '';
  const deploymentKey = readFlag(args, 'deployment-key') || process.env.ZAVORTH_DEPLOYMENT_KEY || '';
  if (!source) return render(args, 'Zavorth managed config', ['Managed config source is missing. Use --file or --url.'], { ok: false });
  const payload = await loadManagedConfigSource(source);
  if (!payload.ok) return render(args, 'Zavorth managed config', [`Failed to load managed config: ${payload.reason}`], payload);
  const managed = payload.config;
  const expectedChecksum = String((managed.integrity as JsonObject | undefined)?.sha256 || readFlag(args, 'checksum') || '');
  const actualChecksum = sha256(Buffer.from(JSON.stringify(redactConfigSecrets(managed)), 'utf8'));
  if (expectedChecksum && expectedChecksum !== actualChecksum) {
    return render(args, 'Zavorth managed config', ['Checksum mismatch. Managed config was not applied.'], { ok: false, expectedChecksum, actualChecksum });
  }
  if (managed.deploymentKeyHash && deploymentKey && hashDeploymentKey(deploymentKey) !== managed.deploymentKeyHash) {
    return render(args, 'Zavorth managed config', ['Deployment key did not match managed config policy.'], { ok: false });
  }
  const next = normalizeConfig({ ...current, ...((managed.config || managed) as JsonObject), managed: { enabled: true, source: redactUrl(source), appliedAt: new Date().toISOString() } }, profile);
  const validation = validateConfigSchema(next);
  const requirements = enforceRequirements(normalizeRequirements((next.requirements || []) as unknown[]));
  const preview = previewConfigPolicy(current, next);
  if (!args.includes('--yes')) {
    return render(args, 'Zavorth managed config', ['Managed config preview only. Add --yes to apply.', ...preview.lines, ...requirements.lines], { dryRun: true, validation, requirements, preview, config: redactConfigSecrets(next) });
  }
  if (!validation.ok || !requirements.ok) {
    return render(args, 'Zavorth managed config', ['Managed config blocked by validation/requirements.', ...validation.errors, ...requirements.lines], { ok: false, validation, requirements });
  }
  await writeJson(configFileForProfile(root, profile), next);
  await appendJsonArray(path.join(stateDir(root), 'receipts', 'managed-config.json'), { id: idWithTime('managed-config'), profile, source: redactUrl(source), checksum: actualChecksum, appliedAt: new Date().toISOString() });
  return render(args, 'Zavorth managed config', ['Managed config applied.', ...preview.lines], { config: redactConfigSecrets(next), checksum: actualChecksum });
}

async function loadManagedConfigSource(source: string): Promise<{ ok: boolean; config: JsonObject; reason?: string }> {
  try {
    if (/^https?:\/\//iu.test(source)) {
      const response = await fetch(source);
      if (!response.ok) return { ok: false, config: {}, reason: `http-${response.status}` };
      return { ok: true, config: await response.json() as JsonObject };
    }
    return { ok: true, config: await readJson(source, {}) as JsonObject };
  } catch (error) {
    return { ok: false, config: {}, reason: error instanceof Error ? error.message : String(error) };
  }
}

function normalizeRequirements(value: unknown[]): Array<{ kind: string; name: string; required: boolean }> {
  return value.map((entry) => {
    if (typeof entry === 'string') return { kind: 'env', name: entry, required: true };
    const item = (entry || {}) as JsonObject;
    return { kind: String(item.kind || 'env'), name: String(item.name || item.id || ''), required: item.required !== false };
  }).filter((entry) => entry.name);
}

function enforceRequirements(requirements: Array<{ kind: string; name: string; required: boolean }>): { ok: boolean; lines: string[]; missing: string[] } {
  const missing: string[] = [];
  for (const requirement of requirements) {
    if (!requirement.required) continue;
    if (requirement.kind === 'env' && !getEnv(requirement.name)) missing.push(requirement.name);
    if (requirement.kind === 'file' && !existsSync(requirement.name)) missing.push(requirement.name);
    if (requirement.kind === 'command') {
      // Command requirements are declared for the user; live command probing belongs in doctor.
    }
  }
  return {
    ok: missing.length === 0,
    missing,
    lines: requirements.length
      ? requirements.map((requirement) => `${missing.includes(requirement.name) ? 'missing' : 'ok'} ${requirement.kind}:${requirement.name}`)
      : ['No requirements declared.'],
  };
}

function previewConfigPolicy(before: JsonObject, after: JsonObject): { lines: string[]; changed: string[] } {
  const keys = ['provider.name', 'provider.model', 'trust.approvalMode', 'trust.sandboxDefault', 'trust.redactSecrets'];
  const changed = keys.filter((key) => safeString(getPath(before, key)) !== safeString(getPath(after, key)));
  return {
    changed,
    lines: changed.length
      ? ['Policy/config changes:', ...changed.map((key) => `- ${key}: ${safeString(getPath(before, key))} -> ${safeString(getPath(after, key))}`)]
      : ['No policy-sensitive config changes detected.'],
  };
}

function redactConfigSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactConfigSecrets);
  if (!value || typeof value !== 'object') return value;
  const out: JsonObject = {};
  for (const [key, item] of Object.entries(value as JsonObject)) {
    out[key] = /token|secret|password|api[_-]?key|deploymentkey/iu.test(key) ? '***' : redactConfigSecrets(item);
  }
  return out;
}

function hashDeploymentKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function runCollection(root: string, collection: string, args: string[], label: string) {
  const file = path.join(stateDir(root), `${collection}.json`);
  const action = firstArg(args, 'list');
  const items = await readArray(file);
  if (['add', 'create', 'pair'].includes(action)) {
    const item = {
      id: idWithTime(label),
      label: args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || `${label} created from CLI`,
      command: readFlag(args, 'command') || readFlag(args, 'cmd') || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    items.push(item);
    await writeJson(file, items);
    return render(args, `Zavorth ${collection}`, [`Created ${label}: ${item.id}`], { item });
  }
  if (['resolve', 'cancel', 'revoke'].includes(action)) {
    const id = args[1];
    const item = items.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!item) return render(args, `Zavorth ${collection}`, [`No ${label} found for id: ${id || '<missing>'}`], { ok: false });
    item.status = action === 'resolve' ? 'resolved' : action === 'cancel' ? 'cancelled' : 'revoked';
    item.updatedAt = new Date().toISOString();
    await writeJson(file, items);
    return render(args, `Zavorth ${collection}`, [`Updated ${label}: ${id} -> ${String(item.status)}`], { item });
  }
  if (['show', 'resume'].includes(action)) {
    const id = args[1];
    const item = items.find((entry) => String((entry as JsonObject).id) === id);
    return render(args, `Zavorth ${collection}`, item ? [JSON.stringify(item, null, 2)] : [`No ${label} found for id: ${id || '<missing>'}`], { item: item || null });
  }
  return render(args, `Zavorth ${collection}`, items.length ? items.map((item) => `- ${String((item as JsonObject).id)} | ${String((item as JsonObject).status || 'ready')} | ${String((item as JsonObject).label || label)}`) : [`No ${collection} recorded yet.`], { items });
}

async function runRunnableCollection(root: string, collection: string, args: string[], label: string) {
  const action = firstArg(args, 'list');
  if (collection === 'tasks' && action === 'background') {
    return runBackground(root, args.slice(1));
  }
  if (collection === 'tasks' && ['board', 'taskboard', 'kanban'].includes(action)) {
    return runTaskBoard(root, args.slice(1));
  }
  const file = path.join(stateDir(root), `${collection}.json`);
  const items = await readArray(file);
  if (['add', 'create', 'schedule'].includes(action)) {
    const command = readFlag(args, 'command') || readFlag(args, 'cmd') || '';
    const item: JsonObject = {
      id: readFlag(args, 'id') || idWithTime(label),
      label: args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || `${label} created from CLI`,
      command,
      status: collection === 'cron-jobs' ? 'scheduled' : 'queued',
      attempts: 0,
      maxRetries: readNumberFlag(args, 'retries') ?? 0,
      retryDelayMs: readNumberFlag(args, 'retry-delay-ms') ?? 1000,
      cron: readFlag(args, 'cron') || '',
      everyMs: readNumberFlag(args, 'every-ms') ?? 0,
      dependsOn: splitList(readFlag(args, 'depends-on') || ''),
      nextRunAt: readFlag(args, 'at') || new Date().toISOString(),
      taskPlane: collection === 'cron-jobs' && wantsTaskPlaneMaterialization(collection, args),
      taskTitle: readFlag(args, 'task-title') || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    items.push(item);
    await writeJson(file, items);
    await appendTaskLog(root, collection, item, 'created', `Created ${label}`);
    return render(args, `Zavorth ${collection}`, [
      `Created ${label}: ${String(item.id)}`,
      `Status: ${String(item.status)}`,
      item.taskPlane ? 'Target: Task Plane materialization' : 'Target: direct runnable worker',
      command ? `Command: ${redactCommand(command)}` : 'Command: not set',
    ], { item: sanitizeTaskRecord(item) });
  }
  if (action === 'status') {
    const summary = summarizeTasks(items);
    return render(args, `Zavorth ${collection}`, [
      `queued: ${summary.queued}`,
      `scheduled: ${summary.scheduled}`,
      `running: ${summary.running}`,
      `completed: ${summary.completed}`,
      `failed: ${summary.failed}`,
      `cancelled: ${summary.cancelled}`,
    ], summary);
  }
  if (action === 'worker') {
    if (!args.includes('--yes')) {
      return render(args, `Zavorth ${collection} worker`, [
        'Worker preview only. Add --yes to process due queued/scheduled work.',
        collection === 'cron-jobs'
          ? 'Add --task-plane to materialize due cron jobs into zavorth tasks instead of executing directly.'
          : 'Task worker will execute queued task commands after confirmation.',
        'Use --once for a single pass or --loop with --limit for repeated passes.',
      ], { dryRun: true, due: dueRunnableItems(items).map(sanitizeTaskRecord) });
    }
    const result = await runTaskWorker(root, collection, label, args);
    return render(args, `Zavorth ${collection} worker`, result.lines, result.payload);
  }
  if (action === 'logs') {
    const id = args[1] || readFlag(args, 'id') || '';
    const logs = await readTaskLogs(root, collection, id);
    return render(args, `Zavorth ${collection} logs`, logs.length ? logs.slice(-30).map(formatTaskLogLine) : ['No task logs recorded yet.'], { logs });
  }
  if (action === 'graph') {
    const graph = buildTaskGraph(items);
    return render(args, `Zavorth ${collection} graph`, graph.nodes.length ? [
      `nodes: ${graph.nodes.length}`,
      `edges: ${graph.edges.length}`,
      ...graph.edges.slice(0, 30).map((edge) => `${edge.from} -> ${edge.to}`),
    ] : ['No graph nodes yet.'], graph);
  }
  if (['cancel', 'resume'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || '';
    const item = findById(items, id);
    if (!item) return render(args, `Zavorth ${collection}`, [`No ${label} found for id: ${id || '<missing>'}`], { ok: false });
    item.status = action === 'cancel' ? 'cancelled' : (collection === 'cron-jobs' ? 'scheduled' : 'queued');
    item.updatedAt = new Date().toISOString();
    await writeJson(file, items);
    await appendTaskLog(root, collection, item, action, `${action === 'cancel' ? 'Cancelled' : 'Resumed'} ${label}`);
    return render(args, `Zavorth ${collection}`, [`${action === 'cancel' ? 'Cancelled' : 'Resumed'} ${label}: ${id}`], { item: sanitizeTaskRecord(item) });
  }
  if (['show', 'inspect'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || '';
    const item = findById(items, id);
    return render(args, `Zavorth ${collection}`, item ? taskDetailLines(item) : [`No ${label} found for id: ${id || '<missing>'}`], { item: item ? sanitizeTaskRecord(item) : null });
  }
  if (action !== 'run' && action !== 'retry') {
    return render(args, `Zavorth ${collection}`, items.length ? items.map(formatTaskRow) : [`No ${collection} recorded yet.`], { items: items.map(sanitizeTaskRecord) });
  }
  const id = args[1] || readFlag(args, 'id') || '';
  const item = items.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
  if (!item) return render(args, `Zavorth ${collection}`, [`No ${label} found for id: ${id || '<missing>'}`], { ok: false });
  if (wantsTaskPlaneMaterialization(collection, args, item)) {
    if (!args.includes('--yes')) {
      return render(args, `Zavorth ${collection}`, [
        `Task Plane materialization preview: ${String(item.label || item.id)}`,
        'Add --yes to create a persistent zavorth tasks item.',
      ], { dryRun: true, item: sanitizeTaskRecord(item), target: 'task-plane' });
    }
    const lock = await acquireTaskLock(root, collection);
    if (!lock.ok) return render(args, `Zavorth ${collection}`, [lock.message], { ok: false, lock });
    let materialized: JsonObject;
    try {
      materialized = await materializeCronItemToTaskPlane(root, item, args);
      await writeJson(file, items);
    } finally {
      await releaseTaskLock(lock.file);
    }
    return render(args, `Zavorth ${collection}`, [
      materialized.created
        ? `Created Task Plane item: ${String(materialized.taskId)}`
        : `Task Plane item already exists: ${String(materialized.taskId || 'unknown')}`,
      `Cron ${String(item.id)} -> ${String(item.status)}`,
    ], { item: sanitizeTaskRecord(item), taskPlane: materialized });
  }
  const command = String(item.command || readFlag(args, 'command') || '');
  if (!command) return render(args, `Zavorth ${collection}`, [`No command stored for ${id}. Use --command when creating it.`], { ok: false });
  if (!args.includes('--yes')) return render(args, `Zavorth ${collection}`, [`Run preview: ${redactCommand(command)}`, 'Add --yes to execute this local command under the durable worker lock.'], { dryRun: true, item: sanitizeTaskRecord(item) });
  const lock = await acquireTaskLock(root, collection);
  if (!lock.ok) return render(args, `Zavorth ${collection}`, [lock.message], { ok: false, lock });
  let outcome: JsonObject;
  try {
    outcome = await executeTaskItem(root, collection, item, args);
    await writeJson(file, items);
  } finally {
    await releaseTaskLock(lock.file);
  }
  await writeJson(file, items);
  return render(args, `Zavorth ${collection}`, [`Run ${String(item.status)}: ${id}`, String(outcome.output || '<empty output>').slice(0, 1000)], { item: sanitizeTaskRecord(item), outcome });
}

function summarizeTasks(items: unknown[]): JsonObject {
  const summary: JsonObject = { queued: 0, scheduled: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
  for (const item of items) {
    const status = String((item as JsonObject).status || 'queued');
    summary[status] = Number(summary[status] || 0) + 1;
  }
  return summary;
}

function dueRunnableItems(items: unknown[]): JsonObject[] {
  const now = Date.now();
  const byId = new Map(items.map((item) => [String((item as JsonObject).id), item as JsonObject]));
  return items.map((item) => item as JsonObject).filter((item) => {
    const status = String(item.status || 'queued');
    if (!['queued', 'scheduled'].includes(status)) return false;
    const nextRunAt = Date.parse(String(item.nextRunAt || new Date().toISOString()));
    if (Number.isFinite(nextRunAt) && nextRunAt > now) return false;
    const deps = Array.isArray(item.dependsOn) ? item.dependsOn.map(String) : [];
    return deps.every((dep) => String(byId.get(dep)?.status || '') === 'completed');
  });
}

async function runTaskWorker(root: string, collection: string, label: string, args: string[]): Promise<{ lines: string[]; payload: JsonObject }> {
  const lock = await acquireTaskLock(root, collection);
  if (!lock.ok) return { lines: [lock.message], payload: { ok: false, lock } };
  const file = path.join(stateDir(root), `${collection}.json`);
  const processed: JsonObject[] = [];
  const limit = readNumberFlag(args, 'limit') || 10;
  try {
    const items = await readArray(file);
    const due = dueRunnableItems(items).slice(0, limit);
    for (const item of due) {
      if (wantsTaskPlaneMaterialization(collection, args, item)) {
        const materialized = await materializeCronItemToTaskPlane(root, item, args);
        processed.push({
          ...sanitizeTaskRecord(item),
          taskPlane: materialized,
        });
        continue;
      }
      if (!String(item.command || '')) {
        item.status = 'failed';
        item.lastError = 'missing-command';
        await appendTaskLog(root, collection, item, 'failed', 'Missing command');
        processed.push(sanitizeTaskRecord(item));
        continue;
      }
      const outcome = await executeTaskItem(root, collection, item, args);
      processed.push({ ...sanitizeTaskRecord(item), outcome: { exitCode: outcome.exitCode, durationMs: outcome.durationMs } });
    }
    await writeJson(file, items);
  } finally {
    await releaseTaskLock(lock.file);
  }
  return {
    lines: processed.length ? [
      `Processed ${processed.length} ${label}(s).`,
      ...processed.map((item) => `- ${String(item.id)} | ${String(item.status)} | attempts ${String(item.attempts || 0)}`),
    ] : ['No due work found.'],
    payload: { ok: true, processed },
  };
}

function wantsTaskPlaneMaterialization(collection: string, args: string[], item?: JsonObject): boolean {
  if (collection !== 'cron-jobs') {
    return false;
  }
  const target = String(readFlag(args, 'target') || item?.target || item?.taskTarget || '').trim().toLowerCase();
  return args.includes('--task-plane')
    || args.includes('--materialize-task')
    || target === 'tasks'
    || target === 'task-plane'
    || item?.taskPlane === true;
}

async function materializeCronItemToTaskPlane(root: string, item: JsonObject, args: string[]): Promise<JsonObject> {
  const dueAt = String(item.nextRunAt || new Date().toISOString());
  if (item.lastTaskPlaneDueAt === dueAt && item.lastMaterializedTaskId) {
    return {
      created: false,
      reason: 'already-materialized',
      taskId: item.lastMaterializedTaskId,
      dueAt,
    };
  }

  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  const taskPlane = new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
  });
  const task = taskPlane.createTask({
    title: String(readFlag(args, 'task-title') || item.taskTitle || item.label || `Cron ${String(item.id || 'job')}`).trim(),
    source: `cron:${String(item.id || 'unknown')}`,
    receiptId: `cron-task-plane:${String(item.id || 'unknown')}:${Date.now()}`,
    payload: {
      cronJobId: item.id || null,
      cronLabel: item.label || null,
      commandPreview: redactCommand(String(item.command || '')),
      commandDigest: createHash('sha256').update(String(item.command || '')).digest('hex'),
      cronExpression: item.cron || null,
      dueAt,
      everyMs: Number(item.everyMs || 0),
      collection: 'cron-jobs',
      materializedBy: 'zavorth-cron-worker',
    },
  });

  item.taskPlane = true;
  item.lastMaterializedTaskId = task.id;
  item.lastTaskPlaneDueAt = dueAt;
  item.lastMaterializedAt = new Date().toISOString();
  item.status = Number(item.everyMs || 0) > 0 ? 'scheduled' : 'completed';
  if (Number(item.everyMs || 0) > 0) {
    item.nextRunAt = new Date(Date.now() + Number(item.everyMs || 0)).toISOString();
  }
  item.updatedAt = new Date().toISOString();
  await appendTaskLog(root, 'cron-jobs', item, 'task-plane-created', `Created Task Plane item ${task.id}`);

  return {
    created: true,
    taskId: task.id,
    taskStatus: task.status,
    taskPlaneStorePath: taskPlane.snapshot().storePath,
    dueAt,
  };
}

async function executeTaskItem(root: string, collection: string, item: JsonObject, args: string[]): Promise<JsonObject> {
  const command = String(item.command || '');
  item.status = 'running';
  item.startedAt = new Date().toISOString();
  item.attempts = Number(item.attempts || 0) + 1;
  item.updatedAt = new Date().toISOString();
  await appendTaskLog(root, collection, item, 'started', `Started: ${redactCommand(command)}`);
  const result = await runProcess(command, [], root, readNumberFlag(args, 'timeout-ms') || Number(item.timeoutMs || 30000));
  item.lastRunAt = new Date().toISOString();
  item.lastRun = { ...result, output: String(result.output || '').slice(0, 4000) };
  const maxRetries = Number(item.maxRetries || 0);
  if (result.exitCode === 0) {
    item.status = collection === 'cron-jobs' && Number(item.everyMs || 0) > 0 ? 'scheduled' : 'completed';
    if (collection === 'cron-jobs' && Number(item.everyMs || 0) > 0) item.nextRunAt = new Date(Date.now() + Number(item.everyMs || 0)).toISOString();
    await appendTaskLog(root, collection, item, 'completed', String(result.output || '<empty output>').slice(0, 1000));
  } else if (Number(item.attempts || 0) <= maxRetries) {
    item.status = 'queued';
    item.nextRunAt = new Date(Date.now() + Number(item.retryDelayMs || 1000)).toISOString();
    await appendTaskLog(root, collection, item, 'retry-scheduled', `Exit ${result.exitCode}; retry ${String(item.attempts)}/${maxRetries}`);
  } else {
    item.status = 'failed';
    item.lastError = `exit ${result.exitCode}`;
    await appendTaskLog(root, collection, item, 'failed', String(result.output || `exit ${result.exitCode}`).slice(0, 1000));
  }
  item.updatedAt = new Date().toISOString();
  return result as JsonObject;
}

async function acquireTaskLock(root: string, collection: string): Promise<{ ok: boolean; file: string; message: string }> {
  const file = path.join(stateDir(root), `${collection}.lock`);
  await ensureDir(path.dirname(file));
  try {
    const handle = await fs.open(file, 'wx');
    await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    await handle.close();
    return { ok: true, file, message: 'lock acquired' };
  } catch {
    return { ok: false, file, message: `Worker lock is active for ${collection}. Use logs/status or remove stale lock only after verifying no worker is running.` };
  }
}

async function releaseTaskLock(file: string): Promise<void> {
  await fs.rm(file, { force: true });
}

async function appendTaskLog(root: string, collection: string, item: JsonObject, event: string, message: string): Promise<void> {
  await appendJsonArray(path.join(stateDir(root), 'logs', `${collection}.json`), {
    id: idWithTime(`${collection}-log`),
    taskId: item.id,
    event,
    status: item.status || 'unknown',
    message: redactCommand(message),
    attempts: item.attempts || 0,
    createdAt: new Date().toISOString(),
  });
}

async function readTaskLogs(root: string, collection: string, id: string): Promise<JsonObject[]> {
  const logs = await readArray(path.join(stateDir(root), 'logs', `${collection}.json`));
  return logs.map((entry) => entry as JsonObject).filter((entry) => !id || String(entry.taskId) === id);
}

function formatTaskLogLine(entry: JsonObject): string {
  return `- ${String(entry.createdAt)} | ${String(entry.taskId)} | ${String(entry.event)} | ${String(entry.status)} | ${String(entry.message)}`;
}

function buildTaskGraph(items: unknown[]): { nodes: JsonObject[]; edges: Array<{ from: string; to: string }> } {
  const nodes = items.map((item) => sanitizeTaskRecord(item));
  const edges: Array<{ from: string; to: string }> = [];
  for (const item of items.map((entry) => entry as JsonObject)) {
    const deps = Array.isArray(item.dependsOn) ? item.dependsOn.map(String) : [];
    for (const dep of deps) edges.push({ from: dep, to: String(item.id) });
  }
  return { nodes, edges };
}

function formatTaskRow(item: unknown): string {
  const task = item as JsonObject;
  const target = task.taskPlane ? ' -> task-plane' : '';
  return `- ${String(task.id)} | ${String(task.status || 'queued')} | attempts ${String(task.attempts || 0)} | ${String(task.label || 'task')}${target}`;
}

function taskDetailLines(item: JsonObject): string[] {
  return [
    `id: ${String(item.id)}`,
    `label: ${String(item.label || '')}`,
    `status: ${String(item.status || 'queued')}`,
    `attempts: ${String(item.attempts || 0)}/${String(item.maxRetries || 0)}`,
    `dependsOn: ${Array.isArray(item.dependsOn) ? item.dependsOn.join(', ') || 'none' : 'none'}`,
    `nextRunAt: ${String(item.nextRunAt || 'now')}`,
    `target: ${item.taskPlane ? 'task-plane' : 'direct-runner'}`,
    item.lastMaterializedTaskId ? `lastTaskPlaneItem: ${String(item.lastMaterializedTaskId)}` : '',
    `command: ${redactCommand(String(item.command || '')) || 'not set'}`,
  ].filter(Boolean);
}

function sanitizeTaskRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.command) item.command = redactCommand(String(item.command));
  if (item.lastRun && typeof item.lastRun === 'object') {
    const run = { ...(item.lastRun as JsonObject) };
    if (run.output) run.output = String(run.output).slice(0, 500);
    item.lastRun = run;
  }
  return item;
}

async function runDocs(root: string, args: string[]) {
  const action = firstArg(args, 'search');
  const query = (action === 'search' ? args.slice(1) : args).filter((arg) => !arg.startsWith('--')).join(' ').toLowerCase();
  const docsDir = path.join(root, 'docs');
  if (action === 'live') {
    const url = readFlag(args, 'url') || process.env.ZAVORTH_DOCS_INDEX_URL || '';
    if (!url) return render(args, 'Zavorth docs', ['No live docs URL configured. Use --url <https://...>.'], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth docs', ['Live docs search preview. Add --yes to fetch remote docs index.', `URL: ${redactUrl(url)}`], { dryRun: true, url: redactUrl(url) });
    const live = await fetchDocsIndex(url, readFlag(args, 'q') || query);
    return render(args, 'Zavorth docs live', live.lines, live.payload);
  }
  if (action === 'index') {
    const index = await buildDocsIndex(root);
    const output = readFlag(args, 'output') || path.join(stateDir(root), 'docs-index.json');
    await writeJson(output, index);
    return render(args, 'Zavorth docs', [`Indexed docs: ${index.files.length}`, `Output: ${output}`], index);
  }
  const files = await walkFiles(docsDir, 120);
  const matches = await searchDocsFiles(root, files, query);
  if (action === 'open' || action === 'show') {
    const selected = matches[0];
    if (!selected) return render(args, 'Zavorth docs', ['No docs matched.'], { query, matches: [] });
    const content = await fs.readFile(selected.file, 'utf8');
    return render(args, 'Zavorth docs', [`File: ${path.relative(root, selected.file)}`, '', content.slice(0, 4000)], { file: path.relative(root, selected.file) });
  }
  return render(args, 'Zavorth docs', matches.length ? matches.slice(0, 20).map((match) => [
    `- ${path.relative(root, match.file)} (${match.score})`,
    ...match.excerpts.map((line) => `  ${line}`),
  ].join('\n')) : ['No docs matched.'], { query, matches: matches.map((match) => ({ ...match, file: path.relative(root, match.file) })) });
}

async function buildDocsIndex(root: string): Promise<{ generatedAt: string; files: Array<{ file: string; title: string; sha256: string }> }> {
  const docsDir = path.join(root, 'docs');
  const files = await walkFiles(docsDir, 1000);
  const indexed = await Promise.all(files.map(async (file) => {
    const content = await fs.readFile(file);
    const text = content.toString('utf8');
    const title = text.match(/^#\s+(.+)$/mu)?.[1] || path.basename(file);
    return { file: path.relative(root, file), title, sha256: sha256(content) };
  }));
  return { generatedAt: new Date().toISOString(), files: indexed };
}

async function searchDocsFiles(root: string, files: string[], query: string): Promise<Array<{ file: string; score: number; excerpts: string[] }>> {
  const terms = query.split(/\s+/u).filter(Boolean);
  const results: Array<{ file: string; score: number; excerpts: string[] }> = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    const content = await fs.readFile(file, 'utf8').catch(() => '');
    const haystack = `${rel}\n${content}`.toLowerCase();
    const score = terms.length ? terms.reduce((sum, term) => sum + countOccurrences(haystack, term), 0) : (rel.toLowerCase().includes('readme') ? 2 : 1);
    if (score <= 0) continue;
    const lines = content.split(/\r?\n/u);
    const excerpts = terms.length
      ? lines.filter((line) => terms.some((term) => line.toLowerCase().includes(term))).slice(0, 3)
      : lines.filter((line) => line.trim()).slice(0, 2);
    results.push({ file, score, excerpts });
  }
  return results.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
}

async function fetchDocsIndex(url: string, query: string): Promise<{ lines: string[]; payload: JsonObject }> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { lines: [`Live docs fetch failed: HTTP ${response.status}`], payload: { ok: false, status: response.status } };
    const text = await response.text();
    const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
    const lines = text.split(/\r?\n/u);
    const matches = terms.length ? lines.filter((line) => terms.some((term) => line.toLowerCase().includes(term))).slice(0, 12) : lines.slice(0, 12);
    return { lines: matches.length ? matches : ['Live docs fetched, no matching lines.'], payload: { ok: true, url: redactUrl(url), matches } };
  } catch (error) {
    return { lines: [`Live docs fetch failed: ${error instanceof Error ? error.message : String(error)}`], payload: { ok: false } };
  }
}

function countOccurrences(value: string, term: string): number {
  if (!term) return 0;
  return value.split(term).length - 1;
}

async function runExecPolicy(root: string, args: string[]) {
  const file = path.join(stateDir(root), 'exec-policy.json');
  const policy = await readJson(file, { shell: 'approval-required', writes: 'approval-required', network: 'approval-required' });
  return render(args, 'Zavorth exec-policy', Object.entries(policy as JsonObject).map(([key, value]) => `${key}: ${safeString(value)}`), { policy });
}

async function runHealth(root: string, args: string[]) {
  const checks = {
    config: existsSync(path.join(stateDir(root), 'cli-config.json')),
    package: existsSync(path.join(root, 'package.json')),
    nodeModules: existsSync(path.join(root, 'node_modules')),
    receipts: existsSync(path.join(stateDir(root), 'receipts')),
  };
  return render(args, 'Zavorth health', Object.entries(checks).map(([key, value]) => `${key}: ${value ? 'ready' : 'missing'}`), checks);
}

async function runHooks(root: string, args: string[]) {
  const dir = path.join(stateDir(root), 'hooks');
  await ensureDir(dir);
  const files = await listJsonFiles(dir);
  return render(args, 'Zavorth hooks', files.length ? files.map((file) => `- ${file}`) : ['No hooks configured yet.'], { hooks: files });
}

async function runInfer(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  const prompt = readFlag(args, 'prompt') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
  if (action === 'status') {
    const providers = ['openai', 'openrouter', 'groq', 'deepseek', 'gemini', 'ollama'];
    const readiness = providers.map((provider) => `${provider}: ${isProviderConfigured(provider) ? 'configured' : 'missing'}`);
    return render(args, 'Zavorth infer', readiness, { providers: Object.fromEntries(providers.map((provider) => [provider, isProviderConfigured(provider)])) });
  }
  if (args.includes('--live') || args.includes('--yes')) {
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth infer', ['Live provider call requires --yes.'], { ok: false });
    }
    const provider = (readFlag(args, 'provider') || process.env.LLM_PROVIDER || 'openai').toLowerCase();
    const result = await inferText(provider, prompt || action, args);
    const record = { id: idWithTime('infer'), action, provider, prompt: redact(prompt || action), result, createdAt: new Date().toISOString(), status: result.ok ? 'completed' : 'failed' };
    const file = path.join(stateDir(root), 'infer-drafts.json');
    const drafts = await readArray(file);
    drafts.push(record);
    await writeJson(file, drafts);
    return render(args, 'Zavorth infer', [
      `Provider: ${provider}`,
      `Status: ${record.status}`,
      result.text ? `Text: ${String(result.text).slice(0, 1200)}` : `Reason: ${String(result.reason || 'unknown')}`,
    ], record);
  }
  const draft = { id: idWithTime('infer'), action, prompt: args.slice(1).join(' '), createdAt: new Date().toISOString(), status: 'draft' };
  const file = path.join(stateDir(root), 'infer-drafts.json');
  const drafts = await readArray(file);
  drafts.push(draft);
  await writeJson(file, drafts);
  return render(args, 'Zavorth infer', [`Drafted governed ${action} ability request.`, 'Configure provider credentials before live execution.'], { draft });
}

async function runLogs(root: string, args: string[]) {
  const candidates = [path.join(stateDir(root), 'logs'), path.join(root, 'logs')];
  const files = (await Promise.all(candidates.map((dir) => listAnyFiles(dir)))).flat().slice(0, 20);
  return render(args, 'Zavorth logs', files.length ? files.map((file) => `- ${path.relative(root, file)}`) : ['No log files found.'], { logs: files.map((file) => path.relative(root, file)) });
}

async function runMcp(root: string, args: string[]) {
  const file = path.join(stateDir(root), 'mcp.json');
  const action = firstArg(args, 'list');
  const servers = await readArray(file);
  if (action === 'add') {
    const name = args[1];
    const command = args.slice(2).join(' ');
    if (!name || !command) return render(args, 'Zavorth mcp', ['Usage: zavorth mcp add <name> <command>'], { ok: false });
    servers.push({
      id: name,
      command,
      status: 'configured',
      allowTools: splitList(readFlag(args, 'allow-tools') || ''),
      allowResources: splitList(readFlag(args, 'allow-resources') || ''),
      channelBridge: readFlag(args, 'channel') || null,
      createdAt: new Date().toISOString(),
    });
    await writeJson(file, servers);
    return render(args, 'Zavorth mcp', [`Added MCP server: ${name}`], { servers });
  }
  if (action === 'allowlist') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findById(servers, id);
    if (!selected) return render(args, 'Zavorth mcp', [`No MCP server found for id: ${id || '<missing>'}`], { ok: false });
    selected.allowTools = splitList(readFlag(args, 'tools') || readFlag(args, 'allow-tools') || String((selected.allowTools as string[] | undefined)?.join(',') || ''));
    selected.allowResources = splitList(readFlag(args, 'resources') || readFlag(args, 'allow-resources') || String((selected.allowResources as string[] | undefined)?.join(',') || ''));
    selected.updatedAt = new Date().toISOString();
    await writeJson(file, servers);
    await writeMcpRuntimeState(root, servers);
    return render(args, 'Zavorth mcp allowlist', [
      `Updated allowlist: ${String(selected.id)}`,
      `tools: ${((selected.allowTools as string[]) || []).join(', ') || 'none'}`,
      `resources: ${((selected.allowResources as string[]) || []).join(', ') || 'none'}`,
    ], { server: sanitizeMcpServer(selected) });
  }
  if (action === 'bridge') {
    const id = args[1] || readFlag(args, 'id') || '';
    const channel = readFlag(args, 'channel') || args[2] || '';
    const selected = findById(servers, id);
    if (!selected) return render(args, 'Zavorth mcp', [`No MCP server found for id: ${id || '<missing>'}`], { ok: false });
    selected.channelBridge = channel || null;
    selected.updatedAt = new Date().toISOString();
    await writeJson(file, servers);
    await writeMcpRuntimeState(root, servers);
    return render(args, 'Zavorth mcp bridge', [`Bridge ${channel ? 'set' : 'cleared'} for ${id}`], { server: sanitizeMcpServer(selected) });
  }
  if (action === 'tools' || action === 'resources' || action === 'handshake' || action === 'doctor' || action === 'run') {
    const id = args[1];
    const selected = id
      ? servers.find((server) => String((server as JsonObject).id) === id) as JsonObject | undefined
      : servers[0] as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth mcp', ['No MCP server configured. Run: zavorth mcp add <name> <command>'], { ok: false });
    if (action === 'doctor' && !args.includes('--run') && !args.includes('--yes')) {
      return render(args, 'Zavorth mcp', [
        `Configured: ${String(selected.id)}`,
        `Command: ${String(selected.command || '')}`,
        'Dry run only. Add --run --yes to execute a short live probe.',
      ], { ok: true, dryRun: true, selected });
    }
    if (!args.includes('--yes')) return render(args, 'Zavorth mcp', ['Live MCP probe/run requires --yes.'], { ok: false });
    const snapshot = await probeMcpServer(root, selected, action, args);
    selected.status = snapshot.ok ? 'available' : 'degraded';
    selected.lastHealthAt = new Date().toISOString();
    selected.lastSnapshot = snapshot;
    await writeJson(file, servers);
    await writeMcpRuntimeState(root, servers);
    await appendJsonArray(path.join(stateDir(root), 'logs', 'mcp.json'), { id: idWithTime('mcp-log'), serverId: selected.id, action, snapshot, createdAt: new Date().toISOString() });
    return render(args, 'Zavorth mcp', renderMcpSnapshotLines(snapshot), { server: sanitizeMcpServer(selected), snapshot });
  }
  if (action === 'reload') {
    await writeMcpRuntimeState(root, servers);
    return render(args, 'Zavorth mcp reload', [`Reloaded runtime MCP state for ${servers.length} server(s).`], { servers: servers.map(sanitizeMcpServer) });
  }
  if (action === 'logs') {
    const logs = await readArray(path.join(stateDir(root), 'logs', 'mcp.json'));
    return render(args, 'Zavorth mcp logs', logs.length ? logs.slice(-20).map((entry) => `- ${String((entry as JsonObject).createdAt)} | ${String((entry as JsonObject).serverId)} | ${String((entry as JsonObject).action)}`) : ['No MCP logs recorded yet.'], { logs });
  }
  if (action === 'health') {
    const runtime = await readJson(path.join(stateDir(root), 'mcp-runtime.json'), { servers: [] }) as JsonObject;
    const runtimeServers = Array.isArray(runtime.servers) ? runtime.servers : [];
    return render(args, 'Zavorth mcp health', runtimeServers.length ? runtimeServers.map((server) => `- ${String((server as JsonObject).id)} | ${String((server as JsonObject).status)} | tools ${String((server as JsonObject).toolsCount || 0)} | resources ${String((server as JsonObject).resourcesCount || 0)}`) : ['No MCP runtime health yet. Run: zavorth mcp doctor <id> --run --yes'], { runtime });
  }
  return render(args, 'Zavorth mcp', servers.length ? servers.map((server) => `- ${String((server as JsonObject).id)} | ${String((server as JsonObject).status || 'configured')}`) : ['No MCP servers configured yet.'], { servers });
}

async function probeMcpServer(root: string, server: JsonObject, action: string, args: string[]): Promise<JsonObject> {
  const command = String(server.command || '');
  const methods = ['initialize'];
  if (action === 'tools' || action === 'doctor' || action === 'run') methods.push('tools/list');
  if (action === 'resources' || action === 'doctor' || action === 'run') methods.push('resources/list');
  const result = await runMcpJsonRpcSequence(command, methods, root, readNumberFlag(args, 'timeout-ms') || 5000);
  const tools = filterMcpTools(extractMcpTools(result.responses), (server.allowTools as string[] | undefined) || []);
  const resources = filterMcpResources(extractMcpResources(result.responses), (server.allowResources as string[] | undefined) || []);
  return {
    ok: result.ok,
    serverId: server.id,
    command: redactCommand(command),
    initialized: Boolean(result.responses.find((response) => Number((response as JsonObject).id) === 1 && !(response as JsonObject).error)),
    tools,
    resources,
    toolsCount: tools.length,
    resourcesCount: resources.length,
    allowTools: server.allowTools || [],
    allowResources: server.allowResources || [],
    channelBridge: server.channelBridge || null,
    durationMs: result.durationMs,
    error: result.error || null,
  };
}

async function runMcpJsonRpcSequence(command: string, methods: string[], cwd: string, timeoutMs: number): Promise<{ ok: boolean; responses: JsonObject[]; durationMs: number; error?: string }> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, [], { cwd, shell: true, windowsHide: true, stdio: 'pipe' });
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr = '';
    const responses: JsonObject[] = [];
    let nextId = 1;
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, responses, durationMs: Date.now() - startedAt, error: 'mcp-timeout' });
    }, timeoutMs);
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.stdout.on('data', (chunk) => {
      stdout = Buffer.concat([stdout, Buffer.from(chunk)]);
      const parsed = parseMcpFrames(stdout);
      stdout = parsed.remaining;
      responses.push(...parsed.messages);
      if (responses.length >= methods.length) {
        clearTimeout(timer);
        child.kill();
        resolve({ ok: responses.every((response) => !(response as JsonObject).error), responses, durationMs: Date.now() - startedAt });
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, responses, durationMs: Date.now() - startedAt, error: error.message });
    });
    child.on('exit', () => {
      clearTimeout(timer);
      resolve({ ok: responses.length > 0 && responses.every((response) => !(response as JsonObject).error), responses, durationMs: Date.now() - startedAt, error: responses.length ? undefined : stderr.slice(0, 500) || 'mcp-process-exited-without-response' });
    });
    for (const method of methods) {
      const payload = method === 'initialize'
        ? { jsonrpc: '2.0', id: nextId, method, params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'zavorth-cli', version: '1' } } }
        : { jsonrpc: '2.0', id: nextId, method, params: {} };
      nextId += 1;
      child.stdin.write(encodeMcpFrame(payload));
    }
  });
}

function encodeMcpFrame(payload: JsonObject): string {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function parseMcpFrames(buffer: Buffer<ArrayBufferLike>): { messages: JsonObject[]; remaining: Buffer<ArrayBufferLike> } {
  const messages: JsonObject[] = [];
  let remaining = buffer;
  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf('\r\n\r\n');
    if (headerEnd < 0) break;
    const header = remaining.slice(0, headerEnd).toString('utf8');
    const match = header.match(/content-length:\s*(\d+)/iu);
    if (!match) break;
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (remaining.length < bodyEnd) break;
    const body = remaining.slice(bodyStart, bodyEnd).toString('utf8');
    try {
      messages.push(JSON.parse(body));
    } catch {
      messages.push({ error: { message: 'invalid-json-rpc-response' } });
    }
    remaining = remaining.slice(bodyEnd);
  }
  return { messages, remaining };
}

function extractMcpTools(responses: JsonObject[]): JsonObject[] {
  const found = responses.find((response) => {
    const result = (response.result || {}) as JsonObject;
    return Array.isArray(result.tools);
  });
  const result = (found?.result || {}) as JsonObject;
  return Array.isArray(result.tools) ? result.tools as JsonObject[] : [];
}

function extractMcpResources(responses: JsonObject[]): JsonObject[] {
  const found = responses.find((response) => {
    const result = (response.result || {}) as JsonObject;
    return Array.isArray(result.resources);
  });
  const result = (found?.result || {}) as JsonObject;
  return Array.isArray(result.resources) ? result.resources as JsonObject[] : [];
}

function filterMcpTools(tools: JsonObject[], allowlist: string[]): JsonObject[] {
  if (!allowlist.length) return tools;
  const allowed = new Set(allowlist.map((entry) => entry.toLowerCase()));
  return tools.filter((tool) => allowed.has(String(tool.name || '').toLowerCase()));
}

function filterMcpResources(resources: JsonObject[], allowlist: string[]): JsonObject[] {
  if (!allowlist.length) return resources;
  const allowed = new Set(allowlist.map((entry) => entry.toLowerCase()));
  return resources.filter((resource) => allowed.has(String(resource.uri || resource.name || '').toLowerCase()));
}

function renderMcpSnapshotLines(snapshot: JsonObject): string[] {
  return [
    `Handshake: ${snapshot.initialized ? 'passed' : 'failed'}`,
    `Tools: ${String(snapshot.toolsCount || 0)}`,
    `Resources: ${String(snapshot.resourcesCount || 0)}`,
    `Duration: ${String(snapshot.durationMs || 0)}ms`,
    snapshot.error ? `Error: ${String(snapshot.error)}` : 'Health snapshot recorded.',
  ];
}

async function writeMcpRuntimeState(root: string, servers: unknown[]): Promise<void> {
  const runtime = {
    version: 1,
    updatedAt: new Date().toISOString(),
    servers: servers.map((server) => {
      const item = server as JsonObject;
      const snapshot = (item.lastSnapshot || {}) as JsonObject;
      return {
        id: item.id,
        status: item.status || 'configured',
        command: redactCommand(String(item.command || '')),
        allowTools: item.allowTools || [],
        allowResources: item.allowResources || [],
        channelBridge: item.channelBridge || null,
        toolsCount: snapshot.toolsCount || 0,
        resourcesCount: snapshot.resourcesCount || 0,
        lastHealthAt: item.lastHealthAt || null,
      };
    }),
  };
  await writeJson(path.join(stateDir(root), 'mcp-runtime.json'), runtime);
}

function sanitizeMcpServer(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.command) item.command = redactCommand(String(item.command));
  return item;
}

function redactCommand(command: string): string {
  return command.replace(/(token|key|secret|password)=("[^"]+"|'[^']+'|\S+)/giu, '$1=***');
}

function findById(items: unknown[], id: string): JsonObject | undefined {
  return items.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
}

async function runMessage(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  if (action === 'status') {
    const statuses = CHANNEL_ADAPTERS.map((adapter) => channelStatus(adapter.id));
    const readiness = statuses.map((status) => {
      const suffix = status.configured ? status.mode : `missing (${status.required.join(' or ')})`;
      return `${status.id}: ${suffix}`;
    });
    return render(args, 'Zavorth message', readiness, { channels: Object.fromEntries(statuses.map((status) => [status.id, status])) });
  }
  const file = path.join(stateDir(root), 'messages.json');
  const messages = await readArray(file);
  if (action === 'retry') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = messages.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth message', [`No message found for retry id: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--deliver') && !args.includes('--yes')) {
      return render(args, 'Zavorth message', [`Retry preview: ${id}`, 'Add --deliver --yes to retry delivery.'], { dryRun: true, message: sanitizeMessageRecord(selected) });
    }
    const retryArgs = [
      'send',
      '--channel', String(selected.channel || ''),
      '--target', String(selected.target || ''),
      '--message', String(selected.message || ''),
      '--deliver',
      '--yes',
      ...((selected.threadId ? ['--thread', String(selected.threadId)] : [])),
      ...((selected.replyTo ? ['--reply-to', String(selected.replyTo)] : [])),
    ];
    const retry = await deliverMessageAdvanced(root, retryArgs, {
      channel: String(selected.channel || ''),
      targets: splitList(String(selected.target || '')),
      message: String(selected.message || ''),
      attachments: (selected.attachments as string[] | undefined) || [],
      threadId: String(selected.threadId || ''),
      replyTo: String(selected.replyTo || ''),
      reaction: String(selected.reaction || ''),
      mentions: splitList(String(selected.mentions || '')),
    });
    selected.status = retry.ok ? 'delivered' : 'delivery-failed';
    selected.retryCount = Number(selected.retryCount || 0) + 1;
    selected.lastRetryAt = new Date().toISOString();
    selected.delivery = retry;
    await writeJson(file, messages);
    return render(args, 'Zavorth message', [`Retry ${selected.status}: ${id}`], { message: sanitizeMessageRecord(selected), retry });
  }
  if (action === 'receipts' || action === 'receipt') {
    const id = args[1] || readFlag(args, 'id') || '';
    const receipts = await readArray(path.join(stateDir(root), 'receipts', 'messages.json'));
    const selected = id ? receipts.filter((entry) => String((entry as JsonObject).messageId) === id || String((entry as JsonObject).id) === id) : receipts;
    return render(args, 'Zavorth message evidence', selected.length ? selected.slice(-20).map(formatMessageReceipt) : ['No message evidence recorded yet.'], { receipts: selected });
  }
  if (action === 'manage') {
    const pending = messages.filter((entry) => ['delivery-failed', 'draft', 'delivery-requested'].includes(String((entry as JsonObject).status)));
    return render(args, 'Zavorth message manage', pending.length ? pending.map((entry) => {
      const item = entry as JsonObject;
      return `- ${String(item.id)} | ${String(item.channel)} | ${String(item.status)} | retries ${String(item.retryCount || 0)}`;
    }) : ['No message drafts or failed deliveries need attention.'], { messages: pending.map(sanitizeMessageRecord) });
  }
  if (action === 'list' || action === 'read') {
    if (action === 'read' && args.includes('--live')) {
      if (!args.includes('--yes')) return render(args, 'Zavorth message', ['Live read requires --yes.'], { ok: false });
      const channel = readFlag(args, 'channel') || 'telegram';
      const result = await readChannelMessages(channel, args);
      return render(args, 'Zavorth message', result.lines, result.payload);
    }
    if (action === 'read') {
      const id = args[1];
      const message = messages.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
      if (!message) return render(args, 'Zavorth message', [`No message found for id: ${id || '<missing>'}`], { ok: false });
      return render(args, 'Zavorth message', [
        `id: ${String(message.id)}`,
        `channel: ${String(message.channel)}`,
        `target: ${String(message.target)}`,
        `status: ${String(message.status)}`,
        `message: ${redact(String(message.message || ''))}`,
      ], { message: { ...message, message: redact(String(message.message || '')) } });
    }
    return render(args, 'Zavorth message', messages.length ? messages.map((message) => `- ${String((message as JsonObject).id)} | ${String((message as JsonObject).channel)} | ${String((message as JsonObject).status)}`) : ['No message drafts recorded yet.'], { messages: messages.map(sanitizeMessageRecord) });
  }
  const compose = parseMessageCompose(args);
  const draft = {
    id: idWithTime('message'),
    channel: compose.channel,
    target: compose.targets.join(','),
    message: compose.message,
    attachments: compose.attachments,
    threadId: compose.threadId || null,
    replyTo: compose.replyTo || null,
    reaction: compose.reaction || null,
    mentions: compose.mentions,
    status: args.includes('--deliver') ? 'delivery-requested' : 'draft',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  if (args.includes('--deliver')) {
    const delivery = await deliverMessageAdvanced(root, args, compose);
    draft.status = delivery.ok ? 'delivered' : 'delivery-failed';
    (draft as JsonObject).delivery = delivery;
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'messages.json'), {
      id: idWithTime('message-receipt'),
      messageId: draft.id,
      channel: compose.channel,
      targets: compose.targets,
      status: draft.status,
      delivery,
      createdAt: new Date().toISOString(),
    });
  }
  messages.push(draft);
  await writeJson(file, messages);
  return render(args, 'Zavorth message', [`Created ${draft.status}: ${draft.id}`, 'No secret or message body was printed in full.'], { draft: sanitizeMessageRecord(draft) });
}

async function runPlugins(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const pkg = await readJson(path.join(root, 'package.json'), {}) as JsonObject;
  const deps = Object.keys({ ...((pkg.dependencies as JsonObject) || {}), ...((pkg.devDependencies as JsonObject) || {}) });
  const pluginFile = path.join(stateDir(root), 'plugins.json');
  const local = await readArray(pluginFile);
  const runtimeFile = path.join(stateDir(root), 'plugins-runtime.json');
  if (action === 'scaffold' || action === 'create') {
    const id = idFromSpec(args[1] || readFlag(args, 'id') || 'zavorth-plugin');
    const targetDir = path.resolve(root, readFlag(args, 'dir') || id);
    if (!isInside(root, targetDir)) {
      return render(args, 'Zavorth plugin scaffold', ['Refusing to scaffold outside the workspace.'], { ok: false });
    }
    const preview = [
      `Plugin id: ${id}`,
      `Target: ${targetDir}`,
      'Files: zavorth.plugin.json, index.js, README.md, package.json',
      'Add --yes to create this governed plugin scaffold.',
    ];
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth plugin scaffold', preview, { dryRun: true, id, targetDir });
    }
    const created = await scaffoldPlugin(root, targetDir, id);
    return render(args, 'Zavorth plugin scaffold', [
      `Created plugin scaffold: ${id}`,
      `Target: ${targetDir}`,
      'Next: zavorth plugins install ./<plugin> --yes',
    ], { plugin: created });
  }
  if (action === 'install') {
    const spec = args[1];
    if (!spec) return render(args, 'Zavorth plugins', ['Usage: zavorth plugins install <package-or-path> [--yes]'], { ok: false });
    const manifest = await resolvePluginManifest(root, spec, args);
    const checksum = await calculatePluginChecksum(root, spec);
    const expectedChecksum = readFlag(args, 'checksum') || '';
    if (expectedChecksum && checksum && expectedChecksum !== checksum) {
      return render(args, 'Zavorth plugins', ['Checksum mismatch. Plugin was not installed.'], { ok: false, expectedChecksum, actualChecksum: checksum });
    }
    const record = buildPluginRecord(spec, manifest, checksum, args);
    if (!args.includes('--yes')) {
      const permissions = (record.permissions as string[]) || [];
      return render(args, 'Zavorth plugins', [
        `Preview install: ${spec}`,
        `Manifest: ${manifest.found ? 'found' : 'fallback'}`,
        `Permissions: ${permissions.join(', ') || 'none'}`,
        `Checksum: ${checksum || 'pending-after-install'}`,
        'Add --yes to install/register this plugin.',
      ], { record: sanitizePluginRecord(record), manifest });
    }
    const install = isLocalPluginSpec(root, spec)
      ? { exitCode: 0, output: 'local plugin registered without npm install', durationMs: 0, timedOut: false }
      : await runProcess(resolveNpmCommand(), ['install', spec, '--save'], root, 120000);
    record.status = install.exitCode === 0 ? 'installed' : 'install-failed';
    record.installedAt = new Date().toISOString();
    record.exitCode = install.exitCode;
    local.push(record);
    await writeJson(pluginFile, local);
    return render(args, 'Zavorth plugins', [`Install ${record.status}: ${spec}`, install.output.slice(0, 800)], { record: sanitizePluginRecord(record), install });
  }
  if (action === 'manifest') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugins', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    return render(args, 'Zavorth plugin manifest', [
      `id: ${String(selected.id)}`,
      `name: ${String(selected.name || selected.spec)}`,
      `version: ${String(selected.version || 'unknown')}`,
      `permissions: ${((selected.permissions as string[]) || []).join(', ') || 'none'}`,
      `checksum: ${String(selected.checksum || 'none')}`,
    ], { plugin: sanitizePluginRecord(selected) });
  }
  if (action === 'doctor') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    const checks = selected ? await doctorPlugin(root, selected) : [];
    return render(args, 'Zavorth plugin doctor', selected ? checks.map((check) => `${check.ok ? 'ok' : 'fail'} ${check.id}: ${check.summary}`) : [`Plugin not found: ${id || '<missing>'}`], { ok: selected ? checks.every((check) => check.ok) : false, checks });
  }
  if (action === 'marketplace' || action === 'search') {
    const query = args[1] || readFlag(args, 'query') || '';
    const marketplace = await loadPluginMarketplace(root);
    const matches = query
      ? marketplace.filter((entry) => JSON.stringify(entry).toLowerCase().includes(query.toLowerCase()))
      : marketplace;
    return render(args, 'Zavorth plugin marketplace', matches.length ? matches.slice(0, 20).map((entry) => `- ${String(entry.id)} | ${String(entry.name)} | ${String(entry.summary || '')}`) : ['No marketplace plugins matched.'], { plugins: matches });
  }
  if (action === 'permissions') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugin permissions', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    return render(args, 'Zavorth plugin permissions', pluginPermissionLines(selected), { plugin: sanitizePluginRecord(selected) });
  }
  if (action === 'hooks') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugin hooks', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    const hooks = (selected.hooks || {}) as JsonObject;
    return render(args, 'Zavorth plugin hooks', Object.keys(hooks).length ? Object.entries(hooks).map(([name, command]) => `${name}: ${String(command)}`) : ['No lifecycle hooks declared.'], { hooks });
  }
  if (action === 'run-hook') {
    const id = args[1] || readFlag(args, 'id') || '';
    const hook = args[2] || readFlag(args, 'hook') || '';
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugin hook', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    const command = String(((selected.hooks || {}) as JsonObject)[hook] || '');
    if (!command) return render(args, 'Zavorth plugin hook', [`Hook not found: ${hook || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth plugin hook', [`Hook preview: ${hook}`, `Command: ${command}`, 'Add --yes to run this hook in the plugin sandbox.'], { dryRun: true, plugin: sanitizePluginRecord(selected), hook, command });
    const result = await runPluginHook(root, selected, command);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'plugins.json'), { id: idWithTime('plugin-receipt'), pluginId: selected.id, hook, status: result.exitCode === 0 ? 'completed' : 'failed', createdAt: new Date().toISOString(), durationMs: result.durationMs });
    return render(args, 'Zavorth plugin hook', [`Hook ${result.exitCode === 0 ? 'completed' : 'failed'}: ${hook}`, result.output.slice(0, 800)], { result });
  }
  if (['enable', 'disable'].includes(action)) {
    const id = args[1];
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugins', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    if (action === 'enable' && !args.includes('--yes')) {
      return render(args, 'Zavorth plugins', [
        `Enable preview: ${id}`,
        ...pluginPermissionLines(selected),
        'Add --yes to enable this plugin in runtime state.',
      ], { dryRun: true, plugin: sanitizePluginRecord(selected) });
    }
    selected.enabled = action === 'enable';
    selected.updatedAt = new Date().toISOString();
    await writeJson(pluginFile, local);
    await writePluginRuntimeState(runtimeFile, local);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'plugins.json'), { id: idWithTime('plugin-receipt'), pluginId: selected.id, action, createdAt: new Date().toISOString() });
    return render(args, 'Zavorth plugins', [`${action === 'enable' ? 'Enabled' : 'Disabled'}: ${id}`], { plugin: sanitizePluginRecord(selected) });
  }
  return render(args, 'Zavorth plugins', [
    `package dependencies: ${deps.length}`,
    `local plugin records: ${local.length}`,
    ...local.slice(0, 10).map((item) => `- ${String((item as JsonObject).id || (item as JsonObject).name)} | ${String((item as JsonObject).status || 'registered')} | ${Boolean((item as JsonObject).enabled) ? 'enabled' : 'disabled'}`),
  ], { dependencies: deps.length, plugins: local.map(sanitizePluginRecord) });
}

async function resolvePluginManifest(root: string, spec: string, args: string[]): Promise<JsonObject> {
  const manifestPath = readFlag(args, 'manifest') || (isLocalPluginSpec(root, spec) ? path.join(resolvePluginPath(root, spec), 'zavorth.plugin.json') : '');
  if (manifestPath && existsSync(manifestPath)) {
    const raw = await readJson(manifestPath, {}) as JsonObject;
    return {
      found: true,
      path: manifestPath,
      name: raw.name || raw.id || idFromSpec(spec),
      version: raw.version || '0.0.0',
      entry: raw.entry || raw.main || null,
      permissions: normalizePermissions(raw.permissions),
      hooks: raw.hooks && typeof raw.hooks === 'object' ? raw.hooks : {},
      sandbox: raw.sandbox && typeof raw.sandbox === 'object' ? raw.sandbox : pluginSandboxForPermissions(normalizePermissions(raw.permissions)),
      signature: raw.signature || null,
    };
  }
  return {
    found: false,
    name: idFromSpec(spec),
    version: '0.0.0',
    entry: null,
    permissions: normalizePermissions(readFlag(args, 'permissions') || ''),
    hooks: {},
    sandbox: pluginSandboxForPermissions(normalizePermissions(readFlag(args, 'permissions') || '')),
    signature: readFlag(args, 'signature') || null,
  };
}

async function calculatePluginChecksum(root: string, spec: string): Promise<string> {
  if (!isLocalPluginSpec(root, spec)) return '';
  const pluginPath = resolvePluginPath(root, spec);
  if (!existsSync(pluginPath)) return '';
  const files = (await walkFiles(pluginPath, 500))
    .filter((file) => !/[\\\/](node_modules|\.git)[\\\/]/u.test(file))
    .sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const relative = path.relative(pluginPath, file).replace(/\\/gu, '/');
    hash.update(relative);
    hash.update(await fs.readFile(file));
  }
  return hash.digest('hex');
}

function buildPluginRecord(spec: string, manifest: JsonObject, checksum: string, args: string[]): JsonObject {
  const permissions = normalizePermissions(readFlag(args, 'permissions') || manifest.permissions || '');
  const record = {
    id: idFromSpec(String(manifest.name || spec)),
    spec,
    name: String(manifest.name || idFromSpec(spec)),
    version: String(manifest.version || '0.0.0'),
    status: 'install-preview',
    enabled: false,
    manifestFound: Boolean(manifest.found),
    entry: manifest.entry || null,
    permissions,
    sandbox: manifest.sandbox || pluginSandboxForPermissions(permissions),
    hooks: manifest.hooks || {},
    checksum,
    signature: readFlag(args, 'signature') || manifest.signature || null,
    installedAt: null,
    createdAt: new Date().toISOString(),
  };
  return record;
}

function normalizePermissions(value: unknown): string[] {
  const source = Array.isArray(value) ? value : splitList(String(value || ''));
  return Array.from(new Set(source.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean))).sort();
}

function pluginSandboxForPermissions(permissions: string[]): JsonObject {
  return {
    network: permissions.some((permission) => /network|http|webhook|external/iu.test(permission)),
    workspaceRead: permissions.some((permission) => /read|workspace|file/iu.test(permission)),
    workspaceWrite: permissions.some((permission) => /write|mutate|delete/iu.test(permission)),
    shell: permissions.some((permission) => /shell|process|exec/iu.test(permission)),
    defaultMode: permissions.length === 0 ? 'metadata-only' : 'approval-required',
  };
}

function findPlugin(items: unknown[], id: string): JsonObject | undefined {
  return items.find((plugin) => {
    const item = plugin as JsonObject;
    return String(item.id) === id || String(item.spec) === id || String(item.name) === id;
  }) as JsonObject | undefined;
}

async function doctorPlugin(root: string, plugin: JsonObject): Promise<Array<{ id: string; ok: boolean; summary: string }>> {
  const checks: Array<{ id: string; ok: boolean; summary: string }> = [];
  checks.push({ id: 'manifest', ok: Boolean(plugin.manifestFound), summary: Boolean(plugin.manifestFound) ? 'Manifest is present.' : 'Plugin uses fallback manifest metadata.' });
  checks.push({ id: 'checksum', ok: Boolean(plugin.checksum), summary: plugin.checksum ? 'Checksum is recorded.' : 'Checksum is unavailable for remote package until install proof.' });
  checks.push({ id: 'permissions', ok: Array.isArray(plugin.permissions), summary: `${((plugin.permissions as string[]) || []).length} permission(s) declared.` });
  const entry = String(plugin.entry || '');
  if (entry && isLocalPluginSpec(root, String(plugin.spec || ''))) {
    const entryPath = path.join(resolvePluginPath(root, String(plugin.spec)), entry);
    checks.push({ id: 'entry', ok: existsSync(entryPath), summary: existsSync(entryPath) ? 'Entry file exists.' : `Entry file is missing: ${entry}` });
  } else {
    checks.push({ id: 'entry', ok: true, summary: entry ? 'Entry is declared.' : 'No entry declared; plugin is metadata/hooks only.' });
  }
  checks.push({ id: 'sandbox', ok: Boolean(plugin.sandbox), summary: `Sandbox mode: ${safeString(plugin.sandbox)}` });
  return checks;
}

async function loadPluginMarketplace(root: string): Promise<JsonObject[]> {
  const local = await readArray(path.join(stateDir(root), 'plugin-marketplace.json')) as JsonObject[];
  const bundled: JsonObject[] = [
    { id: 'zavorth-plugin-webhook-actions', name: 'Webhook Actions', summary: 'Governed webhook action bridge.', permissions: ['network:http'] },
    { id: 'zavorth-plugin-workspace-inspector', name: 'Workspace Inspector', summary: 'Read-only workspace analysis plugin.', permissions: ['workspace:read'] },
    { id: 'zavorth-plugin-channel-bridge', name: 'Channel Bridge', summary: 'Bridge external channel events into Action Cards.', permissions: ['network:http', 'message:send'] },
  ];
  return [...bundled, ...local];
}

async function scaffoldPlugin(root: string, targetDir: string, id: string): Promise<JsonObject> {
  await ensureDir(targetDir);
  const manifest = {
    id,
    name: id,
    version: '0.1.0',
    entry: 'index.js',
    permissions: ['workspace:read'],
    sandbox: {
      network: false,
      workspaceRead: true,
      workspaceWrite: false,
      shell: false,
      defaultMode: 'approval-required',
    },
    hooks: {
      doctor: 'node index.js doctor',
    },
  };
  const index = [
    '#!/usr/bin/env node',
    "const mode = process.argv[2] || 'doctor';",
    "const payload = { plugin: '" + id.replace(/'/gu, "\\'") + "', mode, ok: true, message: 'Zavorth plugin scaffold is reachable.' };",
    'process.stdout.write(JSON.stringify(payload, null, 2) + "\\n");',
    '',
  ].join('\n');
  const pkg = {
    name: id,
    version: '0.1.0',
    private: true,
    type: 'module',
    main: 'index.js',
    scripts: {
      doctor: 'node index.js doctor',
    },
  };
  const readme = [
    `# ${id}`,
    '',
    'Governed Zavorth plugin scaffold.',
    '',
    'Install locally:',
    '',
    '```bash',
    `zavorth plugins install ./${path.relative(root, targetDir).replace(/\\/gu, '/')} --yes`,
    `zavorth plugins doctor ${id}`,
    `zavorth plugins enable ${id} --yes`,
    '```',
    '',
    'Sensitive abilities remain behind policy, sandbox, approval and evidence.',
    '',
  ].join('\n');
  const files = [
    ['zavorth.plugin.json', `${JSON.stringify(manifest, null, 2)}\n`],
    ['index.js', index],
    ['package.json', `${JSON.stringify(pkg, null, 2)}\n`],
    ['README.md', readme],
  ] as const;
  for (const [file, content] of files) {
    const destination = path.join(targetDir, file);
    if (!isInside(root, destination)) continue;
    await fs.writeFile(destination, content, 'utf8');
  }
  return {
    id,
    targetDir,
    files: files.map(([file]) => path.relative(root, path.join(targetDir, file))),
    manifest,
    checksum: await calculatePluginChecksum(root, path.relative(root, targetDir)),
  };
}

function pluginPermissionLines(plugin: JsonObject): string[] {
  const permissions = ((plugin.permissions as string[]) || []);
  const sandbox = (plugin.sandbox || {}) as JsonObject;
  return [
    `Permissions: ${permissions.join(', ') || 'none'}`,
    `Sandbox: network=${String(sandbox.network ?? false)} write=${String(sandbox.workspaceWrite ?? false)} shell=${String(sandbox.shell ?? false)}`,
    'All sensitive plugin abilities remain policy/approval gated.',
  ];
}

async function runPluginHook(root: string, plugin: JsonObject, command: string): Promise<{ exitCode: number; output: string; durationMs: number; timedOut: boolean }> {
  const sandbox = (plugin.sandbox || {}) as JsonObject;
  if (sandbox.shell !== true && /(^|\s)(cmd|powershell|bash|sh|node|npm|pnpm|yarn)\b/iu.test(command)) {
    return { exitCode: 126, output: 'Plugin hook requested shell/process execution but manifest did not declare shell permission.', durationMs: 0, timedOut: false };
  }
  return runProcess(command, [], isLocalPluginSpec(root, String(plugin.spec || '')) ? resolvePluginPath(root, String(plugin.spec)) : root, 30000);
}

async function writePluginRuntimeState(file: string, plugins: unknown[]): Promise<void> {
  const enabled = plugins
    .map((plugin) => plugin as JsonObject)
    .filter((plugin) => plugin.enabled === true)
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      entry: plugin.entry || null,
      permissions: plugin.permissions || [],
      sandbox: plugin.sandbox || {},
      hooks: plugin.hooks || {},
      checksum: plugin.checksum || null,
    }));
  await writeJson(file, { version: 1, updatedAt: new Date().toISOString(), enabled });
}

function sanitizePluginRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.signature) item.signature = '***';
  return item;
}

function isLocalPluginSpec(root: string, spec: string): boolean {
  if (!spec) return false;
  return spec.startsWith('.') || spec.startsWith('/') || /^[a-zA-Z]:[\\/]/u.test(spec) || existsSync(path.resolve(root, spec));
}

function resolvePluginPath(root: string, spec: string): string {
  return path.resolve(root, spec);
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

async function runSkills(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  if (isSkillGovernanceAction(action, args)) {
    return runSkillsGovernance(root, args);
  }
  if (action === 'curator' || action === 'curate') {
    return runSkillsCurator(args);
  }
  if (action === 'quarantine') {
    const { SkillQuarantinePipelineService } = await import('../services/SkillQuarantinePipelineService.js');
    const service = new SkillQuarantinePipelineService({ projectRoot: root });
    const subcommand = String(args[1] || 'preview').trim().toLowerCase();
    const skillId = String(args[2] || readFlag(args, 'skill-id') || 'learned-daily-procedure').trim();
    const snapshot = service.buildSnapshot({
      skillId,
      title: readFlag(args, 'title') || skillId,
      summary: readFlag(args, 'summary') || 'Quarantined skill candidate.',
      applyDraft: subcommand === 'draft' || subcommand === 'apply' || args.includes('--apply'),
      promote: subcommand === 'promote' || args.includes('--promote'),
      approvalId: readFlag(args, 'approval-id'),
    });
    return render(args, 'Zavorth skills quarantine', [
      `Status: ${snapshot.status}`,
      `Skill: ${snapshot.skillId}`,
      `Draft written: ${snapshot.draftWritten ? 'yes' : 'no'}`,
      `Sandbox preview: ${snapshot.sandboxPreviewReady ? 'yes' : 'no'}`,
      `Promotion: ${snapshot.promotionPerformed ? 'done' : 'approval required'}`,
      `Quarantine: ${snapshot.quarantinePath}`,
      snapshot.promotedPath ? `Promoted: ${snapshot.promotedPath}` : 'Promoted: none',
    ], snapshot as unknown as JsonObject);
  }
  const registryFile = path.join(stateDir(root), 'skills.json');
  const registry = await readArray(registryFile);
  const catalog = mergeSkillCatalog(await loadSkillCatalog(root), registry);
  if (action === 'marketplace' || action === 'search') {
    const query = args[1] || readFlag(args, 'query') || '';
    const matches = query ? catalog.filter((skill) => JSON.stringify(skill).toLowerCase().includes(query.toLowerCase())) : catalog;
    return render(args, 'Zavorth skills marketplace', matches.length ? matches.slice(0, 30).map(formatSkillRow) : ['No skills matched.'], { skills: matches.map(sanitizeSkillRecord) });
  }
  if (action === 'install') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    if (!skill) return render(args, 'Zavorth skills', [`Skill not found: ${id || '<missing>'}`], { ok: false });
    const deps = normalizeSkillDependencies(skill);
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth skills', [
        `Install preview: ${String(skill.id)}`,
        `Dependencies: ${deps.length ? deps.join(', ') : 'none'}`,
        `Requirements: ${skillRequirementLines(skill).join('; ') || 'none'}`,
        'Add --yes to install missing npm dependencies and register the skill.',
      ], { dryRun: true, skill: sanitizeSkillRecord(skill), dependencies: deps });
    }
    let install: JsonObject = { skipped: true };
    if (deps.length > 0) {
      const result = await runProcess(resolveNpmCommand(), ['install', ...deps, '--save-dev'], root, 120000);
      install = { exitCode: result.exitCode, output: result.output.slice(0, 1000), durationMs: result.durationMs };
      if (result.exitCode !== 0) return render(args, 'Zavorth skills', [`Dependency install failed for ${String(skill.id)}`], { ok: false, install });
    }
    const record = { ...skill, status: 'installed', enabled: false, installedAt: new Date().toISOString(), allowlisted: isSkillAllowlisted(root, String(skill.id)) };
    await upsertSkillRecord(registryFile, record);
    return render(args, 'Zavorth skills', [`Installed skill: ${String(skill.id)}`], { skill: sanitizeSkillRecord(record), install });
  }
  if (action === 'enable' || action === 'disable') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    if (!skill) return render(args, 'Zavorth skills', [`Skill not found: ${id || '<missing>'}`], { ok: false });
    if (action === 'enable' && !(skill.allowByDefault === true || isSkillAllowlisted(root, String(skill.id)))) {
      return render(args, 'Zavorth skills', [`Skill is not allowlisted: ${String(skill.id)}`, `Run: zavorth skills allowlist add ${String(skill.id)}`], { ok: false, skill: sanitizeSkillRecord(skill) });
    }
    if (action === 'enable' && !args.includes('--yes')) {
      return render(args, 'Zavorth skills', [`Enable preview: ${String(skill.id)}`, ...skillRequirementLines(skill), 'Add --yes to enable this skill in runtime state.'], { dryRun: true, skill: sanitizeSkillRecord(skill) });
    }
    const record = { ...skill, status: 'installed', enabled: action === 'enable', updatedAt: new Date().toISOString(), allowlisted: isSkillAllowlisted(root, String(skill.id)) || skill.allowByDefault === true };
    await upsertSkillRecord(registryFile, record);
    await writeSkillsRuntimeState(root);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'skills.json'), { id: idWithTime('skill-receipt'), skillId: skill.id, action, createdAt: new Date().toISOString() });
    return render(args, 'Zavorth skills', [`${action === 'enable' ? 'Enabled' : 'Disabled'} skill: ${String(skill.id)}`], { skill: sanitizeSkillRecord(record) });
  }
  if (action === 'allowlist') return runSkillAllowlist(root, args);
  if (action === 'doctor') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    if (!skill) return render(args, 'Zavorth skills doctor', [`Skill not found: ${id || '<missing>'}`], { ok: false });
    const checks = doctorSkill(root, skill);
    return render(args, 'Zavorth skills doctor', checks.map((check) => `${check.ok ? 'ok' : 'fail'} ${check.id}: ${check.summary}`), { ok: checks.every((check) => check.ok), checks });
  }
  if (action === 'proof' || action === 'live-proof') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    if (!skill) return render(args, 'Zavorth skills proof', [`Skill not found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth skills proof', [`Live proof preview: ${String(skill.id)}`, 'Add --yes to run the declared proof command or metadata proof.'], { dryRun: true, skill: sanitizeSkillRecord(skill) });
    const proof = await runSkillProof(root, skill, args);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'skills.json'), { id: idWithTime('skill-proof'), skillId: skill.id, status: proof.ok ? 'passed' : 'failed', proof, createdAt: new Date().toISOString() });
    return render(args, 'Zavorth skills proof', [`Proof ${proof.ok ? 'passed' : 'failed'}: ${String(skill.id)}`, proof.summary], { proof });
  }
  if (action === 'requirements') {
    const query = args[1] || '';
    const skills = query ? catalog.filter((skill) => JSON.stringify(skill.requirements || []).toLowerCase().includes(query.toLowerCase())) : catalog;
    return render(args, 'Zavorth skills requirements', skills.length ? skills.map((skill) => `${String(skill.id)}: ${skillRequirementLines(skill).join('; ') || 'none'}`) : ['No skills matched requirements filter.'], { skills: skills.map(sanitizeSkillRecord) });
  }
  if (action === 'inspect' || action === 'show') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    return render(args, 'Zavorth skills', skill ? skillDetailLines(skill) : [`Skill not found: ${id || '<missing>'}`], { skill: skill ? sanitizeSkillRecord(skill) : null });
  }
  const filtered = filterSkills(catalog, args);
  return render(args, 'Zavorth skills', filtered.length ? filtered.map(formatSkillRow) : ['No skills matched.'], { skills: filtered.map(sanitizeSkillRecord) });
}

async function runSkillsGovernance(root: string, args: string[]) {
  const gateway = new ZavorthActionGateway({ root });
  const wanted = resolveRequestedSkillGovernanceMode(args);

  if (!wanted) {
    const status = await gateway.status('skills.governance.status');
    const current = normalizeSkillGovernanceMode(String(status.data?.mode || process.env.ZAVORTH_SKILLS_GOVERNANCE_MODE || 'casual'));
    return render(args, 'Zavorth skill governance', [
      `Current mode: ${current}`,
      'casual: fast personal-use imports; hard security/license blockers remain active.',
      'governed: stricter review for enterprise, compliance and sensitive workspaces.',
      'Switch: zavorth skills governance governed --apply',
    ], {
      mode: current,
      envKey: 'ZAVORTH_SKILLS_GOVERNANCE_MODE',
      actionId: 'skills.governance.status',
      switchCommands: [
        'zavorth skills governance casual --apply',
        'zavorth skills governance governed --apply',
      ],
    });
  }

  if (!args.includes('--apply') && !args.includes('--yes')) {
    const preview = await gateway.preview('skills.governance.set', { mode: wanted });
    return render(args, 'Zavorth skill governance', [
      ...preview.lines.filter((line) => line !== 'Preview only. No file was written.'),
      'Preview only. Add --apply to write ZAVORTH_SKILLS_GOVERNANCE_MODE into .env.',
    ], {
      dryRun: true,
      mode: wanted,
      actionId: preview.actionId,
      ...(preview.data || {}),
      envKey: 'ZAVORTH_SKILLS_GOVERNANCE_MODE',
    });
  }

  const applied = await gateway.apply('skills.governance.set', { mode: wanted }, {
    trustedOperatorConfirmation: true,
    actorId: 'operator',
    sourceSurface: 'cli:skills-governance',
  });

  return render(args, 'Zavorth skill governance', [
    ...applied.lines,
  ], {
    applied: true,
    mode: wanted,
    actionId: applied.actionId,
    ...(applied.data || {}),
    envKey: 'ZAVORTH_SKILLS_GOVERNANCE_MODE',
  });
}

async function runSkillsCurator(args: string[]) {
  const plane = new SkillCuratorPlaneService();
  const topLevelAction = firstArg(args, 'curator');
  const subcommand = topLevelAction === 'curate'
    ? 'run'
    : String(args[1] || 'status').toLowerCase();
  const skillId = topLevelAction === 'curate'
    ? readFlag(args, 'id') || ''
    : String(args[2] || readFlag(args, 'id') || '').trim();

  if (subcommand === 'status') {
    const status = await plane.status();
    return render(args, 'Zavorth skills curator', [
      `State: ${status.enabled ? 'enabled' : 'disabled'}${status.paused ? ' / paused' : ''}`,
      `Managed skills: ${status.stats.managed} (${status.stats.stale} stale, ${status.stats.archived} archived, ${status.stats.pinned} pinned)`,
      `Last run: ${status.lastRunAt || 'never'}`,
      `Next run: ${status.nextRunAt || 'not scheduled yet'}`,
      status.lastRunSummary ? `Summary: ${status.lastRunSummary}` : 'Summary: none',
      `Report: ${status.lastReportPath || 'none'}`,
      'Commands: run --dry-run, run, pause, resume, pin <skill>, unpin <skill>, restore <skill>',
    ], status as unknown as JsonObject);
  }

  if (subcommand === 'run') {
    const report = await plane.runCuratorReview({
      dryRun: args.includes('--dry-run'),
      llmReview: args.includes('--llm-review') || args.includes('--ai-review'),
      reason: args.includes('--dry-run') ? 'cli-dry-run' : 'cli-run',
      triggeredBy: 'cli:skills-curator',
    });
    return render(args, 'Zavorth skills curator', [
      report.summary,
      `Lifecycle transitions: ${report.transitions.length}`,
      `Consolidation candidates: ${report.auxiliaryReview.consolidationCandidates.length}`,
      `LLM review: ${report.llmReview.status}`,
      report.dryRun ? 'Dry-run only. No skill lifecycle state was changed.' : 'Applied safe lifecycle transitions.',
    ], report as unknown as JsonObject);
  }

  if (subcommand === 'pause') {
    const state = await plane.pause();
    return render(args, 'Zavorth skills curator', ['Curator paused. Scheduled maintenance will not run.'], state as unknown as JsonObject);
  }

  if (subcommand === 'resume') {
    const state = await plane.resume();
    return render(args, 'Zavorth skills curator', ['Curator resumed. Scheduled maintenance is eligible again.'], state as unknown as JsonObject);
  }

  if (subcommand === 'pin' || subcommand === 'unpin') {
    if (!skillId) {
      return render(args, 'Zavorth skills curator', ['Missing skill id. Usage: zavorth skills curator pin <skill>'], { ok: false });
    }
    const pinned = subcommand === 'pin';
    await plane.togglePin(skillId, pinned);
    return render(args, 'Zavorth skills curator', [`${pinned ? 'Pinned' : 'Unpinned'} skill: ${skillId}`], {
      skillId,
      pinned,
    });
  }

  if (subcommand === 'restore') {
    if (!skillId) {
      return render(args, 'Zavorth skills curator', ['Missing skill id. Usage: zavorth skills curator restore <skill>'], { ok: false });
    }
    await plane.restoreSkill(skillId);
    return render(args, 'Zavorth skills curator', [`Restored archived skill: ${skillId}`], { skillId });
  }

  return render(args, 'Zavorth skills curator', [
    `Unsupported curator command: ${subcommand}`,
    'Allowed: status, run, pause, resume, pin, unpin, restore',
  ], { ok: false, subcommand });
}

async function loadSkillCatalog(root: string): Promise<JsonObject[]> {
  const bundled: JsonObject[] = [
    { id: 'debugging', name: 'Debugging', summary: 'Investigate failures with evidence-first workflow.', requirements: [], dependencies: [], allowByDefault: true },
    { id: 'requirements-analysis', name: 'Requirements Analysis', summary: 'Turn ambiguous requests into clear acceptance criteria.', requirements: [], dependencies: [], allowByDefault: true },
    { id: 'system-design', name: 'System Design', summary: 'Architecture planning with tradeoffs and contracts.', requirements: [], dependencies: [], allowByDefault: true },
    { id: 'security-review', name: 'Security Review', summary: 'Risk review with policy and mitigation focus.', requirements: [{ kind: 'env', name: 'ZAVORTH_SECURITY_MODE', required: false }], dependencies: [], allowByDefault: false },
    { id: 'web-research', name: 'Web Research', summary: 'Current-information research with source evidence.', requirements: [{ kind: 'env', name: 'WEB_SEARCH_PROVIDER', required: false }], dependencies: [], allowByDefault: false },
  ];
  const localFiles = [path.join(root, 'skills.json'), path.join(root, 'skills', 'catalog.json'), path.join(stateDir(root), 'skill-marketplace.json')];
  const local = (await Promise.all(localFiles.map(async (file) => {
    const value = await readJson(file, []);
    return Array.isArray(value) ? value as JsonObject[] : [];
  }))).flat();
  return [...bundled, ...local].map(normalizeSkillRecord);
}

function mergeSkillCatalog(catalog: JsonObject[], registry: unknown[]): JsonObject[] {
  const map = new Map<string, JsonObject>();
  for (const skill of catalog) map.set(String(skill.id), skill);
  for (const entry of registry) {
    const item = normalizeSkillRecord(entry as JsonObject);
    map.set(String(item.id), { ...(map.get(String(item.id)) || {}), ...item });
  }
  return Array.from(map.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function normalizeSkillRecord(value: JsonObject): JsonObject {
  const id = idFromSpec(String(value.id || value.name || 'skill'));
  return {
    id,
    name: String(value.name || id),
    summary: String(value.summary || value.description || 'Governed skill.'),
    requirements: normalizeRequirements(((value.requirements || []) as unknown[])),
    dependencies: Array.isArray(value.dependencies) ? value.dependencies.map(String) : splitList(String(value.dependencies || '')),
    status: value.status || 'available',
    enabled: value.enabled === true,
    allowByDefault: value.allowByDefault === true,
    allowlisted: value.allowlisted === true,
    proof: value.proof || null,
  };
}

function filterSkills(catalog: JsonObject[], args: string[]): JsonObject[] {
  const requirement = readFlag(args, 'requirement') || '';
  const enabledOnly = args.includes('--enabled');
  const missingOnly = args.includes('--missing');
  return catalog.filter((skill) => {
    if (enabledOnly && skill.enabled !== true) return false;
    if (requirement && !JSON.stringify(skill.requirements || []).toLowerCase().includes(requirement.toLowerCase())) return false;
    if (missingOnly && enforceRequirements((skill.requirements || []) as Array<{ kind: string; name: string; required: boolean }>).ok) return false;
    return true;
  });
}

function formatSkillRow(skill: JsonObject): string {
  const req = enforceRequirements((skill.requirements || []) as Array<{ kind: string; name: string; required: boolean }>);
  return `- ${String(skill.id)} | ${skill.enabled ? 'enabled' : 'disabled'} | ${req.ok ? 'ready' : 'missing'} | ${String(skill.summary)}`;
}

function skillDetailLines(skill: JsonObject): string[] {
  return [
    `id: ${String(skill.id)}`,
    `name: ${String(skill.name)}`,
    `summary: ${String(skill.summary)}`,
    `enabled: ${String(skill.enabled === true)}`,
    `requirements: ${skillRequirementLines(skill).join('; ') || 'none'}`,
    `dependencies: ${normalizeSkillDependencies(skill).join(', ') || 'none'}`,
  ];
}

function skillRequirementLines(skill: JsonObject): string[] {
  return enforceRequirements((skill.requirements || []) as Array<{ kind: string; name: string; required: boolean }>).lines;
}

function normalizeSkillDependencies(skill: JsonObject): string[] {
  return Array.from(new Set(((skill.dependencies || []) as string[]).map(String).filter(Boolean)));
}

async function upsertSkillRecord(file: string, record: JsonObject): Promise<void> {
  const items = await readArray(file);
  const index = items.findIndex((entry) => String((entry as JsonObject).id) === String(record.id));
  if (index >= 0) items[index] = record;
  else items.push(record);
  await writeJson(file, items);
}

async function runSkillAllowlist(root: string, args: string[]) {
  const file = path.join(stateDir(root), 'skills-allowlist.json');
  const action = args[1] || 'list';
  const allowlist = await readArray(file);
  if (action === 'add') {
    const id = args[2] || readFlag(args, 'id') || '';
    if (!id) return render(args, 'Zavorth skills allowlist', ['Usage: zavorth skills allowlist add <id>'], { ok: false });
    const next = Array.from(new Set([...allowlist.map(String), idFromSpec(id)]));
    await writeJson(file, next);
    return render(args, 'Zavorth skills allowlist', [`Allowlisted skill: ${idFromSpec(id)}`], { allowlist: next });
  }
  if (action === 'remove') {
    const id = idFromSpec(args[2] || readFlag(args, 'id') || '');
    const next = allowlist.map(String).filter((entry) => entry !== id);
    await writeJson(file, next);
    return render(args, 'Zavorth skills allowlist', [`Removed skill from allowlist: ${id}`], { allowlist: next });
  }
  return render(args, 'Zavorth skills allowlist', allowlist.length ? allowlist.map((entry) => `- ${String(entry)}`) : ['No skill allowlist entries yet.'], { allowlist });
}

function isSkillAllowlisted(root: string, id: string): boolean {
  try {
    const file = path.join(stateDir(root), 'skills-allowlist.json');
    const raw = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    return Array.isArray(raw) && raw.includes(idFromSpec(id));
  } catch {
    return false;
  }
}

function doctorSkill(root: string, skill: JsonObject): Array<{ id: string; ok: boolean; summary: string }> {
  const requirements = enforceRequirements((skill.requirements || []) as Array<{ kind: string; name: string; required: boolean }>);
  const deps = normalizeSkillDependencies(skill);
  const pkg = existsSync(path.join(root, 'package.json')) ? JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) : {};
  const installed = new Set(Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }));
  const missingDeps = deps.filter((dep) => !installed.has(dep));
  return [
    { id: 'requirements', ok: requirements.ok, summary: requirements.ok ? 'Requirements satisfied.' : `Missing: ${requirements.missing.join(', ')}` },
    { id: 'dependencies', ok: missingDeps.length === 0, summary: missingDeps.length ? `Missing dependencies: ${missingDeps.join(', ')}` : 'Dependencies installed or not required.' },
    { id: 'allowlist', ok: Boolean(skill.allowByDefault || isSkillAllowlisted(root, String(skill.id))), summary: skill.allowByDefault || isSkillAllowlisted(root, String(skill.id)) ? 'Skill is allowed.' : 'Skill requires allowlist before enable.' },
  ];
}

async function runSkillProof(root: string, skill: JsonObject, args: string[]): Promise<{ ok: boolean; summary: string; result?: JsonObject }> {
  const proof = (skill.proof || {}) as JsonObject;
  const command = readFlag(args, 'command') || String(proof.command || '');
  if (!command) return { ok: true, summary: 'Metadata proof recorded; no live proof command declared.' };
  const result = await runProcess(command, [], root, readNumberFlag(args, 'timeout-ms') || 30000);
  return { ok: result.exitCode === 0, summary: result.output.slice(0, 500) || `exit ${result.exitCode}`, result };
}

async function writeSkillsRuntimeState(root: string): Promise<void> {
  const registry = await readArray(path.join(stateDir(root), 'skills.json'));
  const enabled = registry.map((entry) => entry as JsonObject).filter((skill) => skill.enabled === true);
  await writeJson(path.join(stateDir(root), 'skills-runtime.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    enabled: enabled.map((skill) => ({
      id: skill.id,
      name: skill.name,
      requirements: skill.requirements || [],
      dependencies: skill.dependencies || [],
    })),
  });
}

function sanitizeSkillRecord(value: unknown): JsonObject {
  return { ...((value || {}) as JsonObject) };
}

async function runStatusLike(root: string, command: string, args: string[], actions: string[]) {
  return render(args, `Zavorth ${command}`, [
    `state dir: ${stateDir(root)}`,
    `supported actions: ${actions.join(', ')}`,
    'live service control requires configured backend evidence.',
  ], { command, actions, stateDir: stateDir(root) });
}

async function runServiceCommand(root: string, serviceName: 'daemon' | 'gateway', args: string[]) {
  const action = firstArg(args, 'status');
  const stateFile = path.join(stateDir(root), `${serviceName}.json`);
  const state = await readJson(stateFile, defaultServiceState(serviceName)) as JsonObject;
  if (action === 'install') {
    const command = readFlag(args, 'command') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
    if (!command) return render(args, `Zavorth ${serviceName}`, [`Usage: zavorth ${serviceName} install --command <command>`], { ok: false });
    const next = { ...state, serviceName, command, installed: true, status: 'installed', installedAt: new Date().toISOString() };
    await writeJson(stateFile, next);
    await appendServiceLog(root, serviceName, 'install', 'installed', { command: redactCommand(command) });
    return render(args, `Zavorth ${serviceName}`, [`Installed ${serviceName} service config.`, `Command: ${redactCommand(command)}`], { service: sanitizeServiceState(next) });
  }
  if (action === 'uninstall') {
    if (!args.includes('--yes')) return render(args, `Zavorth ${serviceName}`, [`Uninstall preview: ${serviceName}`, 'Add --yes to remove service config.'], { dryRun: true, service: sanitizeServiceState(state) });
    await fs.rm(stateFile, { force: true });
    await appendServiceLog(root, serviceName, 'uninstall', 'removed', {});
    return render(args, `Zavorth ${serviceName}`, [`Removed ${serviceName} service config.`], { removed: true });
  }
  if (action === 'start') {
    const command = readFlag(args, 'command') || String(state.command || '');
    if (!command) return render(args, `Zavorth ${serviceName}`, [`No command configured. Run: zavorth ${serviceName} install --command <command>`], { ok: false });
    if (!args.includes('--yes')) return render(args, `Zavorth ${serviceName}`, [`Start preview: ${serviceName}`, `Command: ${redactCommand(command)}`, 'Add --yes to spawn the service.'], { dryRun: true, service: sanitizeServiceState({ ...state, command }) });
    const child = spawn(command, [], { cwd: root, shell: true, detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    const next = { ...state, serviceName, command, installed: true, status: 'running', pid: child.pid, startedAt: new Date().toISOString() };
    await writeJson(stateFile, next);
    await appendServiceLog(root, serviceName, 'start', 'running', { pid: child.pid, command: redactCommand(command) });
    return render(args, `Zavorth ${serviceName}`, [`Started ${serviceName}: pid ${child.pid}`], { service: sanitizeServiceState(next) });
  }
  if (action === 'stop') {
    const pid = Number(state.pid || 0);
    if (!pid) return render(args, `Zavorth ${serviceName}`, [`${serviceName} has no recorded PID.`], { ok: false, service: sanitizeServiceState(state) });
    if (!args.includes('--yes')) return render(args, `Zavorth ${serviceName}`, [`Stop preview: pid ${pid}`, 'Add --yes to stop the recorded service process.'], { dryRun: true, pid });
    const stopped = killPid(pid);
    const next: JsonObject = { ...state, status: stopped ? 'stopped' : 'stale', stoppedAt: new Date().toISOString() };
    delete next.pid;
    await writeJson(stateFile, next);
    await appendServiceLog(root, serviceName, 'stop', stopped ? 'stopped' : 'stale', { pid });
    return render(args, `Zavorth ${serviceName}`, [`Stop ${stopped ? 'sent' : 'could not signal'}: ${pid}`], { service: sanitizeServiceState(next) });
  }
  if (action === 'restart') {
    if (!args.includes('--yes')) return render(args, `Zavorth ${serviceName}`, [`Restart preview: ${serviceName}`, 'Add --yes to stop then start the configured service.'], { dryRun: true, service: sanitizeServiceState(state) });
    if (Number(state.pid || 0)) killPid(Number(state.pid));
    const command = String(state.command || '');
    if (!command) return render(args, `Zavorth ${serviceName}`, ['No command configured for restart.'], { ok: false });
    const child = spawn(command, [], { cwd: root, shell: true, detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    const next = { ...state, status: 'running', pid: child.pid, restartedAt: new Date().toISOString() };
    await writeJson(stateFile, next);
    await appendServiceLog(root, serviceName, 'restart', 'running', { pid: child.pid });
    return render(args, `Zavorth ${serviceName}`, [`Restarted ${serviceName}: pid ${child.pid}`], { service: sanitizeServiceState(next) });
  }
  if (action === 'logs') {
    const logs = await readArray(path.join(stateDir(root), 'logs', `${serviceName}.json`));
    return render(args, `Zavorth ${serviceName} logs`, logs.length ? logs.slice(-30).map((entry) => `- ${String((entry as JsonObject).createdAt)} | ${String((entry as JsonObject).action)} | ${String((entry as JsonObject).status)}`) : [`No ${serviceName} logs recorded yet.`], { logs });
  }
  if (action === 'health' || action === 'status') {
    const pid = Number(state.pid || 0);
    const alive = pid ? isPidAlive(pid) : false;
    const next: JsonObject = { ...state, health: alive ? 'alive' : pid ? 'stale' : 'not-running', checkedAt: new Date().toISOString() };
    await writeJson(stateFile, next);
    return render(args, `Zavorth ${serviceName}`, [
      `installed: ${Boolean(next.installed)}`,
      `status: ${String(next.status || 'not-installed')}`,
      `health: ${String(next.health)}`,
      `pid: ${pid || 'none'}`,
      `command: ${next.command ? redactCommand(String(next.command)) : 'not configured'}`,
    ], { service: sanitizeServiceState(next) });
  }
  return render(args, `Zavorth ${serviceName}`, [`Supported: install, uninstall, start, stop, restart, logs, health, status`], { ok: true });
}

async function runNodeHost(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  if (action === 'host' || action === 'start') {
    const id = readFlag(args, 'id') || idWithTime('node');
    const command = readFlag(args, 'command') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || 'node';
    if (!args.includes('--yes')) return render(args, 'Zavorth node', [`Node host preview: ${id}`, `Command: ${redactCommand(command)}`, 'Add --yes to start a local node host process.'], { dryRun: true, id, command: redactCommand(command) });
    const child = spawn(command, [], { cwd: root, shell: true, detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    const record = { id, kind: 'node-host', command, pid: child.pid, status: 'running', startedAt: new Date().toISOString() };
    await upsertNodeRecord(root, record);
    await appendServiceLog(root, 'node', 'start', 'running', { nodeId: id, pid: child.pid });
    return render(args, 'Zavorth node', [`Started node host: ${id}`, `pid: ${child.pid}`], { node: sanitizeServiceState(record) });
  }
  if (action === 'stop') {
    const id = args[1] || readFlag(args, 'id') || '';
    const node = await findNodeRecord(root, id);
    if (!node) return render(args, 'Zavorth node', [`No node found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth node', [`Stop node preview: ${id}`, 'Add --yes to stop recorded PID.'], { dryRun: true, node: sanitizeServiceState(node) });
    const stopped = Number(node.pid || 0) ? killPid(Number(node.pid)) : false;
    node.status = stopped ? 'stopped' : 'stale';
    delete node.pid;
    node.stoppedAt = new Date().toISOString();
    await upsertNodeRecord(root, node);
    await appendServiceLog(root, 'node', 'stop', String(node.status), { nodeId: id });
    return render(args, 'Zavorth node', [`Stop ${stopped ? 'sent' : 'could not signal'}: ${id}`], { node: sanitizeServiceState(node) });
  }
  if (action === 'pair') {
    return runNodesCommand(root, ['pair', ...args.slice(1)]);
  }
  if (action === 'logs') {
    const logs = await readArray(path.join(stateDir(root), 'logs', 'node.json'));
    return render(args, 'Zavorth node logs', logs.length ? logs.slice(-30).map((entry) => `- ${String((entry as JsonObject).createdAt)} | ${String((entry as JsonObject).action)} | ${String((entry as JsonObject).status)}`) : ['No node logs recorded yet.'], { logs });
  }
  const nodes = await readArray(path.join(stateDir(root), 'nodes.json'));
  return render(args, 'Zavorth node', nodes.length ? nodes.map((node) => {
    const item = node as JsonObject;
    return `- ${String(item.id)} | ${String(item.status)} | pid ${String(item.pid || 'none')} | health ${Number(item.pid || 0) && isPidAlive(Number(item.pid)) ? 'alive' : 'not-running'}`;
  }) : ['No node hosts recorded yet.'], { nodes: nodes.map(sanitizeServiceState) });
}

async function runNodesCommand(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const file = path.join(stateDir(root), 'nodes.json');
  const nodes = await readArray(file);
  if (action === 'pair') {
    const profile = args[1] && !args[1].startsWith('--') ? args[1] : 'headless';
    const label = readFlag(args, 'label') || args.slice(2).filter((arg) => !arg.startsWith('--')).join(' ') || `${profile} node`;
    const draft = await createPairingDraft(root, { channel: 'node', target: label, label, ttlMinutes: readNumberFlag(args, 'ttl-minutes') || 15 });
    const node = { id: readFlag(args, 'id') || idWithTime('node'), profile, label, status: 'pairing', pairingId: draft.id, pairingUri: draft.uri, pairingStatus: 'pending', createdAt: new Date().toISOString(), queue: [] };
    nodes.push(node);
    await writeJson(file, nodes);
    return render(args, 'Zavorth nodes', [`Created node pairing: ${String(node.id)}`, `Pairing URI: ${String(draft.uri)}`, `Code: ${String(draft.code)}`], { node: sanitizeServiceState(node), pairing: redactPairingRecord(draft) });
  }
  if (action === 'claim') {
    const id = args[1] || readFlag(args, 'id') || '';
    const node = nodes.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!node) return render(args, 'Zavorth nodes', [`No node found: ${id || '<missing>'}`], { ok: false });
    node.pairingStatus = 'paired';
    node.status = 'paired';
    node.sharedSecretRef = idWithTime('node-secret-ref');
    node.claimedAt = new Date().toISOString();
    await writeJson(file, nodes);
    await appendServiceLog(root, 'node', 'claim', 'paired', { nodeId: id });
    return render(args, 'Zavorth nodes', [`Node paired: ${id}`], { node: sanitizeServiceState(node) });
  }
  if (action === 'exec' || action === 'run') {
    const id = args[1] || readFlag(args, 'id') || '';
    const command = readFlag(args, 'command') || args.slice(2).join(' ');
    const node = nodes.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!node) return render(args, 'Zavorth nodes', [`No node found: ${id || '<missing>'}`], { ok: false });
    if (!command) return render(args, 'Zavorth nodes', ['Usage: zavorth nodes exec <id> --command <command>'], { ok: false });
    const invocation = { id: idWithTime('node-invoke'), nodeId: id, command, status: args.includes('--yes') ? 'requested' : 'preview', createdAt: new Date().toISOString() };
    const queue = Array.isArray(node.queue) ? node.queue as JsonObject[] : [];
    queue.push({ ...invocation, command: redactCommand(command) });
    node.queue = queue;
    if (!args.includes('--yes')) {
      await writeJson(file, nodes);
      return render(args, 'Zavorth nodes', [`Remote exec preview: ${id}`, `Command: ${redactCommand(command)}`, 'Add --yes to enqueue/execute through the node host policy.'], { invocation });
    }
    let result: JsonObject = { queued: true };
    if (node.pid && isPidAlive(Number(node.pid))) {
      result = await runProcess(command, [], root, readNumberFlag(args, 'timeout-ms') || 30000);
      invocation.status = (result as { exitCode?: number }).exitCode === 0 ? 'completed' : 'failed';
    } else {
      invocation.status = 'queued';
    }
    node.lastInvocation = invocation;
    await writeJson(file, nodes);
    await appendServiceLog(root, 'node', 'exec', String(invocation.status), { nodeId: id, invocationId: invocation.id, command: redactCommand(command) });
    return render(args, 'Zavorth nodes', [`Remote exec ${String(invocation.status)}: ${id}`], { invocation, result });
  }
  if (['revoke', 'remove'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || '';
    const remaining = nodes.filter((entry) => String((entry as JsonObject).id) !== id);
    if (remaining.length === nodes.length) return render(args, 'Zavorth nodes', [`No node found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth nodes', [`Remove preview: ${id}`, 'Add --yes to remove node record.'], { dryRun: true });
    await writeJson(file, remaining);
    await appendServiceLog(root, 'node', 'remove', 'removed', { nodeId: id });
    return render(args, 'Zavorth nodes', [`Removed node: ${id}`], { removed: id });
  }
  return render(args, 'Zavorth nodes', nodes.length ? nodes.map((node) => {
    const item = node as JsonObject;
    return `- ${String(item.id)} | ${String(item.profile || item.kind || 'node')} | ${String(item.status || 'ready')} | pairing ${String(item.pairingStatus || 'n/a')}`;
  }) : ['No nodes recorded yet.'], { nodes: nodes.map(sanitizeServiceState) });
}

function defaultServiceState(serviceName: string): JsonObject {
  return { serviceName, installed: false, status: 'not-installed', command: '', pid: null };
}

async function appendServiceLog(root: string, serviceName: string, action: string, status: string, metadata: JsonObject): Promise<void> {
  await appendJsonArray(path.join(stateDir(root), 'logs', `${serviceName}.json`), {
    id: idWithTime(`${serviceName}-log`),
    action,
    status,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPid(pid: number): boolean {
  try {
    process.kill(pid);
    return true;
  } catch {
    return false;
  }
}

function sanitizeServiceState(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.command) item.command = redactCommand(String(item.command));
  if (Array.isArray(item.queue)) {
    item.queue = item.queue.map((entry) => ({ ...((entry || {}) as JsonObject), command: redactCommand(String((entry as JsonObject).command || '')) }));
  }
  return item;
}

async function findNodeRecord(root: string, id: string): Promise<JsonObject | null> {
  const nodes = await readArray(path.join(stateDir(root), 'nodes.json'));
  return (nodes.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined) || null;
}

async function upsertNodeRecord(root: string, record: JsonObject): Promise<void> {
  const file = path.join(stateDir(root), 'nodes.json');
  const nodes = await readArray(file);
  const index = nodes.findIndex((entry) => String((entry as JsonObject).id) === String(record.id));
  if (index >= 0) nodes[index] = record;
  else nodes.push(record);
  await writeJson(file, nodes);
}

async function runSandbox(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  const sandboxDir = path.join(stateDir(root), 'sandboxes');
  await ensureDir(sandboxDir);
  if (action === 'doctor') {
    const { ZavorthSandboxControlPlaneService } = await import('../services/ZavorthSandboxControlPlaneService.js');
    const service = new ZavorthSandboxControlPlaneService({ workspaceRoot: root });
    const snapshot = service.buildSnapshot({
      command: readFlag(args, 'command') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || null,
      requestedBy: 'operator',
      sourceSurface: 'cli:sandbox',
    });
    return render(args, 'Zavorth sandbox doctor', service.renderReport({
      command: readFlag(args, 'command') || null,
      requestedBy: 'operator',
      sourceSurface: 'cli:sandbox',
    }).split('\n'), snapshot);
  }
  if (action === 'run') {
    const id = readFlag(args, 'id') || args[1] || '';
    if (!id) {
      return render(args, 'Zavorth sandbox run', [
        'Missing sandbox id. Use: zavorth sandbox create --yes, then zavorth sandbox run <id> --command <command> --yes',
      ], { ok: false });
    }
    return runSandbox(root, ['exec', id, ...args.slice(2)]);
  }
  if (action === 'receipt' || action === 'receipts') {
    return runSandbox(root, ['logs', ...args.slice(1)]);
  }
  if (action === 'status' || action === 'backends') {
    const backends = await inspectSandboxBackends(root);
    return render(args, 'Zavorth sandbox', backends.map((backend) => `${backend.id}: ${backend.status} | ${backend.detail}`), { backends });
  }
  if (action === 'policy') {
    const file = path.join(stateDir(root), 'sandbox-policy.json');
    const policy = await readJson(file, defaultSandboxPolicy()) as JsonObject;
    if (args.includes('set')) {
      const backend = readFlag(args, 'backend') || String(policy.defaultBackend || 'local');
      const network = readFlag(args, 'network') || String(policy.network || 'blocked');
      const writes = readFlag(args, 'writes') || String(policy.writes || 'sandbox-only');
      const next = { ...policy, defaultBackend: backend, network, writes, updatedAt: new Date().toISOString() };
      await writeJson(file, next);
      return render(args, 'Zavorth sandbox policy', ['Policy updated.', `backend: ${backend}`, `network: ${network}`, `writes: ${writes}`], { policy: next });
    }
    return render(args, 'Zavorth sandbox policy', Object.entries(policy).map(([key, value]) => `${key}: ${safeString(value)}`), { policy });
  }
  if (action === 'create') {
    const backend = readFlag(args, 'backend') || String((await readJson(path.join(stateDir(root), 'sandbox-policy.json'), defaultSandboxPolicy()) as JsonObject).defaultBackend || 'local');
    const id = readFlag(args, 'id') || idWithTime('sandbox');
    const label = args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || 'Zavorth sandbox';
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth sandbox', [`Create preview: ${id}`, `Backend: ${backend}`, 'Add --yes to create isolated sandbox state.'], { dryRun: true, id, backend });
    }
    const record = await createSandbox(root, sandboxDir, { id, backend, label, args });
    return render(args, 'Zavorth sandbox', [`Created sandbox: ${id}`, `Backend: ${backend}`, `Workspace: ${String(record.workspacePath || 'n/a')}`], { sandbox: sanitizeSandboxRecord(record) });
  }
  if (action === 'list') {
    const items = await readArray(path.join(stateDir(root), 'sandboxes.json'));
    return render(args, 'Zavorth sandbox', items.length ? items.map((item) => `- ${String((item as JsonObject).id)} | ${String((item as JsonObject).backend)} | ${String((item as JsonObject).status)}`) : ['No sandboxes recorded yet.'], { sandboxes: items.map(sanitizeSandboxRecord) });
  }
  if (action === 'logs') {
    const id = args[1] || readFlag(args, 'id') || '';
    const logs = await readArray(path.join(stateDir(root), 'logs', 'sandbox.json'));
    const selected = id ? logs.filter((entry) => String((entry as JsonObject).sandboxId) === id) : logs;
    return render(args, 'Zavorth sandbox logs', selected.length ? selected.slice(-30).map((entry) => `- ${String((entry as JsonObject).createdAt)} | ${String((entry as JsonObject).sandboxId)} | ${String((entry as JsonObject).action)} | ${String((entry as JsonObject).status)}`) : ['No sandbox logs recorded yet.'], { logs: selected });
  }
  if (action === 'snapshot') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = await findSandbox(root, id);
    if (!selected) return render(args, 'Zavorth sandbox', [`No sandbox found: ${id || '<missing>'}`], { ok: false });
    const snapshot = await createSandboxSnapshot(root, selected);
    return render(args, 'Zavorth sandbox', [`Snapshot created: ${String(snapshot.archive)}`, `Files: ${String(snapshot.filesCount)}`], { snapshot });
  }
  if (action === 'restore') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = await findSandbox(root, id);
    if (!selected) return render(args, 'Zavorth sandbox', [`No sandbox found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth sandbox', [`Restore preview: ${id}`, 'Add --yes to restore files into the sandbox workspace only.'], { dryRun: true, sandbox: sanitizeSandboxRecord(selected) });
    const restored = await restoreSandboxSnapshot(root, selected, readFlag(args, 'snapshot') || '');
    return render(args, 'Zavorth sandbox', [`Restored sandbox snapshot: ${id}`, `Files: ${restored.files}`], { restored });
  }
  if (action === 'exec') {
    const id = args[1] || readFlag(args, 'id') || '';
    const command = readFlag(args, 'command') || args.slice(2).join(' ');
    const selected = await findSandbox(root, id);
    if (!selected) return render(args, 'Zavorth sandbox', [`No sandbox found: ${id || '<missing>'}`], { ok: false });
    if (!command) return render(args, 'Zavorth sandbox', ['Usage: zavorth sandbox exec <id> --command <command> [--yes]'], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth sandbox', [`Exec preview in ${id}: ${command}`, 'Add --yes to execute inside the sandbox workspace/container.'], { dryRun: true, command });
    const result = await execSandboxCommand(root, selected, command, readNumberFlag(args, 'timeout-ms') || 30000);
    await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: id, action: 'exec', status: result.exitCode === 0 ? 'completed' : 'failed', command, durationMs: result.durationMs, output: result.output.slice(0, 1000), createdAt: new Date().toISOString() });
    return render(args, 'Zavorth sandbox', [`Exec ${result.exitCode === 0 ? 'completed' : 'failed'}: ${id}`, result.output.slice(0, 1200) || '<empty output>'], { result });
  }
  if (action === 'destroy' || action === 'remove') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = await findSandbox(root, id);
    if (!selected) return render(args, 'Zavorth sandbox', [`No sandbox found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth sandbox', [`Destroy preview: ${id}`, 'Add --yes to remove sandbox workspace/container metadata.'], { dryRun: true, sandbox: sanitizeSandboxRecord(selected) });
    const destroyed = await destroySandbox(root, selected);
    return render(args, 'Zavorth sandbox', [`Destroyed sandbox: ${id}`], { destroyed });
  }
  return render(args, 'Zavorth sandbox', ['Supported: status, backends, policy, create, list, snapshot, restore, exec, logs, destroy'], { ok: true });
}

function defaultSandboxPolicy(): JsonObject {
  return {
    defaultBackend: 'local',
    network: 'blocked',
    writes: 'sandbox-only',
    dockerImage: 'node:20-alpine',
    firecracker: 'requires-explicit-backend',
    updatedAt: null,
  };
}

async function inspectSandboxBackends(root: string): Promise<Array<{ id: string; status: string; detail: string }>> {
  const docker = await runProcess('docker', ['--version'], root, 3000);
  const wsl = process.platform === 'win32' ? await runProcess('wsl', ['--status'], root, 3000) : { exitCode: 1, output: 'not-windows', durationMs: 0, timedOut: false };
  const firecrackerPath = getEnv('FIRECRACKER_BIN') || getEnv('FIRECRACKER_PATH') || '';
  return [
    { id: 'local', status: 'available', detail: 'copy-on-write workspace directory under .zavorth/sandboxes' },
    { id: 'docker', status: docker.exitCode === 0 ? 'available' : 'missing', detail: docker.output.split(/\r?\n/u)[0] || 'docker CLI not found' },
    { id: 'wsl', status: wsl.exitCode === 0 ? 'available' : 'missing', detail: wsl.output.split(/\r?\n/u)[0] || 'WSL not available from this shell' },
    { id: 'firecracker', status: firecrackerPath && existsSync(firecrackerPath) ? 'available' : 'unconfigured', detail: firecrackerPath || 'set FIRECRACKER_BIN to enable microVM backend' },
  ];
}

async function createSandbox(root: string, sandboxDir: string, input: { id: string; backend: string; label: string; args: string[] }): Promise<JsonObject> {
  const recordsFile = path.join(stateDir(root), 'sandboxes.json');
  const records = await readArray(recordsFile);
  const workspacePath = path.join(sandboxDir, input.id, 'workspace');
  const record: JsonObject = {
    id: input.id,
    label: input.label,
    backend: input.backend,
    status: 'created',
    workspacePath,
    createdAt: new Date().toISOString(),
  };
  if (['local', 'wsl', 'firecracker'].includes(input.backend)) {
    await copyWorkspaceForSandbox(root, workspacePath);
  }
  if (input.backend === 'docker') {
    const image = readFlag(input.args, 'image') || String((await readJson(path.join(stateDir(root), 'sandbox-policy.json'), defaultSandboxPolicy()) as JsonObject).dockerImage || 'node:20-alpine');
    const containerName = `zavorth-${input.id}`.replace(/[^a-zA-Z0-9_.-]+/gu, '-');
    const create = await runProcess('docker', ['create', '--name', containerName, image, 'sleep', '3600'], root, 30000);
    record.containerName = containerName;
    record.image = image;
    record.status = create.exitCode === 0 ? 'container-created' : 'create-failed';
    record.docker = { exitCode: create.exitCode, output: create.output.slice(0, 1000) };
    if (create.exitCode === 0 && input.args.includes('--start')) {
      const start = await runProcess('docker', ['start', containerName], root, 30000);
      record.status = start.exitCode === 0 ? 'running' : 'start-failed';
      record.dockerStart = { exitCode: start.exitCode, output: start.output.slice(0, 1000) };
    }
  }
  records.push(record);
  await writeJson(recordsFile, records);
  await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: input.id, action: 'create', status: record.status, backend: input.backend, createdAt: new Date().toISOString() });
  return record;
}

async function copyWorkspaceForSandbox(root: string, destination: string): Promise<void> {
  await ensureDir(destination);
  const files = (await walkFiles(root, 1500))
    .filter((file) => {
      const relative = path.relative(root, file).replace(/\\/gu, '/');
      return !relative.startsWith('.git/')
        && !relative.startsWith('node_modules/')
        && !relative.startsWith('.zavorth/sandboxes/')
        && !relative.startsWith('.zavorth/logs/')
        && !relative.includes('/node_modules/');
    });
  for (const file of files) {
    const relative = path.relative(root, file);
    const target = path.join(destination, relative);
    if (!isInside(destination, target)) continue;
    await ensureDir(path.dirname(target));
    await fs.copyFile(file, target);
  }
}

async function findSandbox(root: string, id: string): Promise<JsonObject | null> {
  const records = await readArray(path.join(stateDir(root), 'sandboxes.json'));
  return (records.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined) || null;
}

async function createSandboxSnapshot(root: string, sandbox: JsonObject): Promise<JsonObject> {
  const workspacePath = String(sandbox.workspacePath || '');
  if (!workspacePath || !isInside(stateDir(root), workspacePath) || !existsSync(workspacePath)) {
    return { ok: false, reason: 'sandbox-workspace-missing' };
  }
  const snapshotDir = path.join(stateDir(root), 'sandbox-snapshots');
  await ensureDir(snapshotDir);
  const id = idWithTime('sandbox-snapshot');
  const files = await Promise.all((await walkFiles(workspacePath, 2000)).map(async (file) => {
    const raw = await fs.readFile(file);
    return { file: path.relative(workspacePath, file), bytes: raw.byteLength, sha256: sha256(raw), contentBase64: raw.toString('base64') };
  }));
  const manifest = { id, sandboxId: sandbox.id, createdAt: new Date().toISOString(), files };
  const archive = path.join(snapshotDir, `${id}.zavsandbox.gz`);
  await fs.writeFile(archive, await gzipAsync(Buffer.from(JSON.stringify(manifest), 'utf8')));
  await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: sandbox.id, action: 'snapshot', status: 'completed', archive, files: files.length, createdAt: new Date().toISOString() });
  return { id, archive, filesCount: files.length, sandboxId: sandbox.id };
}

async function restoreSandboxSnapshot(root: string, sandbox: JsonObject, snapshotPath: string): Promise<{ files: number }> {
  const workspacePath = String(sandbox.workspacePath || '');
  const snapshotDir = path.join(stateDir(root), 'sandbox-snapshots');
  const archive = snapshotPath
    ? (path.isAbsolute(snapshotPath) ? snapshotPath : path.join(snapshotDir, snapshotPath))
    : (await listAnyFiles(snapshotDir)).filter((file) => file.endsWith('.zavsandbox.gz')).sort().at(-1) || '';
  if (!archive || !existsSync(archive)) return { files: 0 };
  const manifest = JSON.parse((await gunzipAsync(await fs.readFile(archive))).toString('utf8')) as { files?: Array<JsonObject> };
  let restored = 0;
  for (const file of manifest.files || []) {
    const target = path.join(workspacePath, String(file.file || ''));
    if (!isInside(workspacePath, target)) continue;
    await ensureDir(path.dirname(target));
    await fs.writeFile(target, Buffer.from(String(file.contentBase64 || ''), 'base64'));
    restored += 1;
  }
  await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: sandbox.id, action: 'restore', status: 'completed', files: restored, createdAt: new Date().toISOString() });
  return { files: restored };
}

async function execSandboxCommand(root: string, sandbox: JsonObject, command: string, timeoutMs: number): Promise<{ exitCode: number; output: string; durationMs: number; timedOut: boolean }> {
  if (sandbox.backend === 'docker' && sandbox.containerName) {
    return runProcess('docker', ['exec', String(sandbox.containerName), 'sh', '-lc', command], root, timeoutMs);
  }
  const cwd = String(sandbox.workspacePath || root);
  if (!isInside(stateDir(root), cwd)) {
    return { exitCode: 126, output: 'Sandbox workspace is outside Zavorth state directory.', durationMs: 0, timedOut: false };
  }
  return runProcess(command, [], cwd, timeoutMs);
}

async function destroySandbox(root: string, sandbox: JsonObject): Promise<JsonObject> {
  const recordsFile = path.join(stateDir(root), 'sandboxes.json');
  const records = (await readArray(recordsFile)).filter((entry) => String((entry as JsonObject).id) !== String(sandbox.id));
  const result: JsonObject = { id: sandbox.id, backend: sandbox.backend, removedWorkspace: false, removedContainer: false };
  if (sandbox.backend === 'docker' && sandbox.containerName) {
    const docker = await runProcess('docker', ['rm', '-f', String(sandbox.containerName)], root, 30000);
    result.removedContainer = docker.exitCode === 0;
    result.docker = { exitCode: docker.exitCode, output: docker.output.slice(0, 500) };
  }
  const workspacePath = String(sandbox.workspacePath || '');
  if (workspacePath && isInside(stateDir(root), workspacePath) && existsSync(workspacePath)) {
    await fs.rm(path.dirname(workspacePath), { recursive: true, force: true });
    result.removedWorkspace = true;
  }
  await writeJson(recordsFile, records);
  await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: sandbox.id, action: 'destroy', status: 'completed', createdAt: new Date().toISOString() });
  return result;
}

function sanitizeSandboxRecord(value: unknown): JsonObject {
  return { ...((value || {}) as JsonObject) };
}

async function runDirectory(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const file = path.join(stateDir(root), 'directory.json');
  const entries = await readArray(file);
  const channel = readFlag(args, 'channel') || 'telegram';
  if (action === 'self') {
    if (args.includes('--live')) {
      if (!args.includes('--yes')) return render(args, 'Zavorth directory', ['Live directory lookup requires --yes.'], { ok: false });
      const result = await lookupChannelDirectory(channel, 'self', args);
      return render(args, 'Zavorth directory', result.lines, result.payload);
    }
    const local = entries.filter((entry) => String((entry as JsonObject).kind) === 'self');
    return render(args, 'Zavorth directory', local.length ? local.map(formatDirectoryEntry) : ['No local self identity recorded yet.'], { entries: local });
  }
  if (action === 'peers' || action === 'groups' || action === 'sync') {
    if (args.includes('--live')) {
      if (!args.includes('--yes')) return render(args, 'Zavorth directory', ['Live directory lookup requires --yes.'], { ok: false });
      const result = await lookupChannelDirectory(channel, action === 'groups' ? 'groups' : 'peers', args);
      if (action === 'sync' && result.entries.length > 0) {
        const merged = mergeDirectoryEntries(entries, result.entries);
        await writeJson(file, merged);
        return render(args, 'Zavorth directory', [`Synced ${result.entries.length} entrie(s) from ${channel}.`, ...result.lines], { entries: merged });
      }
      return render(args, 'Zavorth directory', result.lines, result.payload);
    }
    const kind = action === 'groups' ? 'group' : 'peer';
    const local = entries.filter((entry) => String((entry as JsonObject).kind) === kind);
    return render(args, 'Zavorth directory', local.length ? local.map(formatDirectoryEntry) : [`No local ${kind}s recorded yet.`], { entries: local });
  }
  if (action === 'lookup') {
    const query = args[1] || readFlag(args, 'query') || '';
    const matches = entries.filter((entry) => JSON.stringify(entry).toLowerCase().includes(query.toLowerCase()));
    return render(args, 'Zavorth directory', matches.length ? matches.map(formatDirectoryEntry) : [`No local directory match for: ${query || '<missing>'}`], { query, entries: matches });
  }
  if (action === 'add') {
    const entry = {
      id: idWithTime('directory'),
      channel,
      externalId: readFlag(args, 'id') || readFlag(args, 'external-id') || '',
      label: readFlag(args, 'label') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || 'Directory entry',
      kind: readFlag(args, 'kind') || 'peer',
      status: 'trusted-local',
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    await writeJson(file, entries);
    return render(args, 'Zavorth directory', [`Added directory entry: ${entry.id}`], { entry });
  }
  return render(args, 'Zavorth directory', entries.length ? entries.map(formatDirectoryEntry) : ['No directory entries recorded yet.'], { entries });
}

async function runPairing(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const file = path.join(stateDir(root), 'pairings.json');
  const pairings = await readArray(file);
  if (['create', 'new', 'request', 'pair'].includes(action)) {
    const channel = readFlag(args, 'channel') || 'device';
    const draft = await createPairingDraft(root, {
      channel,
      target: readFlag(args, 'target') || '',
      label: args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || `${channel} pairing`,
      ttlMinutes: readNumberFlag(args, 'ttl-minutes') || 15,
    });
    return render(args, 'Zavorth pairing', [
      `Created pairing request: ${draft.id}`,
      `Code: ${draft.code}`,
      `URI: ${draft.uri}`,
      `Expires: ${draft.expiresAt}`,
      'Approve only after the remote side claims the same code.',
    ], { pairing: redactPairingRecord(draft) });
  }
  if (action === 'claim') {
    const code = readFlag(args, 'code') || args[1] || '';
    const claimedBy = readFlag(args, 'by') || readFlag(args, 'device') || readFlag(args, 'user') || 'unknown';
    const selected = pairings.find((entry) => String((entry as JsonObject).codeHash) === hashPairingCode(code)) as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth pairing', ['No pending pairing found for that code.'], { ok: false });
    if (pairingExpired(selected)) {
      selected.status = 'expired';
      await writeJson(file, pairings);
      return render(args, 'Zavorth pairing', ['Pairing code expired. Create a new pairing request.'], { ok: false, pairing: redactPairingRecord(selected) });
    }
    selected.status = 'claimed';
    selected.claimedBy = claimedBy;
    selected.claimedAt = new Date().toISOString();
    await writeJson(file, pairings);
    return render(args, 'Zavorth pairing', [`Claim recorded for pairing: ${String(selected.id)}`, 'Run zavorth pairing approve <id> after verifying the source.'], { pairing: redactPairingRecord(selected) });
  }
  if (action === 'approve') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = pairings.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth pairing', [`No pairing found for id: ${id || '<missing>'}`], { ok: false });
    if (pairingExpired(selected)) selected.status = 'expired';
    if (String(selected.status) !== 'claimed') {
      await writeJson(file, pairings);
      return render(args, 'Zavorth pairing', [`Pairing is not claim-ready. Current status: ${String(selected.status)}`], { ok: false, pairing: redactPairingRecord(selected) });
    }
    selected.status = 'approved';
    selected.approvedAt = new Date().toISOString();
    selected.receipt = idWithTime('pairing-receipt');
    await writeJson(file, pairings);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'pairings.json'), { id: selected.receipt, kind: 'pairing-approved', pairingId: selected.id, channel: selected.channel, createdAt: selected.approvedAt });
    return render(args, 'Zavorth pairing', [`Approved pairing: ${id}`, `Evidence: ${String(selected.receipt)}`], { pairing: redactPairingRecord(selected) });
  }
  if (['revoke', 'reject', 'cancel'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = pairings.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth pairing', [`No pairing found for id: ${id || '<missing>'}`], { ok: false });
    selected.status = action === 'revoke' ? 'revoked' : action === 'reject' ? 'rejected' : 'cancelled';
    selected.updatedAt = new Date().toISOString();
    await writeJson(file, pairings);
    return render(args, 'Zavorth pairing', [`${String(selected.status)} pairing: ${id}`], { pairing: redactPairingRecord(selected) });
  }
  return render(args, 'Zavorth pairing', pairings.length ? pairings.map((entry) => {
    const item = entry as JsonObject;
    return `- ${String(item.id)} | ${String(item.channel)} | ${String(item.status)} | expires ${String(item.expiresAt || 'n/a')}`;
  }) : ['No pairing requests recorded yet.'], { pairings: pairings.map(redactPairingRecord) });
}

async function runSystem(root: string, args: string[]) {
  return render(args, 'Zavorth system', [
    `time: ${new Date().toISOString()}`,
    `cwd: ${root}`,
    `node: ${process.version}`,
  ], { time: new Date().toISOString(), root, node: process.version });
}

async function runUninstall(root: string, args: string[]) {
  const targets = [stateDir(root)];
  if (!args.includes('--yes')) {
    return render(args, 'Zavorth uninstall', ['Preview only. Add --yes to remove local Zavorth state.', ...targets.map((target) => `- ${target}`)], { dryRun: true, targets });
  }
  await fs.rm(stateDir(root), { recursive: true, force: true });
  return render(args, 'Zavorth uninstall', ['Removed local Zavorth state directory. CLI files were not removed.'], { removed: targets });
}

function firstArg(args: string[], fallback: string): string {
  return String(args.find((arg) => !arg.startsWith('--')) || fallback).trim().toLowerCase();
}

function isSkillGovernanceAction(action: string, args: string[]): boolean {
  const text = args.filter((arg) => !arg.startsWith('--')).join(' ').toLowerCase();
  return action === 'governance'
    || action === 'governance-mode'
    || action === 'policy'
    || action === 'trust'
    || /skill[s]?\s+governance|governance\s+(?:pra|para|to)|modo\s+(?:governed|governado|casual)/u.test(text)
    || args.some((arg) => arg.startsWith('--governance') || arg.startsWith('--mode='));
}

function resolveRequestedSkillGovernanceMode(args: string[]): 'casual' | 'governed' | null {
  const explicit = readFlag(args, 'mode')
    || readFlag(args, 'governance')
    || readFlag(args, 'skills-governance')
    || readFlag(args, 'skill-governance');
  const text = [explicit, ...args.filter((arg) => !arg.startsWith('--'))].filter(Boolean).join(' ').toLowerCase();
  if (/\b(governed|governado|estrito|strict|enterprise|corporativo)\b/u.test(text)) {
    return 'governed';
  }
  if (/\b(casual|rapido|r\u00e1pido|pessoal|personal|domestico|dom\u00e9stico)\b/u.test(text)) {
    return 'casual';
  }
  return null;
}

function normalizeSkillGovernanceMode(value: string): 'casual' | 'governed' {
  return resolveRequestedSkillGovernanceMode([value]) || 'casual';
}

function mergeSingleEnvValue(current: string, key: string, value: string): string {
  const lines = current.split(/\r?\n/u);
  let replaced = false;
  const next = lines.map((line) => {
    if (new RegExp(`^${escapeRegex(key)}\\s*=`, 'u').test(line)) {
      replaced = true;
      return `${key}=${quoteEnv(value)}`;
    }
    return line;
  });
  if (!replaced) {
    next.push(`${key}=${quoteEnv(value)}`);
  }
  while (next.length > 0 && next[next.length - 1] === '') {
    next.pop();
  }
  return `${next.join('\n')}\n`;
}

function quoteEnv(value: string): string {
  return /^[A-Za-z0-9_.:/\\-]+$/u.test(value)
    ? value
    : JSON.stringify(value);
}

function readFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function readFlags(args: string[], name: string): string[] {
  const values: string[] = [];
  const prefix = `--${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) values.push(arg.slice(prefix.length));
    else if (arg === `--${name}` && args[index + 1]) values.push(args[index + 1]);
  }
  return values.flatMap(splitList);
}

function readNumberFlag(args: string[], name: string): number | null {
  const raw = readFlag(args, name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function firstUsageActionPosition(args: string[]): string {
  const valueFlags = new Set([
    '--action',
    '--action-id',
    '--capability',
    '--title',
    '--event',
    '--kind',
    '--surface',
    '--actor',
    '--status',
    '--duration-ms',
    '--receipt',
  ]);
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (valueFlags.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) continue;
    return arg;
  }
  return '';
}

function stateDir(root: string): string {
  return path.join(root, '.zavorth');
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(file: string, fallback: unknown): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function readArray(file: string): Promise<unknown[]> {
  const value = await readJson(file, []);
  return Array.isArray(value) ? value : [];
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function appendJsonArray(file: string, value: unknown): Promise<void> {
  const items = await readArray(file);
  items.push(value);
  await writeJson(file, items);
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((file) => file.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

async function listAnyFiles(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).map((file) => path.join(dir, file));
  } catch {
    return [];
  }
}

async function walkFiles(dir: string, limit: number): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string): Promise<void> {
    if (out.length >= limit) return;
    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    try {
      entries = await fs.readdir(current, { withFileTypes: true }) as unknown as Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) out.push(next);
      if (out.length >= limit) return;
    }
  }
  await walk(dir);
  return out;
}

function idWithTime(prefix: string): string {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14)}`;
}

function getPath(obj: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => (
    acc && typeof acc === 'object' ? (acc as JsonObject)[part] : undefined
  ), obj);
}

function setPath(obj: JsonObject, key: string, value: unknown): void {
  const parts = key.split('.');
  let cursor = obj;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part] as JsonObject;
  }
  cursor[parts.at(-1) || key] = value;
}

function unsetPath(obj: JsonObject, key: string): void {
  const parts = key.split('.');
  let cursor: JsonObject | undefined = obj;
  for (const part of parts.slice(0, -1)) {
    const next: unknown = cursor[part];
    cursor = next && typeof next === 'object' ? next as JsonObject : undefined;
    if (!cursor) return;
  }
  delete cursor[parts.at(-1) || key];
}

function redact(value: string): string {
  return value.length <= 8 ? '***' : `${value.slice(0, 4)}...${value.slice(-2)}`;
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    for (const key of Array.from(url.searchParams.keys())) {
      if (/token|key|secret|auth|sig/iu.test(key)) url.searchParams.set(key, '***');
    }
    return url.toString();
  } catch {
    return redact(value);
  }
}

function safeString(value: unknown): string {
  if (typeof value === 'string') return value.match(/token|key|secret/iu) ? redact(value) : value;
  return JSON.stringify(value);
}

function sanitizeMessageRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.message) item.message = redact(String(item.message));
  if (Array.isArray(item.attachments)) item.attachments = item.attachments.map((entry) => path.basename(String(entry)));
  if (item.delivery && typeof item.delivery === 'object') item.delivery = sanitizeDelivery(item.delivery as JsonObject);
  return item;
}

function sanitizeDelivery(value: JsonObject): JsonObject {
  const copy = { ...value };
  if (Array.isArray(copy.receipts)) {
    copy.receipts = copy.receipts.map((receipt) => {
      const item = { ...((receipt || {}) as JsonObject) };
      if (item.target) item.target = redact(String(item.target));
      return item;
    });
  }
  return copy;
}

function formatMessageReceipt(value: unknown): string {
  const item = value as JsonObject;
  return `- ${String(item.id)} | ${String(item.channel)} | ${String(item.status)} | targets ${Array.isArray(item.targets) ? item.targets.length : 0}`;
}

function render(args: string[], title: string, lines: string[], payload: unknown) {
  if (args.includes('--json')) return text(`${JSON.stringify(payload, null, 2)}\n`);
  const body = normalizeRenderLines(lines).join('\n');
  return text(`${TerminalPanel.render(body || 'No details available.', {
    title,
    type: resolvePanelType(payload, lines),
    padding: 1,
    width: terminalPanelWidth(),
  })}\n`);
}

function normalizeRenderLines(lines: string[]): string[] {
  return (lines || [])
    .map((line) => String(line || '').trimEnd())
    .filter((line, index, list) => line.trim() || (index > 0 && index < list.length - 1));
}

function resolvePanelType(payload: unknown, lines: string[]): 'info' | 'success' | 'warning' | 'error' | 'default' {
  const record = payload && typeof payload === 'object' ? payload as JsonObject : {};
  if (record.ok === false || lines.some((line) => /\b(error|failed|invalid|not found)\b/i.test(line))) {
    return 'error';
  }
  if (record.dryRun === true || lines.some((line) => /\b(preview|dry-run|add --yes|requires|missing)\b/i.test(line))) {
    return 'warning';
  }
  if (record.ok === true || lines.some((line) => /\b(created|verified|ready|restored|imported|installed|enabled|started|saved)\b/i.test(line))) {
    return 'success';
  }
  return 'default';
}

function terminalPanelWidth(): number {
  const columns = Number(process.stdout?.columns || 0);
  if (!Number.isFinite(columns) || columns <= 0) return 86;
  return Math.max(56, Math.min(92, columns - 4));
}

function text(output: string): { exitCode: number; output: string } {
  return { exitCode: 0, output };
}

type ChannelAdapterMode =
  | 'telegram-bot'
  | 'webhook'
  | 'bot-http'
  | 'matrix'
  | 'line'
  | 'signal-bridge'
  | 'local-bridge'
  | 'apple-bridge'
  | 'outbox';

type ChannelAdapter = {
  id: string;
  aliases?: string[];
  mode: ChannelAdapterMode;
  env: string[];
  webhookEnv?: string[];
  endpointEnv?: string[];
  scriptEnv?: string[];
  tokenEnv?: string[];
  targetEnv?: string[];
  outboxEnv?: string;
};

type MessageCompose = {
  channel: string;
  targets: string[];
  message: string;
  attachments: string[];
  threadId: string;
  replyTo: string;
  reaction: string;
  mentions: string[];
};

const CHANNEL_ADAPTERS: ChannelAdapter[] = [
  { id: 'telegram', mode: 'telegram-bot', env: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_DEFAULT_CHAT_ID'], targetEnv: ['TELEGRAM_DEFAULT_CHAT_ID'] },
  { id: 'discord', mode: 'webhook', env: ['DISCORD_WEBHOOK_URL'], webhookEnv: ['DISCORD_WEBHOOK_URL'] },
  { id: 'slack', mode: 'webhook', env: ['SLACK_WEBHOOK_URL'], webhookEnv: ['SLACK_WEBHOOK_URL'] },
  { id: 'whatsapp', mode: 'local-bridge', env: ['WHATSAPP_BRIDGE_URL or WHATSAPP_WEBHOOK_URL or WHATSAPP_OUTBOX_DIR'], endpointEnv: ['WHATSAPP_BRIDGE_URL'], webhookEnv: ['WHATSAPP_WEBHOOK_URL'], outboxEnv: 'WHATSAPP_OUTBOX_DIR' },
  { id: 'signal', mode: 'signal-bridge', env: ['SIGNAL_JSONRPC_URL or SIGNAL_CLI_PATH', 'SIGNAL_ACCOUNT_NUMBER', 'SIGNAL_ALLOWED_RECIPIENTS'], endpointEnv: ['SIGNAL_JSONRPC_URL'], scriptEnv: ['SIGNAL_CLI_PATH'], outboxEnv: 'SIGNAL_OUTBOX_DIR' },
  { id: 'imessage', mode: 'apple-bridge', env: ['IMESSAGE_BRIDGE_URL or IMESSAGE_SCRIPT_PATH or IMESSAGE_OUTBOX_DIR'], endpointEnv: ['IMESSAGE_BRIDGE_URL'], scriptEnv: ['IMESSAGE_SCRIPT_PATH'], outboxEnv: 'IMESSAGE_OUTBOX_DIR' },
  { id: 'matrix', mode: 'matrix', env: ['MATRIX_BASE_URL', 'MATRIX_ACCESS_TOKEN'], targetEnv: ['MATRIX_DEFAULT_ROOM_ID'] },
  { id: 'microsoft-teams', aliases: ['teams', 'msteams'], mode: 'webhook', env: ['TEAMS_WEBHOOK_URL or MSTEAMS_WEBHOOK_URL'], webhookEnv: ['TEAMS_WEBHOOK_URL', 'MSTEAMS_WEBHOOK_URL'] },
  { id: 'feishu', aliases: ['lark'], mode: 'webhook', env: ['FEISHU_WEBHOOK_URL or LARK_WEBHOOK_URL'], webhookEnv: ['FEISHU_WEBHOOK_URL', 'LARK_WEBHOOK_URL'] },
  { id: 'google-chat', aliases: ['gchat'], mode: 'webhook', env: ['GOOGLE_CHAT_WEBHOOK_URL'], webhookEnv: ['GOOGLE_CHAT_WEBHOOK_URL'] },
  { id: 'irc', mode: 'local-bridge', env: ['IRC_BRIDGE_URL or IRC_WEBHOOK_URL or IRC_OUTBOX_DIR'], endpointEnv: ['IRC_BRIDGE_URL'], webhookEnv: ['IRC_WEBHOOK_URL'], scriptEnv: ['IRC_SCRIPT_PATH'], outboxEnv: 'IRC_OUTBOX_DIR' },
  { id: 'zalo', mode: 'bot-http', env: ['ZALO_SEND_URL', 'ZALO_ACCESS_TOKEN'], endpointEnv: ['ZALO_SEND_URL'], tokenEnv: ['ZALO_ACCESS_TOKEN'] },
  { id: 'wecom', mode: 'webhook', env: ['WECOM_WEBHOOK_URL'], webhookEnv: ['WECOM_WEBHOOK_URL'] },
  { id: 'weixin', aliases: ['wechat'], mode: 'local-bridge', env: ['WEIXIN_BRIDGE_URL or WEIXIN_BRIDGE_SCRIPT or WEIXIN_OUTBOX_DIR'], endpointEnv: ['WEIXIN_BRIDGE_URL'], scriptEnv: ['WEIXIN_BRIDGE_SCRIPT'], outboxEnv: 'WEIXIN_OUTBOX_DIR' },
  { id: 'yuanbao', mode: 'local-bridge', env: ['YUANBAO_BRIDGE_URL or YUANBAO_BRIDGE_SCRIPT or YUANBAO_OUTBOX_DIR'], endpointEnv: ['YUANBAO_BRIDGE_URL'], scriptEnv: ['YUANBAO_BRIDGE_SCRIPT'], outboxEnv: 'YUANBAO_OUTBOX_DIR' },
  { id: 'sms', mode: 'bot-http', env: ['SMS_SEND_URL or SMS_API_BASE_URL', 'SMS_PROVIDER_TOKEN'], endpointEnv: ['SMS_SEND_URL', 'SMS_API_BASE_URL'], tokenEnv: ['SMS_PROVIDER_TOKEN'] },
  { id: 'home-assistant', mode: 'webhook', env: ['HOME_ASSISTANT_WEBHOOK_URL or HOME_ASSISTANT_URL'], webhookEnv: ['HOME_ASSISTANT_WEBHOOK_URL'], endpointEnv: ['HOME_ASSISTANT_URL'], tokenEnv: ['HOME_ASSISTANT_TOKEN'] },
  { id: 'voice-call', mode: 'local-bridge', env: ['VOICE_CALL_BRIDGE_URL or VOICE_CALL_BRIDGE_SCRIPT or VOICE_CALL_OUTBOX_DIR'], endpointEnv: ['VOICE_CALL_BRIDGE_URL'], scriptEnv: ['VOICE_CALL_BRIDGE_SCRIPT'], outboxEnv: 'VOICE_CALL_OUTBOX_DIR' },
  { id: 'google-meet', mode: 'local-bridge', env: ['GOOGLE_MEET_BRIDGE_URL or GOOGLE_MEET_BRIDGE_SCRIPT or GOOGLE_MEET_OUTBOX_DIR'], endpointEnv: ['GOOGLE_MEET_BRIDGE_URL'], scriptEnv: ['GOOGLE_MEET_BRIDGE_SCRIPT'], outboxEnv: 'GOOGLE_MEET_OUTBOX_DIR' },
  { id: 'line', mode: 'line', env: ['LINE_CHANNEL_ACCESS_TOKEN'], targetEnv: ['LINE_DEFAULT_TARGET_ID'] },
  { id: 'twitch', mode: 'local-bridge', env: ['TWITCH_BRIDGE_URL or TWITCH_WEBHOOK_URL or TWITCH_OUTBOX_DIR'], endpointEnv: ['TWITCH_BRIDGE_URL'], webhookEnv: ['TWITCH_WEBHOOK_URL'], scriptEnv: ['TWITCH_SCRIPT_PATH'], outboxEnv: 'TWITCH_OUTBOX_DIR' },
  { id: 'qq', mode: 'bot-http', env: ['QQ_BOT_WEBHOOK_URL or QQ_SEND_URL'], endpointEnv: ['QQ_SEND_URL'], webhookEnv: ['QQ_BOT_WEBHOOK_URL'] },
  { id: 'nextcloud-talk', aliases: ['nextcloud'], mode: 'webhook', env: ['NEXTCLOUD_TALK_WEBHOOK_URL'], webhookEnv: ['NEXTCLOUD_TALK_WEBHOOK_URL'] },
  { id: 'mattermost', mode: 'webhook', env: ['MATTERMOST_WEBHOOK_URL'], webhookEnv: ['MATTERMOST_WEBHOOK_URL'] },
  { id: 'synology-chat', aliases: ['synology'], mode: 'webhook', env: ['SYNOLOGY_CHAT_WEBHOOK_URL'], webhookEnv: ['SYNOLOGY_CHAT_WEBHOOK_URL'] },
  { id: 'clickclack', mode: 'webhook', env: ['CLICKCLACK_WEBHOOK_URL'], webhookEnv: ['CLICKCLACK_WEBHOOK_URL'] },
  { id: 'nostr', aliases: ['nost'], mode: 'local-bridge', env: ['NOSTR_BRIDGE_URL or NOSTR_OUTBOX_DIR'], endpointEnv: ['NOSTR_BRIDGE_URL'], outboxEnv: 'NOSTR_OUTBOX_DIR' },
];

function parseMessageCompose(args: string[]): MessageCompose {
  const channel = readFlag(args, 'channel') || 'unknown';
  const target = readFlag(args, 'target') || readFlag(args, 'to') || '';
  const body = readFlag(args, 'message') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
  return {
    channel,
    targets: splitList(target),
    message: body,
    attachments: readFlags(args, 'attach').concat(readFlags(args, 'file')),
    threadId: readFlag(args, 'thread') || readFlag(args, 'thread-id') || '',
    replyTo: readFlag(args, 'reply-to') || readFlag(args, 'reply') || '',
    reaction: readFlag(args, 'reaction') || '',
    mentions: splitList(readFlag(args, 'mention') || readFlag(args, 'mentions') || ''),
  };
}

async function deliverMessageAdvanced(root: string, args: string[], compose: MessageCompose): Promise<JsonObject> {
  if (!compose.message.trim() && compose.attachments.length === 0 && !compose.reaction) return { ok: false, reason: 'empty-message' };
  if (compose.attachments.length > 0 && !args.includes('--file-consent')) {
    return { ok: false, reason: 'file-consent-required', attachments: compose.attachments.map((file) => path.basename(file)) };
  }
  const rate = await enforceChannelRateLimit(root, compose.channel, args);
  if (!rate.ok) return rate;
  const attachmentRecords = args.includes('--file-consent')
    ? await resolveAttachments(root, compose.attachments)
    : [];
  const targets = compose.targets.length > 0 ? compose.targets : [''];
  const receipts: JsonObject[] = [];
  for (const target of targets) {
    const result = await deliverMessage(root, compose.channel, target, compose.message, args, {
      attachments: attachmentRecords,
      threadId: compose.threadId,
      replyTo: compose.replyTo,
      reaction: compose.reaction,
      mentions: compose.mentions,
    });
    receipts.push({ target: target || '<default>', ...result });
  }
  return {
    ok: receipts.every((receipt) => Boolean(receipt.ok)),
    channel: resolveChannelAdapter(compose.channel).id,
    targets: receipts.length,
    receipts,
    attachments: attachmentRecords.map((item) => ({ file: item.file, bytes: item.bytes, sha256: item.sha256 })),
  };
}

async function enforceChannelRateLimit(root: string, channel: string, args: string[]): Promise<JsonObject> {
  const normalized = resolveChannelAdapter(channel).id;
  const limit = readNumberFlag(args, 'rate-limit') || Number(getEnv(`${envPrefix(normalized)}_RATE_LIMIT_PER_MINUTE`) || 20);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true };
  const file = path.join(stateDir(root), 'message-rate-limits.json');
  const records = await readArray(file);
  const now = Date.now();
  const recent = records.filter((entry) => {
    const item = entry as JsonObject;
    return String(item.channel) === normalized && now - Number(item.at || 0) < 60_000;
  });
  if (recent.length >= limit) {
    return { ok: false, reason: 'channel-rate-limit-exceeded', channel: normalized, limitPerMinute: limit };
  }
  recent.push({ channel: normalized, at: now });
  await writeJson(file, records.filter((entry) => now - Number((entry as JsonObject).at || 0) < 60_000).concat([{ channel: normalized, at: now }]));
  return { ok: true };
}

async function resolveAttachments(root: string, attachments: string[]): Promise<Array<{ file: string; absolutePath: string; bytes: number; sha256: string; contentBase64?: string }>> {
  const records: Array<{ file: string; absolutePath: string; bytes: number; sha256: string; contentBase64?: string }> = [];
  for (const file of attachments) {
    const absolutePath = path.resolve(root, file);
    if (!isInside(root, absolutePath) || !existsSync(absolutePath)) continue;
    const raw = await fs.readFile(absolutePath);
    records.push({
      file: path.relative(root, absolutePath),
      absolutePath,
      bytes: raw.byteLength,
      sha256: sha256(raw),
      contentBase64: raw.byteLength <= 5_000_000 ? raw.toString('base64') : undefined,
    });
  }
  return records;
}

async function deliverMessage(
  root: string,
  channel: string,
  target: string,
  message: string,
  args: string[],
  meta: {
    attachments?: Array<{ file: string; bytes: number; sha256: string; contentBase64?: string }>;
    threadId?: string;
    replyTo?: string;
    reaction?: string;
    mentions?: string[];
  } = {},
): Promise<JsonObject> {
  if (!message.trim() && !(meta.attachments || []).length && !meta.reaction) return { ok: false, reason: 'empty-message' };
  const adapter = resolveChannelAdapter(channel);
  const normalized = adapter.id;
  const text = message.trim() || `[${(meta.attachments || []).length} attachment(s)]`;
  try {
    if (normalized === 'telegram') {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = target || readFlag(args, 'chat-id') || process.env.TELEGRAM_DEFAULT_CHAT_ID;
      if (!token || !chatId) return { ok: false, reason: 'missing-telegram-token-or-chat-id' };
      if ((meta.attachments || []).length > 0) {
        const attachmentReceipts: JsonObject[] = [];
        for (const attachment of meta.attachments || []) {
          const fileResult = await sendTelegramDocument(token, chatId, text, attachment);
          attachmentReceipts.push(fileResult);
        }
        return { ok: attachmentReceipts.every((receipt) => Boolean(receipt.ok)), channel: 'telegram', attachments: attachmentReceipts };
      }
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: meta.replyTo || undefined }),
      });
      return { ok: response.ok, status: response.status, channel: 'telegram' };
    }
    if (normalized === 'matrix') {
      const baseUrl = getEnv('MATRIX_BASE_URL')?.replace(/\/$/u, '');
      const token = getEnv('MATRIX_ACCESS_TOKEN');
      const roomId = target || readFlag(args, 'room-id') || getEnv('MATRIX_DEFAULT_ROOM_ID');
      if (!baseUrl || !token || !roomId) return { ok: false, reason: 'missing-matrix-base-url-token-or-room-id' };
      const txnId = idWithTime('zavorth');
      const response = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ msgtype: 'm.text', body: text, 'm.relates_to': meta.replyTo ? { 'm.in_reply_to': { event_id: meta.replyTo } } : undefined }),
      });
      return { ok: response.ok, status: response.status, channel: normalized };
    }
    if (normalized === 'line') {
      const token = getEnv('LINE_CHANNEL_ACCESS_TOKEN');
      const recipient = target || readFlag(args, 'to') || getEnv('LINE_DEFAULT_TARGET_ID');
      if (!token || !recipient) return { ok: false, reason: 'missing-line-token-or-target' };
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: recipient, messages: [{ type: 'text', text }] }),
      });
      return { ok: response.ok, status: response.status, channel: normalized };
    }
    const webhook = readFlag(args, 'webhook-url') || getFirstEnv(adapter.webhookEnv || []);
    if (webhook) {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(channelWebhookPayload(normalized, text, target, meta)),
      });
      return { ok: response.ok, status: response.status, channel: normalized, mode: 'webhook' };
    }
    const endpoint = getFirstEnv(adapter.endpointEnv || []);
    if (endpoint) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: channelEndpointHeaders(adapter),
        body: JSON.stringify({ channel: normalized, target, recipients: target ? [target] : [], text, message: text, threadId: meta.threadId || null, replyTo: meta.replyTo || null, reaction: meta.reaction || null, mentions: meta.mentions || [], attachments: safeAttachmentMetadata(meta.attachments || []) }),
      });
      return { ok: response.ok, status: response.status, channel: normalized, mode: adapter.mode };
    }
    const script = getFirstEnv(adapter.scriptEnv || []);
    if (script) {
      const result = await runChannelScript(script, adapter, target, text);
      return { ok: result.exitCode === 0, channel: normalized, mode: adapter.mode, exitCode: result.exitCode, durationMs: result.durationMs };
    }
    const outboxDir = getEnv(adapter.outboxEnv || '') || path.join(stateDir(root), 'outbox', normalized);
    if (adapter.outboxEnv && outboxDir) {
      const receipt = await writeChannelOutbox(outboxDir, normalized, target, text, meta);
      return { ok: true, channel: normalized, mode: 'outbox', receipt };
    }
    return { ok: false, reason: `missing-channel-config:${normalized}`, required: adapter.env };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function readChannelMessages(channel: string, args: string[]): Promise<{ lines: string[]; payload: JsonObject }> {
  const normalized = channel.toLowerCase();
  try {
    if (normalized === 'telegram') {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return { lines: ['Telegram token is missing.'], payload: { ok: false, reason: 'missing-telegram-token' } };
      const limit = readNumberFlag(args, 'limit') || 5;
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=${limit}`);
      const data = await response.json() as { ok?: boolean; result?: Array<JsonObject> };
      const updates = Array.isArray(data.result) ? data.result.slice(-limit) : [];
      return {
        lines: updates.length
          ? updates.map((update) => {
              const message = (update.message || update.edited_message || {}) as JsonObject;
              const from = (message.from || {}) as JsonObject;
              return `- ${String(update.update_id)} | ${String(from.username || from.id || 'unknown')} | ${redact(String(message.text || '<non-text>'))}`;
            })
          : ['No Telegram updates returned.'],
        payload: { ok: response.ok && data.ok !== false, channel: 'telegram', count: updates.length },
      };
    }
    if (['matrix'].includes(normalized)) {
      const baseUrl = getEnv('MATRIX_BASE_URL')?.replace(/\/$/u, '');
      const token = getEnv('MATRIX_ACCESS_TOKEN');
      const roomId = readFlag(args, 'room-id') || getEnv('MATRIX_DEFAULT_ROOM_ID');
      if (!baseUrl || !token || !roomId) return { lines: ['Matrix base URL, access token or room id is missing.'], payload: { ok: false, reason: 'missing-matrix-base-url-token-or-room-id' } };
      const limit = readNumberFlag(args, 'limit') || 5;
      const response = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=${limit}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await response.json() as { chunk?: Array<JsonObject> };
      const events = Array.isArray(data.chunk) ? data.chunk.slice(0, limit) : [];
      return {
        lines: events.length
          ? events.map((event) => {
              const content = (event.content || {}) as JsonObject;
              return `- ${String(event.event_id || event.origin_server_ts || 'event')} | ${redact(String(content.body || '<non-text>'))}`;
            })
          : ['No Matrix messages returned.'],
        payload: { ok: response.ok, channel: 'matrix', count: events.length },
      };
    }
    return { lines: [`Live read is not available for ${channel} yet.`], payload: { ok: false, reason: `unsupported-live-read:${channel}` } };
  } catch (error) {
    return { lines: [`Live read failed: ${error instanceof Error ? error.message : String(error)}`], payload: { ok: false, reason: error instanceof Error ? error.message : String(error) } };
  }
}

async function lookupChannelDirectory(channel: string, kind: 'self' | 'peers' | 'groups', args: string[]): Promise<{ lines: string[]; payload: JsonObject; entries: JsonObject[] }> {
  const normalized = resolveChannelAdapter(channel).id;
  try {
    if (normalized === 'telegram') {
      const token = getEnv('TELEGRAM_BOT_TOKEN');
      if (!token) return { lines: ['Telegram token is missing.'], payload: { ok: false, reason: 'missing-telegram-token' }, entries: [] };
      if (kind === 'self') {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json() as { ok?: boolean; result?: JsonObject };
        const bot = data.result || {};
        const entry = {
          id: 'telegram:self',
          channel: 'telegram',
          externalId: String(bot.id || ''),
          label: String(bot.username || bot.first_name || 'Telegram bot'),
          kind: 'self',
          source: 'telegram.getMe',
          syncedAt: new Date().toISOString(),
        };
        return { lines: [formatDirectoryEntry(entry)], payload: { ok: response.ok && data.ok !== false, entry }, entries: [entry] };
      }
      const limit = readNumberFlag(args, 'limit') || 50;
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=${limit}`);
      const data = await response.json() as { ok?: boolean; result?: Array<JsonObject> };
      const updates = Array.isArray(data.result) ? data.result : [];
      const map = new Map<string, JsonObject>();
      for (const update of updates) {
        const message = (update.message || update.edited_message || update.channel_post || {}) as JsonObject;
        const chat = (message.chat || {}) as JsonObject;
        const type = String(chat.type || '');
        const directoryKind = ['group', 'supergroup', 'channel'].includes(type) ? 'group' : 'peer';
        if ((kind === 'groups' && directoryKind !== 'group') || (kind === 'peers' && directoryKind !== 'peer')) continue;
        const externalId = String(chat.id || '');
        if (!externalId) continue;
        map.set(externalId, {
          id: `telegram:${externalId}`,
          channel: 'telegram',
          externalId,
          label: String(chat.title || chat.username || chat.first_name || externalId),
          kind: directoryKind,
          source: 'telegram.getUpdates',
          syncedAt: new Date().toISOString(),
        });
      }
      const entries = Array.from(map.values());
      return {
        lines: entries.length ? entries.map(formatDirectoryEntry) : ['No Telegram directory entries returned. Send a message to the bot first, then retry.'],
        payload: { ok: response.ok && data.ok !== false, count: entries.length, entries },
        entries,
      };
    }
    if (normalized === 'matrix') {
      const baseUrl = getEnv('MATRIX_BASE_URL')?.replace(/\/$/u, '');
      const token = getEnv('MATRIX_ACCESS_TOKEN');
      if (!baseUrl || !token) return { lines: ['Matrix base URL or access token is missing.'], payload: { ok: false, reason: 'missing-matrix-base-url-or-token' }, entries: [] };
      if (kind === 'self') {
        const response = await fetch(`${baseUrl}/_matrix/client/v3/account/whoami`, { headers: { authorization: `Bearer ${token}` } });
        const data = await response.json() as JsonObject;
        const entry = { id: `matrix:${String(data.user_id || 'self')}`, channel: 'matrix', externalId: String(data.user_id || ''), label: String(data.user_id || 'Matrix user'), kind: 'self', source: 'matrix.whoami', syncedAt: new Date().toISOString() };
        return { lines: [formatDirectoryEntry(entry)], payload: { ok: response.ok, entry }, entries: [entry] };
      }
      const response = await fetch(`${baseUrl}/_matrix/client/v3/joined_rooms`, { headers: { authorization: `Bearer ${token}` } });
      const data = await response.json() as { joined_rooms?: string[] };
      const entries = (data.joined_rooms || []).map((roomId) => ({ id: `matrix:${roomId}`, channel: 'matrix', externalId: roomId, label: roomId, kind: 'group', source: 'matrix.joined_rooms', syncedAt: new Date().toISOString() }));
      return { lines: entries.length ? entries.map(formatDirectoryEntry) : ['No Matrix rooms returned.'], payload: { ok: response.ok, count: entries.length, entries }, entries };
    }
    return { lines: [`Live directory lookup is not available for ${channel} yet. Use zavorth directory add to store trusted IDs locally.`], payload: { ok: false, reason: `unsupported-live-directory:${channel}` }, entries: [] };
  } catch (error) {
    return { lines: [`Live directory lookup failed: ${error instanceof Error ? error.message : String(error)}`], payload: { ok: false, reason: error instanceof Error ? error.message : String(error) }, entries: [] };
  }
}

async function createPairingDraft(root: string, input: { channel: string; target: string; label: string; ttlMinutes: number }): Promise<JsonObject> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttlMinutes * 60_000).toISOString();
  const code = createHash('sha256').update(`${root}:${input.channel}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 10).toUpperCase();
  const id = idWithTime('pairing');
  const uri = `zavorth://pair?pairing=${encodeURIComponent(id)}&channel=${encodeURIComponent(input.channel)}&code=${encodeURIComponent(code)}`;
  const record = {
    id,
    channel: resolveChannelAdapter(input.channel).id,
    target: input.target || null,
    label: input.label,
    status: 'pending',
    code,
    codeHash: hashPairingCode(code),
    uri,
    createdAt: now.toISOString(),
    expiresAt,
    ttlMinutes: input.ttlMinutes,
  };
  const file = path.join(stateDir(root), 'pairings.json');
  const pairings = await readArray(file);
  const { code: _code, uri: _uri, ...storedRecord } = record;
  pairings.push(storedRecord);
  await writeJson(file, pairings);
  return record;
}

async function renderTerminalQr(value: string): Promise<string> {
  try {
    const loader = Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ default?: { toString?: unknown }; toString?: unknown }>;
    const module = await loader('qrcode');
    const toString = (module.toString || module.default?.toString) as ((text: string, options: JsonObject) => Promise<string>) | undefined;
    if (!toString) return '';
    return (await toString(value, { type: 'terminal', small: true, margin: 1 })).trim();
  } catch {
    return '';
  }
}

function hashPairingCode(code: string): string {
  return createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');
}

function pairingExpired(pairing: JsonObject): boolean {
  const expiresAt = Date.parse(String(pairing.expiresAt || ''));
  return Number.isFinite(expiresAt) && expiresAt < Date.now();
}

function redactPairingRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.code) item.code = redact(String(item.code));
  if (item.codeHash) item.codeHash = '***';
  if (item.uri) item.uri = String(item.uri).replace(/code=[^&]+/u, 'code=***');
  return item;
}

function formatDirectoryEntry(value: unknown): string {
  const item = (value || {}) as JsonObject;
  return `- ${String(item.channel || 'channel')} | ${String(item.kind || 'entry')} | ${String(item.label || item.externalId || item.id || 'unknown')} | ${String(item.externalId || item.id || '')}`;
}

function mergeDirectoryEntries(existing: unknown[], incoming: JsonObject[]): JsonObject[] {
  const map = new Map<string, JsonObject>();
  for (const entry of existing) {
    const item = entry as JsonObject;
    map.set(`${String(item.channel)}:${String(item.externalId || item.id)}`, item);
  }
  for (const item of incoming) {
    map.set(`${String(item.channel)}:${String(item.externalId || item.id)}`, item);
  }
  return Array.from(map.values());
}

function isChannelConfigured(channel: string): boolean {
  return channelStatus(channel).configured;
}

function resolveChannelAdapter(channel: string): ChannelAdapter {
  const normalized = String(channel || 'unknown').trim().toLowerCase();
  return CHANNEL_ADAPTERS.find((adapter) => {
    return adapter.id === normalized || (adapter.aliases || []).includes(normalized);
  }) || {
    id: normalized,
    mode: 'outbox',
    env: [`${envPrefix(normalized)}_WEBHOOK_URL or ${envPrefix(normalized)}_OUTBOX_DIR`],
    webhookEnv: [`${envPrefix(normalized)}_WEBHOOK_URL`],
    outboxEnv: `${envPrefix(normalized)}_OUTBOX_DIR`,
  };
}

function channelStatus(channel: string): { id: string; configured: boolean; mode: ChannelAdapterMode | 'outbox-ready'; required: string[] } {
  const adapter = resolveChannelAdapter(channel);
  if (adapter.id === 'telegram') {
    return { id: adapter.id, configured: Boolean(getEnv('TELEGRAM_BOT_TOKEN')), mode: adapter.mode, required: adapter.env };
  }
  if (adapter.id === 'matrix') {
    return { id: adapter.id, configured: Boolean(getEnv('MATRIX_BASE_URL') && getEnv('MATRIX_ACCESS_TOKEN')), mode: adapter.mode, required: adapter.env };
  }
  if (adapter.id === 'line') {
    return { id: adapter.id, configured: Boolean(getEnv('LINE_CHANNEL_ACCESS_TOKEN')), mode: adapter.mode, required: adapter.env };
  }
  if (adapter.id === 'signal') {
    return {
      id: adapter.id,
      configured: Boolean((getEnv('SIGNAL_JSONRPC_URL') || getEnv('SIGNAL_CLI_PATH')) && getEnv('SIGNAL_ACCOUNT_NUMBER') && getEnv('SIGNAL_ALLOWED_RECIPIENTS')),
      mode: adapter.mode,
      required: adapter.env,
    };
  }
  const configured = Boolean(
    getFirstEnv(adapter.webhookEnv || [])
    || getFirstEnv(adapter.endpointEnv || [])
    || getFirstEnv(adapter.scriptEnv || [])
    || getEnv(adapter.outboxEnv || ''),
  );
  return { id: adapter.id, configured, mode: configured ? adapter.mode : 'outbox-ready', required: adapter.env };
}

function channelWebhookPayload(channel: string, message: string, target: string, meta: { attachments?: Array<{ file: string; bytes: number; sha256: string }>; threadId?: string; replyTo?: string; reaction?: string; mentions?: string[] } = {}): JsonObject {
  const rich = { threadId: meta.threadId || null, replyTo: meta.replyTo || null, reaction: meta.reaction || null, mentions: meta.mentions || [], attachments: safeAttachmentMetadata(meta.attachments || []) };
  if (channel === 'discord') return { content: message, ...rich };
  if (channel === 'slack' || channel === 'google-chat' || channel === 'mattermost' || channel === 'synology-chat' || channel === 'clickclack' || channel === 'nextcloud-talk') {
    return { text: message, ...rich };
  }
  if (channel === 'feishu') return { msg_type: 'text', content: { text: message }, ...rich };
  if (channel === 'wecom') return { msgtype: 'text', text: { content: message }, ...rich };
  return { source: 'zavorth', channel, target, text: message, message, ...rich };
}

function channelEndpointHeaders(adapter: ChannelAdapter): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = getFirstEnv(adapter.tokenEnv || []);
  if (token) headers.authorization = `Bearer ${token}`;
  if (adapter.id === 'signal' && getEnv('SIGNAL_BRIDGE_TOKEN')) headers.authorization = `Bearer ${getEnv('SIGNAL_BRIDGE_TOKEN')}`;
  if (adapter.id === 'imessage' && getEnv('IMESSAGE_BRIDGE_TOKEN')) headers.authorization = `Bearer ${getEnv('IMESSAGE_BRIDGE_TOKEN')}`;
  return headers;
}

async function writeChannelOutbox(outboxDir: string, channel: string, target: string, message: string, meta: {
  attachments?: Array<{ file: string; bytes: number; sha256: string }>;
  threadId?: string;
  replyTo?: string;
  reaction?: string;
  mentions?: string[];
} = {}): Promise<JsonObject> {
  await ensureDir(outboxDir);
  const id = idWithTime(`${channel}-outbox`);
  const file = path.join(outboxDir, `${id}.json`);
  const receipt = {
    id,
    channel,
    target: target || null,
    message,
    threadId: meta.threadId || null,
    replyTo: meta.replyTo || null,
    reaction: meta.reaction || null,
    mentions: meta.mentions || [],
    attachments: safeAttachmentMetadata(meta.attachments || []),
    status: 'queued-for-bridge',
    createdAt: new Date().toISOString(),
  };
  await writeJson(file, receipt);
  return { id, file, status: 'queued-for-bridge' };
}

async function sendTelegramDocument(token: string, chatId: string, caption: string, attachment: { file: string; contentBase64?: string }): Promise<JsonObject> {
  if (!attachment.contentBase64) return { ok: false, file: attachment.file, reason: 'attachment-too-large-for-cli-upload' };
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('caption', caption);
  const bytes = Buffer.from(attachment.contentBase64, 'base64');
  form.set('document', new Blob([bytes]), path.basename(attachment.file));
  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  return { ok: response.ok, status: response.status, file: attachment.file };
}

function safeAttachmentMetadata(attachments: Array<{ file: string; bytes: number; sha256: string }>): JsonObject[] {
  return attachments.map((attachment) => ({
    file: attachment.file,
    bytes: attachment.bytes,
    sha256: attachment.sha256,
  }));
}

async function runChannelScript(script: string, adapter: ChannelAdapter, target: string, message: string): Promise<{ exitCode: number; durationMs: number }> {
  if (adapter.id === 'signal') {
    const account = getEnv('SIGNAL_ACCOUNT_NUMBER');
    const recipients = splitList(target || getEnv('SIGNAL_ALLOWED_RECIPIENTS') || '');
    if (!account || recipients.length === 0) return { exitCode: 1, durationMs: 0 };
    const result = await runProcess(script, ['-u', account, 'send', '-m', message, ...recipients], process.cwd(), 30000);
    return { exitCode: result.exitCode, durationMs: result.durationMs };
  }
  const recipients = target ? [target] : splitList(getEnv(`${envPrefix(adapter.id)}_DEFAULT_RECIPIENTS`) || '');
  const result = await runProcess(script, [
    '--channel',
    adapter.id,
    '--recipients',
    recipients.join(','),
    '--message',
    message,
  ], process.cwd(), 30000);
  return { exitCode: result.exitCode, durationMs: result.durationMs };
}

function splitList(value: string): string[] {
  return value.split(/[,\n;]/u).map((entry) => entry.trim()).filter(Boolean);
}

function getFirstEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return undefined;
}

function getEnv(name: string): string | undefined {
  if (!name) return undefined;
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function envPrefix(value: string): string {
  return value.replace(/[^a-z0-9]+/giu, '_').replace(/^_+|_+$/gu, '').toUpperCase() || 'CHANNEL';
}

function isProviderConfigured(provider: string): boolean {
  const normalized = provider.toLowerCase();
  if (normalized === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  if (normalized === 'openrouter') return Boolean(process.env.OPENROUTER_API_KEY);
  if (normalized === 'groq') return Boolean(process.env.GROQ_API_KEY);
  if (normalized === 'deepseek') return Boolean(process.env.DEEPSEEK_API_KEY);
  if (normalized === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  if (normalized === 'ollama') return Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL);
  return false;
}

async function inferText(provider: string, prompt: string, args: string[]): Promise<JsonObject> {
  if (!prompt.trim()) return { ok: false, reason: 'empty-prompt' };
  try {
    if (provider === 'ollama') {
      const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/u, '');
      const model = readFlag(args, 'model') || process.env.OLLAMA_MODEL || 'llama3.1';
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
      });
      const data = await response.json() as JsonObject;
      return { ok: response.ok, status: response.status, provider, model, text: data.response || data.error || '' };
    }
    if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return { ok: false, reason: 'missing-gemini-api-key' };
      const model = readFlag(args, 'model') || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await response.json() as JsonObject;
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const first = (candidates[0] || {}) as JsonObject;
      const content = (first.content || {}) as JsonObject;
      const parts = Array.isArray(content.parts) ? content.parts : [];
      return { ok: response.ok, status: response.status, provider, model, text: String((parts[0] as JsonObject | undefined)?.text || data.error || '') };
    }
    const openAiLike = resolveOpenAiLikeProvider(provider, args);
    if (!openAiLike.apiKey) return { ok: false, reason: `missing-${provider}-api-key` };
    const response = await fetch(`${openAiLike.baseUrl.replace(/\/$/u, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${openAiLike.apiKey}`,
      },
      body: JSON.stringify({ model: openAiLike.model, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await response.json() as JsonObject;
    const choices = Array.isArray(data.choices) ? data.choices : [];
    const message = ((choices[0] as JsonObject | undefined)?.message || {}) as JsonObject;
    return { ok: response.ok, status: response.status, provider, model: openAiLike.model, text: String(message.content || data.error || '') };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function resolveOpenAiLikeProvider(provider: string, args: string[]): { baseUrl: string; apiKey?: string; model: string } {
  if (provider === 'openrouter') {
    return {
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: readFlag(args, 'model') || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    };
  }
  if (provider === 'groq') {
    return {
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      model: readFlag(args, 'model') || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    };
  }
  if (provider === 'deepseek') {
    return {
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: readFlag(args, 'model') || process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    };
  }
  return {
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: readFlag(args, 'model') || process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };
}

function runProcess(command: string, args: string[], cwd: string, timeoutMs: number): Promise<{ exitCode: number; output: string; durationMs: number; timedOut: boolean }> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: args.length === 0, windowsHide: true });
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ exitCode: 124, output: output.trim(), durationMs: Date.now() - startedAt, timedOut: true });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, output: error.message, durationMs: Date.now() - startedAt, timedOut: false });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code || 0, output: output.trim(), durationMs: Date.now() - startedAt, timedOut: false });
    });
  });
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function idFromSpec(spec: string): string {
  return spec.replace(/[^a-z0-9._-]+/giu, '-').replace(/^-+|-+$/gu, '').toLowerCase() || idWithTime('plugin');
}

function resolveNpmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function isInside(root: string, target: string): boolean {
  const normalizedRoot = path.resolve(root).toLowerCase();
  const normalizedTarget = path.resolve(target).toLowerCase();
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
}

async function postJson(url: string, body: unknown): Promise<JsonObject> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
