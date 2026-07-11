#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'scripts/installer-release-manifest.mjs',
  'scripts/installer-readiness-check.mjs',
  'scripts/release-installer-rollback-check.mjs',
  'docs/product/release-hardening.md',
  'package.json',
];
const packageScripts = ['installer-release:check', 'installer-readiness:check', 'release:check'];
const failures = [];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`missing file: ${rel}`);
}
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const s of packageScripts) {
    if (!pkg.scripts?.[s]) failures.push(`missing npm script: ${s}`);
  }
} catch (e) {
  failures.push(`package.json unreadable: ${e instanceof Error ? e.message : e}`);
}

if (failures.length) {
  console.error('[update-rollback] failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('update/rollback readiness check ok');
console.log('[update-rollback] installer release/readiness + release-hardening present');
console.log('[update-rollback] note: signed store assets remain ops-only');
