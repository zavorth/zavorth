#!/usr/bin/env tsx
import { ZavorthLiveReadinessEvidenceProofPackService } from '../src/services/ZavorthLiveReadinessEvidenceProofPackService.js';

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthLiveReadinessEvidenceProofPackService();
  const snapshot = await service.buildSnapshot({
    providerId: args.providerId,
    includeAdvanced: args.includeAdvanced,
  });
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }
  if (args.requirePass && snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
  if (args.requireLive && snapshot.operationalClosure.liveProofSatisfied === false) {
    process.exitCode = 2;
  }
}

function parseArgs(argv: string[]): {
  json: boolean;
  requirePass: boolean;
  requireLive: boolean;
  includeAdvanced: boolean;
  providerId: string | null;
} {
  const valueAfter = (name: string): string | null => {
    const index = argv.indexOf(name);
    if (index < 0) return null;
    return argv[index + 1] || null;
  };
  return {
    json: argv.includes('--json'),
    requirePass: argv.includes('--require-pass'),
    requireLive: argv.includes('--require-live'),
    includeAdvanced: !argv.includes('--basic'),
    providerId: valueAfter('--provider'),
  };
}
