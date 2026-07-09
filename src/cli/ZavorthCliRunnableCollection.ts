import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { ZavorthHomePathService } from '../services/ZavorthHomePathService.js';
import { TaskPlaneService } from '../services/TaskPlaneService.js';
import {
  firstArg,
  readFlag,
  readNumberFlag,
  stateDir,
  ensureDir,
  readArray,
  writeJson,
  appendJsonArray,
  idWithTime,
  runProcess,
  render,
  splitList,
} from './ZavorthCliSharedHelpers.js';
import { logger } from '../logger.js';
import {
redactCommand,
  runBackground,
  runTaskBoard,
  taskPlaneServiceForCli,
} from './ZavorthCliLiveNamespaces.js';

type JsonObject = Record<string, unknown>;

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
  return items.map((item) => item as JsonObject).filter((item) => {
    const status = String(item.status || 'queued');
    if (!['queued', 'scheduled'].includes(status)) return false;
    const nextRunAt = Date.parse(String(item.nextRunAt || new Date().toISOString()));
    if (Number.isFinite(nextRunAt) && nextRunAt > now) return false;
    const deps = Array.isArray(item.dependsOn) ? item.dependsOn.map(String) : [];
    return deps.every((dep) => String(byId.get(dep)?.status || '') === 'completed');
  });
}

export async function runTaskWorker(root: string, collection: string, label: string, args: string[]): Promise<{ lines: string[]; payload: JsonObject }> {
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

export function wantsTaskPlaneMaterialization(collection: string, args: string[], item?: JsonObject): boolean {
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

export async function materializeCronItemToTaskPlane(root: string, item: JsonObject, args: string[]): Promise<JsonObject> {
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

export async function executeTaskItem(root: string, collection: string, item: JsonObject, args: string[]): Promise<JsonObject> {
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

export async function acquireTaskLock(root: string, collection: string): Promise<{ ok: boolean; file: string; message: string }> {
  const file = path.join(stateDir(root), `${collection}.lock`);
  await ensureDir(path.dirname(file));
  try {
    const handle = await fs.open(file, 'wx');
    await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    await handle.close();
    return { ok: true, file, message: 'lock acquired' };
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[Zavorth Cli Runnable Collection] filesystem operation failed', error);
    return { ok: false, file, message: `Worker lock is active for ${collection}. Use logs/status or remove stale lock only after verifying no worker is running.` };
  }
}

export async function releaseTaskLock(file: string): Promise<void> {
  await fs.rm(file, { force: true });
}

export async function appendTaskLog(root: string, collection: string, item: JsonObject, event: string, message: string): Promise<void> {
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

export function findById(items: unknown[], id: string): JsonObject | undefined {
  return items.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
}
