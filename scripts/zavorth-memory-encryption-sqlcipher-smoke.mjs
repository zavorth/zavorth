#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const driver = 'better-sqlite3-multiple-ciphers';
const require = createRequire(import.meta.url);

try {
  requireFromRoot(driver);
} catch {
  console.log(`[zavorth-memory-encryption] optional driver ${driver} is not installed; skipping strong smoke.`);
  process.exit(0);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-encryption-sqlcipher-'));
const dbPath = path.join(tempRoot, 'memory.sqlite');
const key = 'zavorth-memory-encryption-smoke-key';

try {
  const seed = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    '-e',
    [
      "import { SqliteVecMemoryBackend } from './src/adapters/memory/SqliteVecMemoryBackend.ts';",
      `const backend = new SqliteVecMemoryBackend({ dbPath: ${JSON.stringify(dbPath)} });`,
      "backend.write({ namespace: 'smoke', text: 'Strong memory encryption smoke record.', metadata: { source: 'smoke' } });",
      'backend.close();',
    ].join('\n'),
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  if (seed.status !== 0) {
    throw new Error(`seed failed: ${seed.stderr || seed.stdout}`);
  }

  const apply = run([
    'apply',
    '--json',
    '--db',
    dbPath,
    '--mode',
    'required',
    '--key',
    key,
    '--driver',
    driver,
  ]);
  if (apply.status !== 0) {
    throw new Error(`apply failed: ${apply.stderr || apply.stdout}`);
  }

  const status = run([
    'status',
    '--json',
    '--db',
    dbPath,
    '--mode',
    'required',
    '--key',
    key,
    '--driver',
    driver,
  ]);
  if (status.status !== 0) {
    throw new Error(`status failed: ${status.stderr || status.stdout}`);
  }
  const parsed = JSON.parse(status.stdout);
  if (!parsed.fullFileEncrypted || parsed.fullFileEncryptionStatus !== 'active' || parsed.fullFileEncryptionProof?.unkeyedOpenBlocked !== true) {
    throw new Error(`strong proof missing: ${JSON.stringify(parsed, null, 2)}`);
  }
  console.log('[zavorth-memory-encryption] strong SQLCipher smoke passed.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function run(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-memory-encryption.ts',
    ...args,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
}

function requireFromRoot(packageName) {
  const requirePath = path.join(root, 'node_modules', packageName);
  return require(requirePath);
}
