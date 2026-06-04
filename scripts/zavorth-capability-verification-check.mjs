#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const requiredFiles = [
  'src/contracts/ZavorthCapabilityAdapterVerificationContract.ts',
  'src/services/ZavorthCapabilityAdapterVerificationService.ts',
  'scripts/zavorth-capability-verification.ts',
  'scripts/zavorth-capability-verification-check.mjs',
  'tests/services/ZavorthCapabilityAdapterVerificationService.test.ts',
];
const failures = [];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) failures.push(`missing files: ${missing.join(', ')}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-verification-check-'));
const result = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-verification.ts', '--json', '--list'], {
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
  if (snapshot.surface !== 'capability-adapter-verification') failures.push('surface mismatch');
  if (!snapshot.safety?.draftReadyAdaptersOnly) failures.push('draft-ready boundary missing');
  if (!snapshot.safety?.deterministicEvalOnly) failures.push('deterministic eval boundary missing');
  if (!snapshot.safety?.localCanaryOnly || !snapshot.safety?.noNetworkUsed) failures.push('local/no-network canary boundary missing');
  if (!snapshot.safety?.securityChecksRequired) failures.push('security check boundary missing');
  if (!snapshot.safety?.noActionHarnessExposure || !snapshot.safety?.noLiveActivation) failures.push('promotion/live boundary missing');
}

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`[capability-verification-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[capability-verification-check] ok');
