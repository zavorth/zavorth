#!/usr/bin/env tsx
import type { ScheduledTask } from '../src/storage/SchedulerRepository.js';
import { Database } from '../src/storage/Database.js';
import { SchedulerRepository } from '../src/storage/SchedulerRepository.js';
import { SchedulerService } from '../src/services/SchedulerService.js';
import type {
  ZavorthScheduledTaskPersistenceAction,
  ZavorthScheduledTaskPersistenceInput,
} from '../src/contracts/ZavorthScheduledTaskPersistenceContract.js';
import type {
  ZavorthScheduledTaskBudget,
  ZavorthScheduledTaskInput,
  ZavorthScheduledTaskRenewalPolicy,
} from '../src/contracts/ZavorthScheduledTaskContract.js';
import type { ZavorthCrossSurfaceProjectionSurface } from '../src/contracts/ZavorthCrossSurfaceRuntimeProjectionContract.js';
import { ZavorthScheduledTaskPersistenceService } from '../src/services/ZavorthScheduledTaskPersistenceService.js';

type Args = {
  json: boolean;
  fixtureScheduler: boolean;
  noScheduler: boolean;
  input: ZavorthScheduledTaskPersistenceInput;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const scheduler = await resolveScheduler(args);
  const service = new ZavorthScheduledTaskPersistenceService({
    schedulerService: scheduler,
  });
  const snapshot = await service.buildSnapshot(args.input);

  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (snapshot.status === 'blocked') process.exitCode = 1;
}

async function resolveScheduler(args: Args): Promise<SchedulerService | MemoryScheduler | null> {
  if (args.noScheduler) return null;
  if (args.fixtureScheduler) return new MemoryScheduler();
  if (args.input.action && args.input.action !== 'preview') {
    const db = await Database.getInstance();
    return new SchedulerService(new SchedulerRepository(db));
  }
  return null;
}

