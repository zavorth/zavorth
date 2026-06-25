import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const runtimeDir = path.resolve(projectRoot, 'data', 'runtime');
const envFile = path.resolve(projectRoot, '.env');

const envMap = {};
if (fs.existsSync(envFile)) {
  for (const rawLine of fs.readFileSync(envFile, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      envMap[key] = value;
    }
  }
}

const envBoolean = (key, fallback = false) => {
  const rawValue = (process.env[key] ?? envMap[key] ?? '').toString().trim().toLowerCase();
  if (!rawValue) {
    return fallback;
  }
  return !['0', 'false', 'off', 'no'].includes(rawValue);
};

const readJson = (fileNames, fallback) => {
  for (const fileName of Array.isArray(fileNames) ? fileNames : [fileNames]) {
    const target = path.resolve(runtimeDir, fileName);
    try {
      if (!fs.existsSync(target)) {
        continue;
      }
      return { ...fallback, ...JSON.parse(fs.readFileSync(target, 'utf8')) };
    } catch {
      // try next candidate
    }
  }
  return fallback;
};

const aiGatewaySidecar = readJson(['AIGateway-sidecar.json', 'ai-gateway-sidecar.json'], {
  enabled: envBoolean('AIGateway_SIDECAR_ENABLED', false),
  running: false,
  ready: false,
  baseUrl: 'http://127.0.0.1:20128/v1',
  message: 'Sem status salvo ainda.',
});

const aiGatewayGateway = readJson('zavorth-control-last.json', {
  enabled: envBoolean('ZAVORTH_AIGateway_GATEWAY_ENABLED', false),
  running: false,
  ready: false,
  baseUrl: 'http://127.0.0.1:21128/v1',
  upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
  message: 'Sem status salvo ainda.',
});

const aiGateway = {
  ...aiGatewaySidecar,
  enabled: Boolean(aiGatewaySidecar.enabled || aiGatewayGateway.enabled),
  running: Boolean(aiGatewaySidecar.running || aiGatewayGateway.running),
  ready: aiGatewayGateway.enabled
    ? Boolean(aiGatewayGateway.ready && (!aiGatewaySidecar.enabled || aiGatewaySidecar.ready))
    : Boolean(aiGatewaySidecar.ready),
  baseUrl: aiGatewayGateway.baseUrl || aiGatewaySidecar.baseUrl,
  localUrl: aiGatewaySidecar.upstreamBaseUrl || aiGatewayGateway.upstreamBaseUrl || aiGatewaySidecar.baseUrl,
  pid: aiGatewaySidecar.pid || aiGatewayGateway.pid || null,
  message: aiGatewayGateway.enabled
    ? (aiGatewayGateway.ready
        ? (aiGatewaySidecar.enabled
            ? 'Gateway proprio do AIGateway pronto sobre upstream supervisionado.'
            : 'Gateway proprio do AIGateway pronto em modo gateway-only.')
        : aiGatewayGateway.message)
    : aiGatewaySidecar.message,
};

const zavorthTerminal = readJson('zavorth-terminal-sidecar.json', {
  enabled: envBoolean('ZAVORTH_BRIDGE_REMOTE_SIDECAR_ENABLED', envBoolean('ZAVORTH_BRIDGE_AUTOMATION_ENABLED', false)),
  running: false,
  ready: false,
  baseUrl: 'http://127.0.0.1:4747',
  localUrl: 'http://127.0.0.1:4747',
  message: 'Sem status salvo ainda.',
});

const runtimeShellSidecar = readJson('sidecar-docker-bootstrap-last.json', {
  ready: false,
  docker: {
    enabled: envBoolean('ZAVORTH_DOCKER_SANDBOX_ENABLED', true),
    canRun: false,
    detail: 'Bootstrap Docker de sidecars ainda nao foi executado.',
  },
  firecracker: {
    enabled: envBoolean('ZAVORTH_FIRECRACKER_ENABLED', false),
    canRun: false,
    detail: 'Bootstrap MicroVM ainda nao foi executado.',
  },
  nextSafeAction: 'Rode npm run sidecars:bootstrap -- --pull para preparar imagens Docker aprovadas.',
});

