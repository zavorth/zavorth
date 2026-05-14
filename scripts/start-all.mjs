import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import {
  buildZavorthBridgeArgs,
  formatZavorthBridgeLaunchSummary,
  launchZavorthBridgeDetached,
  resolveZavorthBridgeLaunchConfig,
} from './zavorth-bridge-launch.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const startFullScript = path.resolve(projectRoot, 'scripts', 'start-full.mjs');

if (!fs.existsSync(startFullScript)) {
  console.error('Nao encontrei scripts/start-full.mjs.');
  process.exit(1);
}

const config = resolveZavorthBridgeLaunchConfig(projectRoot);
const args = buildZavorthBridgeArgs(config);
const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  console.log(formatZavorthBridgeLaunchSummary(config, args));
  console.log('');
  console.log(`Apos ${config.zavorthStartDelayMs}ms, o script iniciaria: node scripts/start-full.mjs`);
  process.exit(0);
}

const { pid } = launchZavorthBridgeDetached(config);

console.log(formatZavorthBridgeLaunchSummary(config, args, pid));
console.log('');
console.log(`Aguardando ${config.zavorthStartDelayMs}ms para subir o stack do Zavorth...`);

await new Promise((resolve) => setTimeout(resolve, config.zavorthStartDelayMs));

const child = spawn(process.execPath, [startFullScript], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(`Falha ao iniciar o stack completo: ${error.message}`);
  process.exit(1);
});
