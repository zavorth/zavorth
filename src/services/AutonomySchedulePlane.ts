import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import type { TaskPlaneItem } from '../contracts/TaskPlaneContract.js';
import {
  OperatorContinuityKernel,
  type OperatorContinuityEnvelope,
  type OperatorContinuityReceipt,
  resultFromToolOutcome,
} from '../runtime/operator/OperatorContinuityEnvelope.js';
import type { TaskPlaneService } from './TaskPlaneService.js';

export type AutonomyRoutineScheduleType = 'cron' | 'interval' | 'once' | 'natural_language';
export type AutonomyRoutineRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AutonomyRoutine = {
  contractVersion: 'autonomy-routine/1';
  id: string;
  name: string;
  schedule: string;
  scheduleType: AutonomyRoutineScheduleType;
  intervalMs?: number;
  taskDescription: string;
  channel?: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  lastResult: string | null;
  lastTaskPlaneItemId: string | null;
  createdAt: string;
  updatedAt: string;
  riskLevel: AutonomyRoutineRiskLevel;
  requiresApproval: boolean;
  frozen: boolean;
  scopeTags: string[];
};

export type AutonomySchedulePlaneSnapshot = {
  contractVersion: 'autonomy-schedule-plane/1';
  generatedAt: string;
  storageDir: string;
  killSwitchActive: boolean;
  frozenScopes: string[];
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    frozen: number;
    due: number;
  };
  routines: AutonomyRoutine[];
  safety: {
    taskPlaneBacked: boolean;
    killSwitchHonored: true;
    scopeFreezeHonored: true;
    noParallelTaskStore: true;
  };
};

export type AutonomyScheduleMutationResult = {
  ok: boolean;
  summary: string;
  routine: AutonomyRoutine | null;
  task: TaskPlaneItem | null;
  receipt: OperatorContinuityReceipt | null;
  continuity: OperatorContinuityEnvelope | null;
  blockedReason?: string;
};

export type AutonomyScheduleProcessDueResult = {
  ok: boolean;
  summary: string;
  processed: number;
  materialized: Array<{ routineId: string; taskId: string | null; nextRunAt: string | null }>;
  receipt: OperatorContinuityReceipt | null;
  continuity: OperatorContinuityEnvelope | null;
  blockedReason?: string;
};

type AutonomySchedulePlaneOptions = {
  storageDir: string;
  taskPlane?: TaskPlaneService | null;
  now?: () => Date;
  continuity?: OperatorContinuityKernel | null;
};

type CreateRoutineInput = {
  name?: string | null;
  schedule: string;
  scheduleType?: AutonomyRoutineScheduleType | null;
  intervalMs?: number | null;
  taskDescription: string;
  channel?: string | null;
  riskLevel?: AutonomyRoutineRiskLevel | null;
  requiresApproval?: boolean | null;
  scopeTags?: readonly string[] | null;
  actor?: string | null;
  enabled?: boolean | null;
};

type RoutineIdInput = {
  routineId: string;
  actor?: string | null;
};

type ProcessDueInput = {
  actor?: string | null;
  maxItems?: number | null;
  dryRun?: boolean | null;
};

type ControlPlaneState = {
  killSwitchActive: boolean;
  frozenScopes: string[];
  updatedAt: string;
};

const CONTROL_FILE = '_control.json';

/** Canonical on-disk root for AutonomySchedulePlane (shared by CLI, cron tool, actions, control, daemon). */
export function resolveAutonomyScheduleStorageDir(runtimeDir: string): string {
  return path.resolve(path.join(String(runtimeDir || '').trim() || path.join(process.cwd(), 'data', 'runtime'), 'cron'));
}

/**
 * Bind Control / cron / action surfaces to the same plane when an instance is missing.
 * Storage is filesystem-backed so a new process with the same runtimeDir reloads routines.
 */
export function bindAutonomySchedulePlane(options: {
  runtimeDir: string;
  taskPlane?: TaskPlaneService | null;
  plane?: AutonomySchedulePlane | null;
  now?: () => Date;
  continuity?: OperatorContinuityKernel | null;
}): AutonomySchedulePlane {
  if (options.plane) {
    return options.plane;
  }
  return new AutonomySchedulePlane({
    storageDir: resolveAutonomyScheduleStorageDir(options.runtimeDir),
    taskPlane: options.taskPlane || null,
    now: options.now,
    continuity: options.continuity || null,
  });
}