const browserSidecar = readJson('browser-sidecar.json', {
  enabled: Boolean(process.env.ZAVORTH_BROWSER_SIDECAR_URL || envMap.ZAVORTH_BROWSER_SIDECAR_URL),
  running: false,
  ready: false,
  baseUrl: process.env.ZAVORTH_BROWSER_SIDECAR_URL || envMap.ZAVORTH_BROWSER_SIDECAR_URL || 'http://127.0.0.1:35791',
  localUrl: process.env.ZAVORTH_BROWSER_SIDECAR_URL || envMap.ZAVORTH_BROWSER_SIDECAR_URL || 'http://127.0.0.1:35791',
  message: 'Browser sidecar sem status salvo nesta sessao.',
});

const readPortFromUrl = (rawUrl, fallbackPort) => {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
    return Number.isFinite(port) && port > 0 ? port : fallbackPort;
  } catch {
    return fallbackPort;
  }
};

const isPortListening = (port, host = '127.0.0.1') => {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    let settled = false;
    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(1000);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
  });
};

const capture = (command, argsList) => {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [command, ...argsList].join(' ')],
          {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            encoding: 'utf8',
          },
        )
      : spawnSync(command, argsList, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          encoding: 'utf8',
        });
  if (result.status !== 0) {
    return '';
  }
  return String(result.stdout || '').trim();
};

const getListeningPidWindows = (port) => {
  const output = capture('netstat', ['-ano', '-p', 'tcp']);
  if (!output) {
    return null;
  }

  const lines = output.split(/\r?\n/u);
  for (const line of lines) {
    if (!line.includes(`:${port}`) || !/\bLISTENING\b/i.test(line)) {
      continue;
    }
    const parts = line.trim().split(/\s+/u);
    const pid = Number(parts[parts.length - 1]);
    if (Number.isFinite(pid) && pid > 0) {
      return pid;
    }
  }
  return null;
};

const getListeningPid = (port) => {
  if (process.platform === 'win32') {
    return getListeningPidWindows(port);
  }
  const output = capture('bash', ['-lc', `lsof -ti tcp:${port} -sTCP:LISTEN | head -n 1`]);
  const pid = Number(output);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
};

const describe = async (snapshot, primaryUrl, fallbackPort) => {
  const port = readPortFromUrl(primaryUrl, fallbackPort);
  const portPid = getListeningPid(port);
  const livePort = await isPortListening(port).catch(() => false);
  if (snapshot.pid && !isProcessAlive(snapshot.pid)) {
    return 'offline | O ultimo processo registrado nao esta mais ativo.';
  }
  if (!snapshot.enabled) {
    return `desativado | ${snapshot.message}`;
  }
  if (snapshot.pid && isProcessAlive(snapshot.pid) && snapshot.ready) {
    return `pronto | ${primaryUrl}`;
  }
  if (snapshot.pid && isProcessAlive(snapshot.pid) && (snapshot.running || snapshot.ready)) {
    return `subindo | ${primaryUrl}`;
  }
  if (portPid && snapshot.pid && portPid === Number(snapshot.pid) && snapshot.ready) {
    return `pronto | ${primaryUrl}`;
  }
  if (portPid && livePort) {
    return `indefinido | porta ${port} ocupada por PID ${portPid}, sem ownership confirmado do Zavorth.`;
  }
  if ((snapshot.running || snapshot.ready) && !livePort) {
    return `offline | O ultimo snapshot indicava atividade, mas a porta ${port} nao responde mais.`;
  }
  return `offline | ${snapshot.message}`;
};

const isProcessAlive = (pid) => {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
};

console.log('Sidecars do Zavorth');
console.log('');
console.log(`AI Gateway: ${await describe(aiGateway, aiGateway.baseUrl, 21128)}`);
console.log(`Zavorth Terminal: ${await describe(zavorthTerminal, zavorthTerminal.localUrl || zavorthTerminal.baseUrl, 4747)}`);
console.log(`Runtime Shell Sidecar: ${runtimeShellSidecar.ready || runtimeShellSidecar.docker?.canRun || runtimeShellSidecar.firecracker?.canRun ? 'pronto' : 'atencao'} | ${runtimeShellSidecar.nextSafeAction || runtimeShellSidecar.docker?.detail || runtimeShellSidecar.firecracker?.detail}`);
console.log(`Browser Sidecar: ${await describe(browserSidecar, browserSidecar.localUrl || browserSidecar.baseUrl, 35791)}`);
