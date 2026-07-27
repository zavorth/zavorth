#!/usr/bin/env node

import path from 'path';
import { findProjectRoot } from '../src/config/configHelpers.js';
import { MinimalCapabilityActivationLedger } from '../src/core/MinimalCapabilityActivationLedger.js';

function readNumberFlag(argv: string[], name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const strict = argv.includes('--strict');
  const projectRoot = findProjectRoot();
  const dataDir = path.resolve(projectRoot, 'data', 'runtime');
  const ledgerFile = argv.find((arg) => arg.startsWith('--ledger-file='))?.split('=').slice(1).join('=')
    || path.resolve(dataDir, 'capability-activation-ledger.jsonl');
  const profile = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
    || null;
  const capability = argv.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=')
    || null;
  const limit = readNumberFlag(argv, 'limit', 20);
  const snapshot = new MinimalCapabilityActivationLedger({
    projectRoot,
    dataDir,
    ledgerFile,
  }).buildSnapshot({ limit, profile, capability });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] capability activation ledger doctor',
      `[zavorth-core] status: ${snapshot.status} | exists: ${snapshot.exists} | total ${snapshot.total} | returned ${snapshot.returned} | invalidLines ${snapshot.invalidLines}`,
      `[zavorth-core] counts: plan ${snapshot.counts.plan} | activate ${snapshot.counts.activate} | dry-run ${snapshot.counts.dryRun} | applied ${snapshot.counts.applied}`,
      ...snapshot.receipts.map((receipt) =>
        `- ${receipt.createdAt} ${receipt.operation}/${receipt.profileId}/${receipt.capabilityId}: ${receipt.status}/${receipt.mode} | dryRun=${receipt.dryRun} | applied=${receipt.applied}`,
      ),
      ...snapshot.errors.slice(0, 10).map((error) => `! line ${error.line}: ${error.reason}`),
    ].join('\n') + '\n');
  }

  process.exitCode = strict && snapshot.invalidLines > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('[zavorth-core] capability activation ledger doctor failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
