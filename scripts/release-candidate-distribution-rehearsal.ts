#!/usr/bin/env tsx
import { ReleaseCandidateDistributionRehearsalService } from '../src/services/ReleaseCandidateDistributionRehearsalService.js';

const asJson = process.argv.includes('--json');
const requireRehearsed = process.argv.includes('--require-rehearsed');

const service = new ReleaseCandidateDistributionRehearsalService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatRehearsalText(snapshot));
}

if (requireRehearsed && !snapshot.summary.rehearsalReady) {
  process.exitCode = 1;
}