export class AutonomySchedulePlane {
  private readonly storageDir: string;
  private readonly taskPlane: TaskPlaneService | null;
  private readonly now: () => Date;
  private readonly continuity: OperatorContinuityKernel;

  constructor(options: AutonomySchedulePlaneOptions) {
    this.storageDir = path.resolve(options.storageDir);
    this.taskPlane = options.taskPlane || null;
    this.now = options.now || (() => new Date());
    this.continuity = options.continuity || new OperatorContinuityKernel({ now: this.now });
  }

  public getStorageDir(): string {
    return this.storageDir;
  }

  /** Alias used by action/control surfaces that expect a short list API. */
  public list(): AutonomyRoutine[] {
    return this.listRoutines();
  }

  public snapshot(): AutonomySchedulePlaneSnapshot {
    const control = this.readControl();
    const routines = this.listRoutines();
    const due = routines.filter((routine) => this.isDue(routine, control));
    return {
      contractVersion: 'autonomy-schedule-plane/1',
      generatedAt: this.timestamp(),
      storageDir: this.storageDir,
      killSwitchActive: control.killSwitchActive,
      frozenScopes: [...control.frozenScopes],
      summary: {
        total: routines.length,
        enabled: routines.filter((routine) => routine.enabled).length,
        disabled: routines.filter((routine) => !routine.enabled).length,
        frozen: routines.filter((routine) => routine.frozen).length,
        due: due.length,
      },
      routines,
      safety: {
        taskPlaneBacked: Boolean(this.taskPlane),
        killSwitchHonored: true,
        scopeFreezeHonored: true,
        noParallelTaskStore: true,
      },
    };
  }

  public listRoutines(): AutonomyRoutine[] {
    this.ensureStorageDir();
    return this.listAllRoutineIds()
      .map((id) => this.loadRoutine(id))
      .filter((routine): routine is AutonomyRoutine => Boolean(routine))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public getRoutine(routineId: string): AutonomyRoutine | null {
    return this.loadRoutine(normalizeId(routineId));
  }

  public createRoutine(input: CreateRoutineInput): AutonomyScheduleMutationResult {
    const schedule = String(input.schedule || '').trim();
    const taskDescription = String(input.taskDescription || '').trim();
    if (!schedule) {
      return this.blockedMutation('create', null, 'schedule is required.');
    }
    if (!taskDescription) {
      return this.blockedMutation('create', null, 'taskDescription is required.');
    }

    const name = String(input.name || `routine_${Date.now()}`).trim() || `routine_${Date.now()}`;
    const routineId = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 48) || `routine_${randomUUID().slice(0, 8)}`;
    if (this.loadRoutine(routineId)) {
      return this.blockedMutation('create', null, `routine "${routineId}" already exists.`);
    }

    const riskLevel = input.riskLevel || inferRiskLevel(taskDescription);
    const requiresApproval = typeof input.requiresApproval === 'boolean'
      ? input.requiresApproval
      : ['high', 'critical'].includes(riskLevel);
    const scheduleType = input.scheduleType || detectScheduleType(schedule, input.intervalMs);
    const enabled = typeof input.enabled === 'boolean'
      ? input.enabled
      : !requiresApproval;

    const routine: AutonomyRoutine = {
      contractVersion: 'autonomy-routine/1',
      id: routineId,
      name,
      schedule,
      scheduleType,
      ...(typeof input.intervalMs === 'number' ? { intervalMs: Math.max(1, Math.floor(input.intervalMs)) } : {}),
      taskDescription,
      ...(input.channel ? { channel: String(input.channel) } : {}),
      enabled,
      lastRunAt: null,
      nextRunAt: null,
      runCount: 0,
      lastResult: null,
      lastTaskPlaneItemId: null,
      createdAt: this.timestamp(),
      updatedAt: this.timestamp(),
      riskLevel,
      requiresApproval,
      frozen: false,
      scopeTags: uniqueTags(input.scopeTags),
    };
    routine.nextRunAt = this.computeNextRun(routine);
    this.saveRoutine(routine);

    return this.finalizeMutation({
      operation: 'autonomy.routine.create',
      target: routine.id,
      actor: input.actor,
      allowed: true,
      rule: 'autonomy-schedule:create',
      reasons: ['Routine stored in cron-backed schedule plane.'],
      summary: `Created routine ${routine.id}.`,
      routine,
      task: null,
      status: 'applied',
      data: { enabled: routine.enabled, nextRunAt: routine.nextRunAt },
    });
  }

