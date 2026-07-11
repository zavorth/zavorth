#!/usr/bin/env node
/**
 * Record R2 only when UTC calendar day is after first day0Install.
 * Safe to run repeatedly (no-op or fail closed on same day).
 *
 *   node scripts/schedule-day1-retention.mjs
 *   node scripts/schedule-day1-retention.mjs --force-check
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const retPath = path.join(root, '.zavorth', 'retention-log.json');

function dayKey(iso) {
  return String(iso || '').slice(0, 10);
}

if (!fs.existsSync(retPath)) {
  console.error('[day1] no retention log yet — run dogfood:day0 first');
  process.exit(1);
}

const doc = JSON.parse(fs.readFileSync(retPath, 'utf8'));
if (doc.criteria?.day1Return) {
  console.log('[day1] R2 already recorded');
  process.exit(0);
}

const day0 = (doc.history || []).find((h) => h.event === 'day0Install');
const day0Day = dayKey(day0?.at);
const today = dayKey(new Date().toISOString());

if (!day0Day) {
  console.error('[day1] no day0Install history');
  process.exit(1);
}

if (day0Day === today) {
  console.log(`[day1] still same UTC day as day0 (${day0Day}). Not recording R2.`);
  console.log('[day1] re-run this script tomorrow:');
  console.log('  node scripts/schedule-day1-retention.mjs');
  process.exit(2);
}

const r = spawnSync(
  process.execPath,
  [
    path.join(root, 'scripts', 'retention-log.mjs'),
    '--day1-return',
    '--notes',
    `calendar day1 return ${today} (day0=${day0Day})`,
  ],
  { cwd: root, encoding: 'utf8', windowsHide: true },
);
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
if (r.status !== 0) process.exit(r.status || 1);

const check = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'retention-log.mjs'), '--check'],
  { cwd: root, encoding: 'utf8', windowsHide: true },
);
process.stdout.write(check.stdout || '');
process.stderr.write(check.stderr || '');
process.exit(check.status || 0);
