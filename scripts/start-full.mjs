import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const hostScript = path.resolve(projectRoot, 'dist', 'host.js');

if (!fs.existsSync(hostScript)) {
  console.error('Nao encontrei dist/host.js. Rode "npm run build" antes de usar "npm run start:full".');
  process.exit(1);
}

const env = {
  ...process.env,
  LLM_PROVIDER: process.env.LLM_PROVIDER || 'AIGateway',
  AIGateway_SIDECAR_ENABLED: process.env.AIGateway_SIDECAR_ENABLED || 'true',
  ZAVORTH_BRIDGE_REMOTE_SIDECAR_ENABLED: process.env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_ENABLED || 'true',
};

console.log('===========================================');
console.log('  Zavorth Full Stack');
console.log('===========================================');
console.log(`Provider principal: ${env.LLM_PROVIDER}`);
console.log(`AIGateway sidecar: ${env.AIGateway_SIDECAR_ENABLED}`);
console.log(`ZavorthBridge remote sidecar: ${env.ZAVORTH_BRIDGE_REMOTE_SIDECAR_ENABLED}`);
if (!process.env.ZAVORTH_BRIDGE_REMOTE_APP_PASSWORD) {
  console.log('Aviso: ZAVORTH_BRIDGE_REMOTE_APP_PASSWORD nao definido; o valor padrao local sera usado.');
}
console.log('');

const child = spawn(process.execPath, [hostScript], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
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
  console.error(`Falha ao iniciar o host supervisionado: ${error.message}`);
  process.exit(1);
});
