#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  'docs/product/launch-readiness.md',
  'docs/product/retention-gate.md',
  'docs/support.md',
  'docs/known-limitations.md',
  'docs/security/threat-model.md',
  '.github/workflows/security.yml',
  '.github/workflows/ci.yml',
  'scripts/security-ci-check.mjs',
  'scripts/installer-release-manifest.mjs',
  'scripts/retention-log.mjs',
];
const failures = [];
const warnings = [];
for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`missing ${rel}`);
}
const launchDoc = path.join(root, 'docs', 'product', 'launch-readiness.md');
if (fs.existsSync(launchDoc)) {
  const t = fs.readFileSync(launchDoc, 'utf8');
  for (const needle of [/signing|signed|store/i, /retention|day.?1/i, /ops|operator/i]) {
    if (!needle.test(t)) failures.push(`launch-readiness.md missing honesty marker: ${needle}`);
  }
  if (/\blaunch\s+(complete|done|shipped)\b/i.test(t) && !/not\s+yet|pending|blocked|residual/i.test(t)) {
    failures.push('launch-readiness.md appears to claim launch complete without residual caveats');
  }
}
const retPath = path.join(root, '.zavorth', 'retention-log.json');
if (fs.existsSync(retPath)) {
  try {
    const ret = JSON.parse(fs.readFileSync(retPath, 'utf8'));
    if (ret.criteria?.day1Return === true) {
      warnings.push('day1Return is true - ensure this was recorded on a later calendar day');
    } else {
      warnings.push('day1Return is still open and requires a real later-day return');
    }
  } catch {
    warnings.push('retention-log.json unreadable');
  }
}
if (failures.length) {
  console.error('[launch-readiness] failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('[launch-readiness] ok (honesty gate; not a public launch announcement)');
for (const w of warnings) console.log(`[launch-readiness] note: ${w}`);
