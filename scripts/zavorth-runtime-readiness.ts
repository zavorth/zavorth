#!/usr/bin/env node

import { ZavorthRuntimeReadinessService } from '../src/services/ZavorthRuntimeReadinessService.js';
import { ZavorthRuntimeReadinessUxService } from '../src/services/ZavorthRuntimeReadinessUxService.js';

async function main() {
  const args = process.argv.slice(2);
  const action = String(args[0] || '').trim().toLowerCase();
  if (action === 'fixes' || args.includes('--fixes')) {
    await renderGuidedFixes(action === 'fixes' ? args.slice(1) : args);
    return;
  }
  const asJson = args.includes('--json');
  const technical = args.includes('--technical') || args.includes('--raw');
  const requirePass = args.includes('--require-pass') || args.includes('--strict');
  const service = new ZavorthRuntimeReadinessService();
  const uxService = new ZavorthRuntimeReadinessUxService();
  const snapshot = await service.buildSnapshot({
    userId: readFlexibleStringFlag(args, 'user-id') || 'operator',
    sessionId: readFlexibleStringFlag(args, 'session-id') || 'runtime-readiness',
    workspaceHint: readFlexibleStringFlag(args, 'workspace') || process.cwd(),
  });
  const operatorUx = uxService.buildSnapshot(snapshot);

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ...snapshot, operatorUx }, null, 2)}\n`);
  } else if (technical) {
    process.stdout.write(service.renderText(snapshot));
  } else {
    process.stdout.write(uxService.renderCli(operatorUx));
  }

  if (snapshot.status === 'blocked' || (requirePass && snapshot.status !== 'ready')) {
    process.exitCode = 1;
  }
}

async function renderGuidedFixes(args: string[]): Promise<void> {
  const { ZavorthRuntimeGuidedFixesService } = await import('../src/services/ZavorthRuntimeGuidedFixesService.js');
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
  console.error('[zavorth-runtime-readiness] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
