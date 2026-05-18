#!/usr/bin/env node

import { ZavorthCliTuiPolishService } from '../src/services/ZavorthCliTuiPolishService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const service = new ZavorthCliTuiPolishService();
  const snapshot = await service.buildSnapshot({
    refreshProviders: args.includes('--refresh-providers') || args.includes('--live'),
    includeAdvancedProviders: args.includes('--advanced'),
    userId: readFlag(args, 'user-id') || 'operator',
    sessionId: readFlag(args, 'session-id') || 'cli-tui-polish',
    workspaceHint: readFlag(args, 'workspace') || process.cwd(),
  });

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }

  if ((args.includes('--require-pass') || args.includes('--strict')) && snapshot.status !== 'ready') {
    process.exitCode = 1;
  }
}

function readFlag(args: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

main().catch((error) => {
  console.error('[zavorth-cli-tui-polish] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
