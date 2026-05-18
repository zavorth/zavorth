#!/usr/bin/env node

import { ZavorthReadyToGoService } from '../src/services/ZavorthReadyToGoService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const service = new ZavorthReadyToGoService();
  const snapshot = await service.buildSnapshot({
    refreshProviders: !args.includes('--offline') || args.includes('--refresh-providers'),
    includeAdvancedProviders: args.includes('--advanced'),
    userId: readFlexibleStringFlag(args, 'user-id') || 'operator',
    sessionId: readFlexibleStringFlag(args, 'session-id') || 'ready-to-go',
    workspaceHint: readFlexibleStringFlag(args, 'workspace') || process.cwd(),
  });

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }

  if (args.includes('--require-pass') && snapshot.status !== 'ready') {
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
  console.error('[zavorth-ready-to-go] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