  public enableRoutine(input: RoutineIdInput): AutonomyScheduleMutationResult {
    return this.toggleRoutine(input, true);
  }

  public disableRoutine(input: RoutineIdInput): AutonomyScheduleMutationResult {
    return this.toggleRoutine(input, false);
  }

  public runNow(input: RoutineIdInput): AutonomyScheduleMutationResult {
    const control = this.readControl();
    if (control.killSwitchActive) {
      return this.blockedMutation('run_now', input.routineId, 'Autonomy kill switch is active.');
    }

    const routine = this.loadRoutine(normalizeId(input.routineId));
    if (!routine) {
      return this.blockedMutation('run_now', input.routineId, `routine "${input.routineId}" not found.`);
    }
    if (routine.frozen || this.isScopeFrozen(routine, control)) {
      return this.blockedMutation('run_now', routine.id, 'Routine scope is frozen.');
    }

    const task = this.taskPlane ? this.materializeToTaskPlane(routine, 'manual') : null;
    const next = {
      ...routine,
      lastRunAt: this.timestamp(),
      runCount: routine.runCount + 1,
      lastResult: task ? 'task-plane-materialized' : 'manual_trigger_pending',
      lastTaskPlaneItemId: task?.id || routine.lastTaskPlaneItemId,
      nextRunAt: this.computeNextRun(routine),
      updatedAt: this.timestamp(),
    };
    this.saveRoutine(next);

    return this.finalizeMutation({
      operation: 'autonomy.routine.run_now',
      target: next.id,
      actor: input.actor,
      allowed: true,
      rule: 'autonomy-schedule:run-now',
      reasons: [
        task
          ? 'Routine materialized into Task Plane without a parallel task store.'
          : 'Routine marked for manual trigger; Task Plane not wired on this surface.',
      ],
      summary: task
        ? `Materialized routine ${next.id} as task ${task.id}.`
        : `Manually triggered routine ${next.id}.`,
      routine: next,
      task,
      status: 'applied',
      data: {
        taskId: task?.id || null,
        nextRunAt: next.nextRunAt,
        runCount: next.runCount,
      },
    });
  }

  public processDue(input: ProcessDueInput = {}): AutonomyScheduleProcessDueResult {
    const control = this.readControl();
    if (control.killSwitchActive) {
      const blocked = this.blockedProcessDue('Autonomy kill switch is active.');
      return blocked;
    }
    if (!this.taskPlane) {
      return this.blockedProcessDue('TaskPlaneService is required to materialize due routines.');
    }

    const maxItems = clampInt(Number(input.maxItems || 25), 1, 100);
    const due = this.listRoutines()
      .filter((routine) => this.isDue(routine, control))
      .slice(0, maxItems);

    const materialized: AutonomyScheduleProcessDueResult['materialized'] = [];
    if (!input.dryRun) {
      for (const routine of due) {
        const task = this.materializeToTaskPlane(routine, 'due');
        const next: AutonomyRoutine = {
          ...routine,
          lastRunAt: this.timestamp(),
          runCount: routine.runCount + 1,
          lastResult: 'task-plane-materialized',
          lastTaskPlaneItemId: task.id,
          nextRunAt: this.computeNextRunAfterRun(routine),
          updatedAt: this.timestamp(),
        };
        this.saveRoutine(next);
        materialized.push({
          routineId: next.id,
          taskId: task.id,
          nextRunAt: next.nextRunAt,
        });
      }
    } else {
      for (const routine of due) {
        materialized.push({
          routineId: routine.id,
          taskId: null,
          nextRunAt: routine.nextRunAt,
        });
      }
    }

    let envelope = this.continuity.begin();
    envelope = this.continuity.recordRequest(envelope, {
      surface: 'cli',
      operation: 'autonomy.routine.process_due',
      target: 'autonomy-schedule-plane',
      actorId: input.actor || 'autonomy-schedule-plane',
      sourceSurface: 'autonomy-schedule-plane',
      metadata: {
        due: due.length,
        processed: materialized.length,
        dryRun: Boolean(input.dryRun),
      },
    });
    envelope = this.continuity.attachDecision(envelope, {
      source: 'mutation-plane',
      action: 'allow',
      allowed: true,
      rule: 'autonomy-schedule:process-due',
      reasons: ['Due routines materialize into the shared Task Plane.'],
    });
    envelope = this.continuity.attachResult(envelope, resultFromToolOutcome({
      ok: true,
      status: input.dryRun ? 'preview' : 'applied',
      summary: input.dryRun
        ? `Previewed ${materialized.length} due routine(s).`
        : `Materialized ${materialized.length} due routine(s) into Task Plane.`,
      data: { processed: materialized.length, dryRun: Boolean(input.dryRun) },
    }));
    envelope = this.continuity.finalizeReceipt(envelope);

    return {
      ok: true,
      summary: envelope.result?.summary || 'process due complete',
      processed: materialized.length,
      materialized,
      receipt: envelope.receipt,
      continuity: envelope,
    };
  }

