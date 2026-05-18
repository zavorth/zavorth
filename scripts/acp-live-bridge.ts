#!/usr/bin/env node

import { AcpLiveBridgeService } from '../src/services/AcpLiveBridgeService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const service = new AcpLiveBridgeService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.renderText(snapshot));
}

if (requirePass && snapshot.status !== 'ready') {
  process.exitCode = 1;
}
