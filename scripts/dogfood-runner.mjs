#!/usr/bin/env node
/**
 * Dogfood run log helper.
 *   node scripts/dogfood-runner.mjs --mark pass dogfood.install.01 --notes "..."
 *   node scripts/dogfood-runner.mjs --summary
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function argValue(flag) {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}
function has(flag) {
  return args.includes(flag);
}

const defaultLog = path.join(root, '.zavorth', 'dogfood-runs.json');
const logPath = path.resolve(argValue('--log') || defaultLog);

function pkgVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function load() {
  if (!fs.existsSync(logPath)) {
    return {
      version: 'dogfood-run-log/1',
      operator: process.env.ZAVORTH_DOGFOOD_OPERATOR || os.userInfo().username || 'operator',
      machine: process.platform,
      zavorthVersion: pkgVersion(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      runs: [],
      retention: {
        day0Install: false,
        day1Return: false,
        completedMissionWithoutCreator: false,
        notes: '',
      },
    };
  }
  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch {
    return {
      version: 'dogfood-run-log/1',
      operator: 'operator',
      machine: process.platform,
      zavorthVersion: pkgVersion(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      runs: [],
    };
  }
}

function save(doc) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  doc.completedAt = new Date().toISOString();
  doc.zavorthVersion = pkgVersion();
  fs.writeFileSync(logPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
}

function mark() {
  const i = args.indexOf('--mark');
  const status = (args[i + 1] || '').toLowerCase();
  const missionId = args[i + 2];
  if (!['pass', 'fail', 'blocked', 'skip'].includes(status) || !missionId) {
    console.error('usage: --mark <pass|fail|blocked|skip> <missionId> [--notes text]');
    process.exit(2);
  }
  const notes = argValue('--notes') || '';
  const doc = load();
  if (!Array.isArray(doc.runs)) doc.runs = [];
  const next = { missionId, status, at: new Date().toISOString(), notes };
  const idx = doc.runs.findIndex((r) => r.missionId === missionId);
  if (idx >= 0) doc.runs[idx] = next;
  else doc.runs.push(next);
  doc.runs.sort((a, b) => String(a.missionId).localeCompare(String(b.missionId)));
  save(doc);
  console.log(`[dogfood-runner] marked ${status} ${missionId}`);
}

function summary() {
  const doc = load();
  const by = { pass: 0, fail: 0, blocked: 0, skip: 0, other: 0 };
  const latest = new Map();
  for (const r of doc.runs || []) latest.set(r.missionId, r);
  for (const r of latest.values()) {
    if (by[r.status] != null) by[r.status] += 1;
    else by.other += 1;
  }
  console.log(
    [
      '=== Dogfood run summary ===',
      `log: ${path.relative(root, logPath)}`,
      `unique missions: ${latest.size}`,
      `pass=${by.pass} fail=${by.fail} blocked=${by.blocked} skip=${by.skip} other=${by.other}`,
      `operator=${doc.operator || '-'} machine=${doc.machine || '-'} version=${doc.zavorthVersion || '-'}`,
      `startedAt=${doc.startedAt || '-'} completedAt=${doc.completedAt || '-'}`,
    ].join('\n'),
  );
  if (doc.retention) {
    console.log(
      `retention: day0=${!!doc.retention.day0Install} day1=${!!doc.retention.day1Return} solo=${!!doc.retention.completedMissionWithoutCreator}`,
    );
  }
}

function list() {
  const doc = load();
  for (const r of doc.runs || []) {
    console.log(`${String(r.status).padEnd(8)} ${r.missionId}  ${r.notes || ''}`);
  }
}

if (has('--mark')) mark();
else if (has('--summary')) summary();
else if (has('--list')) list();
else {
  console.log(`usage:
  node scripts/dogfood-runner.mjs --mark <pass|fail|blocked|skip> <id> [--notes text]
  node scripts/dogfood-runner.mjs --summary
  node scripts/dogfood-runner.mjs --list`);
}
