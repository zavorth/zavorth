#!/usr/bin/env node
/**
 * Honest calendar day1 retention bridge.
 *
 * - Reads retention day0 from .zavorth/retention-log.json
 * - Confirms current UTC day is later than day0
 * - Records R2 with day1Method: 'calendar' via retention-log.mjs
 * - NEVER sets ZAVORTH_ALLOW_FAKE_DAY1
 *
 * Optional desktop continuity link:
 *   If data/product/desktop-open-clock.json (or similar) exists, attach its
 *   timestamps to notes. If missing, skip — do not invent localStorage/clock data.
 *
 *   node scripts/record-day1-from-desktop-clock.mjs
 *   node scripts/record-day1-from-desktop-clock.mjs --json
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const retPath = path.join(root, '.zavorth', 'retention-log.json');

/** Known optional continuity files — never invent if absent. */
const DESKTOP_CLOCK_CANDIDATES = [
  'data/product/desktop-open-clock.json',
  'data/product/desktop-continuity-clock.json',
  '.zavorth/desktop-open-clock.json',
];

function dayKey(iso) {
  return String(iso || '').slice(0, 10);
}

function readJsonSafe(abs) {
  try {
    if (!fs.existsSync(abs)) return null;
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

function loadDesktopClock() {
  for (const rel of DESKTOP_CLOCK_CANDIDATES) {
    const abs = path.join(root, rel);
    const doc = readJsonSafe(abs);
    if (doc && typeof doc === 'object') {
      return { path: rel, doc };
    }
  }
  return null;
}

function summarizeClock(clock) {
  if (!clock) return null;
  const d = clock.doc;
  const bits = [];
  if (d.firstOpenAt) bits.push(`firstOpenAt=${d.firstOpenAt}`);
  if (d.lastOpenAt) bits.push(`lastOpenAt=${d.lastOpenAt}`);
  if (d.day0At) bits.push(`day0At=${d.day0At}`);
  if (d.day1At) bits.push(`day1At=${d.day1At}`);
  if (Array.isArray(d.opens) && d.opens.length) {
    bits.push(`opens=${d.opens.length}`);
  }
  if (!bits.length) {
    bits.push(`present=${clock.path}`);
  }
  return { path: clock.path, summary: bits.join(' ') };
}

// Hard ban: this bridge must never green-light same-day fake R2.
if (process.env.ZAVORTH_ALLOW_FAKE_DAY1 === '1') {
  console.error(
    '[day1-desktop] ZAVORTH_ALLOW_FAKE_DAY1 is set — refusing. Unset it for real calendar R2.',
  );
  process.exit(3);
}

if (!fs.existsSync(retPath)) {
  console.error('[day1-desktop] no retention log — run dogfood:day0 first');
  process.exit(1);
}

const doc = JSON.parse(fs.readFileSync(retPath, 'utf8'));
const already = Boolean(doc.criteria?.day1Return);
const day0 = (doc.history || []).find((h) => h.event === 'day0Install');
const day0Day = dayKey(day0?.at);
const today = dayKey(new Date().toISOString());
const clock = loadDesktopClock();
const clockInfo = summarizeClock(clock);

if (already && doc.day1Method === 'calendar') {
  const out = {
    ok: true,
    action: 'noop',
    reason: 'R2 already recorded with day1Method=calendar',
    day0Day,
    today,
    day1Method: doc.day1Method,
    desktopClock: clockInfo,
  };
  if (asJson) {
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  } else {
    console.log('[day1-desktop] R2 already recorded (calendar)');
    if (clockInfo) console.log(`[day1-desktop] desktop clock: ${clockInfo.path} (${clockInfo.summary})`);
    else console.log('[day1-desktop] desktop clock: absent — skipped (no invent)');
  }
  process.exit(0);
}

if (!doc.criteria?.day0Install || !day0Day) {
  console.error('[day1-desktop] day0Install missing — cannot record R2');
  process.exit(1);
}

if (day0Day === today) {
  const msg = `still same UTC day as day0 (${day0Day}). Not recording R2.`;
  if (asJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        action: 'blocked-same-day',
        day0Day,
        today,
        desktopClock: clockInfo,
        reason: msg,
      }, null, 2)}\n`,
    );
  } else {
    console.log(`[day1-desktop] ${msg}`);
    console.log('[day1-desktop] re-run tomorrow:');
    console.log('  node scripts/record-day1-from-desktop-clock.mjs');
    console.log('  # or: npm run retention:day1');
  }
  process.exit(2);
}

const noteParts = [
  `calendar day1 return ${today} (day0=${day0Day}) via record-day1-from-desktop-clock`,
];
if (clockInfo) {
  noteParts.push(`desktop-clock ${clockInfo.path}: ${clockInfo.summary}`);
} else {
  noteParts.push('desktop-clock absent — calendar gate only (no invent)');
}

const notes = noteParts.join('; ');
const r = spawnSync(
  process.execPath,
  [
    path.join(root, 'scripts', 'retention-log.mjs'),
    '--day1-return',
    '--notes',
    notes,
  ],
  {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    // Explicitly strip fake override so child cannot inherit a flaky shell export.
    env: { ...process.env, ZAVORTH_ALLOW_FAKE_DAY1: '' },
  },
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

if (asJson) {
  const after = readJsonSafe(retPath);
  process.stdout.write(
    `${JSON.stringify({
      ok: check.status === 0,
      action: 'recorded',
      day0Day,
      today,
      day1Method: after?.day1Method || 'calendar',
      desktopClock: clockInfo,
      notes,
    }, null, 2)}\n`,
  );
}

process.exit(check.status || 0);
