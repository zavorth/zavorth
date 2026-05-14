#!/usr/bin/env tsx
import { ZavorthEndToEndMissionFlowPublicRuntimeCertificationService } from '../src/services/ZavorthEndToEndMissionFlowPublicRuntimeCertificationService.js';

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthEndToEndMissionFlowPublicRuntimeCertificationService();
  const originalLog = console.log;
  if (args.json) console.log = () => undefined;
  const snapshot = await service.buildSnapshot({
    request: args.request,
    sessionId: args.sessionId,
  });
  if (args.json) console.log = originalLog;
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }
  if (args.requirePass && snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): {
  json: boolean;
  requirePass: boolean;
  request: string | null;
  sessionId: string | null;
} {
  const valueAfter = (name: string): string | null => {
    const index = argv.indexOf(name);
    if (index < 0) return null;
    return argv[index + 1] || null;
  };
  return {
    json: argv.includes('--json'),
    requirePass: argv.includes('--require-pass'),
    request: valueAfter('--request'),
    sessionId: valueAfter('--session-id'),
  };
}
