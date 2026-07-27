#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  'docs/product/dogfood-missions-100.md',
  'docs/product/beta-canonical-missions.md',
  'docs/product/retention-gate.md',
  'docs/product/honesty-readiness.md',
  'docs/product/surfaces-code-control-desktop.md',
  'docs/product/golden-path.md',
  'docs/product/release-hardening.md',
  'docs/product/guided-troubleshooting.md',
  '.github/ISSUE_TEMPLATE/bug_report.md',
  '.github/ISSUE_TEMPLATE/feature_request.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
];
const failures = [];
for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`missing ${rel}`);
}
const missionsPath = path.join(root, 'docs', 'product', 'dogfood-missions-100.md');
if (fs.existsSync(missionsPath)) {
  const text = fs.readFileSync(missionsPath, 'utf8');
  const ids = [];
  for (const line of text.split(/\r...\n/)) {
    const m = line.match(/\|\s*\d+\s*\|\s*`([^`]+)`/);
    if (m) ids.push(m[1]);
  }
  if (ids.length !== 110) failures.push(`dogfood-missions-100.md has ${ids.length} rows (want 110)`);
}
const retentionGate = path.join(root, 'docs', 'product', 'retention-gate.md');
if (fs.existsSync(retentionGate)) {
  const t = fs.readFileSync(retentionGate, 'utf8');
  if (!/day1|calendar|R2/i.test(t)) failures.push('retention-gate.md should document R2 calendar day-1 gate');
}
if (failures.length) {
  console.error('[group-2-docs] failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('[group-2-docs] ok');
console.log(`[group-2-docs] checked ${requiredFiles.length} paths + missions table`);
