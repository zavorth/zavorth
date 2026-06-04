#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const requiredFiles = [
  'src/contracts/ZavorthInnovationRadarContract.ts',
  'src/services/ZavorthInnovationRadarService.ts',
  'scripts/zavorth-innovation-radar.ts',
  'scripts/zavorth-innovation-radar-check.mjs',
  'tests/services/ZavorthInnovationRadarService.test.ts',
];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
const result = spawnSync(process.execPath, [tsx, 'scripts/zavorth-innovation-radar.ts', '--json', '--no-persist'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 45_000,
});
const failures = [];

if (missing.length > 0) failures.push(`missing files: ${missing.join(', ')}`);
if (result.status !== 0) failures.push(`snapshot exit=${result.status}`);

let snapshot = null;
if (result.stdout) {
  try {
    snapshot = JSON.parse(result.stdout);
  } catch (error) {
    failures.push(`json parse failed: ${error.message}`);
  }
}
if (snapshot) {
  if (snapshot.surface !== 'innovation-radar') failures.push('surface mismatch');
  if (snapshot.status === 'blocked') failures.push('snapshot blocked');
  if (!snapshot.safety?.observationOnly) failures.push('observation-only guarantee missing');
  if (!snapshot.safety?.noCapabilityRegistered) failures.push('candidate registration boundary missing');
  if (!snapshot.safety?.httpsFeedsOnly || !snapshot.safety?.feedHostsAllowlisted) failures.push('feed safety policy missing');
}

if (failures.length > 0) {
  console.error(`[innovation-radar-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[innovation-radar-check] ok');
