#!/usr/bin/env tsx
import { ReleaseCandidatePackageFreezeService } from '../src/services/ReleaseCandidatePackageFreezeService.js';

const asJson = process.argv.includes('--json');
const requireFrozen = process.argv.includes('--require-frozen');

const service = new ReleaseCandidatePackageFreezeService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatFreezeText(snapshot));
}

if (requireFrozen && !snapshot.summary.packageFrozen) {
  process.exitCode = 1;
}
