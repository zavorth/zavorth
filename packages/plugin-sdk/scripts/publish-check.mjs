#!/usr/bin/env node
/**
 * Wave 8 — publish ritual gate for @zavorth/plugin-sdk
 * Runs build + harness + dry-run metadata checks (no network publish).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`@zavorth/plugin-sdk publish-check v${pkg.version}`);
if (!/^\d+\.\d+\.\d+/.test(String(pkg.version || ''))) {
  console.error('Invalid package version');
  process.exit(1);
}

run('npm', ['run', 'check']);
run('npm', ['run', 'publish:dry-run']);

console.log('\nPublish check OK.');
console.log(`Next: git tag plugin-sdk-v${pkg.version} && git push origin plugin-sdk-v${pkg.version}`);
