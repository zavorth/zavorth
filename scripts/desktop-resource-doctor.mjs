#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distServicePath = path.resolve(scriptDir, '../dist/services/DesktopResourcePlaneService.js');

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');

  if (!fs.existsSync(distServicePath)) {
    throw new Error('Desktop doctor exige build previa. Rode npm run build antes de usar este comando.');
  }

  const moduleUrl = pathToFileURL(distServicePath).href;
  const { DesktopResourcePlaneService } = await import(moduleUrl);
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
