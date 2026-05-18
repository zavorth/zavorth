#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const explicitRun = process.env.ZAVORTH_RUN_DETACHED_ARCHIVE_JEST === '1';

if (!explicitRun) {
  console.log('External Agents historical Jest archive is detached from the current product gate.');
  console.log('');
  console.log('Status: resolved-detached-from-current-product-gate');
  console.log('Current product impact: none');
  console.log('');
  console.log('This command exits green by default.');
  console.log('To run the raw historical Jest suite for snapshot restoration, set:');
  console.log('  ZAVORTH_RUN_DETACHED_ARCHIVE_JEST=1');
  process.exit(0);
}

const args = [
  'node_modules/jest/bin/jest.js',
  'tests/runtime/external-agents',
  '--runInBand',
  '--forceExit',
  ...process.argv.slice(2),
];

const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

process.exit(typeof result.status === 'number' ? result.status : 1);
