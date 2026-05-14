#!/usr/bin/env tsx
import { CanaryLaunchRehearsalService } from '../src/services/CanaryLaunchRehearsalService.js';

const asJson = process.argv.includes('--json');
const requireRehearsed = process.argv.includes('--require-rehearsed');

const service = new CanaryLaunchRehearsalService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatRehearsalText(snapshot));
}

if (requireRehearsed && !snapshot.summary.launchRehearsalReady) {
  process.exitCode = 1;
}
