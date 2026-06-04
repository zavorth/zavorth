#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const requiredFiles = [
  'src/contracts/ZavorthChannelLiveCanaryContract.ts',
  'src/services/ZavorthChannelLiveCanaryService.ts',
  'scripts/zavorth-channel-live-canary.ts',
  'scripts/zavorth-channel-live-canary-check.mjs',
  'tests/services/ZavorthChannelLiveCanaryService.test.ts',
];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
const result = spawnSync(process.execPath, [tsx, 'scripts/zavorth-channel-live-canary.ts', '--json'], {
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
  if (snapshot.surface !== 'channel-live-canary') failures.push('surface mismatch');
  if (snapshot.status === 'blocked') failures.push('snapshot blocked');
  if (!snapshot.guarantees?.noExternalIoDuringCheck) failures.push('no external IO guarantee missing');
  if (!snapshot.summary || snapshot.summary.total < 10) failures.push('channel catalog too small');
}

if (failures.length > 0) {
  console.error(`[channel-live-canary-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log('[channel-live-canary-check] ok');
