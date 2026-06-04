#!/usr/bin/env tsx
import { OperationalReadinessToolingService } from '../src/services/OperationalReadinessToolingService.js';

const asJson = process.argv.includes('--json');
const requirePass = process.argv.includes('--require-pass');
const requireNoP0 = process.argv.includes('--require-no-p0');

const service = new OperationalReadinessToolingService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatDoctorText(snapshot));
}

if (requirePass && snapshot.status !== 'passed') {
  process.exitCode = 1;
}

if (requireNoP0 && snapshot.summary.p0Gaps > 0) {
  process.exitCode = 1;
}
