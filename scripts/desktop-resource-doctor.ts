#!/usr/bin/env node

import { DesktopResourcePlaneService } from '../src/services/DesktopResourcePlaneService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new DesktopResourcePlaneService();
  const snapshot = await service.inspectLive({
    preferCachedWithinMs: asJson ? 0 : 10_000,
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    if (snapshot.host.pressure === 'critical') {
      process.exitCode = 1;
    }
    return;
  }

  process.stdout.write(`${service.renderReport(snapshot)}\n`);
  if (snapshot.host.pressure === 'critical') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[zavorth-ops] desktop doctor falhou.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
