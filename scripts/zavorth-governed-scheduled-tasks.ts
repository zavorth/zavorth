#!/usr/bin/env tsx
import type {
  ZavorthScheduledTaskBudget,
  ZavorthScheduledTaskInput,
  ZavorthScheduledTaskRenewalPolicy,
} from '../src/contracts/ZavorthScheduledTaskContract.js';
import type { ZavorthCrossSurfaceProjectionSurface } from '../src/contracts/ZavorthCrossSurfaceRuntimeProjectionContract.js';
import { ZavorthGovernedScheduledTaskRegistryService } from '../src/services/ZavorthGovernedScheduledTaskRegistryService.js';

type Args = {
  json: boolean;
  input: ZavorthScheduledTaskInput;
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const service = new ZavorthGovernedScheduledTaskRegistryService();
  const snapshot = service.buildSnapshot(args.input);

  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (snapshot.status === 'blocked') process.exitCode = 1;
}

function parseArgs(argv: string[]): Args {
  const input: ZavorthScheduledTaskInput = {
    allowedTools: [],
    budget: {},
    approval: {},
    policy: {},
  };
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') json = true;
    else if (arg === '--intent') input.intent = next(argv, ++index);
    else if (arg.startsWith('--intent=')) input.intent = arg.slice('--intent='.length);
    else if (arg === '--command') input.command = next(argv, ++index);
    else if (arg.startsWith('--command=')) input.command = arg.slice('--command='.length);
    else if (arg === '--schedule') input.schedule = next(argv, ++index);
    else if (arg.startsWith('--schedule=')) input.schedule = arg.slice('--schedule='.length);
    else if (arg === '--workspace') input.workspace = next(argv, ++index);
    else if (arg.startsWith('--workspace=')) input.workspace = arg.slice('--workspace='.length);
    else if (arg === '--surface') input.surface = parseSurface(next(argv, ++index));
    else if (arg.startsWith('--surface=')) input.surface = parseSurface(arg.slice('--surface='.length));
    else if (arg === '--created-by') input.createdBy = next(argv, ++index);
    else if (arg.startsWith('--created-by=')) input.createdBy = arg.slice('--created-by='.length);
    else if (arg === '--tool') input.allowedTools = appendTool(input.allowedTools, next(argv, ++index));
    else if (arg.startsWith('--tool=')) input.allowedTools = appendTool(input.allowedTools, arg.slice('--tool='.length));
    else if (arg === '--owner-confirmed') input.approval = { ...(input.approval || {}), ownerConfirmed: true };
    else if (arg === '--approval') input.approval = { ...(input.approval || {}), approvalId: next(argv, ++index) };
    else if (arg.startsWith('--approval=')) input.approval = { ...(input.approval || {}), approvalId: arg.slice('--approval='.length) };
    else if (arg === '--approved-by') input.approval = { ...(input.approval || {}), approvedBy: next(argv, ++index) };
    else if (arg.startsWith('--approved-by=')) input.approval = { ...(input.approval || {}), approvedBy: arg.slice('--approved-by='.length) };
    else if (arg === '--ttl-ms') input.approval = { ...(input.approval || {}), ttlMs: Number(next(argv, ++index)) };
    else if (arg.startsWith('--ttl-ms=')) input.approval = { ...(input.approval || {}), ttlMs: Number(arg.slice('--ttl-ms='.length)) };
    else if (arg === '--no-approval-required') input.policy = { ...(input.policy || {}), requireApproval: false };
    else if (arg === '--kill-switch') input.policy = { ...(input.policy || {}), killSwitchEnabled: true };
    else if (arg === '--allow-compound') input.policy = { ...(input.policy || {}), noCompound: false };
    else if (arg === '--renewal') input.policy = { ...(input.policy || {}), renewalPolicy: parseRenewal(next(argv, ++index)) };
    else if (arg.startsWith('--renewal=')) input.policy = { ...(input.policy || {}), renewalPolicy: parseRenewal(arg.slice('--renewal='.length)) };
    else if (arg === '--max-runtime-ms') input.budget = setBudget(input.budget, 'maxRuntimeMs', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-runtime-ms=')) input.budget = setBudget(input.budget, 'maxRuntimeMs', Number(arg.slice('--max-runtime-ms='.length)));
    else if (arg === '--max-tokens') input.budget = setBudget(input.budget, 'maxTokens', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-tokens=')) input.budget = setBudget(input.budget, 'maxTokens', Number(arg.slice('--max-tokens='.length)));
    else if (arg === '--max-tool-calls') input.budget = setBudget(input.budget, 'maxToolCalls', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-tool-calls=')) input.budget = setBudget(input.budget, 'maxToolCalls', Number(arg.slice('--max-tool-calls='.length)));
    else if (arg === '--max-network-requests') input.budget = setBudget(input.budget, 'maxNetworkRequests', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-network-requests=')) input.budget = setBudget(input.budget, 'maxNetworkRequests', Number(arg.slice('--max-network-requests='.length)));
    else if (arg === '--max-commands') input.budget = setBudget(input.budget, 'maxCommands', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-commands=')) input.budget = setBudget(input.budget, 'maxCommands', Number(arg.slice('--max-commands='.length)));
    else if (arg === '--max-mutations') input.budget = setBudget(input.budget, 'maxMutations', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-mutations=')) input.budget = setBudget(input.budget, 'maxMutations', Number(arg.slice('--max-mutations='.length)));
    else if (arg === '--max-retries') input.budget = setBudget(input.budget, 'maxRetries', Number(next(argv, ++index)));
    else if (arg.startsWith('--max-retries=')) input.budget = setBudget(input.budget, 'maxRetries', Number(arg.slice('--max-retries='.length)));
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