  public activateKillSwitch(actor = 'operator'): AutonomyScheduleMutationResult {
    const control = this.writeControl({
      ...this.readControl(),
      killSwitchActive: true,
      updatedAt: this.timestamp(),
    });
    return this.finalizeMutation({
      operation: 'autonomy.kill_switch.activate',
      target: 'autonomy-schedule-plane',
      actor,
      allowed: true,
      rule: 'autonomy-schedule:kill-switch',
      reasons: ['Kill switch freezes all routine materialization.'],
      summary: 'Autonomy schedule kill switch activated.',
      routine: null,
      task: null,
      status: 'applied',
      data: control,
    });
  }

  public clearKillSwitch(actor = 'operator'): AutonomyScheduleMutationResult {
    const control = this.writeControl({
      ...this.readControl(),
      killSwitchActive: false,
      updatedAt: this.timestamp(),
    });
    return this.finalizeMutation({
      operation: 'autonomy.kill_switch.clear',
      target: 'autonomy-schedule-plane',
      actor,
      allowed: true,
      rule: 'autonomy-schedule:kill-switch',
      reasons: ['Kill switch cleared; enabled routines may materialize again.'],
      summary: 'Autonomy schedule kill switch cleared.',
      routine: null,
      task: null,
      status: 'applied',
      data: control,
    });
  }

  public freezeScope(scope: string, actor = 'operator'): AutonomyScheduleMutationResult {
    const tag = String(scope || '').trim().toLowerCase();
    if (!tag) {
      return this.blockedMutation('freeze_scope', null, 'scope tag is required.');
    }
    const current = this.readControl();
    const frozenScopes = uniqueTags([...current.frozenScopes, tag]);
    const control = this.writeControl({
      ...current,
      frozenScopes,
      updatedAt: this.timestamp(),
    });
    return this.finalizeMutation({
      operation: 'autonomy.scope.freeze',
      target: tag,
      actor,
      allowed: true,
      rule: 'autonomy-schedule:scope-freeze',
      reasons: [`Scope "${tag}" frozen for routine materialization.`],
      summary: `Frozen autonomy scope: ${tag}.`,
      routine: null,
      task: null,
      status: 'applied',
      data: control,
    });
  }

  public unfreezeScope(scope: string, actor = 'operator'): AutonomyScheduleMutationResult {
    const tag = String(scope || '').trim().toLowerCase();
    const current = this.readControl();
    const frozenScopes = current.frozenScopes.filter((entry) => entry !== tag);
    const control = this.writeControl({
      ...current,
      frozenScopes,
      updatedAt: this.timestamp(),
    });
    return this.finalizeMutation({
      operation: 'autonomy.scope.unfreeze',
      target: tag || 'autonomy-schedule-plane',
      actor,
      allowed: true,
      rule: 'autonomy-schedule:scope-freeze',
      reasons: [`Scope "${tag}" unfrozen.`],
      summary: `Unfroze autonomy scope: ${tag || '<empty>'}.`,
      routine: null,
      task: null,
      status: 'applied',
      data: control,
    });
  }

