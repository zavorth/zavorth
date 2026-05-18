#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', [
  'jest',
  'tests/services/ZavorthSkillExpansionPackService.test.ts',
  'tests/skills/SkillLoader.test.ts',
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
