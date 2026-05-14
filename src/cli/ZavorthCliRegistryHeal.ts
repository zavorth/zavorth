import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import type { ZavorthSelfHealPlanInput } from '../services/ZavorthSelfHealControlPlaneService.js';
import { formatSelfHealPlan } from './ZavorthCliSelfHealRenderer.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

type ParsedHealArgs = ZavorthSelfHealPlanInput & {
  action: 'preview' | 'apply' | 'report';
};

export async function handleZavorthCliRegistryHealCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { runtime, effectiveFlags, commandName, args, writer } = params;
  if (commandName !== 'heal') {
    return null;
  }

  const service = runtime.selfHealControlPlaneService;
  if (!service) {
    return null;
  }

  const parsed = parseHealArgs(args, effectiveFlags);
  const snapshot = parsed.action === 'report'
    ? await service.buildDailyReport({
        ...parsed,
        requestedBy: effectiveFlags.userId,
      })
    : await service.buildPreview({
        ...parsed,
        apply: parsed.action === 'apply',
        requestedBy: effectiveFlags.userId,
      });
  const body = effectiveFlags.json
    ? JSON.stringify(snapshot, null, 2)
    : formatSelfHealPlan(snapshot);
  writer.line(body);
  return {
    ok: true,
    handled: true,
    output: [body],
    error: null,
  };
}

function parseHealArgs(args: string, flags: Pick<ZavorthCliFlags, 'live'>): ParsedHealArgs {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  let action: ParsedHealArgs['action'] = 'preview';
  let live = Boolean(flags.live);
  let force = false;
  let budget: number | null = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const lower = token.toLowerCase();
    if (lower === 'preview' || lower === '--preview' || lower === 'dryrun' || lower === '--dry-run') {
      action = 'preview';
      continue;
    }
    if (lower === 'apply' || lower === '--apply') {
      action = 'apply';
      continue;
    }
    if (lower === 'report' || lower === 'daily' || lower === 'daily-report') {
      action = 'report';
      continue;
    }
    if (lower === '--live') {
      live = true;
      continue;
    }
    if (lower === '--force' || lower === 'force') {
      force = true;
      continue;
    }
    if (lower === '--budget' && tokens[index + 1]) {
      budget = Number(tokens[index + 1]);
      index += 1;
      continue;
    }
    if (lower.startsWith('--budget=')) {
      budget = Number(token.slice('--budget='.length));
    }
  }

  return {
    action,
    live,
    force,
    budget,
    includeDaily: action === 'report',
  };
}
