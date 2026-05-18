#!/usr/bin/env node
import { spawn } from 'node:child_process';

const runner = process.execPath;
const child = spawn(
  runner,
  ['node_modules/jest/bin/jest.js', 'tests/e2e/mnemos.e2e.test.ts', '--runInBand'],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ZAVORTH_RUN_MNEMOS_E2E: '1',
    },
    stdio: 'inherit',
    windowsHide: true,
  },
);

child.on('error', (error) => {
  process.stderr.write(`[mnemos-e2e] ${error.message}\n`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.stderr.write(`[mnemos-e2e] stopped by ${signal}\n`);
    process.exit(1);
  }

  process.exit(code ?? 0);
});
