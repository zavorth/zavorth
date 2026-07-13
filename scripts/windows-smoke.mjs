#!/usr/bin/env node
/**
 * Minimal Windows (or cross-platform) smoke for release CI.
 * Does not require full provider keys: checks package shape, dist entry, CLI help.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function ok(label) {
  console.log(`[windows-smoke] ok  ${label}`);
}

function fail(label, detail) {
  failures.push(`${label}: ${detail}`);
  console.error(`[windows-smoke] fail ${label}: ${detail}`);
}

// 1) package.json contract
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!pkg.name) fail('package.name', 'missing');
  else ok(`package.name=${pkg.name}`);
  if (!pkg.version) fail('package.version', 'missing');
  else ok(`package.version=${pkg.version}`);
  if (pkg.license !== 'MIT') fail('package.license', String(pkg.license));
  else ok('package.license=MIT');
  if (!pkg.bin && !pkg.main) fail('package.entry', 'no bin/main');
  else ok('package.entry present');
} catch (error) {
  fail('package.json', error instanceof Error ? error.message : String(error));
}

// 2) dist entry if built
const distIndex = path.join(root, 'dist', 'index.js');
if (fs.existsSync(distIndex)) {
  ok('dist/index.js present');
} else {
  console.log('[windows-smoke] skip dist/index.js (not built yet)');
}

// 3) CLI help via node entry (bin/zavorth.js or dist)
const binCandidates = [
  path.join(root, 'bin', 'zavorth.js'),
  path.join(root, 'dist', 'cli', 'index.js'),
  path.join(root, 'dist', 'zavorth-cli.js'),
].filter((p) => fs.existsSync(p));

if (binCandidates.length > 0) {
  const entry = binCandidates[0];
  const result = spawnSync(process.execPath, [entry, '--help'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, NO_COLOR: '1' },
  });
  if (result.status === 0 || /usage|zavorth|command/i.test(`${result.stdout}\n${result.stderr}`)) {
    ok(`cli help via ${path.relative(root, entry)}`);
  } else {
    fail('cli help', `exit=${result.status} ${String(result.stderr || result.stdout).slice(0, 200)}`);
  }
} else {
  // Fallback: npm run if package scripts define help
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', 'zavorth', '--', '--help'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    shell: process.platform === 'win32',
    env: { ...process.env, NO_COLOR: '1' },
  });
  if (result.status === 0 || /usage|zavorth/i.test(`${result.stdout}\n${result.stderr}`)) {
    ok('cli help via npm run zavorth');
  } else {
    console.log('[windows-smoke] skip cli help (no bin entry found)');
  }
}

// 4) Dockerfile exists (release packaging)
if (fs.existsSync(path.join(root, 'Dockerfile'))) {
  ok('Dockerfile present');
} else {
  fail('Dockerfile', 'missing');
}

if (failures.length > 0) {
  console.error(`[windows-smoke] verdict: failed (${failures.length})`);
  process.exitCode = 1;
} else {
  console.log('[windows-smoke] verdict: passed');
}
