import fs from 'node:fs';
import path from 'node:path';

import type { TaskPlaneItem, TaskPlaneSnapshot } from '../contracts/TaskPlaneContract.js';
import { TaskPlaneService } from './TaskPlaneService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';

type FriendlyCommand = 'todo' | 'later' | 'work' | 'done' | 'retry' | 'cancel';

type FriendlyWorkCommandOptions = {
  projectRoot: string;
  explicitHome?: string | null;
  env?: Record<string, string | undefined>;
  now?: () => Date;
};

type FriendlyCronRecord = {
  id: string;
  label: string;
  command: '';
  status: 'scheduled' | 'completed' | 'cancelled';
  attempts: 0;
  maxRetries: 0;
  retryDelayMs: 1000;
  cron: '';
  everyMs: 0;
  dependsOn: string[];
  nextRunAt: string;
  taskPlane: true;
  taskTitle: string;
  createdAt: string;
  updatedAt: string;
  sourceSurface: 'zavorth-later';
  lastMaterializedTaskId?: string;
  lastTaskPlaneDueAt?: string;
  lastMaterializedAt?: string;
};

export type FriendlyWorkCommandResult = {
  contractVersion: 'zavorth-friendly-work-command/1';
  command: FriendlyCommand;
  ok: boolean;
  message: string;
  lines: string[];
  task: TaskPlaneItem | null;
  tasks: TaskPlaneSnapshot;
  scheduled: FriendlyCronRecord[];
  materialized: Array<{
    cronId: string;
    taskId: string;
    created: boolean;
  }>;
};

export class ZavorthFriendlyWorkCommandService {
  private readonly projectRoot: string;
  private readonly explicitHome: string | null;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;

  constructor(options: FriendlyWorkCommandOptions) {
    this.projectRoot = path.resolve(options.projectRoot || process.cwd());
    this.explicitHome = normalizeOptional(options.explicitHome);
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
  }

  public run(command: FriendlyCommand, args: string[]): FriendlyWorkCommandResult {
    const context = this.context(args);
    if (command === 'todo') {
      const title = readPhrase(args) || 'Untitled task';
      const task = context.taskPlane.createTask({
        title,
        source: 'cli:todo',
        approvalId: readFlag(args, 'approval-id'),
      });
      return this.result(command, true, `Added todo: ${task.title}`, [`todo: ${task.title}`, `id: ${task.id}`], task, context);
    }

    if (command === 'later') {
      const title = readPhrase(args) || 'Untitled scheduled task';
      const dueAt = parseDueAt(args, title, this.now());
      const scheduled = this.readScheduled(context.scheduleFile);
      const record: FriendlyCronRecord = {
        id: readFlag(args, 'id') || idWithTime('later', this.now),
        label: title,
        command: '',
        status: 'scheduled',
        attempts: 0,
        maxRetries: 0,
        retryDelayMs: 1000,
        cron: '',
        everyMs: 0,
        dependsOn: [],
        nextRunAt: dueAt,
        taskPlane: true,
        taskTitle: title,
        createdAt: this.now().toISOString(),
        updatedAt: this.now().toISOString(),
        sourceSurface: 'zavorth-later',
      };
      scheduled.push(record);
      this.writeScheduled(context.scheduleFile, scheduled);
      return this.result(command, true, `Scheduled for ${dueAt}: ${title}`, [`later: ${title}`, `at: ${dueAt}`, `id: ${record.id}`], null, context);
    }

    if (command === 'work') {
      const materialized = this.materializeDue(context);
      return this.result(command, true, 'Work queue ready.', this.renderWorkLines(context, materialized), null, context, materialized);
    }

    const id = readId(args);
    if (!id) {
      return this.result(command, false, `${command} needs an id.`, [`usage: zavorth ${command} <id>`], null, context);
    }

    if (command === 'done') {
      const task = context.taskPlane.updateStatus(id, 'done', 'cli:done', 'Completed from friendly command.');
      return this.result(command, Boolean(task), task ? `Done: ${task.title}` : `No task found: ${id}`, task ? [`done: ${task.title}`, `id: ${task.id}`] : [`No task found: ${id}`], task, context);
    }

    if (command === 'retry') {
      const task = context.taskPlane.retryTask(id, 'cli:retry');
      return this.result(command, Boolean(task), task ? `Retry queued: ${task.title}` : `Task cannot be retried: ${id}`, task ? [`retry: ${task.title}`, `id: ${task.id}`] : [`Task cannot be retried: ${id}`], task, context);
    }

    const cancelledTask = context.taskPlane.cancelTask(id, 'cli:cancel', 'Cancelled from friendly command.');
    if (cancelledTask) {
      return this.result(command, true, `Cancelled: ${cancelledTask.title}`, [`cancelled task: ${cancelledTask.title}`, `id: ${cancelledTask.id}`], cancelledTask, context);
    }
    const scheduled = this.readScheduled(context.scheduleFile);
    const scheduledItem = scheduled.find((item) => item.id === id);
    if (scheduledItem) {
      scheduledItem.status = 'cancelled';
      scheduledItem.updatedAt = this.now().toISOString();
      this.writeScheduled(context.scheduleFile, scheduled);
      return this.result(command, true, `Cancelled scheduled item: ${scheduledItem.label}`, [`cancelled later: ${scheduledItem.label}`, `id: ${scheduledItem.id}`], null, context);
    }
    return this.result(command, false, `No task or scheduled item found: ${id}`, [`No task or scheduled item found: ${id}`], null, context);
  }

