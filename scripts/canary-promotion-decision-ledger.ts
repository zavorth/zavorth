#!/usr/bin/env tsx
import { CanaryPromotionDecisionLedgerService } from '../src/services/CanaryPromotionDecisionLedgerService.js';

const asJson = process.argv.includes('--json');
const requireLedgerReady = process.argv.includes('--require-ledger-ready');

const service = new CanaryPromotionDecisionLedgerService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatLedgerText(snapshot));
}

if (requireLedgerReady && !snapshot.summary.promotionDecisionLedgerReady) {
  process.exitCode = 1;
}
