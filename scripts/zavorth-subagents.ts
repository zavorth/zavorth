#!/usr/bin/env tsx
import { ZavorthSubagentRuntimeService } from '@zavorth/agents/ZavorthSubagentRuntimeService.js';
import type { ZavorthSubagentRuntimeAction, ZavorthSubagentRuntimeMode } from '../src/contracts/ZavorthSubagentRuntimeContract.js';

type Args = {
  json: boolean;
  action: string;
  task: string | null;
  message: string | null;
  sessionId: string | null;
  runId: string | null;
  parentRunId: string | null;
  mode: string | null;
  roleIds: string[];
  channel: string | null;
  actorId: string | null;
  threadId: string | null;
  approvalId: string | null;
  explicitSubagents: boolean;
  live: boolean;
  mockLive: boolean;
  sourceSurface: string | null;
  providerName: string | null;
  modelName: string | null;
  maxLiveWorkers: number | null;
  persistState: boolean;
};

const args = parseArgs(process.argv.slice(2));
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthSubagentRuntimeService();
  const snapshot = await service.execute({
    action: args.action as ZavorthSubagentRuntimeAction,
    task: args.task,
    message: args.message,
    sessionId: args.sessionId,
    runId: args.runId,
    parentRunId: args.parentRunId,
    mode: args.mode as ZavorthSubagentRuntimeMode | null,
    roleIds: args.roleIds,
    channel: args.channel,
    actorId: args.actorId,
    threadId: args.threadId,
    approvalId: args.approvalId,
    explicitSubagents: args.explicitSubagents,
    live: args.live,
    mockLive: args.mockLive,
    executionMode: args.mockLive ? 'mock-live' : args.live ? 'live-llm' : null,
    sourceSurface: args.sourceSurface,
    providerName: args.providerName,
    modelName: args.modelName,
    maxLiveWorkers: args.maxLiveWorkers,
    persistState: args.persistState,
  });

  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (snapshot.status === 'blocked' || snapshot.status === 'denied' || snapshot.status === 'not-found') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    action: 'subagents.list',
    task: null,
    message: null,
    sessionId: null,
    runId: null,
    parentRunId: null,
    mode: null,
    roleIds: [],
    channel: null,
    actorId: null,
    threadId: null,
    approvalId: null,
    explicitSubagents: false,
    live: false,
    mockLive: false,
    sourceSurface: null,
    providerName: null,
    modelName: null,
    maxLiveWorkers: null,
    persistState: true,
  };
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--no-persist') out.persistState = false;
    else if (arg === '--explicit' || arg === '--explicit-subagents') out.explicitSubagents = true;
    else if (arg === '--live') out.live = true;
    else if (arg === '--mock-live') {
      out.live = true;
      out.mockLive = true;
    }
    else if (arg === '--task') out.task = argv[++index] || null;
    else if (arg.startsWith('--task=')) out.task = arg.slice('--task='.length);
    else if (arg === '--message') out.message = argv[++index] || null;
    else if (arg.startsWith('--message=')) out.message = arg.slice('--message='.length);
    else if (arg === '--session') out.sessionId = argv[++index] || null;
    else if (arg.startsWith('--session=')) out.sessionId = arg.slice('--session='.length);
    else if (arg === '--run') out.runId = argv[++index] || null;
    else if (arg.startsWith('--run=')) out.runId = arg.slice('--run='.length);
    else if (arg === '--parent-run') out.parentRunId = argv[++index] || null;
    else if (arg.startsWith('--parent-run=')) out.parentRunId = arg.slice('--parent-run='.length);
    else if (arg === '--mode') out.mode = argv[++index] || null;
    else if (arg.startsWith('--mode=')) out.mode = arg.slice('--mode='.length);
    else if (arg === '--roles') out.roleIds = splitList(argv[++index] || '');
    else if (arg.startsWith('--roles=')) out.roleIds = splitList(arg.slice('--roles='.length));
    else if (arg === '--channel') out.channel = argv[++index] || null;
    else if (arg.startsWith('--channel=')) out.channel = arg.slice('--channel='.length);
    else if (arg === '--actor') out.actorId = argv[++index] || null;
    else if (arg.startsWith('--actor=')) out.actorId = arg.slice('--actor='.length);
    else if (arg === '--thread') out.threadId = argv[++index] || null;
    else if (arg.startsWith('--thread=')) out.threadId = arg.slice('--thread='.length);
    else if (arg === '--approval-id') out.approvalId = argv[++index] || null;
    else if (arg.startsWith('--approval-id=')) out.approvalId = arg.slice('--approval-id='.length);
    else if (arg === '--source') out.sourceSurface = argv[++index] || null;
    else if (arg.startsWith('--source=')) out.sourceSurface = arg.slice('--source='.length);
    else if (arg === '--provider') out.providerName = argv[++index] || null;
    else if (arg.startsWith('--provider=')) out.providerName = arg.slice('--provider='.length);
    else if (arg === '--model') out.modelName = argv[++index] || null;
    else if (arg.startsWith('--model=')) out.modelName = arg.slice('--model='.length);
    else if (arg === '--max-live-workers') out.maxLiveWorkers = parsePositive(argv[++index]);
    else if (arg.startsWith('--max-live-workers=')) out.maxLiveWorkers = parsePositive(arg.slice('--max-live-workers='.length));
    else positional.push(arg);
  }
  if (positional.length > 0) {
    out.action = normalizeAction(positional[0] || '');
    if (!out.task && positional.length > 1) {
      out.task = positional.slice(1).join(' ');
    }
  }
  return out;
}

function normalizeAction(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'spawn') return 'subagents.spawn';
  if (normalized === 'subagent' || normalized === 'subagent.spawn' || normalized === 'sessions_spawn') return 'subagents.spawn';
  if (normalized === 'wait') return 'subagents.wait';
  if (normalized === 'send') return 'subagents.send';
  if (normalized === 'cancel') return 'subagents.cancel';
  if (normalized === 'read') return 'subagents.read';
  if (normalized === 'summarize' || normalized === 'summary') return 'subagents.summarize';
  if (normalized === 'status' || normalized === 'list' || normalized === 'ls' || normalized === 'history' || normalized === 'timeline') return 'subagents.list';
  return 'subagents.list';
}

function splitList(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parsePositive(value: string | undefined): number | null {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
