'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const cli = path.resolve(__dirname, '..', 'bin', 'create-zavorth.js');

function run(cwd, args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('creates a usable workspace without secrets or runtime side effects', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'create-zavorth-'));
  try {
    const result = run(cwd, ['daily-agent', '--json']);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.mode, 'created');
    const target = path.join(cwd, 'daily-agent');
    const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(pkg.scripts), ['setup', 'start', 'open', 'doctor']);
    assert.match(fs.readFileSync(path.join(target, '.gitignore'), 'utf8'), /^\.env$/m);
    assert.equal(fs.existsSync(path.join(target, '.env')), false);
    assert.equal(fs.existsSync(path.join(target, '.zavorth')), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('dry-run reports files without creating a directory', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'create-zavorth-'));
  try {
    const result = run(cwd, ['preview-agent', '--dry-run', '--json']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).mode, 'dry-run');
    assert.equal(fs.existsSync(path.join(cwd, 'preview-agent')), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('refuses traversal and existing targets', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'create-zavorth-'));
  try {
    assert.notEqual(run(cwd, ['../outside']).status, 0);
    fs.mkdirSync(path.join(cwd, 'existing'));
    assert.notEqual(run(cwd, ['existing']).status, 0);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
