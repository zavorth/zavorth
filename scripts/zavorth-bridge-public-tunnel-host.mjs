import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length ? 1) {
    return fallback;
  }
  return String(process.argv[index + 1] || '').trim();
}

const cliPath = readArg('--cli-path', 'cloudflared');
const targetUrl = readArg('--target-url');
const stateFile = readArg('--state-file');
const logFile = readArg('--log-file');

if (!targetUrl || !stateFile || !logFile) {
  throw new Error('usage: node zavorth-bridge-public-tunnel-host.mjs --cli-path <bin> --target-url <url> --state-file <file> --log-file <file>');
}

if (!isLoopbackHttpUrl(targetUrl)) {
  throw new Error('The target URL for the public tunnel must be local HTTP.');
}

fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.mkdirSync(path.dirname(logFile), { recursive: true });

function writeLog(line) {
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`, 'utf8');
}

function writeState(partial) {
  const current = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    : {};
  const next = {
    ...current,
    enabled: true,
    running: true,
    ready: false,
    pid: process.pid,
    tunnelPid: null,
    cliPath,
    hostScriptPath: path.resolve(process.argv[1] || ''),
    publicUrl: null,
    targetUrl,
    checkedAt: new Date().toISOString(),
    message: 'Starting public tunnel for ZavorthBridge.',
    stateFile,
    logFile,
    ...partial,
    checkedAt: new Date().toISOString(),
  };
  fs.writeFileSync(stateFile, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

let shuttingDown = false;
const child = spawn(cliPath, ['tunnel', '--url', targetUrl, '--no-autoupdate'], {
  cwd: process.cwd(),
  env: buildTunnelChildEnv(),
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
});

writeState({
  running: true,
  ready: false,
  tunnelPid: child.pid ?? null,
  message: 'Cloudflared iniciado; waiting for URL public do ZavorthBridge.',
});

const tryCloudflarePattern = /(https:\/\/[a-z0-9.-]+\.trycloudflare\.com)/i;

function consumeChunk(chunk, stream) {
  const text = String(chunk || '');
  if (!text) {
    return;
  }
  for (const rawLine of text.split(/\r...\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    writeLog(`[${stream}] ${line}`);
    const match = line.match(tryCloudflarePattern);
    if (match?.[1]) {
      writeState({
        running: true,
        ready: true,
        publicUrl: match[1],
        tunnelPid: child.pid ?? null,
        message: `Public tunnel for ZavorthBridge ready at ${match[1]}.`,
      });
    }
  }
}

child.stdout?.on('data', (chunk) => consumeChunk(chunk, 'stdout'));
child.stderr?.on('data', (chunk) => consumeChunk(chunk, 'stderr'));
child.on('error', (error) => {
  writeLog(`[host-error] ${error?.message || error}`);
  writeState({
    running: false,
    ready: false,
    tunnelPid: null,
    publicUrl: null,
    message: `Failure ao iniciar cloudflared: ${error?.message || error}.`,
  });
});

child.on('exit', (code, signal) => {
  writeLog(`[host-exit] code=${code ?? 'null'} signal=${signal ?? 'null'}`);
  writeState({
    running: false,
    ready: false,
    tunnelPid: null,
    publicUrl: null,
    message: shuttingDown ? 'Public tunnel for ZavorthBridge closed.'
      : `Cloudflared saiu before estabilizar (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`,
  });
  process.exit(typeof code === 'number' ? code : 0);
});

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  if (child.pid) {
    try {
      process.kill(child.pid);
    } catch {
      // Ignore stale child processes.
    }
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function isLoopbackHttpUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === 'http:' && (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

function buildTunnelChildEnv() {
  const allowedNames = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'HOME', 'USERPROFILE', 'TMP', 'TEMP'];
  const env = {};
  for (const name of allowedNames) {
    if (process.env[name]) {
      env[name] = process.env[name];
    }
  }
  return env;
}
