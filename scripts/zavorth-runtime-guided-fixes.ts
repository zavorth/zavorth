#!/usr/bin/env node

import { ZavorthRuntimeGuidedFixesService } from '../src/services/ZavorthRuntimeGuidedFixesService.js';
import { ZavorthRuntimeReadinessService } from '../src/services/ZavorthRuntimeReadinessService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
    userId: readFlexibleStringFlag(args, 'user-id') || 'operator',
    sessionId: readFlexibleStringFlag(args, 'session-id') || 'runtime-guided-fixes',
    workspaceHint: readFlexibleStringFlag(args, 'workspace') || process.cwd(),
  });
  const service = new ZavorthRuntimeGuidedFixesService();
  const snapshot = service.buildSnapshot(readiness);

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderCli(snapshot));
  }
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

main().catch((error) => {
  console.error('[zavorth-runtime-guided-fixes] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
