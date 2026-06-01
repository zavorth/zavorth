import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const runner = path.join(root, 'scripts', 'zavorth-skills-curator-canary-runner.ts');

const result = spawnSync(process.execPath, [
  tsx,
  '--tsconfig',
  path.join(root, 'tsconfig.json'),
  runner,
], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
