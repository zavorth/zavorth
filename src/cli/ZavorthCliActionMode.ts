import { ExecutionEngineRegistryService } from '../services/ExecutionEngineRegistryService.js';
import { ExecutionEngineRouterService, type ExecutionEngineRouteOperation } from '../services/ExecutionEngineRouterService.js';
import { GlassBoxTraceService } from '../services/GlassBoxTraceService.js';
import { TrustedWorkspacePolicyService } from '../services/TrustedWorkspacePolicyService.js';
import type { ExecutionEngineDecision } from '../contracts/ExecutionEngineContract.js';

export type ZavorthCliActionCommand = 'ask' | 'chat' | 'edit' | 'apply';

export type ZavorthCliActionInput = {
  command: ZavorthCliActionCommand;
  args: string[];
  cwd?: string;
};

type ParsedAction = {
  prompt: string;
  targetPath: string | null;
  json: boolean;
  yes: boolean;
};

export async function runZavorthCliActionMode(input: ZavorthCliActionInput): Promise<number> {
  const parsed = parseActionArgs(input.args);
  if (!parsed.prompt && input.command !== 'chat') {
    process.stdout.write(renderActionHelp(input.command));
    return 0;
  }

  const registry = new ExecutionEngineRegistryService({
    activeEngineId: preferredEngineFor(input.command),
  });
  const trustedWorkspaces = new TrustedWorkspacePolicyService();
  const trace = new GlassBoxTraceService();
  const router = new ExecutionEngineRouterService(registry, trustedWorkspaces, trace);
  const decision = router.decide({
    prompt: parsed.prompt || 'Start an interactive Zavorth chat session.',
    operation: operationFor(input.command),
    targetPath: parsed.targetPath || input.cwd || process.cwd(),
    requestedEngineId: registry.getActiveEngineId(),
  });

  const payload = {
    ok: true,
    surface: 'cli-action-mode',
    command: input.command,
    prompt: parsed.prompt,
    targetPath: parsed.targetPath || input.cwd || process.cwd(),
    engineDecision: decision,
    next: nextActions(input.command, decision, parsed.yes),
    safety: {
      directHostExecution: decision.engineId === 'velocity' && decision.status === 'ready' && parsed.yes,
      policyStillFinalAuthority: true,
      rawReasoningHidden: true,
      traceKind: decision.engineId === 'shield' ? 'full-operational' : decision.engineId === 'velocity' ? 'compact-operational' : 'quiet',
    },
  };

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(renderActionText(payload));
  return 0;
}

function parseActionArgs(args: string[]): ParsedAction {
  const words: string[] = [];
  let targetPath: string | null = null;
  let json = false;
  let yes = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] || '';
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg === '--yes' || arg === '-y') {
      yes = true;
      continue;
    }
    if (arg === '--path' || arg === '--workspace' || arg === '--file') {
      targetPath = args[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg.startsWith('--path=')) {
      targetPath = arg.slice('--path='.length);
      continue;
    }
    if (arg.startsWith('--workspace=')) {
      targetPath = arg.slice('--workspace='.length);
      continue;
    }
    if (arg.startsWith('--file=')) {
      targetPath = arg.slice('--file='.length);
      continue;
    }
    words.push(arg);
  }
  return {
    prompt: words.join(' ').trim(),
    targetPath,
    json,
    yes,
  };
}

function preferredEngineFor(command: ZavorthCliActionCommand): 'lite' | 'velocity' | 'shield' {
  if (command === 'edit' || command === 'apply') return 'velocity';
  return 'lite';
}

function operationFor(command: ZavorthCliActionCommand): ExecutionEngineRouteOperation {
  if (command === 'edit' || command === 'apply') return 'write';
  return 'chat';
}

function nextActions(command: ZavorthCliActionCommand, decision: ExecutionEngineDecision, yes: boolean): string[] {
  if (decision.engineId === 'lite') {
    return [
      'Start the answer immediately.',
      'Promote to Velocity or Shield only if the conversation turns into file/system work.',
    ];
  }
  if (decision.engineId === 'velocity' && decision.status === 'ready') {
    return yes
      ? ['Prepare the diff and apply only if the trusted-workspace policy still allows it.']
      : ['Prepare an interactive diff.', 'Run again with --yes only after reviewing the diff.'];
  }
  if (command === 'apply') {
    return ['Open Shield approval because this apply is outside the low-risk trusted path.'];
  }
  return ['Use Shield sandbox preview.', 'Show approval only for the risky step, not for ordinary chat.'];
}

function renderActionHelp(command: ZavorthCliActionCommand): string {
  return [
    `Zavorth ${command}`,
    '',
    `Usage: zavorth ${command} "<request>" [--path <folder-or-file>] [--json] [--yes]`,
    '',
    'Fast surface rules:',
    '  ask/chat  -> Lite / Express for conversation and read-only work',
    '  edit      -> Velocity diff when inside a trusted workspace',
    '  apply     -> Velocity only for accepted low-risk trusted diffs; otherwise Shield',
    '',
  ].join('\n');
}

function renderActionText(payload: {
  command: ZavorthCliActionCommand;
  prompt: string;
  targetPath: string;
  engineDecision: ExecutionEngineDecision;
  next: string[];
}): string {
  const decision = payload.engineDecision;
  const title = decision.express ? 'Express'
    : decision.engineId === 'velocity'
      ? 'Velocity'
      : 'Shield';
  return [
    `Zavorth ${payload.command}`,
    '',
    `${title}: ${decision.reason}`,
    `Target: ${payload.targetPath}`,
    `Next: ${decision.nextSafeAction}`,
    '',
    ...payload.next.map((entry) => `- ${entry}`),
    '',
  ].join('\n');
}
