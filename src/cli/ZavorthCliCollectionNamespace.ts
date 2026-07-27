import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { spawnCommandLine } from '../security/SafeProcessExec.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { formatZavorthCertificationHelp } from './ZavorthCliCertificationCommands.js';
import { ZavorthOperationalReadinessService } from '../services/ZavorthOperationalReadinessService.js';
import { ZavorthNativeCapabilityCertificationService } from '../services/ZavorthNativeCapabilityCertificationService.js';
import { ZavorthProductExcellenceService } from '../services/ZavorthProductExcellenceService.js';
import { AutonomySchedulePlane, bindAutonomySchedulePlane } from '../services/AutonomySchedulePlane.js';
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
import { SessionContinuumService, resolveSessionContinuumStorePath } from '../services/SessionContinuumService.js';
import { ZavorthXaiRuntimeService } from '../services/ZavorthXaiRuntimeService.js';
import { ZavorthOperationalStateDbService } from '../services/ZavorthOperationalStateDbService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import { runSkills as runSkillsNamespace } from './skills/ZavorthCliSkillsNamespace.js';
import { runPlugins as runPluginsNamespace } from './plugins/ZavorthCliPluginsNamespace.js';
import { AgentRunService } from '../runtime/agent/AgentRunService.js';
import { AgentUnifiedHealthService } from '../services/AgentUnifiedHealthService.js';
import { TerminalPanel } from './presentation/TerminalPanel.js';
import { ChannelGatewayFactory } from '../gateways/ChannelGatewayFactory.js';
import { runCertify } from './certify/ZavorthCliCertifyNamespace.js';
import { runSandbox } from './sandbox/ZavorthCliSandboxNamespace.js';
import {
  firstArg,
  readFlag,
  readFlags,
  readNumberFlag,
  stateDir,
  ensureDir,
  readJson,
  readArray,
  writeJson,
  appendJsonArray,
  listJsonFiles,
  listAnyFiles,
  walkFiles,
  idWithTime,
  safeString,
  isInside,
  runProcess,
  sha256,
  render,
  normalizeRenderLines,
  resolvePanelType,
  terminalPanelWidth,
  text,
  splitList,
  getEnv,
  quoteEnv,
  mergeSingleEnvValue,
} from './ZavorthCliSharedHelpers.js';
import type {
  ZavorthCapabilityUsageEventKind,
  ZavorthCapabilityUsageSurface,
} from '../contracts/ZavorthCapabilityUsageSignalsContract.js';
import type { ZavorthCapabilityAtlasCategory } from '../contracts/ZavorthCapabilityAtlasContract.js';
import type {
  ZavorthAppsSatelliteAction,
  ZavorthAppsSatelliteNodeKind,
} from '../contracts/ZavorthAppsSatelliteNodesContract.js';
import type { ZavorthTerminalBackendId } from '../contracts/runtime/ZavorthTerminalBackendsContract.js';
import type {
  SwarmScaleExecutionMode,
  SwarmScaleExecutionBackendId,
} from '../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
import { runBackground, runTaskBoard } from './ZavorthCliLiveNamespaces.js';
import { findById, redactCommand } from './ZavorthCliMcpNamespace.js';
import { inferText, isProviderConfigured, redact, redactUrl } from './ZavorthCliCommunicationNamespace.js';

type JsonObject = Record<string, unknown>;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

import { taskPlaneServiceForCli } from './ZavorthCliLiveNamespaces.js';

