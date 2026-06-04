import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-usage-signals-check-'));
const env = { ...process.env, ZAVORTH_HOME: tmp };
const failures = [];

for (const args of [
  ['scripts/zavorth-capability-usage-signals.ts', '--record', '--action', 'capability.candidate.research-pack', '--event', 'shown', '--surface', 'dashboard', '--title', 'Research pack'],
  ['scripts/zavorth-capability-usage-signals.ts', '--record', '--action', 'capability.candidate.research-pack', '--event', 'previewed', '--duration-ms', '120'],
  ['scripts/zavorth-capability-usage-signals.ts', '--record', '--action', 'capability.candidate.research-pack', '--event', 'succeeded', '--duration-ms', '240', '--receipt', 'receipt:1'],
]) {
  const result = spawnSync(process.execPath, [tsx, ...args], { cwd: root, env, encoding: 'utf8' });
  if (result.status !== 0) failures.push(result.stderr || `record command exited with ${result.status}`);
}

const json = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-usage-signals.ts', '--json'], {
  cwd: root,
  env,
  encoding: 'utf8',
});

if (json.status !== 0) {
  failures.push(json.stderr || `json command exited with ${json.status}`);
} else {
  try {
    const snapshot = JSON.parse(json.stdout);
    if (snapshot.surface !== 'capability-usage-signals') failures.push('surface mismatch');
    if (snapshot.summary?.events !== 3) failures.push('event count mismatch');
    if (snapshot.safety?.localOnly !== true) failures.push('local-only safety flag missing');
    const action = snapshot.actions?.[0];
    if (!action || action.recommendation !== 'keep_learning') failures.push('unexpected recommendation for small sample');
    if (action?.performance?.p95Ms !== 240) failures.push('p95 latency mismatch');
    const serialized = JSON.stringify(snapshot);
    if (/sk-|token=|secret=|password=|prompt text/iu.test(serialized)) failures.push('snapshot leaked sensitive-looking content');
  } catch (error) {
    failures.push(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const text = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-usage-signals.ts'], {
  cwd: root,
  env,
  encoding: 'utf8',
});
if (text.status !== 0) {
  failures.push(text.stderr || `text command exited with ${text.status}`);
} else if (!text.stdout.includes('Zavorth Capability Usage Signals')) {
  failures.push('text output header missing');
}

const cliHome = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-usage-signals-cli-'));
const cli = spawnSync(process.execPath, [
  path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  'src/zavorth-cli.ts',
  'actions',
  'usage',
  '--record',
  '--action',
  'capability.candidate.cli-smoke',
  '--event',
  'previewed',
  '--duration-ms',
  '42',
  '--json',
], {
  cwd: root,
  env: { ...process.env, ZAVORTH_HOME: cliHome },
  encoding: 'utf8',
});
if (cli.status !== 0) {
  failures.push(cli.stderr || `cli command exited with ${cli.status}`);
} else {
  try {
    const snapshot = JSON.parse(cli.stdout);
    if (snapshot.surface !== 'capability-usage-signals') failures.push('cli surface mismatch');
    if (snapshot.summary?.events !== 1) failures.push('cli event count mismatch');
  } catch (error) {
    failures.push(`invalid CLI JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
fs.rmSync(cliHome, { recursive: true, force: true });

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`[capability-usage-signals-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[capability-usage-signals-check] ok');
