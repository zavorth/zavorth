import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-action-surface-check-'));
const result = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-action-surface.ts', '--json', '--list'], {
  cwd: root,
  env: { ...process.env, ZAVORTH_HOME: tmp },
  encoding: 'utf8',
});
const failures = [];

if (result.status !== 0) {
  failures.push(result.stderr || `CLI exited with ${result.status}`);
} else {
  try {
    const snapshot = JSON.parse(result.stdout);
    if (snapshot.surface !== 'capability-action-surface') failures.push('surface mismatch');
    if (snapshot.safety?.readOnlyProjection !== true) failures.push('projection is not marked read-only');
    if (snapshot.safety?.previewRequired !== true) failures.push('preview gate is missing');
    if (snapshot.safety?.approvalRequired !== true) failures.push('approval gate is missing');
    if (snapshot.placement?.dashboard?.apiPath !== '/api/operations/capabilities') failures.push('dashboard placement is missing');
    if (snapshot.placement?.tui?.visible !== true) failures.push('TUI placement is missing');
    if (snapshot.placement?.setup?.visible !== true) failures.push('setup placement is missing');
  } catch (error) {
    failures.push(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`[capability-action-surface-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[capability-action-surface-check] ok');
