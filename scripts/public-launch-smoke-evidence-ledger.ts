#!/usr/bin/env tsx
import { PublicLaunchSmokeEvidenceLedgerService } from '../src/services/PublicLaunchSmokeEvidenceLedgerService.js';

const asJson = process.argv.includes('--json');
const requireReady = process.argv.includes('--require-ready');

const service = new PublicLaunchSmokeEvidenceLedgerService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatLedgerText(snapshot));
}

if (requireReady && !snapshot.summary.publicLaunchReady) {
  process.exitCode = 1;
}
