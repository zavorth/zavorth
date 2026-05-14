#!/usr/bin/env node

import path from 'path';
import { findProjectRoot } from '../src/config/configHelpers.js';
import { MinimalRuntimeRetentionService } from '../src/core/MinimalRuntimeRetentionService.js';

function readNumberFlag(argv: string[], name: string): number | null {
  const prefix = `--${name}=`;
  const raw = argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function readPolicy(argv: string[]) {
  return {
    ...(readNumberFlag(argv, 'max-activation-receipts') !== null
      ? { maxActivationReceipts: readNumberFlag(argv, 'max-activation-receipts') as number }
      : {}),
    ...(readNumberFlag(argv, 'max-activation-ledger-kb') !== null
      ? { maxActivationLedgerBytes: (readNumberFlag(argv, 'max-activation-ledger-kb') as number) * 1024 }
      : {}),
    ...(readNumberFlag(argv, 'max-jsonl-kb') !== null
      ? { maxGenericJsonlBytes: (readNumberFlag(argv, 'max-jsonl-kb') as number) * 1024 }
      : {}),
    ...(readNumberFlag(argv, 'max-jsonl-lines') !== null
      ? { maxGenericJsonlLines: readNumberFlag(argv, 'max-jsonl-lines') as number }
      : {}),
    ...(readNumberFlag(argv, 'max-log-kb') !== null
      ? { maxLogBytes: (readNumberFlag(argv, 'max-log-kb') as number) * 1024 }
      : {}),
    ...(readNumberFlag(argv, 'max-state-kb') !== null
      ? { maxStateBytes: (readNumberFlag(argv, 'max-state-kb') as number) * 1024 }
      : {}),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const strict = argv.includes('--strict');
  const apply = argv.includes('--apply');
  const projectRoot = findProjectRoot();
  const dataDir = argv.find((arg) => arg.startsWith('--data-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'data', 'runtime');
  const report = new MinimalRuntimeRetentionService({
    projectRoot,
    dataDir,
    policy: readPolicy(argv),
  }).buildReport({ apply });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] runtime retention doctor',
      `[zavorth-core] status: ${report.status} | applied: ${report.applied} | files ${report.totals.files} | bytes ${report.totals.bytes}`,
      `[zavorth-core] actions: planned ${report.totals.planned} | manual ${report.totals.manual} | applied ${report.totals.applied} | skipped ${report.totals.skipped} | errors ${report.totals.errors}`,
      ...report.actions
        .filter((action) => action.status !== 'kept')
        .slice(0, 20)
        .map((action) => `- ${action.status} ${action.kind} ${path.basename(action.filePath)}: ${action.message}`),
      ...report.errors.slice(0, 10).map((error) => `! ${error.filePath}: ${error.reason}`),
    ].join('\n') + '\n');
  }

  process.exitCode = report.status === 'failed' || (strict && report.totals.errors > 0) ? 1 : 0;
}

main().catch((error) => {
  console.error('[zavorth-core] runtime retention doctor falhou.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
