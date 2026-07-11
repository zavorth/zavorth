#!/usr/bin/env node
/**
 * Smoke: single public entry `zavorth` launches Code TUI (compat `code` strip).
 *
 *   node scripts/smoke-code-dispatch.mjs
 *   npm run code:dispatch:smoke
 *
 * Historical name kept for npm script stability. Dual-bin product is gone.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 120_000;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert(pkg.bin && pkg.bin.zavorth === './bin/zavorth.js', 'bin.zavorth mapping');
assert(!pkg.bin['zavorth-code'], 'no public zavorth-code bin');
assert(!fs.existsSync(path.join(root, 'bin', 'zavorth-code.js')), 'no bin/zavorth-code.js');
pass('single public bin: zavorth only');

assert(fs.existsSync(path.join(root, 'bin', 'zavorth.js')), 'bin/zavorth.js');
assert(
  fs.existsSync(path.join(root, 'packages', 'code', 'cli', 'src', 'index.ts')),
  'Code TUI sources',
);
pass('entry + Code TUI sources present');

const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-single-bin-'));
const stubJs = path.join(stubDir, 'stub.js');
fs.writeFileSync(
  stubJs,
  "process.stdout.write(['TUI_OK', ...process.argv.slice(2)].join(' ') + '\\n'); process.exit(0);\n",
  'utf8',
);
let stubCmd = stubJs;
if (process.platform === 'win32') {
  stubCmd = path.join(stubDir, 'stub.cmd');
  fs.writeFileSync(stubCmd, `@echo off\r\n"${process.execPath}" "${stubJs}" %*\r\n`, 'utf8');
}

try {
  const r = spawnSync(process.execPath, [path.join(root, 'bin', 'zavorth.js'), 'code', '--version'], {
    cwd: root,
    env: { ...process.env, ZAVORTH_CODE_BIN: stubCmd, ZAVORTH_TAGLINE: 'off' },
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
  assert(r.status === 0, `compat code strip failed: ${r.status} ${r.stderr}`);
  assert(String(r.stdout || '').includes('TUI_OK'), 'expected TUI stub');
  assert(String(r.stdout || '').includes('--version'), 'forward --version');
  pass('zavorth code … strips to TUI (compat, not dual product)');
} finally {
  try {
    fs.rmSync(stubDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// Soft real --version
const real = spawnSync(process.execPath, [path.join(root, 'bin', 'zavorth.js'), '--version'], {
  cwd: root,
  env: { ...process.env, ZAVORTH_TAGLINE: 'off' },
  timeout: TIMEOUT_MS,
  windowsHide: false,
  stdio: 'inherit',
});
if (real.status === 0) {
  pass('zavorth --version (real TUI, soft)');
} else {
  console.log(`WARN: real zavorth --version exit ${real.status} (soft)`);
}

console.log('single-bin dispatch smoke ok');
