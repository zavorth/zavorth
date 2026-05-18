#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', [
  'jest',
  'tests/services/ZavorthSkillCuratorLiveLoopService.test.ts',
  '--runInBand',
], {
  cwd: process.cwd(),
  env: process.env,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
