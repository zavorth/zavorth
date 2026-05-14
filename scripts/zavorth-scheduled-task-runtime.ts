#!/usr/bin/env tsx
import type {
  ZavorthScheduledTaskInput,
  ZavorthScheduledTaskBudget,
  ZavorthScheduledTaskRenewalPolicy,
} from '../src/contracts/ZavorthScheduledTaskContract.js';
import type { ZavorthCrossSurfaceProjectionSurface } from '../src/contracts/ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type { ZavorthScheduledTaskRuntimeInput } from '../src/contracts/ZavorthScheduledTaskRuntimeContract.js';
import { ZavorthScheduledTaskExecutionGatewayRuntimeService } from '../src/services/ZavorthScheduledTaskExecutionGatewayRuntimeService.js';

type Args = {
  json: boolean;
  input: ZavorthScheduledTaskRuntimeInput;
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const service = new ZavorthScheduledTaskExecutionGatewayRuntimeService();
  const snapshot = await service.buildSnapshot(args.input);

  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (snapshot.status === 'blocked' || snapshot.status === 'gateway_failed') process.exitCode = 1;
}

function parseArgs(argv: string[]): Args {
  const scheduledTask: ZavorthScheduledTaskInput = {
    allowedTools: [],
    budget: {},
    approval: {},
    policy: {},
  };
  const input: ZavorthScheduledTaskRuntimeInput = {
    scheduledTask,
    tick: {
      due: true,
      submit: false,
      dryRun: true,
      scopeOverride: {},
    },
  };
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') json = true;
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
    else if (arg === '--no-approval-required') scheduledTask.policy = { ...(scheduledTask.policy || {}), requireApproval: false };
    else if (arg === '--renewal') scheduledTask.policy = { ...(scheduledTask.policy || {}), renewalPolicy: parseRenewal(next(argv, ++index)) };
    else if (arg.startsWith('--renewal=')) scheduledTask.policy = { ...(scheduledTask.policy || {}), renewalPolicy: parseRenewal(arg.slice('--renewal='.length)) };
    else if (arg === '--max-mutations') scheduledTask.budget = setBudget(scheduledTask.budget, 'maxMutations', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-mutations=')) scheduledTask.budget = setBudget(scheduledTask.budget, 'maxMutations', Number(arg.slice('--max-mutations='.length)));
    else if (arg === '--max-commands') scheduledTask.budget = setBudget(scheduledTask.budget, 'maxCommands', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-commands=')) scheduledTask.budget = setBudget(scheduledTask.budget, 'maxCommands', Number(arg.slice('--max-commands='.length)));
    else if (arg === '--max-network-requests') scheduledTask.budget = setBudget(scheduledTask.budget, 'maxNetworkRequests', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-network-requests=')) scheduledTask.budget = setBudget(scheduledTask.budget, 'maxNetworkRequests', Number(arg.slice('--max-network-requests='.length)));
    else if (arg === '--submit') input.tick = { ...(input.tick || {}), submit: true };
    else if (arg === '--not-due') input.tick = { ...(input.tick || {}), due: false };
    else if (arg === '--live') input.tick = { ...(input.tick || {}), dryRun: false };
    else if (arg === '--kill-switch') input.tick = { ...(input.tick || {}), killSwitchEnabled: true };
    else if (arg === '--task-id') input.tick = { ...(input.tick || {}), taskId: next(argv, ++index) };
    else if (arg.startsWith('--task-id=')) input.tick = { ...(input.tick || {}), taskId: arg.slice('--task-id='.length) };
    else if (arg === '--executor') input.tick = { ...(input.tick || {}), executor: next(argv, ++index) };
    else if (arg.startsWith('--executor=')) input.tick = { ...(input.tick || {}), executor: arg.slice('--executor='.length) };
    else if (arg === '--override-command') input.tick = { ...(input.tick || {}), scopeOverride: { ...(input.tick?.scopeOverride || {}), command: next(argv, ++index) } };
    else if (arg.startsWith('--override-command=')) input.tick = { ...(input.tick || {}), scopeOverride: { ...(input.tick?.scopeOverride || {}), command: arg.slice('--override-command='.length) } };
    else if (arg === '--override-workspace') input.tick = { ...(input.tick || {}), scopeOverride: { ...(input.tick?.scopeOverride || {}), workspace: next(argv, ++index) } };
    else if (arg.startsWith('--override-workspace=')) input.tick = { ...(input.tick || {}), scopeOverride: { ...(input.tick?.scopeOverride || {}), workspace: arg.slice('--override-workspace='.length) } };
    else if (arg === '--override-schedule') input.tick = { ...(input.tick || {}), scopeOverride: { ...(input.tick?.scopeOverride || {}), schedule: next(argv, ++index) } };
    else if (arg.startsWith('--override-schedule=')) input.tick = { ...(input.tick || {}), scopeOverride: { ...(input.tick?.scopeOverride || {}), schedule: arg.slice('--override-schedule='.length) } };
  }

  return { json, input };
}

function next(argv: string[], index: number): string {
  return String(argv[index] || '');
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
