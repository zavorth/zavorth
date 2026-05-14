import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import type { ZavorthSupervisorGraphPlanInput } from '../services/ZavorthSupervisorGraphService.js';
import { formatSupervisorGraphSnapshot } from './ZavorthCliSupervisorGraphRenderer.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

type ParsedSupervisorArgs = ZavorthSupervisorGraphPlanInput & {
  action: 'plan' | 'status' | 'ledger';
};

export async function handleZavorthCliRegistrySupervisorCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { runtime, effectiveFlags, commandName, args, writer } = params;
  if (commandName !== 'supervisor' && commandName !== 'graph') {
    return null;
  }
  const service = runtime.supervisorGraphService;
  if (!service) {
    return null;
  }

  const parsed = parseSupervisorArgs(args);
  const snapshot = await service.buildSnapshot({
    ...parsed,
    userId: effectiveFlags.userId,
  });
  const body = effectiveFlags.json
    ? JSON.stringify(snapshot, null, 2)
    : formatSupervisorGraphSnapshot(snapshot);
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function parseSupervisorArgs(args: string): ParsedSupervisorArgs {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const first = String(tokens[0] || '').trim().toLowerCase();
  const action: ParsedSupervisorArgs['action'] = first === 'ledger'
    ? 'ledger'
    : first === 'status'
      ? 'status'
      : 'plan';
  const rest = action === 'plan' && first !== 'plan'
    ? tokens
    : tokens.slice(1);

  const objectiveParts: string[] = [];
  let taskId: string | null = null;
  let forceGraph = false;
  let simulateTestFailure = false;
  let maxRetries: number | null = null;
  let maxCost: number | null = null;
  let spentCost: number | null = null;

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const lower = token.toLowerCase();
    if (lower === '--graph' || lower === '--force-graph') {
      forceGraph = true;
      continue;
    }
    if (lower === '--simulate-test-failure' || lower === '--fail-test') {
      simulateTestFailure = true;
      continue;
    }
    if ((lower === '--task' || lower === '--task-id') && rest[index + 1]) {
      taskId = rest[index + 1];
      index += 1;
      continue;
    }
    if (lower.startsWith('--task=')) {
      taskId = token.slice('--task='.length);
      continue;
    }
    if (lower.startsWith('--task-id=')) {
      taskId = token.slice('--task-id='.length);
      continue;
    }
    if (lower === '--max-retries' && rest[index + 1]) {
      maxRetries = Number(rest[index + 1]);
      index += 1;
      continue;
    }
    if (lower.startsWith('--max-retries=')) {
      maxRetries = Number(token.slice('--max-retries='.length));
      continue;
    }
    if (lower === '--max-cost' && rest[index + 1]) {
      maxCost = Number(rest[index + 1]);
      index += 1;
      continue;
    }
    if (lower.startsWith('--max-cost=')) {
      maxCost = Number(token.slice('--max-cost='.length));
      continue;
    }
    if (lower === '--spent-cost' && rest[index + 1]) {
      spentCost = Number(rest[index + 1]);
      index += 1;
      continue;
    }
    if (lower.startsWith('--spent-cost=')) {
      spentCost = Number(token.slice('--spent-cost='.length));
      continue;
    }
    objectiveParts.push(token);
  }

  return {
    action,
    objective: objectiveParts.join(' ').trim() || null,
    taskId,
    forceGraph,
    simulateTestFailure,
    maxRetries,
    maxCost,
    spentCost,
  };
}
