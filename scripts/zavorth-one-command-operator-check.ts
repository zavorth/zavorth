#!/usr/bin/env node

import { ZavorthOneCommandOperatorCheckService } from '../src/services/ZavorthOneCommandOperatorCheckService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const service = new ZavorthOneCommandOperatorCheckService();
  const snapshot = await service.buildSnapshot({
    live: args.includes('--live'),
    strict: args.includes('--strict') || args.includes('--require-pass'),
    userId: readFlexibleStringFlag(args, 'user-id') || 'operator',
    sessionId: readFlexibleStringFlag(args, 'session-id') || 'operator-check',
    workspaceHint: readFlexibleStringFlag(args, 'workspace') || process.cwd(),
  });

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }

  if ((args.includes('--strict') || args.includes('--require-pass')) && snapshot.strictPass !== true) {
    process.exitCode = 1;
  }
  if (snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

main().catch((error) => {
  console.error('[zavorth-one-command-operator-check] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
