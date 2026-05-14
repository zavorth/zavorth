#!/usr/bin/env node
import { DeterministicQaMatrixService } from '../src/services/DeterministicQaMatrixService.js';
import type { DeterministicQaTier } from '../src/contracts/DeterministicQaContract.js';

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

function normalizeTier(value: string | null): DeterministicQaTier {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'standard' || normalized === 'release') {
    return normalized;
  }
  return 'quick';
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
  const tier = normalizeTier(readFlag('--tier'));

  const service = new DeterministicQaMatrixService();
  const snapshot = service.buildSnapshot();
  const payload = {
    ...snapshot,
    selectedTier: {
      id: tier,
      ...snapshot.tiers[tier],
    },
  };

  if (asJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderReport(snapshot)}\n`);
    process.stdout.write(`\nselected tier: ${tier} | ${snapshot.tiers[tier].command}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[deterministic-qa] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
