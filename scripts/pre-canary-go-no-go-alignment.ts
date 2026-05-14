#!/usr/bin/env tsx
import { PreCanaryGoNoGoAlignmentService } from '../src/services/PreCanaryGoNoGoAlignmentService.js';

const asJson = process.argv.includes('--json');
const requireAligned = process.argv.includes('--require-aligned');

const service = new PreCanaryGoNoGoAlignmentService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatAlignmentText(snapshot));
}

if (requireAligned && !snapshot.summary.alignmentReady) {
  process.exitCode = 1;
}