  private context(args: string[]) {
    const explicitHome = readFlag(args, 'home') || this.explicitHome;
    const home = new ZavorthHomePathService({
      projectRoot: this.projectRoot,
      explicitHome,
      env: this.env,
      now: this.now,
    }).resolveSnapshot();
    const taskPlane = new TaskPlaneService({
      storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
      now: this.now,
    });
    return {
      home,
      taskPlane,
      scheduleFile: path.join(home.root, '.zavorth', 'cron-jobs.json'),
    };
  }

  private materializeDue(context: ReturnType<ZavorthFriendlyWorkCommandService['context']>): Array<{ cronId: string; taskId: string; created: boolean }> {
    const scheduled = this.readScheduled(context.scheduleFile);
    const now = this.now().getTime();
    const materialized: Array<{ cronId: string; taskId: string; created: boolean }> = [];
    for (const item of scheduled) {
      if (item.status !== 'scheduled') {
        continue;
      }
      const dueAt = Date.parse(item.nextRunAt);
      if (Number.isFinite(dueAt) && dueAt > now) {
        continue;
      }
      if (item.lastTaskPlaneDueAt === item.nextRunAt && item.lastMaterializedTaskId) {
        materialized.push({ cronId: item.id, taskId: item.lastMaterializedTaskId, created: false });
        continue;
      }
      const task = context.taskPlane.createTask({
        title: item.taskTitle || item.label,
        source: `later:${item.id}`,
        receiptId: `later-task:${item.id}:${this.now().getTime()}`,
        payload: {
          scheduledId: item.id,
          dueAt: item.nextRunAt,
          sourceSurface: item.sourceSurface,
        },
      });
      item.status = 'completed';
      item.lastTaskPlaneDueAt = item.nextRunAt;
      item.lastMaterializedTaskId = task.id;
      item.lastMaterializedAt = this.now().toISOString();
      item.updatedAt = this.now().toISOString();
      materialized.push({ cronId: item.id, taskId: task.id, created: true });
    }
    if (materialized.length > 0) {
      this.writeScheduled(context.scheduleFile, scheduled);
    }
    return materialized;
  }

  private renderWorkLines(
    context: ReturnType<ZavorthFriendlyWorkCommandService['context']>,
    materialized: Array<{ cronId: string; taskId: string; created: boolean }>,
  ): string[] {
    const tasks = context.taskPlane.snapshot();
    const scheduled = this.readScheduled(context.scheduleFile).filter((item) => item.status === 'scheduled');
    return [
      `tasks: ${tasks.items.length}`,
      `queued: ${tasks.summary.queued}`,
      `running: ${tasks.summary.running}`,
      `waiting approval: ${tasks.summary.waiting_approval}`,
      materialized.length ? `new from later: ${materialized.filter((item) => item.created).length}` : 'new from later: 0',
      '',
      ...tasks.items.slice(0, 12).map((task) => `- ${task.status.padEnd(16)} ${task.id} ${task.title}`),
      ...(scheduled.length ? ['', 'scheduled:', ...scheduled.slice(0, 8).map((item) => `- ${item.id} ${item.nextRunAt} ${item.label}`)] : []),
    ];
  }

