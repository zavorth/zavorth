#!/usr/bin/env tsx
import { asErrorLike } from '../src/utils/errorLike';
import { ZavorthSandboxLifecycleManager } from '../src/services/ZavorthSandboxLifecycleManager.js';

type Args = {
  json: boolean;
  text: string;
  actorId: string | null;
  sourceSurface: string | null;
  approvalId: string | null;
  live: boolean;
  ownedResourceIds: string[];
};

const args = parseArgs(process.argv.slice(2));

try {
  const manager = new ZavorthSandboxLifecycleManager();
  const plan = manager.plan({
    text: args.text || 'sandbox status',
    actorId: args.actorId,
    sourceSurface: args.sourceSurface,
    approvalId: args.approvalId,
    live: args.live,
    ownedResourceIds: args.ownedResourceIds,
  });
  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(manager.renderPlan(plan));
  }
  if (plan.status === 'blocked') {
    process.exitCode = 1;
  }
} catch (error: unknown) {
  const err = asErrorLike(error);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    text: '',
    actorId: null,
    sourceSurface: null,
    approvalId: null,
    live: false,
    ownedResourceIds: [],
  };
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--live') out.live = true;
    else if (arg === '--text') out.text = argv[++index] || '';
    else if (arg.startsWith('--text=')) out.text = arg.slice('--text='.length);
    else if (arg === '--actor') out.actorId = argv[++index] || null;
    else if (arg.startsWith('--actor=')) out.actorId = arg.slice('--actor='.length);
    else if (arg === '--surface') out.sourceSurface = argv[++index] || null;
    else if (arg.startsWith('--surface=')) out.sourceSurface = arg.slice('--surface='.length);
    else if (arg === '--approval-id') out.approvalId = argv[++index] || null;
    else if (arg.startsWith('--approval-id=')) out.approvalId = arg.slice('--approval-id='.length);
    else if (arg === '--owned-resource') out.ownedResourceIds.push(argv[++index] || '');
    else if (arg.startsWith('--owned-resource=')) out.ownedResourceIds.push(arg.slice('--owned-resource='.length));
    else rest.push(arg);
  }
  if (!out.text && rest.length > 0) {
    out.text = rest.join(' ');
  }
  out.ownedResourceIds = out.ownedResourceIds.map((entry) => entry.trim()).filter(Boolean);
  return out;
}
