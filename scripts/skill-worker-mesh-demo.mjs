#!/usr/bin/env node
/**
 * Capability mesh hermetic demo — Journey 1 (skill install) + Journey 2 (worker mesh).
 * No network. Temp project root. Exit 0 on success.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runDemoTest() {
  const jestBin = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  const result = spawnSync(
    process.execPath,
    [jestBin, 'tests/services/SkillWorkerMeshDemo.test.ts', '--runInBand'],
    {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, ZAVORTH_TOOL_EXPOSURE_PROFILE: 'daily-ops' },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log('Skill+Worker mesh demo (J1 + J2 hermetic)');
runDemoTest();
console.log('Demo OK');
