#!/usr/bin/env node
import { ProductQualityContractService } from '../src/services/ProductQualityContractService.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass') || argv.includes('--gate');

  const service = new ProductQualityContractService();
  const snapshot = service.buildSnapshot();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[product-quality] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
