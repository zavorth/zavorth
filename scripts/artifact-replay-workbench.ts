#!/usr/bin/env node
import { ArtifactReplayWorkbenchService } from '../src/services/ArtifactReplayWorkbenchService.js';

function readFlag(name: string): string | null {
  const argv = process.argv.slice(2);
  const inline = argv.find((entry) => entry.startsWith(`${name}=`));
  if (inline) {
    return inline.split('=').slice(1).join('=').trim() || null;
  }
  const index = argv.findIndex((entry) => entry === name);
  if (index >= 0 && argv[index + 1]) {
    return String(argv[index + 1]).trim() || null;
  }
  return null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
  const limit = Math.max(1, Math.min(Number(readFlag('--limit') || 12), 50));

  const service = new ArtifactReplayWorkbenchService();
  const snapshot = await service.buildSnapshot({ limit });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${await service.renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[artifact-workbench] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
