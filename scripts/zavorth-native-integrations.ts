#!/usr/bin/env node
import { ZavorthNativeIntegrationService } from '../src/services/ZavorthNativeIntegrationService.js';

const json = process.argv.includes('--json');
const service = new ZavorthNativeIntegrationService();
const snapshot = service.buildSnapshot();

if (json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.renderText(snapshot));
}
