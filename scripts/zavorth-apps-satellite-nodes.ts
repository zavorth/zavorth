#!/usr/bin/env node

import { ZavorthAppsSatelliteNodesService } from '../src/services/ZavorthAppsSatelliteNodesService.js';

type Args = Record<string, string | boolean>;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const service = new ZavorthAppsSatelliteNodesService();
  const snapshot = service.execute({
    action: readString(args, 'action') as any,
    nodeKind: (readString(args, 'surface') || readString(args, 'node') || readString(args, 'node-kind')) as any,
    label: readString(args, 'label'),
    actorId: readString(args, 'actor') || 'operator',
    workspace: readString(args, 'workspace'),
    ttlSeconds: readNumber(args, 'ttl-seconds'),
    materialize: Boolean(args.materialize),
    approvalId: readString(args, 'approval-id') || readString(args, 'approval'),
    consentId: readString(args, 'consent-id') || readString(args, 'consent'),
    sourceSurface: readString(args, 'source-surface') || 'cli',
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
  if (argv.includes('--materialize')) result.materialize = true;
  return result;
}

function readString(args: Args, key: string): string | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readNumber(args: Args, key: string): number | null {
  const value = readString(args, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

main().catch((error) => {
  console.error('[zavorth-apps-satellite-nodes] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
