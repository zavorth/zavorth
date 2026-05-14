#!/usr/bin/env node

import path from 'path';
import { findProjectRoot } from '../src/config/configHelpers.js';
import {
  MinimalCapabilityActivationReplayService,
  type MinimalCapabilityReplayAction,
} from '../src/core/MinimalCapabilityActivationReplayService.js';

function readNumberFlag(argv: string[], name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function readAction(argv: string[]): MinimalCapabilityReplayAction {
  const raw = argv.find((arg) => arg.startsWith('--action='))?.split('=').slice(1).join('=')
    || (argv.includes('--rollback') ? 'rollback' : 'replay');
  return String(raw || '').trim().toLowerCase() === 'rollback' ? 'rollback' : 'replay';
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const strict = argv.includes('--strict');
  const apply = argv.includes('--apply');
  const execute = argv.includes('--execute') || apply;
  const projectRoot = findProjectRoot();
  const dataDir = path.resolve(projectRoot, 'data', 'runtime');
  const action = readAction(argv);
  const ledgerFile = argv.find((arg) => arg.startsWith('--ledger-file='))?.split('=').slice(1).join('=')
    || path.resolve(dataDir, 'capability-activation-ledger.jsonl');
  const profile = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
    || null;
  const capability = argv.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=')
    || null;
  const receiptId = argv.find((arg) => arg.startsWith('--receipt-id='))?.split('=').slice(1).join('=')
    || null;
  const limit = readNumberFlag(argv, 'limit', 20);
  const service = new MinimalCapabilityActivationReplayService({
    projectRoot,
    dataDir,
    ledgerFile,
  });

  if (execute) {
    const result = await service.execute(action, {
      profile,
      capability,
      receiptId,
      limit,
      apply,
    });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] capability activation replay doctor',
        `[zavorth-core] action: ${result.action} | apply: ${result.apply} | status: ${result.plan.status} | executable: ${result.plan.executable}`,
        `[zavorth-core] command: ${result.plan.command}`,
        `[zavorth-core] result: ${result.message}`,
        ...result.plan.reasons.map((reason) => `- reason: ${reason}`),
        ...result.plan.nextSteps.map((nextStep) => `- next: ${nextStep}`),
      ].join('\n') + '\n');
    }
    process.exitCode = strict && ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    return;
  }

  const report = service.buildReport(action, {
    profile,
    capability,
    receiptId,
    limit,
  });
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] capability activation replay doctor',
      `[zavorth-core] action: ${report.action} | status: ${report.status} | total ${report.total} | ready ${report.ready} | noop ${report.noop} | manual ${report.manual}`,
      ...report.plans.map((plan) =>
        `- ${plan.receiptId || 'missing'} ${plan.profileId}/${plan.capabilityId}: ${plan.status} | ${plan.message}`,
      ),
    ].join('\n') + '\n');
  }
  process.exitCode = report.status === 'failed' || (strict && report.blocked > 0) ? 1 : 0;
}

main().catch((error) => {
  console.error('[zavorth-core] capability activation replay doctor falhou.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
