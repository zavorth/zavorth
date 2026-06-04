#!/usr/bin/env tsx
import type { ReleaseCertificationProfile } from '../src/contracts/ReleaseCertificationContract.js';
import { ReleaseCertificationService } from '../src/services/ReleaseCertificationService.js';

const asJson = process.argv.includes('--json');
const requireReady = process.argv.includes('--require-ready');
const requireNoBlockers = process.argv.includes('--require-no-blockers');
const profile = readProfile();

const service = new ReleaseCertificationService({ profile });
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatCertificationText(snapshot));
}

if (requireReady && !snapshot.summary.releaseReady) {
  process.exitCode = 1;
}

if (requireNoBlockers && snapshot.summary.blockingFailures > 0) {
  process.exitCode = 1;
}

function readProfile(): ReleaseCertificationProfile {
  const arg = process.argv.find((item) => item.startsWith('--profile='));
  const value = arg ? arg.slice('--profile='.length) : 'private-absorption';
  if (value === 'private-absorption' || value === 'release-candidate' || value === 'public-launch') {
    return value;
  }
  throw new Error(`Unknown consistency certification profile: ${value}`);
}