  public freezeRoutine(input: RoutineIdInput): AutonomyScheduleMutationResult {
    const routine = this.loadRoutine(normalizeId(input.routineId));
    if (!routine) {
      return this.blockedMutation('freeze', input.routineId, `routine "${input.routineId}" not found.`);
    }
    const next = {
      ...routine,
      frozen: true,
      enabled: false,
      nextRunAt: null,
      updatedAt: this.timestamp(),
    };
    this.saveRoutine(next);
    return this.finalizeMutation({
      operation: 'autonomy.routine.freeze',
      target: next.id,
      actor: input.actor,
      allowed: true,
      rule: 'autonomy-schedule:routine-freeze',
      reasons: ['Routine frozen and disabled.'],
      summary: `Froze routine ${next.id}.`,
      routine: next,
      task: null,
      status: 'applied',
      data: { frozen: true },
    });
  }

  public deleteRoutine(input: RoutineIdInput): AutonomyScheduleMutationResult {
    const routine = this.loadRoutine(normalizeId(input.routineId));
    if (!routine) {
      return this.blockedMutation('delete', input.routineId, `routine "${input.routineId}" not found.`);
    }
    const filePath = this.routinePath(routine.id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return this.finalizeMutation({
      operation: 'autonomy.routine.delete',
      target: routine.id,
      actor: input.actor,
      allowed: true,
      rule: 'autonomy-schedule:delete',
      reasons: ['Routine removed from cron-backed storage.'],
      summary: `Deleted routine ${routine.id}.`,
      routine,
      task: null,
      status: 'applied',
      data: {
        riskLevel: routine.riskLevel,
        runCount: routine.runCount,
      },
    });
  }

  public updateRoutine(input: {
    routineId: string;
    name?: string | null;
    schedule?: string | null;
    scheduleType?: AutonomyRoutineScheduleType | null;
    intervalMs?: number | null;
    taskDescription?: string | null;
    channel?: string | null;
    riskLevel?: AutonomyRoutineRiskLevel | null;
    requiresApproval?: boolean | null;
    scopeTags?: readonly string[] | null;
    actor?: string | null;
  }): AutonomyScheduleMutationResult {
    const routine = this.loadRoutine(normalizeId(input.routineId));
    if (!routine) {
      return this.blockedMutation('update', input.routineId, `routine "${input.routineId}" not found.`);
    }
    const schedule = input.schedule ? String(input.schedule).trim() : routine.schedule;
    const taskDescription = input.taskDescription
      ? String(input.taskDescription).trim()
      : routine.taskDescription;
    const next: AutonomyRoutine = {
      ...routine,
      name: input.name ? String(input.name).trim() || routine.name : routine.name,
      schedule,
      scheduleType: input.scheduleType || (
        input.schedule
          ? detectScheduleType(schedule, input.intervalMs ?? routine.intervalMs)
          : routine.scheduleType
      ),
      ...(typeof input.intervalMs === 'number'
        ? { intervalMs: Math.max(1, Math.floor(input.intervalMs)) }
        : routine.intervalMs !== undefined
          ? { intervalMs: routine.intervalMs }
          : {}),
      taskDescription,
      ...(input.channel !== undefined
        ? (input.channel ? { channel: String(input.channel) } : {})
        : (routine.channel ? { channel: routine.channel } : {})),
      riskLevel: input.riskLevel || routine.riskLevel,
      requiresApproval: typeof input.requiresApproval === 'boolean'
        ? input.requiresApproval
        : routine.requiresApproval,
      scopeTags: input.scopeTags ? uniqueTags(input.scopeTags) : routine.scopeTags,
      updatedAt: this.timestamp(),
    };
    next.nextRunAt = this.computeNextRun(next);
    this.saveRoutine(next);
    return this.finalizeMutation({
      operation: 'autonomy.routine.update',
      target: next.id,
      actor: input.actor,
      allowed: true,
      rule: 'autonomy-schedule:update',
      reasons: ['Routine updated in cron-backed storage.'],
      summary: `Updated routine ${next.id}.`,
      routine: next,
      task: null,
      status: 'applied',
      data: { nextRunAt: next.nextRunAt },
    });
  }

  private toggleRoutine(input: RoutineIdInput, enabled: boolean): AutonomyScheduleMutationResult {
    const routine = this.loadRoutine(normalizeId(input.routineId));
    if (!routine) {
      return this.blockedMutation(enabled ? 'enable' : 'disable', input.routineId, `routine "${input.routineId}" not found.`);
    }
    if (enabled && routine.frozen) {
      return this.blockedMutation('enable', routine.id, 'Frozen routines cannot be enabled until unfrozen.');
    }
    const next = {
      ...routine,
      enabled,
      requiresApproval: enabled ? false : routine.requiresApproval,
      nextRunAt: enabled ? this.computeNextRun({ ...routine, enabled: true }) : null,
      updatedAt: this.timestamp(),
    };
    this.saveRoutine(next);
    return this.finalizeMutation({
      operation: enabled ? 'autonomy.routine.enable' : 'autonomy.routine.disable',
      target: next.id,
      actor: input.actor,
      allowed: true,
      rule: enabled ? 'autonomy-schedule:enable' : 'autonomy-schedule:disable',
      reasons: [enabled ? 'Routine enabled.' : 'Routine disabled.'],
      summary: `${enabled ? 'Enabled' : 'Disabled'} routine ${next.id}.`,
      routine: next,
      task: null,
      status: 'applied',
      data: { enabled: next.enabled, nextRunAt: next.nextRunAt },
    });
  }

  private materializeToTaskPlane(routine: AutonomyRoutine, trigger: 'manual' | 'due'): TaskPlaneItem {
    if (!this.taskPlane) {
      throw new Error('TaskPlaneService is required.');
    }
    return this.taskPlane.createTask({
      title: `Routine: ${routine.name}`,
      source: `autonomy-schedule:${routine.id}`,
      receiptId: `autonomy-schedule:${routine.id}:${Date.now()}`,
      payload: {
        kind: 'autonomy-routine-run',
        routineId: routine.id,
        routineName: routine.name,
        taskDescription: routine.taskDescription,
        schedule: routine.schedule,
        scheduleType: routine.scheduleType,
        channel: routine.channel || null,
        riskLevel: routine.riskLevel,
        trigger,
        commandDigest: createHash('sha256').update(routine.taskDescription).digest('hex'),
        collection: 'autonomy-schedule',
        materializedBy: 'autonomy-schedule-plane',
      },
    });
  }

  private isDue(routine: AutonomyRoutine, control: ControlPlaneState): boolean {
    if (!routine.enabled || routine.frozen || control.killSwitchActive) {
      return false;
    }
    if (this.isScopeFrozen(routine, control)) {
      return false;
    }
    if (!routine.nextRunAt) {
      return false;
    }
    const next = Date.parse(routine.nextRunAt);
    return Number.isFinite(next) && next <= this.now().getTime();
  }

  private isScopeFrozen(routine: AutonomyRoutine, control: ControlPlaneState): boolean {
    if (control.frozenScopes.length === 0 || routine.scopeTags.length === 0) {
      return false;
    }
    return routine.scopeTags.some((tag) => control.frozenScopes.includes(tag));
  }

  private computeNextRun(routine: AutonomyRoutine): string | null {
    if (!routine.enabled || routine.frozen) {
      return null;
    }
    const nowMs = this.now().getTime();
    if (routine.scheduleType === 'interval' && routine.intervalMs) {
      return new Date(nowMs + Math.max(1, routine.intervalMs)).toISOString();
    }
    if (routine.scheduleType === 'once') {
      const target = Date.parse(routine.schedule);
      return Number.isFinite(target) && target > nowMs ? new Date(target).toISOString() : null;
    }
    // cron / natural_language: keep a conservative forward pointer; host daemon re-evaluates.
    return new Date(nowMs + 60_000).toISOString();
  }

  private computeNextRunAfterRun(routine: AutonomyRoutine): string | null {
    if (routine.scheduleType === 'once') {
      return null;
    }
    return this.computeNextRun({ ...routine, enabled: true, frozen: false });
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private controlPath(): string {
    return path.join(this.storageDir, CONTROL_FILE);
  }

  private routinePath(routineId: string): string {
    return path.join(this.storageDir, `${routineId}.json`);
  }

  private listAllRoutineIds(): string[] {
    if (!fs.existsSync(this.storageDir)) {
      return [];
    }
    return fs.readdirSync(this.storageDir)
      .filter((file) => file.endsWith('.json') && file !== CONTROL_FILE)
      .map((file) => file.replace(/\.json$/u, ''));
  }

  private loadRoutine(routineId: string): AutonomyRoutine | null {
    const id = normalizeId(routineId);
    if (!id) return null;
    const filePath = this.routinePath(id);
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      return normalizeStoredRoutine(raw, id);
    } catch {
      return null;
    }
  }

  private saveRoutine(routine: AutonomyRoutine): void {
    this.ensureStorageDir();
    fs.writeFileSync(this.routinePath(routine.id), JSON.stringify(routine, null, 2), 'utf8');
  }

  private readControl(): ControlPlaneState {
    this.ensureStorageDir();
    const filePath = this.controlPath();
    if (!fs.existsSync(filePath)) {
      return {
        killSwitchActive: false,
        frozenScopes: [],
        updatedAt: this.timestamp(),
      };
    }
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<ControlPlaneState>;
      return {
        killSwitchActive: Boolean(raw.killSwitchActive),
        frozenScopes: uniqueTags(raw.frozenScopes || []),
        updatedAt: String(raw.updatedAt || this.timestamp()),
      };
    } catch {
      return {
        killSwitchActive: false,
        frozenScopes: [],
        updatedAt: this.timestamp(),
      };
    }
  }

