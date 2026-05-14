#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const uiRoot = path.resolve(root, '..', 'Zavorth-Modern-UI');
const backendEntry = path.join(root, 'dist', 'nexus-server.js');
const isWindows = process.platform === 'win32';

function npmCommand(args, cwd) {
  return isWindows
    ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm', ...args], { cwd, stdio: 'inherit' })
    : spawn('npm', args, { cwd, stdio: 'inherit' });
}

function nodeCommand(args, cwd) {
  return spawn(process.execPath, args, { cwd, stdio: 'inherit' });
}

async function runBuildIfNeeded() {
  if (fs.existsSync(backendEntry)) {
    return;
  }

  await new Promise((resolve, reject) => {
    const child = npmCommand(['run', 'build'], root);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`build falhou com codigo ${code}`)));
    child.on('error', reject);
  });
}

await runBuildIfNeeded();

const children = [
  nodeCommand([backendEntry], root),
  npmCommand(['run', 'dev'], uiRoot),
];

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown();
      process.exit(code);
    }
  });
}