function parseArgs(argv: string[]): Args {
  const scheduledTask: ZavorthScheduledTaskInput = {
    allowedTools: [],
    budget: {},
    approval: {},
    policy: {},
  };
  const input: ZavorthScheduledTaskPersistenceInput = {
    action: 'preview',
    scheduledTask,
  };
  let json = false;
  let fixtureScheduler = false;
  let noScheduler = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') json = true;
    else if (arg === '--fixture-scheduler') fixtureScheduler = true;
    else if (arg === '--no-scheduler') noScheduler = true;
    else if (arg === '--action') input.action = parseAction(next(argv, ++index));
    else if (arg.startsWith('--action=')) input.action = parseAction(arg.slice('--action='.length));
    else if (arg === '--task-id') input.taskId = next(argv, ++index);
    else if (arg.startsWith('--task-id=')) input.taskId = arg.slice('--task-id='.length);
    else if (arg === '--intent') scheduledTask.intent = next(argv, ++index);
    else if (arg.startsWith('--intent=')) scheduledTask.intent = arg.slice('--intent='.length);
    else if (arg === '--command') scheduledTask.command = next(argv, ++index);
    else if (arg.startsWith('--command=')) scheduledTask.command = arg.slice('--command='.length);
    else if (arg === '--schedule') scheduledTask.schedule = next(argv, ++index);
    else if (arg.startsWith('--schedule=')) scheduledTask.schedule = arg.slice('--schedule='.length);
    else if (arg === '--workspace') scheduledTask.workspace = next(argv, ++index);
    else if (arg.startsWith('--workspace=')) scheduledTask.workspace = arg.slice('--workspace='.length);
    else if (arg === '--surface') scheduledTask.surface = parseSurface(next(argv, ++index));
    else if (arg.startsWith('--surface=')) scheduledTask.surface = parseSurface(arg.slice('--surface='.length));
    else if (arg === '--created-by') scheduledTask.createdBy = next(argv, ++index);
    else if (arg.startsWith('--created-by=')) scheduledTask.createdBy = arg.slice('--created-by='.length);
    else if (arg === '--tool') scheduledTask.allowedTools = appendTool(scheduledTask.allowedTools, next(argv, ++index));
    else if (arg.startsWith('--tool=')) scheduledTask.allowedTools = appendTool(scheduledTask.allowedTools, arg.slice('--tool='.length));
    else if (arg === '--owner-confirmed') scheduledTask.approval = { ...(scheduledTask.approval || {}), ownerConfirmed: true };
    else if (arg === '--approval') scheduledTask.approval = { ...(scheduledTask.approval || {}), approvalId: next(argv, ++index) };
    else if (arg.startsWith('--approval=')) scheduledTask.approval = { ...(scheduledTask.approval || {}), approvalId: arg.slice('--approval='.length) };
    else if (arg === '--approved-by') scheduledTask.approval = { ...(scheduledTask.approval || {}), approvedBy: next(argv, ++index) };
    else if (arg.startsWith('--approved-by=')) scheduledTask.approval = { ...(scheduledTask.approval || {}), approvedBy: arg.slice('--approved-by='.length) };
    else if (arg === '--ttl-ms') scheduledTask.approval = { ...(scheduledTask.approval || {}), ttlMs: Number(next(argv, ++index)) };
    else if (arg.startsWith('--ttl-ms=')) scheduledTask.approval = { ...(scheduledTask.approval || {}), ttlMs: Number(arg.slice('--ttl-ms='.length)) };
    else if (arg === '--renewal') scheduledTask.policy = { ...(scheduledTask.policy || {}), renewalPolicy: parseRenewal(next(argv, ++index)) };
    else if (arg.startsWith('--renewal=')) scheduledTask.policy = { ...(scheduledTask.policy || {}), renewalPolicy: parseRenewal(arg.slice('--renewal='.length)) };
    else if (arg === '--max-mutations') scheduledTask.budget = setBudget(scheduledTask.budget, 'maxMutations', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-mutations=')) scheduledTask.budget = setBudget(scheduledTask.budget, 'maxMutations', Number(arg.slice('--max-mutations='.length)));
    else if (arg === '--max-commands') scheduledTask.budget = setBudget(scheduledTask.budget, 'maxCommands', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-commands=')) scheduledTask.budget = setBudget(scheduledTask.budget, 'maxCommands', Number(arg.slice('--max-commands='.length)));
  }

  return { json, fixtureScheduler, noScheduler, input };
}

class MemoryScheduler {
  private readonly tasks = new Map<string, ScheduledTask>();
  private sequence = 0;

  public scheduleTask(command: string, schedule: string, userId: string, options: any = {}): ScheduledTask {
    this.sequence += 1;
    const id = `fixture-task-${this.sequence}`;
    const now = new Date('2026-05-12T12:00:00.000Z').toISOString();
    const task: ScheduledTask = {
      id,
      command,
      schedule,
      created_at: now,
      last_run: null,
      next_run: '2026-05-12T12:15:00.000Z',
      created_by: userId,
      status: 'active',
      intent_text: options.intentText || command,
      delivery: options.delivery || 'app',
      delivery_target: options.deliveryTarget || null,
      last_status: 'idle',
      last_error: null,
      last_result: null,
      run_count: 0,
      failure_count: 0,
      budget_json: JSON.stringify(options.budget || {}),
      guardrail_json: JSON.stringify({
        ...(options.guardrails || {}),
        governedScheduledTask: options.governedScheduledTask || null,
      }),
      paused_reason: null,
      last_failure_at: null,
      consecutive_failures: 0,
    };
    this.tasks.set(id, task);
    return task;
  }

  public findTaskByPrefix(idPrefix: string): ScheduledTask | null {
    return Array.from(this.tasks.values()).find((entry) => entry.id.startsWith(idPrefix)) || null;
  }

  public getTask(id: string): ScheduledTask | null {
    return this.tasks.get(id) || null;
  }

  public pauseTask(id: string): ScheduledTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.status = 'paused';
    return task;
  }

  public resumeTask(id: string): ScheduledTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.status = 'active';
    return task;
  }

  public removeTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  public updateTaskRuntimeMetadata(id: string, input: any): ScheduledTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.budget_json = JSON.stringify(input.budget || {});
    task.guardrail_json = JSON.stringify({
      ...(input.guardrails || {}),
      governedScheduledTask: input.governedScheduledTask || null,
    });
    task.paused_reason = input.pausedReason || null;
    return task;
  }
}

function next(argv: string[], index: number): string {
  return String(argv[index] || '');
}

function parseAction(value: string): ZavorthScheduledTaskPersistenceAction {
  if (value === 'register' || value === 'pause' || value === 'resume' || value === 'revoke' || value === 'reapprove') return value;
  return 'preview';
}

function appendTool(current: string[] | null | undefined, value: string): string[] {
  const clean = value.trim();
  return clean ? [...(current || []), clean] : [...(current || [])];
}

function setBudget(
  current: Partial<ZavorthScheduledTaskBudget> | null | undefined,
  key: keyof ZavorthScheduledTaskBudget,
  value: number,
): Partial<ZavorthScheduledTaskBudget> {
  return { ...(current || {}), [key]: value };
}

function parseSurface(value: string): ZavorthCrossSurfaceProjectionSurface {
  const normalized = value.trim().toLowerCase();
  const allowed = new Set<ZavorthCrossSurfaceProjectionSurface>([
    'cli',
    'telegram',
    'discord',
    'whatsapp',
    'signal',
    'imessage',
    'web',
    'api',
    'command_center',
  ]);
  return allowed.has(normalized as ZavorthCrossSurfaceProjectionSurface)
    ? normalized as ZavorthCrossSurfaceProjectionSurface
    : 'cli';
}

function parseRenewal(value: string): ZavorthScheduledTaskRenewalPolicy {
  if (value === 'expire_and_notify' || value === 'auto_renew_disabled' || value === 'require_reapproval') return value;
  return 'require_reapproval';
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
