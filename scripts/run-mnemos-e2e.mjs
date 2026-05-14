#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const result = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js'),
    'tests/e2e/mnemos.e2e.test.ts',
    '--runInBand',
    '--forceExit',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ZAVORTH_RUN_MNEMOS_E2E: '1',
    },
  },
);

if (result.error) {
  console.error(`[mnemos-e2e] Failed to start Jest: ${result.error.message}`);
}

process.exit(result.status ?? 1);
