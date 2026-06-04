import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-lifecycle-check-'));
const env = { ...process.env, ZAVORTH_HOME: tmp };
const failures = [];

for (const args of [
  ['scripts/zavorth-capability-usage-signals.ts', '--record', '--action', 'capability.candidate.fast-search', '--event', 'shown', '--title', 'Fast search'],
  ['scripts/zavorth-capability-usage-signals.ts', '--record', '--action', 'capability.candidate.fast-search', '--event', 'previewed', '--duration-ms', '90'],
  ['scripts/zavorth-capability-usage-signals.ts', '--record', '--action', 'capability.candidate.fast-search', '--event', 'succeeded', '--duration-ms', '120'],
  ['scripts/zavorth-capability-usage-signals.ts', '--record', '--action', 'capability.candidate.fast-search', '--event', 'succeeded', '--duration-ms', '180'],
  ['scripts/zavorth-capability-usage-signals.ts', '--record', '--action', 'capability.candidate.stale-tool', '--event', 'abandoned'],
  ['scripts/zavorth-capability-usage-signals.ts', '--record', '--action', 'capability.candidate.stale-tool', '--event', 'abandoned'],
]) {
  const result = spawnSync(process.execPath, [tsx, ...args], { cwd: root, env, encoding: 'utf8' });
  if (result.status !== 0) failures.push(result.stderr || `usage record exited with ${result.status}`);
}

const preview = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-lifecycle.ts', '--json'], {
  cwd: root,
  env,
  encoding: 'utf8',
});
if (preview.status !== 0) {
  failures.push(preview.stderr || `preview exited with ${preview.status}`);
} else {
  try {
    const snapshot = JSON.parse(preview.stdout);
    if (snapshot.surface !== 'capability-lifecycle') failures.push('surface mismatch');
    if (snapshot.preview?.planned !== 2) failures.push(`expected 2 planned decisions, got ${snapshot.preview?.planned}`);
    if (!snapshot.preview?.decisions?.some((decision) => decision.kind === 'promote')) failures.push('missing promote decision');
    if (!snapshot.preview?.decisions?.some((decision) => decision.kind === 'archive')) failures.push('missing archive decision');
    if (snapshot.safety?.noDeletion !== true || snapshot.safety?.noLiveActivation !== true) failures.push('safety flags missing');
  } catch (error) {
    failures.push(`invalid preview JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const blocked = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-lifecycle.ts', '--apply', '--json'], {
  cwd: root,
  env,
  encoding: 'utf8',
});
if (blocked.status !== 0) {
  failures.push(blocked.stderr || `blocked apply exited with ${blocked.status}`);
} else {
  const snapshot = JSON.parse(blocked.stdout);
  if (!snapshot.decisions?.some((decision) => decision.status === 'blocked')) failures.push('apply without approval should block promote/archive');
}

const applied = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-lifecycle.ts', '--apply', '--approval-id', 'approval:lifecycle-smoke', '--json'], {
  cwd: root,
  env,
  encoding: 'utf8',
});
if (applied.status !== 0) {
  failures.push(applied.stderr || `approved apply exited with ${applied.status}`);
} else {
  const snapshot = JSON.parse(applied.stdout);
  if (snapshot.summary?.promoted !== 1) failures.push('promoted count mismatch');
  if (snapshot.summary?.archived !== 1) failures.push('archived count mismatch');
  if (!snapshot.receipts?.some((receipt) => receipt.status === 'applied')) failures.push('missing applied receipt');
  const serialized = JSON.stringify(snapshot);
  if (/sk-|token=|secret=|password=|prompt text/iu.test(serialized)) failures.push('snapshot leaked sensitive-looking content');
}

const cliHome = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-lifecycle-cli-'));
const cli = spawnSync(process.execPath, [tsx, 'src/zavorth-cli.ts', 'actions', 'lifecycle', '--json'], {
  cwd: root,
  env: { ...process.env, ZAVORTH_HOME: cliHome },
  encoding: 'utf8',
});
if (cli.status !== 0) {
  failures.push(cli.stderr || `cli lifecycle exited with ${cli.status}`);
} else {
  try {
    const snapshot = JSON.parse(cli.stdout);
    if (snapshot.surface !== 'capability-lifecycle') failures.push('cli lifecycle surface mismatch');
  } catch (error) {
    failures.push(`invalid CLI lifecycle JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
fs.rmSync(cliHome, { recursive: true, force: true });

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`[capability-lifecycle-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[capability-lifecycle-check] ok');
