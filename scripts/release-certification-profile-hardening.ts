#!/usr/bin/env tsx
import { ReleaseCertificationProfileHardeningService } from '../src/services/ReleaseCertificationProfileHardeningService.js';

const asJson = process.argv.includes('--json');
const requireReady = process.argv.includes('--require-ready');

const service = new ReleaseCertificationProfileHardeningService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatHardeningText(snapshot));
}

if (requireReady && !snapshot.summary.releaseReady) {
  process.exitCode = 1;
}
