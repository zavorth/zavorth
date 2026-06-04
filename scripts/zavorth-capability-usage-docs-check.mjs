import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-usage-docs-check-'));
const env = { ...process.env, ZAVORTH_HOME: tmp };
const failures = [];

const json = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-usage-docs.ts', '--json'], {
  cwd: root,
  env,
  encoding: 'utf8',
});
if (json.status !== 0) {
  failures.push(json.stderr || `json command exited with ${json.status}`);
} else {
  try {
    const snapshot = JSON.parse(json.stdout);
    if (snapshot.surface !== 'capability-usage-docs') failures.push('surface mismatch');
    if (snapshot.safety?.publicDocsOnly !== true) failures.push('public docs safety flag missing');
    if (!String(snapshot.publicCommands?.preview || '').includes('zavorth actions preview')) failures.push('preview command missing');
  } catch (error) {
    failures.push(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const markdown = spawnSync(process.execPath, [tsx, 'scripts/zavorth-capability-usage-docs.ts', '--markdown'], {
  cwd: root,
  env,
  encoding: 'utf8',
});
if (markdown.status !== 0) {
  failures.push(markdown.stderr || `markdown command exited with ${markdown.status}`);
} else {
  const text = markdown.stdout;
  for (const required of [
    '# Zavorth Capabilities',
    '## Where To See Capabilities',
    '## How To Use One',
    '## Safety Rules',
  ]) {
    if (!text.includes(required)) failures.push(`missing section: ${required}`);
  }
  const forbidden = /\b(private audit|comparison report|internal report|maintenance report)\b/iu;
  if (forbidden.test(text)) failures.push('markdown contains private or comparison language');
}

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`[capability-usage-docs-check] failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[capability-usage-docs-check] ok');
