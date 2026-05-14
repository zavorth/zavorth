#!/usr/bin/env node

import { TenantTeamOpsService } from '../src/services/TenantTeamOpsService.js';

function readFlag(name: string): string | null {
  const argv = process.argv.slice(2);
  const index = argv.findIndex((entry) => entry === name);
  if (index >= 0 && argv[index + 1]) {
    return String(argv[index + 1]).trim() || null;
  }
  const inline = argv.find((entry) => entry.startsWith(`${name}=`));
  if (inline) {
    return String(inline.split('=').slice(1).join('=')).trim() || null;
  }
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
  const limit = Number(readFlag('--limit') || 12);
  const service = new TenantTeamOpsService();
  const snapshot = service.buildSnapshot({ limit });

  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.renderReport(snapshot));
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

main();
