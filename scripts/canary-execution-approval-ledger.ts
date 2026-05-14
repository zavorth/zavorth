#!/usr/bin/env tsx
import { CanaryExecutionApprovalLedgerService } from '../src/services/CanaryExecutionApprovalLedgerService.js';

const asJson = process.argv.includes('--json');
const requireLedgerReady = process.argv.includes('--require-ledger-ready');

const service = new CanaryExecutionApprovalLedgerService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatLedgerText(snapshot));
}

if (requireLedgerReady && !snapshot.summary.approvalLedgerReady) {
  process.exitCode = 1;
}
