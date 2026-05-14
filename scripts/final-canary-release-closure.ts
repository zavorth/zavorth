#!/usr/bin/env tsx
import { FinalCanaryReleaseClosureService } from '../src/services/FinalCanaryReleaseClosureService.js';

const asJson = process.argv.includes('--json');
const requireClosureReady = process.argv.includes('--require-closure-ready');

const service = new FinalCanaryReleaseClosureService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatClosureText(snapshot));
}

if (requireClosureReady && !snapshot.summary.finalCanaryReleaseClosureReady) {
  process.exitCode = 1;
}
