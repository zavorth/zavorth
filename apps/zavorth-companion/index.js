const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const distEntry = path.join(repoRoot, 'dist', 'companion.js');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function ensureBuild() {
  if (fs.existsSync(distEntry)) {
    return;
  }
  console.log('--- Zavorth Desktop Companion ---');
  console.log('Build missing. Compiling the companion before starting...');
  const result = spawnSync(npmCommand, ['run', 'build', '--silent'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0 || !fs.existsSync(distEntry)) {
    process.exit(result.status || 1);
  }
}

function run() {
  ensureBuild();
  console.log('--- Zavorth Desktop Companion ---');
  console.log('Iniciando daemon real do companion e conectando ao Node Mesh...');

  const child = spawn(process.execPath, [distEntry, ...process.argv.slice(2)], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });
  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
}

run();
