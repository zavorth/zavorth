#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spawn } = require('node-pty');

const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
const args = process.platform === 'win32'
  ? ['-NoProfile', '-Command', 'npx tsx src/zavorth-cli.ts tui --once']
  : ['-lc', 'npx tsx src/zavorth-cli.ts tui --once'];

const pty = spawn(shell, args, {
  name: 'xterm-color',
  cols: 72,
  rows: 20,
  cwd: process.cwd(),
  env: {
    ...process.env,
    CI: '1',
    ZAVORTH_DISABLE_INK: '1',
  },
});

let output = '';
let settled = false;

pty.onData((chunk) => {
  output += chunk;
});

pty.resize(104, 28);

const timer = setTimeout(() => {
  if (settled) return;
  settled = true;
  try {
    pty.kill();
  } catch {
    // Already closed.
  }
  fail(`PTY smoke timed out.\n${stripAnsi(output)}`);
}, 30000);

pty.onExit(({ exitCode }) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  const clean = stripAnsi(output);
  try {
    assert(exitCode === 0, `Expected exit code 0, received ${exitCode}.\n${clean}`);
    assert(clean.includes('Zavorth Terminal Shell'), `Missing Terminal Shell heading.\n${clean}`);
    assert(clean.includes('Conversation'), `Missing conversation area.\n${clean}`);
    assert(clean.includes('Composer'), `Missing bottom composer projection.\n${clean}`);
    assert(!clean.includes('Runtime Kernel'), `Daily PTY output leaked technical runtime panel.\n${clean}`);
    console.log('zavorth terminal shell PTY smoke passed');
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
  return String(value || '').replace(/\u001b\[[0-9;...]*[ -/]*[@-~]/g, '');
}
