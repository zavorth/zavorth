#!/usr/bin/env node

import { ZavorthProductQaLiveService } from '../src/services/ZavorthProductQaLiveService.js';

type Args = Record<string, string | boolean>;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const service = new ZavorthProductQaLiveService();
  const snapshot = service.execute({
    action: readString(args, 'action') as any,
    workspace: readString(args, 'workspace'),
    requireLive: Boolean(args['require-live']),
    sourceSurface: readString(args, 'surface') || 'cli',
    actorId: readString(args, 'actor') || 'operator',
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${service.formatSnapshotText(snapshot)}\n`);
}

function parseArgs(argv: string[]): Args {
  const result: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] || '';
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  if (argv.includes('--json')) result.json = true;
  if (argv.includes('--require-live')) result['require-live'] = true;
  return result;
}

function readString(args: Args, key: string): string | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

main().catch((error) => {
  console.error('[zavorth-product-qa-live] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
