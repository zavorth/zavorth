#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spawn } = require('node-pty');

const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
const args = process.platform === 'win32'
  ? ['-NoProfile', '-Command', 'npx tsx scripts/zavorth-terminal-shell-approval-harness.ts']
  : ['-lc', 'npx tsx scripts/zavorth-terminal-shell-approval-harness.ts'];

const env = { ...process.env };
delete env.CI;
delete env.ZAVORTH_DISABLE_INK;

const pty = spawn(shell, args, {
  name: 'xterm-color',
  cols: 96,
  rows: 28,
  cwd: process.cwd(),
  env,
});

let output = '';
let settled = false;
let droveKeys = false;
let requestedExit = false;

pty.onData((chunk) => {
  output += chunk;
  const clean = stripAnsi(output);
  if (!droveKeys && clean.includes('Approval harness ready.')) {
    droveKeys = true;
    setTimeout(() => pty.write('\t'), 100);
    setTimeout(() => pty.write('\t'), 220);
    setTimeout(() => pty.write('a'), 360);
  }
  if (!requestedExit && clean.includes('Approval captured by PTY harness.')) {
    requestedExit = true;
    setTimeout(() => pty.write('\x03'), 200);
  }
});

const timer = setTimeout(() => {
  if (settled) return;
  settled = true;
  try {
    pty.kill();
  } catch {
    // Already closed.
  }
  fail(`Approval PTY smoke timed out.\n${stripAnsi(output)}`);
}, 45000);

pty.onExit(({ exitCode }) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  const clean = stripAnsi(output);
  try {
    assert(exitCode === 0, `Expected exit code 0, received ${exitCode}.\n${clean}`);
    assert(clean.includes('Apply safe patch'), `Missing approval card.\n${clean}`);
    assert(
      clean.includes('RUN_ONCE:hud --action approve --plan plan-terminal-pty --yes'),
      `Approval shortcut did not call governed HUD command.\n${clean}`,
    );
    assert(clean.includes('Approval captured by PTY harness.'), `Missing approval result.\n${clean}`);
    console.log('zavorth terminal shell approval PTY smoke passed');
    process.exit(0);
  } catch (error) {
    fail(error.message || String(error));
  }
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function stripAnsi(value) {
  return String(value || '').replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
}
