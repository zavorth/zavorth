#!/usr/bin/env tsx
import { FinalAbsorptionCertificationService } from '../src/services/FinalAbsorptionCertificationService.js';

const asJson = process.argv.includes('--json');
const requireCertified = process.argv.includes('--require-certified');

const service = new FinalAbsorptionCertificationService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatCertificationText(snapshot));
}

if (requireCertified && snapshot.status !== 'certified') {
  process.exitCode = 1;
}
