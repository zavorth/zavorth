#!/usr/bin/env tsx
import { CanaryMonitoringRollbackGateService } from '../src/services/CanaryMonitoringRollbackGateService.js';

const asJson = process.argv.includes('--json');
const requireGateReady = process.argv.includes('--require-gate-ready');

const service = new CanaryMonitoringRollbackGateService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatGateText(snapshot));
}

if (requireGateReady && !snapshot.summary.monitoringRollbackGateReady) {
  process.exitCode = 1;
}
