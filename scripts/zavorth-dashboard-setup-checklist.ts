#!/usr/bin/env node
import { DashboardSetupChecklistService } from '../src/services/DashboardSetupChecklistService.js';

const args = process.argv.slice(2);
const service = new DashboardSetupChecklistService();
const snapshot = service.buildSnapshot();

if (args.includes('--json')) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.renderText(snapshot));
}