export async function runCollection(root: string, collection: string, args: string[], label: string) {
  const file = path.join(stateDir(root), `${collection}.json`);
  const action = firstArg(args, 'list');
  const items = await readArray(file);
  if (['add', 'create', 'pair'].includes(action)) {
    const item = {
      id: idWithTime(label),
      label:
        args
          .slice(1)
          .filter((arg) => !arg.startsWith('--'))
          .join(' ') || `${label} created from CLI`,
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
    if (!item)
      return render(args, `Zavorth ${collection}`, [`No ${label} found for id: ${id || '<missing>'}`], { ok: false });
    item.status = action === 'resolve' ? 'resolved' : action === 'cancel' ? 'cancelled' : 'revoked';
    item.updatedAt = new Date().toISOString();
    await writeJson(file, items);
    return render(args, `Zavorth ${collection}`, [`Updated ${label}: ${id} -> ${String(item.status)}`], { item });
  }
  if (['show', 'resume'].includes(action)) {
    const id = args[1];
    const item = items.find((entry) => String((entry as JsonObject).id) === id);
    return render(
      args,
      `Zavorth ${collection}`,
      item ? [JSON.stringify(item, null, 2)] : [`No ${label} found for id: ${id || '<missing>'}`],
      { item: item || null },
    );
  }
  return render(
    args,
    `Zavorth ${collection}`,
    items.length
      ? items.map(
          (item) =>
            `- ${String((item as JsonObject).id)} | ${String((item as JsonObject).status || 'ready')} | ${String((item as JsonObject).label || label)}`,
        )
      : [`No ${collection} recorded yet.`],
    { items },
  );
}

export async function runRunnableCollection(root: string, collection: string, args: string[], label: string) {
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
      label:
        args
          .slice(1)
          .filter((arg) => !arg.startsWith('--'))
          .join(' ') || `${label} created from CLI`,
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
    return render(
      args,
      `Zavorth ${collection}`,
      [
        `Created ${label}: ${String(item.id)}`,
        `Status: ${String(item.status)}`,
        item.taskPlane ? 'Target: Task Plane materialization' : 'Target: direct runnable worker',
        command ? `Command: ${redactCommand(command)}` : 'Command: not set',
      ],
      { item: sanitizeTaskRecord(item) },
    );
  }
  if (action === 'status') {
    const summary = summarizeTasks(items);
    return render(
      args,
      `Zavorth ${collection}`,
      [
        `queued: ${summary.queued}`,
        `scheduled: ${summary.scheduled}`,
        `running: ${summary.running}`,
        `completed: ${summary.completed}`,
        `failed: ${summary.failed}`,
        `cancelled: ${summary.cancelled}`,
      ],
      summary,
    );
  }
  if (action === 'worker') {
    if (!args.includes('--yes')) {
      return render(
        args,
        `Zavorth ${collection} worker`,
        [
          'Worker preview only. Add --yes to process due queued/scheduled work.',
          collection === 'cron-jobs'
            ? 'Add --task-plane to materialize due cron jobs into zavorth tasks instead of executing directly.'
            : 'Task worker will execute queued task commands after confirmation.',
          'Use --once for a single pass or --loop with --limit for repeated passes.',
        ],
        { dryRun: true, due: dueRunnableItems(items).map(sanitizeTaskRecord) },
      );
    }
    const result = await runTaskWorker(root, collection, label, args);
    return render(args, `Zavorth ${collection} worker`, result.lines, result.payload);
  }
  if (action === 'logs') {
    const id = args[1] || readFlag(args, 'id') || '';
    const logs = await readTaskLogs(root, collection, id);
    return render(
      args,
      `Zavorth ${collection} logs`,
      logs.length ? logs.slice(-30).map(formatTaskLogLine) : ['No task logs recorded yet.'],
      { logs },
    );
  }
  if (action === 'graph') {
    const graph = buildTaskGraph(items);
    return render(
      args,
      `Zavorth ${collection} graph`,
      graph.nodes.length
        ? [
            `nodes: ${graph.nodes.length}`,
            `edges: ${graph.edges.length}`,
            ...graph.edges.slice(0, 30).map((edge) => `${edge.from} -> ${edge.to}`),
          ]
        : ['No graph nodes yet.'],
      graph,
    );
  }
  if (['cancel', 'resume'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || '';
    const item = findById(items, id);
    if (!item)
      return render(args, `Zavorth ${collection}`, [`No ${label} found for id: ${id || '<missing>'}`], { ok: false });
    item.status = action === 'cancel' ? 'cancelled' : collection === 'cron-jobs' ? 'scheduled' : 'queued';
    item.updatedAt = new Date().toISOString();
    await writeJson(file, items);
    await appendTaskLog(root, collection, item, action, `${action === 'cancel' ? 'Cancelled' : 'Resumed'} ${label}`);
    return render(args, `Zavorth ${collection}`, [`${action === 'cancel' ? 'Cancelled' : 'Resumed'} ${label}: ${id}`], {
      item: sanitizeTaskRecord(item),
    });
  }
  if (['show', 'inspect'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || '';
    const item = findById(items, id);
    return render(
      args,
      `Zavorth ${collection}`,
      item ? taskDetailLines(item) : [`No ${label} found for id: ${id || '<missing>'}`],
      { item: item ? sanitizeTaskRecord(item) : null },
    );
  }
  if (action !== 'run' && action !== 'retry') {
    return render(
      args,
      `Zavorth ${collection}`,
      items.length ? items.map(formatTaskRow) : [`No ${collection} recorded yet.`],
      { items: items.map(sanitizeTaskRecord) },
    );
  }
  const id = args[1] || readFlag(args, 'id') || '';
  const item = items.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
  if (!item)
    return render(args, `Zavorth ${collection}`, [`No ${label} found for id: ${id || '<missing>'}`], { ok: false });
  if (wantsTaskPlaneMaterialization(collection, args, item)) {
    if (!args.includes('--yes')) {
      return render(
        args,
        `Zavorth ${collection}`,
        [
          `Task Plane materialization preview: ${String(item.label || item.id)}`,
          'Add --yes to create a persistent zavorth tasks item.',
        ],
        { dryRun: true, item: sanitizeTaskRecord(item), target: 'task-plane' },
      );
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
    return render(
      args,
      `Zavorth ${collection}`,
      [
        materialized.created ? `Created Task Plane item: ${String(materialized.taskId)}`
          : `Task Plane item already exists: ${String(materialized.taskId || 'unknown')}`,
        `Cron ${String(item.id)} -> ${String(item.status)}`,
      ],
      { item: sanitizeTaskRecord(item), taskPlane: materialized },
    );
  }
  const command = String(item.command || readFlag(args, 'command') || '');
  if (!command)
    return render(args, `Zavorth ${collection}`, [`No command stored for ${id}. Use --command when creating it.`], {
      ok: false,
    });
  if (!args.includes('--yes'))
    return render(
      args,
      `Zavorth ${collection}`,
      [
        `Run preview: ${redactCommand(command)}`,
        'Add --yes to execute this local command under the durable worker lock.',
      ],
      { dryRun: true, item: sanitizeTaskRecord(item) },
    );
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
  return render(
    args,
    `Zavorth ${collection}`,
    [`Run ${String(item.status)}: ${id}`, String(outcome.output || '<empty output>').slice(0, 1000)],
    { item: sanitizeTaskRecord(item), outcome },
  );
}

export function summarizeTasks(items: unknown[]): JsonObject {
  const summary: JsonObject = { queued: 0, scheduled: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
  for (const item of items) {
    const status = String((item as JsonObject).status || 'queued');
    summary[status] = Number(summary[status] || 0) + 1;
  }
  return summary;
}

export function dueRunnableItems(items: unknown[]): JsonObject[] {
  const now = Date.now();
  const byId = new Map(items.map((item) => [String((item as JsonObject).id), item as JsonObject]));
  return items
    .map((item) => item as JsonObject)
    .filter((item) => {
      const status = String(item.status || 'queued');
      if (!['queued', 'scheduled'].includes(status)) return false;
      const nextRunAt = Date.parse(String(item.nextRunAt || new Date().toISOString()));
      if (Number.isFinite(nextRunAt) && nextRunAt > now) return false;
      const deps = Array.isArray(item.dependsOn) ? item.dependsOn.map(String) : [];
      return deps.every((dep) => String(byId.get(dep)?.status || '') === 'completed');
    });
}

export async function runTaskWorker(
  root: string,
  collection: string,
  label: string,
  args: string[],
): Promise<{ lines: string[]; payload: JsonObject }> {
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
      processed.push({
        ...sanitizeTaskRecord(item),
        outcome: { exitCode: outcome.exitCode, durationMs: outcome.durationMs },
      });
    }
    await writeJson(file, items);
  } finally {
    await releaseTaskLock(lock.file);
  }
  return {
    lines: processed.length
      ? [
          `Processed ${processed.length} ${label}(s).`,
          ...processed.map(
            (item) => `- ${String(item.id)} | ${String(item.status)} | attempts ${String(item.attempts || 0)}`,
          ),
        ]
      : ['No due work found.'],
    payload: { ok: true, processed },
  };
}

export function wantsTaskPlaneMaterialization(collection: string, args: string[], item?: JsonObject): boolean {
  if (collection !== 'cron-jobs') {
    return false;
  }
  const target = String(readFlag(args, 'target') || item?.target || item?.taskTarget || '')
    .trim()
    .toLowerCase();
  return (
    args.includes('--task-plane') ||
    args.includes('--materialize-task') ||
    target === 'tasks' ||
    target === 'task-plane' ||
    item?.taskPlane === true
  );
}

export async function materializeCronItemToTaskPlane(
  root: string,
  item: JsonObject,
  args: string[],
): Promise<JsonObject> {
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
    title: String(
      readFlag(args, 'task-title') || item.taskTitle || item.label || `Cron ${String(item.id || 'job')}`,
    ).trim(),
    source: `cron:${String(item.id || 'unknown')}`,
    receiptId: `cron-task-plane:${String(item.id || 'unknown')}:${Date.now()}`,
    payload: {
      cronJobId: item.id || null,
      cronLabel: item.label || null,
      commandPreview: redactCommand(String(item.command || '')),
      commandDigest: createHash('sha256')
        .update(String(item.command || ''))
        .digest('hex'),
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

export async function executeTaskItem(
  root: string,
  collection: string,
  item: JsonObject,
  args: string[],
): Promise<JsonObject> {
  const command = String(item.command || '');
  item.status = 'running';
  item.startedAt = new Date().toISOString();
  item.attempts = Number(item.attempts || 0) + 1;
  item.updatedAt = new Date().toISOString();
  await appendTaskLog(root, collection, item, 'started', `Started: ${redactCommand(command)}`);
  const result = await runProcess(
    command,
    [],
    root,
    readNumberFlag(args, 'timeout-ms') || Number(item.timeoutMs || 30000),
  );
  item.lastRunAt = new Date().toISOString();
  item.lastRun = { ...result, output: String(result.output || '').slice(0, 4000) };
  const maxRetries = Number(item.maxRetries || 0);
  if (result.exitCode === 0) {
    item.status = collection === 'cron-jobs' && Number(item.everyMs || 0) > 0 ? 'scheduled' : 'completed';
    if (collection === 'cron-jobs' && Number(item.everyMs || 0) > 0)
      item.nextRunAt = new Date(Date.now() + Number(item.everyMs || 0)).toISOString();
    await appendTaskLog(root, collection, item, 'completed', String(result.output || '<empty output>').slice(0, 1000));
  } else if (Number(item.attempts || 0) <= maxRetries) {
    item.status = 'queued';
    item.nextRunAt = new Date(Date.now() + Number(item.retryDelayMs || 1000)).toISOString();
    await appendTaskLog(
      root,
      collection,
      item,
      'retry-scheduled',
      `Exit ${result.exitCode}; retry ${String(item.attempts)}/${maxRetries}`,
    );
  } else {
    item.status = 'failed';
    item.lastError = `exit ${result.exitCode}`;
    await appendTaskLog(
      root,
      collection,
      item,
      'failed',
      String(result.output || `exit ${result.exitCode}`).slice(0, 1000),
    );
  }
  item.updatedAt = new Date().toISOString();
  return result as JsonObject;
}

export async function acquireTaskLock(
  root: string,
  collection: string,
): Promise<{ ok: boolean; file: string; message: string }> {
  const file = path.join(stateDir(root), `${collection}.lock`);
  await ensureDir(path.dirname(file));
  try {
    const handle = await fs.open(file, 'wx');
    await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    await handle.close();
    return { ok: true, file, message: 'lock acquired' };
  } catch (error: unknown) {
    logger.warn('[Zavorth Cli Live Namespaces] filesystem operation failed', error);
    return {
      ok: false,
      file,
      message: `Worker lock is active for ${collection}. Use logs/status or remove stale lock only after verifying no worker is running.`,
    };
  }
}

export async function releaseTaskLock(file: string): Promise<void> {
  await fs.rm(file, { force: true });
}

export async function appendTaskLog(
  root: string,
  collection: string,
  item: JsonObject,
  event: string,
  message: string,
): Promise<void> {
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

export async function readTaskLogs(root: string, collection: string, id: string): Promise<JsonObject[]> {
  const logs = await readArray(path.join(stateDir(root), 'logs', `${collection}.json`));
  return logs.map((entry) => entry as JsonObject).filter((entry) => !id || String(entry.taskId) === id);
}

export function formatTaskLogLine(entry: JsonObject): string {
  return `- ${String(entry.createdAt)} | ${String(entry.taskId)} | ${String(entry.event)} | ${String(entry.status)} | ${String(entry.message)}`;
}

export function buildTaskGraph(items: unknown[]): { nodes: JsonObject[]; edges: Array<{ from: string; to: string }> } {
  const nodes = items.map((item) => sanitizeTaskRecord(item));
  const edges: Array<{ from: string; to: string }> = [];
  for (const item of items.map((entry) => entry as JsonObject)) {
    const deps = Array.isArray(item.dependsOn) ? item.dependsOn.map(String) : [];
    for (const dep of deps) edges.push({ from: dep, to: String(item.id) });
  }
  return { nodes, edges };
}

export function formatTaskRow(item: unknown): string {
  const task = item as JsonObject;
  const target = task.taskPlane ? ' -> task-plane' : '';
  return `- ${String(task.id)} | ${String(task.status || 'queued')} | attempts ${String(task.attempts || 0)} | ${String(task.label || 'task')}${target}`;
}

export function taskDetailLines(item: JsonObject): string[] {
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

export function sanitizeTaskRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.command) item.command = redactCommand(String(item.command));
  if (item.lastRun && typeof item.lastRun === 'object') {
    const run = { ...(item.lastRun as JsonObject) };
    if (run.output) run.output = String(run.output).slice(0, 500);
    item.lastRun = run;
  }
  return item;
}

export async function runDocs(root: string, args: string[]) {
  const action = firstArg(args, 'search');
  const query = (action === 'search' ? args.slice(1) : args)
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .toLowerCase();
  const docsDir = path.join(root, 'docs');
  if (action === 'live') {
    const url = readFlag(args, 'url') || process.env.ZAVORTH_DOCS_INDEX_URL || '';
    if (!url)
      return render(args, 'Zavorth docs', ['No live docs URL configured. Use --url <https://...>.'], { ok: false });
    if (!args.includes('--yes'))
      return render(
        args,
        'Zavorth docs',
        ['Live docs search preview. Add --yes to fetch remote docs index.', `URL: ${redactUrl(url)}`],
        { dryRun: true, url: redactUrl(url) },
      );
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
    return render(args, 'Zavorth docs', [`File: ${path.relative(root, selected.file)}`, '', content.slice(0, 4000)], {
      file: path.relative(root, selected.file),
    });
  }
  return render(
    args,
    'Zavorth docs',
    matches.length
      ? matches
          .slice(0, 20)
          .map((match) =>
            [
              `- ${path.relative(root, match.file)} (${match.score})`,
              ...match.excerpts.map((line) => `  ${line}`),
            ].join('\n'),
          )
      : ['No docs matched.'],
    { query, matches: matches.map((match) => ({ ...match, file: path.relative(root, match.file) })) },
  );
}

export async function buildDocsIndex(
  root: string,
): Promise<{ generatedAt: string; files: Array<{ file: string; title: string; sha256: string }> }> {
  const docsDir = path.join(root, 'docs');
  const files = await walkFiles(docsDir, 1000);
  const indexed = await Promise.all(
    files.map(async (file) => {
      const content = await fs.readFile(file);
      const text = content.toString('utf8');
      const title = text.match(/^#\s+(.+)$/mu)?.[1] || path.basename(file);
      return { file: path.relative(root, file), title, sha256: sha256(content) };
    }),
  );
  return { generatedAt: new Date().toISOString(), files: indexed };
}

export async function searchDocsFiles(
  root: string,
  files: string[],
  query: string,
): Promise<Array<{ file: string; score: number; excerpts: string[] }>> {
  const terms = query.split(/\s+/u).filter(Boolean);
  const results: Array<{ file: string; score: number; excerpts: string[] }> = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    const content = await fs.readFile(file, 'utf8').catch(() => '');
    const haystack = `${rel}\n${content}`.toLowerCase();
    const score = terms.length
      ? terms.reduce((sum, term) => sum + countOccurrences(haystack, term), 0)
      : rel.toLowerCase().includes('readme')
        ? 2
        : 1;
    if (score <= 0) continue;
    const lines = content.split(/\r...\n/u);
    const excerpts = terms.length
      ? lines.filter((line) => terms.some((term) => line.toLowerCase().includes(term))).slice(0, 3)
      : lines.filter((line) => line.trim()).slice(0, 2);
    results.push({ file, score, excerpts });
  }
  return results.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
}

export async function fetchDocsIndex(url: string, query: string): Promise<{ lines: string[]; payload: JsonObject }> {
  try {
    const response = await fetch(url);
    if (!response.ok)
      return {
        lines: [`Live docs fetch failed: HTTP ${response.status}`],
        payload: { ok: false, status: response.status },
      };
    const text = await response.text();
    const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
    const lines = text.split(/\r...\n/u);
    const matches = terms.length
      ? lines.filter((line) => terms.some((term) => line.toLowerCase().includes(term))).slice(0, 12)
      : lines.slice(0, 12);
    return {
      lines: matches.length ? matches : ['Live docs fetched, no matching lines.'],
      payload: { ok: true, url: redactUrl(url), matches },
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[Zavorth Cli Live Namespaces] network request failed', error);
    return {
      lines: [`Live docs fetch failed: ${error instanceof Error ? err.message : String(error)}`],
      payload: { ok: false },
    };
  }
}

export function countOccurrences(value: string, term: string): number {
  if (!term) return 0;
  return value.split(term).length - 1;
}

export async function runExecPolicy(root: string, args: string[]) {
  const file = path.join(stateDir(root), 'exec-policy.json');
  const policy = await readJson(file, {
    shell: 'approval-required',
    writes: 'approval-required',
    network: 'approval-required',
  });
  return render(
    args,
    'Zavorth exec-policy',
    Object.entries(policy as JsonObject).map(([key, value]) => `${key}: ${safeString(value)}`),
    { policy },
  );
}

export async function runHealth(root: string, args: string[]) {
  const checks = {
    config: existsSync(path.join(stateDir(root), 'cli-config.json')),
    package: existsSync(path.join(root, 'package.json')),
    nodeModules: existsSync(path.join(root, 'node_modules')),
    receipts: existsSync(path.join(stateDir(root), 'receipts')),
  };
  const workspaceId = `workspace-${createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 16)}`;

  const providers: Array<{
    id: string;
    label: string;
    read: () => {
      status: 'healthy' | 'attention' | 'critical' | 'unavailable';
      summary: string;
      recommendedAction: string | null;
    };
  }> = Object.entries(checks).map(([id, ready]) => ({
    id,
    label: id === 'nodeModules' ? 'Dependencies' : `${id.slice(0, 1).toUpperCase()}${id.slice(1)}`,
    read: () => ({
      status: ready ? ('healthy' as const) : ('attention' as const),
      summary: ready ? `${id} is ready.` : `${id} is missing.`,
      recommendedAction: ready ? null : id === 'nodeModules' ? 'Run npm install.' : 'Run zavorth setup.',
    }),
  }));

  // Live LLM / roles / governance diagnostics (best-effort).
  providers.push({
    id: 'llm-providers',
    label: 'LLM providers',
    read: () => {
      try {
        const runtime = new LlmRuntimeService();
        const names = ['gemini', 'openai', 'anthropic', 'deepseek', 'xai', 'openrouter'];
        const usable = names.filter((name) => {
          try {
            return runtime.isProviderAvailable(name);
          } catch {
            return false;
          }
        });
        if (usable.length === 0) {
          return {
            status: 'attention' as const,
            summary: 'No LLM provider credentials look usable right now.',
            recommendedAction: 'Configure at least one provider API key (e.g. GEMINI_API_KEY).',
          };
        }
        return {
          status: 'healthy' as const,
          summary: `Usable providers: ${usable.join(', ')}.`,
          recommendedAction: null,
        };
      } catch (error: unknown) {
        return {
          status: 'unavailable' as const,
          summary: error instanceof Error ? error.message : 'LLM runtime unavailable.',
          recommendedAction: 'Run zavorth doctor for provider setup.',
        };
      }
    },
  });

  providers.push({
    id: 'llm-roles',
    label: 'LLM roles store',
    read: () => {
      try {
        const { LlmRoleRoutingService } =
          require('../services/llm/LlmRoleRoutingService.js') as typeof import('../services/llm/LlmRoleRoutingService.js');
        const { resolveLlmRoleScopeId } =
          require('../contracts/runtime/LlmRoleRoutingContract.js') as typeof import('../contracts/runtime/LlmRoleRoutingContract.js');
        const roles = new LlmRoleRoutingService();
        const scopeId = resolveLlmRoleScopeId({
          userId: process.env.USER || process.env.USERNAME || 'cli',
          surface: 'cli',
        });
        const cfg = roles.getConfig(scopeId);
        const runtime = new LlmRuntimeService();
        const healthIssues = roles.healthCheck(scopeId, (name) => runtime.isProviderAvailable(name));
        if (healthIssues.some((issue) => issue.severity === 'error')) {
          return {
            status: 'critical' as const,
            summary: healthIssues.map((issue) => issue.message).join(' | '),
            recommendedAction: 'Run zavorth roles setup or /model setup.',
          };
        }
        if (!cfg.rolesConfigured) {
          return {
            status: 'attention' as const,
            summary: 'Default/strong roles are not configured yet.',
            recommendedAction: 'Run zavorth roles setup when multiple models are available.',
          };
        }
        if (healthIssues.length > 0) {
          return {
            status: 'attention' as const,
            summary: healthIssues.map((issue) => issue.message).join(' | '),
            recommendedAction: 'Review role bindings with zavorth roles status.',
          };
        }
        return {
          status: 'healthy' as const,
          summary: `Roles configured for ${scopeId} (default=${cfg.default ? `${cfg.default.provider}/${cfg.default.model}` : 'n/a'}).`,
          recommendedAction: null,
        };
      } catch (error: unknown) {
        return {
          status: 'unavailable' as const,
          summary: error instanceof Error ? error.message : 'Roles store unavailable.',
          recommendedAction: null,
        };
      }
    },
  });

  providers.push({
    id: 'channels',
    label: 'Channel gateways',
    read: () => {
      try {
        const factory = new ChannelGatewayFactory();
        const list =
          typeof (factory as { listConfigured?: () => string[] }).listConfigured === 'function'
            ? (factory as { listConfigured: () => string[] }).listConfigured()
            : [];
        const telegram = Boolean(String(process.env.TELEGRAM_BOT_TOKEN || '').trim());
        const discord = Boolean(String(process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim());
        const configured = [telegram ? 'telegram' : null, discord ? 'discord' : null, ...list].filter(Boolean);
        if (configured.length === 0) {
          return {
            status: 'attention' as const,
            summary: 'No chat channel credentials detected (Telegram/Discord/…).',
            recommendedAction: 'Configure a channel token when you want multi-surface chat.',
          };
        }
        return {
          status: 'healthy' as const,
          summary: `Channel signals: ${Array.from(new Set(configured)).join(', ')}.`,
          recommendedAction: null,
        };
      } catch {
        return {
          status: 'unavailable' as const,
          summary: 'Channel gateway factory unavailable in this runtime.',
          recommendedAction: null,
        };
      }
    },
  });

  providers.push({
    id: 'governance',
    label: 'Agent governance',
    read: () => {
      try {
        const missionGate =
          existsSync(path.join(root, 'src', 'services', 'AgentMissionCompletionGate.ts')) ||
          existsSync(path.join(root, 'dist', 'services', 'AgentMissionCompletionGate.js'));
        const budget =
          existsSync(path.join(root, 'src', 'services', 'AgentRuntimeBudgetEnforcementService.ts')) ||
          existsSync(path.join(root, 'dist', 'services', 'AgentRuntimeBudgetEnforcementService.js'));
        const memory =
          existsSync(path.join(root, 'src', 'services', 'AgentProvenanceMemoryService.ts')) ||
          existsSync(path.join(root, 'dist', 'services', 'AgentProvenanceMemoryService.js'));
        const ready = missionGate && budget && memory;
        return {
          status: ready ? ('healthy' as const) : ('attention' as const),
          summary: ready ? 'Mission gate, budget enforcement and provenance memory modules are present.'
            : 'One or more governance modules are missing from this install.',
          recommendedAction: ready ? null : 'Rebuild or restore agent governance services.',
        };
      } catch {
        return {
          status: 'unavailable' as const,
          summary: 'Could not inspect governance modules.',
          recommendedAction: null,
        };
      }
    },
  });

  providers.push({
    id: 'about-you',
    label: 'About you',
    read: () => {
      try {
        const { AboutYouService, isUserModelEnabled } =
          require('../services/learned-knowledge/index.js') as typeof import('../services/learned-knowledge/index.js');
        const userId = process.env.USER || process.env.USERNAME || 'local-user';
        const snap = new AboutYouService({ projectRoot: root }).buildSnapshot(userId);
        const inject = isUserModelEnabled();
        return {
          status: 'healthy' as const,
          summary: `facts=${snap.facts.length} drafts=${snap.drafts.length}; inject=${inject ? 'on' : 'off'}; dialectic=${snap.dialectic.answered}/${snap.dialectic.total}`,
          recommendedAction: inject ? null : 'Set ZAVORTH_USER_MODEL=1 to inject About you into prompts.',
        };
      } catch (error: unknown) {
        return {
          status: 'unavailable' as const,
          summary: error instanceof Error ? error.message : 'About you unavailable.',
          recommendedAction: 'Run zavorth knowledge about.',
        };
      }
    },
  });

  providers.push({
    id: 'knowledge-wiki',
    label: 'Knowledge (Mnemos wiki)',
    read: () => {
      try {
        const { knowledgeWikiPresent, queryKnowledgeFacts } =
          require('../services/learned-knowledge/index.js') as typeof import('../services/learned-knowledge/index.js');
        const wiki = knowledgeWikiPresent(root);
        if (!wiki) {
          return {
            status: 'attention' as const,
            summary: 'Knowledge wiki index missing (.zavorth/wiki/index.json).',
            recommendedAction: 'Run mnemos ingest/lint or create wiki pages under .zavorth/wiki.',
          };
        }
        // Light probe: empty-ish query still exercises service without network.
        try {
          const probe = queryKnowledgeFacts({ query: 'zavorth', topK: 1, projectRoot: root });
          return {
            status: 'healthy' as const,
            summary: `Wiki present; probe status=${probe.status} hits=${probe.summary.hits}; FTS=${probe.summary.sqliteFtsAvailable ? 'on' : 'off'}; no silent promote.`,
            recommendedAction: null,
          };
        } catch (error: unknown) {
          return {
            status: 'attention' as const,
            summary: error instanceof Error ? error.message : 'Knowledge query probe failed.',
            recommendedAction: 'Run zavorth knowledge facts "test" or npm run mnemos:query.',
          };
        }
      } catch (error: unknown) {
        return {
          status: 'unavailable' as const,
          summary: error instanceof Error ? error.message : 'Knowledge pillar unavailable.',
          recommendedAction: 'Run zavorth knowledge status.',
        };
      }
    },
  });

  providers.push({
    id: 'conversation-continuum',
    label: 'Conversation continuum',
    read: () => {
      try {
        const { getConversationContinuum, isContinuumCaptureEnabled, continuumBackendLabel } =
          require('../services/learned-knowledge/index.js') as typeof import('../services/learned-knowledge/index.js');
        const continuum = getConversationContinuum({ projectRoot: root });
        const capture = isContinuumCaptureEnabled();
        const backend = continuumBackendLabel({ projectRoot: root });
        const storePath = continuum.getStorePath();
        const exists = existsSync(storePath);
        if (!capture) {
          return {
            status: 'attention' as const,
            summary: 'Conversation continuum capture is disabled (ZAVORTH_CONTINUUM_CAPTURE=0).',
            recommendedAction: 'Set ZAVORTH_CONTINUUM_CAPTURE=1 to record chat turns for recall.',
          };
        }
        return {
          status: 'healthy' as const,
          summary: `Capture on; backend=${backend}; store ${exists ? 'present' : 'will be created on first turn'}: ${storePath}`,
          recommendedAction: exists ? null : 'Chat once or run: zavorth knowledge recall --browse',
        };
      } catch (error: unknown) {
        return {
          status: 'unavailable' as const,
          summary: error instanceof Error ? error.message : 'Conversation continuum unavailable.',
          recommendedAction: 'Run zavorth knowledge status.',
        };
      }
    },
  });

  providers.push({
    id: 'experience-skill-learning',
    label: 'Experience skill learning',
    read: () => {
      try {
        const {
          ExperienceSkillLearningLoopService,
          isExperienceSkillLearningLoopEnabled,
        } = require('../services/ExperienceSkillLearningLoopService.js');
        if (!isExperienceSkillLearningLoopEnabled()) {
          return {
            status: 'attention' as const,
            summary: 'Experience skill learning loop is disabled (ZAVORTH_SKILL_LEARN_LOOP=0).',
            recommendedAction: 'Set ZAVORTH_SKILL_LEARN_LOOP=1 to enable multi-tool skill drafts.',
          };
        }
        const userId = process.env.USER || process.env.USERNAME || 'local-user';
        const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
        const snap = loop.buildStatusSnapshot(userId);
        const m = snap.metrics || { weekKey: 'n/a', draftsCreated: 0, promotes: 0, reuses: 0 };
        return {
          status: 'healthy' as const,
          summary: `Loop on; drafts=${snap.drafts} promoted=${snap.promoted}; week ${m.weekKey}: created=${m.draftsCreated} promotes=${m.promotes} reuses=${m.reuses}.`,
          recommendedAction:
            snap.drafts === 0
              ? 'Complete a multi-tool chat task to create the first draft, or run zavorth learn.'
              : null,
        };
      } catch (error: unknown) {
        return {
          status: 'unavailable' as const,
          summary: error instanceof Error ? error.message : 'Learning loop diagnostic unavailable.',
          recommendedAction: 'Run zavorth learn status.',
        };
      }
    },
  });

  const health = await new AgentUnifiedHealthService({
    workspaceId,
    providers,
  }).readSnapshot();
  return render(
    args,
    'Zavorth health',
    [health.summary, ...health.diagnostics.map((entry) => `${entry.label}: ${entry.status} | ${entry.summary}`)],
    { ...checks, agentHealth: health },
  );
}

export async function runHooks(root: string, args: string[]) {
  const dir = path.join(stateDir(root), 'hooks');
  await ensureDir(dir);
  const files = await listJsonFiles(dir);
  return render(args, 'Zavorth hooks', files.length ? files.map((file) => `- ${file}`) : ['No hooks configured yet.'], {
    hooks: files,
  });
}

export async function runInfer(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  const prompt =
    readFlag(args, 'prompt') ||
    args
      .slice(1)
      .filter((arg) => !arg.startsWith('--'))
      .join(' ');
  if (action === 'status') {
    const providers = ['openai', 'openrouter', 'groq', 'deepseek', 'gemini', 'ollama'];
    const readiness = providers.map(
      (provider) => `${provider}: ${isProviderConfigured(provider) ? 'configured' : 'missing'}`,
    );
    return render(args, 'Zavorth infer', readiness, {
      providers: Object.fromEntries(providers.map((provider) => [provider, isProviderConfigured(provider)])),
    });
  }
  if (args.includes('--live') || args.includes('--yes')) {
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth infer', ['Live provider call requires --yes.'], { ok: false });
    }
    const provider = (readFlag(args, 'provider') || process.env.LLM_PROVIDER || 'openai').toLowerCase();
    const result = await inferText(provider, prompt || action, args);
    const record = {
      id: idWithTime('infer'),
      action,
      provider,
      prompt: redact(prompt || action),
      result,
      createdAt: new Date().toISOString(),
      status: result.ok ? 'completed' : 'failed',
    };
    const file = path.join(stateDir(root), 'infer-drafts.json');
    const drafts = await readArray(file);
    drafts.push(record);
    await writeJson(file, drafts);
    return render(
      args,
      'Zavorth infer',
      [
        `Provider: ${provider}`,
        `Status: ${record.status}`,
        result.text ? `Text: ${String(result.text).slice(0, 1200)}` : `Reason: ${String(result.reason || 'unknown')}`,
      ],
      record,
    );
  }
  const draft = {
    id: idWithTime('infer'),
    action,
    prompt: args.slice(1).join(' '),
    createdAt: new Date().toISOString(),
    status: 'draft',
  };
  const file = path.join(stateDir(root), 'infer-drafts.json');
  const drafts = await readArray(file);
  drafts.push(draft);
  await writeJson(file, drafts);
  return render(
    args,
    'Zavorth infer',
    [`Drafted governed ${action} ability request.`, 'Configure provider credentials before live execution.'],
    { draft },
  );
}

export async function runLogs(root: string, args: string[]) {
  const candidates = [path.join(stateDir(root), 'logs'), path.join(root, 'logs')];
  const files = (await Promise.all(candidates.map((dir) => listAnyFiles(dir)))).flat().slice(0, 20);
  return render(
    args,
    'Zavorth logs',
    files.length ? files.map((file) => `- ${path.relative(root, file)}`) : ['No log files found.'],
    { logs: files.map((file) => path.relative(root, file)) },
  );
}
