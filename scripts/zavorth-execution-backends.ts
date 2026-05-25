#!/usr/bin/env node

import { ZavorthTerminalBackendsService } from '../src/services/ZavorthTerminalBackendsService.js';

type Args = Record<string, string | boolean>;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const service = new ZavorthTerminalBackendsService();
  const snapshot = service.execute({
    action: readString(args, 'action') as any,
    backend: readString(args, 'backend') as any,
    command: readString(args, 'command'),
    workspace: readString(args, 'workspace'),
    live: Boolean(args.live),
    approvalId: readString(args, 'approval-id') || readString(args, 'approval'),
    timeoutMs: readNumber(args, 'timeout-ms'),
    dockerImage: readString(args, 'docker-image') || readString(args, 'image'),
    sshHost: readString(args, 'ssh-host') || readString(args, 'host'),
    wslDistro: readString(args, 'wsl-distro') || readString(args, 'distro'),
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
  if (argv.includes('--live')) result.live = true;
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
  console.error('[zavorth-execution-backends] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
