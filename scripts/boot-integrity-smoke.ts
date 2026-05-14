#!/usr/bin/env node
import { BootIntegrityService } from '../src/services/BootIntegrityService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const repair = args.includes('--repair');
const requirePass = args.includes('--require-pass') || args.includes('--require-ready');
const requireReady = args.includes('--require-ready');

const snapshot = new BootIntegrityService().inspect({ repair });
const blocked = snapshot.status === 'blocked';
const degraded = snapshot.status === 'degraded';

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  console.log(`[boot-integrity] status=${snapshot.status} checks=${snapshot.summary.total} warnings=${snapshot.summary.warnings} failures=${snapshot.summary.failures} repaired=${snapshot.summary.repaired}`);
  for (const check of snapshot.checks) {
    const marker = check.status === 'pass' ? 'ok' : check.status;
    console.log(`[boot-integrity] ${marker} ${check.id}: ${check.message}`);
  }
}

if (blocked || (requireReady && degraded)) {
  process.exit(1);
}

if (requirePass && blocked) {
  process.exit(1);
}
