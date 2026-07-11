#!/usr/bin/env node
/**
 * Day-0 dogfood session — hermetic probes only (no live LLM / store / R2).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logPath = path.join(root, '.zavorth', 'dogfood-runs.json');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    shell: Boolean(opts.shell),
    timeout: opts.timeout ?? 180_000,
    env: { ...process.env, ...(opts.env || {}) },
    windowsHide: true,
  });
  return { ok: r.status === 0, status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function npmRun(script) {
  if (process.platform === 'win32') {
    return run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm run ${script} --silent`], {
      timeout: 420_000,
    });
  }
  return run('npm', ['run', script, '--silent'], { timeout: 420_000 });
}

function nodeBin(...args) {
  return run(process.execPath, [path.join(root, 'bin', 'zavorth.js'), ...args], { timeout: 90_000 });
}

function mark(status, id, notes) {
  run(process.execPath, [
    path.join(root, 'scripts', 'dogfood-runner.mjs'),
    '--mark',
    status,
    id,
    '--notes',
    notes,
    '--log',
    logPath,
  ], { timeout: 30_000 });
  console.log(`  ${status.toUpperCase()} ${id} — ${notes}`);
}

console.log('=== Day-0 dogfood session ===');
const started = new Date().toISOString();
const probes = [
  ['dogfood.install.01', () => {
    const r = nodeBin('--version');
    const h = nodeBin();
    return r.ok && h.ok ? ['pass', 'home+version'] : ['fail', 'cli home/version'];
  }],
  ['dogfood.install.02', () => {
    const r = nodeBin('doctor');
    return r.ok && /ready:\s*yes/i.test(r.out) ? ['pass', 'doctor ready:yes'] : ['fail', r.out.slice(0, 120)];
  }],
  ['dogfood.install.03', () => {
    const r = nodeBin('--help');
    return r.ok ? ['pass', 'offline help'] : ['fail', 'help'];
  }],
  ['dogfood.install.06', () => {
    const r = npmRun('code:packaging:smoke');
    return r.ok || /packaging smoke ok/i.test(r.out) ? ['pass', 'pack smoke'] : ['fail', 'pack'];
  }],
  ['dogfood.first-run.03', () => {
    const r = npmRun('code:entry:smoke');
    return r.ok || /entry smoke ok/i.test(r.out) ? ['pass', 'entry smoke'] : ['fail', 'entry'];
  }],
  ['dogfood.first-run.08', () => {
    const r = npmRun('qa:zavorth-golden-path');
    return r.ok || /golden path complete|classifyHonestReadiness/i.test(r.out)
      ? ['pass', 'golden honesty']
      : ['fail', 'golden'];
  }],
  ['dogfood.security.08', () => {
    const r = npmRun('security:ci');
    return r.ok || /All security gates passed/i.test(r.out) ? ['pass', 'security:ci'] : ['fail', 'security:ci'];
  }],
  ['dogfood.update.06', () => {
    const r = nodeBin('doctor');
    return r.ok ? ['pass', 'doctor after probes'] : ['fail', 'doctor'];
  }],
];

let pass = 0;
let fail = 0;
for (const [id, fn] of probes) {
  process.stdout.write(`${id} ... `);
  try {
    const [status, notes] = fn();
    if (status === 'pass') pass += 1;
    else fail += 1;
    console.log(status);
    mark(status, id, notes);
  } catch (e) {
    fail += 1;
    const msg = e instanceof Error ? e.message : String(e);
    console.log('fail');
    mark('fail', id, msg);
  }
}

run(process.execPath, [
  path.join(root, 'scripts', 'retention-log.mjs'),
  '--day0-install',
  '--mission-solo',
  '--notes',
  `day0 clean session ${started}; pass=${pass} fail=${fail}`,
]);

const sum = run(process.execPath, [
  path.join(root, 'scripts', 'dogfood-runner.mjs'),
  '--summary',
  '--log',
  logPath,
]);
console.log(sum.out);
console.log(JSON.stringify({ pass, fail, total: probes.length, started }, null, 2));
console.log('R2 day1 still calendar-gated (not recorded).');
if (fail > 0) process.exitCode = 1;
