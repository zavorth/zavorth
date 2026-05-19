#!/usr/bin/env tsx
import { ZavorthMnemosMemoryUxService } from '../src/services/ZavorthMnemosMemoryUxService.js';

const json = process.argv.includes('--json');
const telegram = process.argv.includes('--telegram');
const service = new ZavorthMnemosMemoryUxService();
const snapshot = service.buildSnapshot();

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else if (telegram) {
  process.stdout.write(`${service.formatTelegram(snapshot)}\n`);
} else {
  process.stdout.write(`${service.formatCli(snapshot)}\n`);
}

if (snapshot.status === 'blocked') {
  process.exitCode = 1;
}
