#!/usr/bin/env node

import { OracleCloudflareRolloutService } from '../src/services/OracleCloudflareRolloutService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new OracleCloudflareRolloutService();
  const snapshot = service.inspect();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  console.log(service.renderText(snapshot));
}

main().catch((error) => {
  console.error('[oracle-cloudflare-rollout] failure ao inspecionar o rollout.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
