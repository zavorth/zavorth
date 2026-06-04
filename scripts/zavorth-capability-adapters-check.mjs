#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const requiredFiles = [
  'src/contracts/ZavorthCapabilityAdapterDraftContract.ts',
  'src/services/ZavorthCapabilityAdapterDraftService.ts',
  'scripts/zavorth-capability-adapters.ts',
  'scripts/zavorth-capability-adapters-check.mjs',
  'tests/services/ZavorthCapabilityAdapterDraftService.test.ts',
];
const failures = [];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) failures.push(`missing files: ${missing.join(', ')}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-adapters-check-'));
const result = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-adapters.ts', '--json', '--list'], {
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
  if (snapshot.surface !== 'capability-adapter-draft') failures.push('surface mismatch');
  if (!snapshot.safety?.simulatedPrototypesOnly) failures.push('simulated prototype boundary missing');
  if (!snapshot.safety?.capabilityLabRequired) failures.push('capability lab boundary missing');
  if (!snapshot.safety?.defaultEnabledFalse || !snapshot.safety?.liveAllowedByDefaultFalse) failures.push('disabled/live-default boundary missing');
  if (!snapshot.safety?.noCapabilityInstalled || !snapshot.safety?.noLiveActivation) failures.push('install/live boundary missing');
}

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`[capability-adapters-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[capability-adapters-check] ok');
