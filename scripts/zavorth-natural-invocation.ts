#!/usr/bin/env tsx
import { ZavorthNaturalInvocationRouter } from '../src/services/ZavorthNaturalInvocationRouter.js';

type Args = {
  json: boolean;
  text: string;
  channel: string | null;
  actorId: string | null;
  sourcePath: string | null;
  approvalId: string | null;
  autoExecute: boolean;
  autoLiveSubagents: boolean;
  dryLiveSubagents: boolean;
};

const args = parseArgs(process.argv.slice(2));
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const router = new ZavorthNaturalInvocationRouter();
  const plan = await router.plan({
    text: args.text || 'status',
    channel: args.channel,
    actorId: args.actorId,
    sourcePath: args.sourcePath,
    approvalId: args.approvalId,
    autoExecute: args.autoExecute,
    autoLiveSubagents: args.autoLiveSubagents,
    dryLiveSubagents: args.dryLiveSubagents,
  });
  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(router.renderPlan(plan));
  }
  if (plan.status === 'denied') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    text: '',
    channel: null,
    actorId: null,
    sourcePath: null,
    approvalId: null,
    autoExecute: false,
    autoLiveSubagents: true,
    dryLiveSubagents: false,
  };
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--execute' || arg === '--auto-execute') out.autoExecute = true;
    else if (arg === '--no-auto-live-subagents') out.autoLiveSubagents = false;
    else if (arg === '--dry-live') out.dryLiveSubagents = true;
    else if (arg === '--text') out.text = argv[++index] || '';
    else if (arg.startsWith('--text=')) out.text = arg.slice('--text='.length);
    else if (arg === '--channel') out.channel = argv[++index] || null;
    else if (arg.startsWith('--channel=')) out.channel = arg.slice('--channel='.length);
    else if (arg === '--actor') out.actorId = argv[++index] || null;
    else if (arg.startsWith('--actor=')) out.actorId = arg.slice('--actor='.length);
    else if (arg === '--source') out.sourcePath = argv[++index] || null;
    else if (arg.startsWith('--source=')) out.sourcePath = arg.slice('--source='.length);
    else if (arg === '--approval-id') out.approvalId = argv[++index] || null;
    else if (arg.startsWith('--approval-id=')) out.approvalId = arg.slice('--approval-id='.length);
    else rest.push(arg);
  }
  if (!out.text && rest.length > 0) {
    out.text = rest.join(' ');
  }
  return out;
}
