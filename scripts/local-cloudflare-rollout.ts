#!/usr/bin/env node

import { LocalCloudflareRolloutService } from '../src/services/LocalCloudflareRolloutService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new LocalCloudflareRolloutService();
  const snapshot = service.inspect();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  console.log(service.renderText(snapshot));
}

main().catch((error) => {
  console.error('[local-cloudflare-rollout] falha ao inspecionar o rollout.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
