#!/usr/bin/env tsx
import { ZavorthProviderCapabilityCatalogService } from '../src/services/ZavorthProviderCapabilityCatalogService.js';

const asJson = process.argv.includes('--json');
const service = new ZavorthProviderCapabilityCatalogService();
const snapshot = service.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.renderText(snapshot));
}

if (snapshot.status === 'blocked') {
  process.exitCode = 1;
}