  private writeControl(control: ControlPlaneState): ControlPlaneState {
    this.ensureStorageDir();
    const next = {
      killSwitchActive: Boolean(control.killSwitchActive),
      frozenScopes: uniqueTags(control.frozenScopes),
      updatedAt: this.timestamp(),
    };
    fs.writeFileSync(this.controlPath(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  private blockedMutation(operation: string, target: string | null, reason: string): AutonomyScheduleMutationResult {
    return this.finalizeMutation({
      operation: `autonomy.routine.${operation}`,
      target: target || 'autonomy-schedule-plane',
      actor: 'operator',
      allowed: false,
      rule: 'autonomy-schedule:blocked',
      reasons: [reason],
      summary: reason,
      routine: target ? this.loadRoutine(target) : null,
      task: null,
      status: 'blocked',
      data: { blockedReason: reason },
      blockedReason: reason,
    });
  }

  private blockedProcessDue(reason: string): AutonomyScheduleProcessDueResult {
    let envelope = this.continuity.begin();
    envelope = this.continuity.recordRequest(envelope, {
      surface: 'cli',
      operation: 'autonomy.routine.process_due',
      target: 'autonomy-schedule-plane',
      actorId: 'autonomy-schedule-plane',
      sourceSurface: 'autonomy-schedule-plane',
    });
    envelope = this.continuity.attachDecision(envelope, {
      source: 'mutation-plane',
      action: 'deny',
      allowed: false,
      rule: 'autonomy-schedule:blocked',
      reasons: [reason],
    });
    envelope = this.continuity.attachResult(envelope, resultFromToolOutcome({
      ok: false,
      status: 'blocked',
      summary: reason,
    }));
    envelope = this.continuity.finalizeReceipt(envelope);
    return {
      ok: false,
      summary: reason,
      processed: 0,
      materialized: [],
      receipt: envelope.receipt,
      continuity: envelope,
      blockedReason: reason,
    };
  }

  private finalizeMutation(input: {
    operation: string;
    target: string;
    actor?: string | null;
    allowed: boolean;
    rule: string;
    reasons: string[];
    summary: string;
    routine: AutonomyRoutine | null;
    task: TaskPlaneItem | null;
    status: 'applied' | 'blocked' | 'preview' | 'failed';
    data?: Record<string, unknown>;
    blockedReason?: string;
  }): AutonomyScheduleMutationResult {
    let envelope = this.continuity.begin({
      correlation: {
        taskId: input.task?.id || null,
      },
    });
    envelope = this.continuity.recordRequest(envelope, {
      surface: 'cli',
      operation: input.operation,
      target: input.target,
      actorId: input.actor || 'operator',
      sourceSurface: 'autonomy-schedule-plane',
      metadata: {
        routineId: input.routine?.id || null,
        taskId: input.task?.id || null,
      },
    });
    envelope = this.continuity.attachDecision(envelope, {
      source: 'mutation-plane',
      action: input.allowed ? 'allow' : 'deny',
      allowed: input.allowed,
      rule: input.rule,
      reasons: input.reasons,
    });
    envelope = this.continuity.attachResult(envelope, resultFromToolOutcome({
      ok: input.allowed,
      status: input.status,
      summary: input.summary,
      data: {
        ...(input.data || {}),
        routineId: input.routine?.id || null,
        taskId: input.task?.id || null,
      },
    }));
    envelope = this.continuity.finalizeReceipt(envelope);
    return {
      ok: input.allowed,
      summary: input.summary,
      routine: input.routine,
      task: input.task,
      receipt: envelope.receipt,
      continuity: envelope,
      ...(input.blockedReason ? { blockedReason: input.blockedReason } : {}),
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function normalizeStoredRoutine(raw: Record<string, unknown>, fallbackId: string): AutonomyRoutine {
  const scheduleType = String(raw.scheduleType || raw.schedule_type || 'natural_language') as AutonomyRoutineScheduleType;
  const riskLevel = String(raw.riskLevel || raw.risk_level || 'medium') as AutonomyRoutineRiskLevel;
  return {
    contractVersion: 'autonomy-routine/1',
    id: String(raw.id || fallbackId),
    name: String(raw.name || fallbackId),
    schedule: String(raw.schedule || ''),
    scheduleType: ['cron', 'interval', 'once', 'natural_language'].includes(scheduleType)
      ? scheduleType
      : 'natural_language',
    ...(typeof raw.intervalMs === 'number' || typeof raw.interval_ms === 'number'
      ? { intervalMs: Number(raw.intervalMs ?? raw.interval_ms) }
      : {}),
    taskDescription: String(raw.taskDescription || raw.task_description || ''),
    ...(raw.channel ? { channel: String(raw.channel) } : {}),
    enabled: Boolean(raw.enabled),
    lastRunAt: (raw.lastRunAt || raw.last_run || null) as string | null,
    nextRunAt: (raw.nextRunAt || raw.next_run || null) as string | null,
    runCount: Number(raw.runCount || raw.run_count || 0),
    lastResult: (raw.lastResult || raw.last_result || null) as string | null,
    lastTaskPlaneItemId: (raw.lastTaskPlaneItemId || raw.last_task_plane_item_id || null) as string | null,
    createdAt: String(raw.createdAt || raw.created_at || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.updated_at || new Date().toISOString()),
    riskLevel: ['low', 'medium', 'high', 'critical'].includes(riskLevel) ? riskLevel : 'medium',
    requiresApproval: Boolean(raw.requiresApproval ?? raw.requires_approval),
    frozen: Boolean(raw.frozen),
    scopeTags: uniqueTags((raw.scopeTags || raw.scope_tags || []) as string[]),
  };
}

function detectScheduleType(schedule: string, intervalMs?: number | null): AutonomyRoutineScheduleType {
  if (typeof intervalMs === 'number') return 'interval';
  if (/^[\d/*,\-]+\s+[\d/*,\-]+\s+[\d/*,\-]+\s+[\d/*,\-]+\s+[\d/*,\-]+$/.test(schedule.trim())) return 'cron';
  if (/^\d{4}-\d{2}-\d{2}T/.test(schedule.trim())) return 'once';
  return 'natural_language';
}

function inferRiskLevel(taskDescription: string): AutonomyRoutineRiskLevel {
  const desc = taskDescription.toLowerCase();
  if (/\b(delete|remove|drop|destroy|kill|rm\s+-rf)\b/u.test(desc)) return 'critical';
  if (/\b(send|post|publish|deploy|execute|run|modify|write|edit)\b/u.test(desc)) return 'high';
  if (/\b(read|check|monitor|scan|list|query|search)\b/u.test(desc)) return 'low';
  return 'medium';
}

function normalizeId(value: string): string {
  return String(value || '').trim();
}

function uniqueTags(values?: readonly string[] | null): string[] {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))).sort();
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
