#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const requiredFiles = [
  'src/contracts/ZavorthCapabilityCandidateRegistryContract.ts',
  'src/services/ZavorthCapabilityCandidateRegistryService.ts',
  'scripts/zavorth-capability-candidates.ts',
  'scripts/zavorth-capability-candidates-check.mjs',
  'tests/services/ZavorthCapabilityCandidateRegistryService.test.ts',
];
const failures = [];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) failures.push(`missing files: ${missing.join(', ')}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-candidates-check-'));
const env = { ...process.env, ZAVORTH_HOME: path.join(tmp, 'home') };
const result = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-candidates.ts', '--json', '--list'], {
  cwd: root,
  env,
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
  if (snapshot.surface !== 'capability-candidate-registry') failures.push('surface mismatch');
  if (!snapshot.safety?.registrationExplicitOnly) failures.push('explicit registration boundary missing');
  if (!snapshot.safety?.knownCapabilitiesRejected) failures.push('known capability rejection boundary missing');
  if (!snapshot.safety?.noPrototypeCreated || !snapshot.safety?.noLiveActivation) failures.push('prototype/live boundary missing');
}

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`[capability-candidates-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[capability-candidates-check] ok');
