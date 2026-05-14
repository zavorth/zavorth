#!/usr/bin/env tsx
import { CanaryPlanDryRunHoldService } from '../src/services/CanaryPlanDryRunHoldService.js';

const asJson = process.argv.includes('--json');
const requireDryRunReady = process.argv.includes('--require-dry-run-ready');

const service = new CanaryPlanDryRunHoldService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatDryRunText(snapshot));
}

if (requireDryRunReady && !snapshot.summary.canaryPlanDryRunReady) {
  process.exitCode = 1;
}
