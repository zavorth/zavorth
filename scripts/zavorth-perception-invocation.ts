#!/usr/bin/env tsx
import { ZavorthPerceptionInvocationRouter } from '../src/services/ZavorthPerceptionInvocationRouter.js';

type Args = {
  text: string;
  json: boolean;
  channel: string | null;
  actorId: string | null;
  approvalId: string | null;
};

const args = parseArgs(process.argv.slice(2));

const router = new ZavorthPerceptionInvocationRouter();
const plan = router.plan({
  text: args.text,
  channel: args.channel,
  actorId: args.actorId,
  approvalId: args.approvalId,
});

if (args.json) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log(router.formatPlanText(plan));
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    text: '',
    json: false,
    channel: null,
    actorId: null,
    approvalId: null,
  };
  const textParts: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--text') {
      out.text = argv[++index] || '';
    } else if (arg.startsWith('--text=')) {
      out.text = arg.slice('--text='.length);
    } else if (arg === '--channel') {
      out.channel = argv[++index] || null;
    } else if (arg.startsWith('--channel=')) {
      out.channel = arg.slice('--channel='.length) || null;
    } else if (arg === '--actor') {
      out.actorId = argv[++index] || null;
    } else if (arg.startsWith('--actor=')) {
      out.actorId = arg.slice('--actor='.length) || null;
    } else if (arg === '--approval-id') {
      out.approvalId = argv[++index] || null;
    } else if (arg.startsWith('--approval-id=')) {
      out.approvalId = arg.slice('--approval-id='.length) || null;
    } else {
      textParts.push(arg);
    }
  }
  if (!out.text) {
    out.text = textParts.join(' ').trim() || 'confirme visualmente o resultado';
  }
  return out;
}
