#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const IMAGE = process.env.MNEMOS_DOCKER_IMAGE || 'mnemos-cognitive-engine:latest';

function splitScanDirs(value) {
  return String(value || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveDir(value, fallback) {
  const raw = String(value || '').trim() || fallback;
  return path.resolve(raw);
}

export function buildDockerArgs(env = process.env) {
  const vaultDir = resolveDir(env.MNEMOS_VAULT_DIR, path.join(process.cwd(), 'data', 'mnemos_vault'));
  const dbDir = resolveDir(env.MNEMOS_DB_DIR, path.join(process.cwd(), 'data', 'mnemos_db'));
  const scanDirs = splitScanDirs(env.MNEMOS_SCAN_DIRS);
  const args = [
    'run',
    '--rm',
    '-i',
    '--network',
    'none',
    '--name',
    env.MNEMOS_CONTAINER_NAME || 'mnemos-mcp',
    '-v',
    `${vaultDir}:/app/data/vault`,
    '-v',
    `${dbDir}:/app/data/vector_db`,
    '-e',
    `MNEMOS_EMBEDDING_MODEL=${env.MNEMOS_EMBEDDING_MODEL || 'all-MiniLM-L6-v2'}`,
    '-e',
    `MNEMOS_MAX_SCAN_DEPTH=${env.MNEMOS_MAX_SCAN_DEPTH || '5'}`,
    '-e',
    `MNEMOS_MAX_RESULTS=${env.MNEMOS_MAX_RESULTS || '10'}`,
    '-e',
    'MNEMOS_SCAN_VOLUMES=/scan_volumes',
    '-e',
    'HF_HUB_OFFLINE=1',
    '-e',
    'TRANSFORMERS_OFFLINE=1',
  ];

  scanDirs.forEach((scanDir, index) => {
    args.push('-v', `${path.resolve(scanDir)}:/scan_volumes/${index}:ro`);
  });

  args.push(IMAGE, 'python', 'server.py');
  return {
    command: 'docker',
    args,
    vaultDir,
    dbDir,
    scanDirs: scanDirs.map((entry) => path.resolve(entry)),
  };
}

function ensureWritableDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const plan = buildDockerArgs();
  if (process.argv.includes('--print-args')) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  ensureWritableDir(plan.vaultDir);
  ensureWritableDir(plan.dbDir);

  const child = spawn(plan.command, plan.args, {
    stdio: ['inherit', 'inherit', 'inherit'],
    windowsHide: true,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    process.stderr.write(`[mnemos-launcher] ${error.message}\n`);
    process.exit(1);
  });
}

main();