  private result(
    command: FriendlyCommand,
    ok: boolean,
    message: string,
    lines: string[],
    task: TaskPlaneItem | null,
    context: ReturnType<ZavorthFriendlyWorkCommandService['context']>,
    materialized: Array<{ cronId: string; taskId: string; created: boolean }> = [],
  ): FriendlyWorkCommandResult {
    return {
      contractVersion: 'zavorth-friendly-work-command/1',
      command,
      ok,
      message,
      lines,
      task,
      tasks: context.taskPlane.snapshot(),
      scheduled: this.readScheduled(context.scheduleFile),
      materialized,
    };
  }

  private readScheduled(file: string): FriendlyCronRecord[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isFriendlyCronRecord) : [];
    } catch {
      return [];
    }
  }

  private writeScheduled(file: string, records: FriendlyCronRecord[]): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  }
}

function readFlag(args: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

function readPhrase(args: string[]): string {
  const explicit = readFlag(args, 'title') || readFlag(args, 'task') || readFlag(args, 'text');
  if (explicit) {
    return explicit.trim();
  }
  const flagValueIndexes = new Set<number>();
  for (let index = 0; index < args.length; index += 1) {
    if (args[index].startsWith('--') && !args[index].includes('=') && args[index + 1] && !args[index + 1].startsWith('--')) {
      flagValueIndexes.add(index + 1);
      index += 1;
    }
  }
  return args
    .filter((arg, index) => !arg.startsWith('--') && !flagValueIndexes.has(index))
    .join(' ')
    .trim();
}

function readId(args: string[]): string {
  return readFlag(args, 'id') || args.find((arg) => !arg.startsWith('--')) || '';
}

function parseDueAt(args: string[], phrase: string, now: Date): string {
  const at = readFlag(args, 'at');
  if (at) {
    return normalizeDateInput(at, now);
  }
  const delay = readFlag(args, 'in');
  if (delay) {
    return new Date(now.getTime() + parseDurationMs(delay, 24 * 60 * 60 * 1000)).toISOString();
  }
  const lower = phrase.toLowerCase();
  const wantsTomorrow = /\b(tomorrow|amanh[aã])\b/u.test(lower);
  const wantsToday = /\b(today|hoje)\b/u.test(lower);
  const time = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(h|am|pm)?\b/u);
  const target = new Date(now);
  if (wantsTomorrow || !wantsToday) {
    target.setDate(target.getDate() + 1);
  }
  const hourRaw = time ? Number(time[1]) : 9;
  const minute = time?.[2] ? Number(time[2]) : 0;
  const suffix = time?.[3] || '';
  const hour = suffix === 'pm' && hourRaw < 12 ? hourRaw + 12 : suffix === 'am' && hourRaw === 12 ? 0 : hourRaw;
  target.setHours(Math.max(0, Math.min(23, hour)), Math.max(0, Math.min(59, minute)), 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString();
}

function normalizeDateInput(value: string, now: Date): string {
  if (/^\d{1,2}:\d{2}$/u.test(value) || /^\d{1,2}h$/iu.test(value)) {
    return parseDueAt([], `today ${value.replace(/h$/iu, ':00')}`, now);
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(now.getTime() + parseDurationMs(value, 24 * 60 * 60 * 1000)).toISOString();
}

function parseDurationMs(value: string, fallback: number): number {
  const match = value.trim().match(/^(\d+)(ms|s|m|h|d)?$/iu);
  if (!match) {
    return fallback;
  }
  const amount = Number(match[1]);
  const unit = String(match[2] || 'm').toLowerCase();
  const factor = unit === 'd' ? 24 * 60 * 60 * 1000 : unit === 'h' ? 60 * 60 * 1000 : unit === 'm' ? 60 * 1000 : unit === 's' ? 1000 : 1;
  return Number.isFinite(amount) ? amount * factor : fallback;
}

function isFriendlyCronRecord(value: unknown): value is FriendlyCronRecord {
  const item = value as Partial<FriendlyCronRecord>;
  return Boolean(item && typeof item === 'object' && item.id && item.taskPlane === true);
}

function idWithTime(prefix: string, now: () => Date): string {
  return `${prefix}-${now().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14)}`;
}

function normalizeOptional(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}
