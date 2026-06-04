#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const requiredFiles = [
  'src/contracts/ZavorthCapabilityActionExposureContract.ts',
  'src/services/ZavorthCapabilityActionExposureService.ts',
  'scripts/zavorth-capability-action-exposure.ts',
  'scripts/zavorth-capability-action-exposure-check.mjs',
  'tests/services/ZavorthCapabilityActionExposureService.test.ts',
];
const failures = [];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) failures.push(`missing files: ${missing.join(', ')}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-action-exposure-check-'));
const result = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-action-exposure.ts', '--json', '--list'], {
  cwd: root,
  env: { ...process.env, ZAVORTH_HOME: path.join(tmp, 'home') },
  encoding: 'utf8',
  timeout: 45_000,
});
if (result.status !== 0) failures.push(`list exit=${result.status}`);

let snapshot = null;
if (result.stdout) {
  try {
    snapshot = JSON.parse(result.stdout);
  } catch (error) {
    failures.push(`json parse failed: ${error.message}`);
  }
}
if (snapshot) {
  if (snapshot.surface !== 'capability-action-exposure') failures.push('surface mismatch');
  if (!snapshot.safety?.verifiedAdaptersOnly) failures.push('verified-only boundary missing');
  if (!snapshot.safety?.actionHarnessOnly) failures.push('action harness boundary missing');
  if (!snapshot.safety?.previewRequired || !snapshot.safety?.approvalRequired) failures.push('preview/approval boundary missing');
  if (!snapshot.safety?.noToolExecution || !snapshot.safety?.noLiveActivation) failures.push('execution/live boundary missing');
  if (!snapshot.safety?.noNetworkUsed) failures.push('no-network boundary missing');
}

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`[capability-action-exposure-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[capability-action-exposure-check] ok');
