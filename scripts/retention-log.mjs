#!/usr/bin/env node
/**
 * Retention criteria log (R1 day0, R2 day1 calendar return, R3 solo mission).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function has(flag) {
  return args.includes(flag);
}
function argValue(flag) {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}

const logPath = path.resolve(argValue('--log') || path.join(root, '.zavorth', 'retention-log.json'));
const dogfoodPath = path.join(root, '.zavorth', 'dogfood-runs.json');

function load() {
  if (!fs.existsSync(logPath)) {
    return {
      version: 'retention-log/1',
      updatedAt: new Date().toISOString(),
      operator: process.env.ZAVORTH_DOGFOOD_OPERATOR || 'REPLACE_ME',
      criteria: {
        day0Install: false,
        day1Return: false,
        completedMissionWithoutCreator: false,
      },
      notes: '',
      history: [],
    };
  }
  return JSON.parse(fs.readFileSync(logPath, 'utf8'));
}

function save(doc) {
  doc.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  try {
    if (fs.existsSync(dogfoodPath)) {
      const d = JSON.parse(fs.readFileSync(dogfoodPath, 'utf8'));
      d.retention = {
        day0Install: !!doc.criteria.day0Install,
        day1Return: !!doc.criteria.day1Return,
        completedMissionWithoutCreator: !!doc.criteria.completedMissionWithoutCreator,
        notes: doc.notes || '',
      };
      fs.writeFileSync(dogfoodPath, JSON.stringify(d, null, 2) + '\n', 'utf8');
    }
  } catch {
    /* ignore */
  }
}

function pushHistory(doc, event, detail) {
  if (!Array.isArray(doc.history)) doc.history = [];
  doc.history.push({ at: new Date().toISOString(), event, detail });
}

function dayKey(iso) {
  return String(iso || '').slice(0, 10);
}

function firstDay0At(doc) {
  const hit = (doc.history || []).find((h) => h.event === 'day0Install');
  return hit?.at || null;
}

function applyNotes(doc) {
  const notes = argValue('--notes');
  if (notes) {
    doc.notes = doc.notes ? `${doc.notes}\n${notes}` : notes;
    pushHistory(doc, 'notes', notes);
  }
}

const doc = load();
let mutated = false;

if (has('--day0-install')) {
  doc.criteria.day0Install = true;
  pushHistory(doc, 'day0Install', 'flag --day0-install');
  applyNotes(doc);
  mutated = true;
  console.log('[retention] R1 day0Install = true');
}

if (has('--mission-solo')) {
  doc.criteria.completedMissionWithoutCreator = true;
  pushHistory(doc, 'missionSolo', 'flag --mission-solo');
  applyNotes(doc);
  mutated = true;
  console.log('[retention] R3 completedMissionWithoutCreator = true');
}

if (has('--day1-return')) {
  const day0At = firstDay0At(doc);
  const today = dayKey(new Date().toISOString());
  const day0Day = dayKey(day0At);
  if (!doc.criteria.day0Install || !day0Day) {
    console.error('[retention] cannot set day1Return before day0Install is recorded');
    process.exit(1);
  }
  if (day0Day === today && process.env.ZAVORTH_ALLOW_FAKE_DAY1 !== '1') {
    console.error(
      `[retention] R2 day1Return is calendar-gated: day0 was ${day0Day}, today is ${today}. Not recording.`,
    );
    process.exit(2);
  }
  const usedFake = day0Day === today && process.env.ZAVORTH_ALLOW_FAKE_DAY1 === '1';
  doc.criteria.day1Return = true;
  doc.day1Method = usedFake ? 'fake-env' : 'calendar';
  pushHistory(
    doc,
    'day1Return',
    usedFake ? 'flag --day1-return with ZAVORTH_ALLOW_FAKE_DAY1 (not launch evidence)' : 'flag --day1-return',
  );
  applyNotes(doc);
  mutated = true;
  console.log(
    usedFake
      ? '[retention] R2 day1Return = true (FAKE — not launch evidence)'
      : '[retention] R2 day1Return = true',
  );
}

if (has('--notes') && !mutated) {
  applyNotes(doc);
  mutated = true;
}

if (mutated) save(doc);

if (has('--check')) {
  const soft = has('--soft');
  const c = doc.criteria || {};
  const missing = [];
  if (!c.day0Install) missing.push('day0Install (R1)');
  if (!c.completedMissionWithoutCreator) missing.push('completedMissionWithoutCreator (R3)');
  if (!c.day1Return) missing.push('day1Return (R2 calendar)');
  console.log('[retention] criteria snapshot');
  console.log(`  day0Install=${!!c.day0Install}`);
  console.log(`  day1Return=${!!c.day1Return}`);
  console.log(`  completedMissionWithoutCreator=${!!c.completedMissionWithoutCreator}`);
  console.log(`  log=${path.relative(root, logPath)}`);
  if (missing.length === 0) {
    console.log('[retention] check ok (R1+R2+R3)');
    process.exit(0);
  }
  if (soft) {
    const hardMissing = missing.filter((m) => !m.includes('R2'));
    if (hardMissing.length === 0) {
      console.log(
        `[retention] soft check ok (R1+R3); pending: ${missing.filter((m) => m.includes('R2')).join(', ')}`,
      );
      process.exit(0);
    }
    console.error(`[retention] soft check failed: missing ${hardMissing.join(', ')}`);
    process.exit(1);
  }
  console.error(`[retention] check failed: missing ${missing.join(', ')}`);
  process.exit(1);
}

if (!mutated && !has('--check')) {
  console.log(`usage:
  node scripts/retention-log.mjs --day0-install [--notes text]
  node scripts/retention-log.mjs --day1-return [--notes text]
  node scripts/retention-log.mjs --mission-solo [--notes text]
  node scripts/retention-log.mjs --check [--soft]`);
}
