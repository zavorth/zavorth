const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
} = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

let mainWindow = null;
let runtimeProcess = null;
let lastEvents = [];

function resolveRepoRoot() {
  const fromEnv = process.env.ZAVORTH_ROOT && path.resolve(process.env.ZAVORTH_ROOT);
  if (fromEnv && fs.existsSync(path.join(fromEnv, 'package.json'))) {
    return fromEnv;
  }

  const devRoot = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(devRoot, 'package.json'))) {
    return devRoot;
  }

  return process.resourcesPath || devRoot;
}

function resolveZavorthHome() {
  if (process.env.ZAVORTH_HOME) {
    return path.resolve(process.env.ZAVORTH_HOME);
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'Zavorth');
  }
  return path.join(os.homedir(), '.zavorth');
}

function resolveRuntimePaths() {
  const repoRoot = resolveRepoRoot();
  const runtimeDir = path.join(repoRoot, 'data', 'runtime');
  const logsDir = path.join(runtimeDir);
  return {
    repoRoot,
    zavorthHome: resolveZavorthHome(),
    runtimeDir,
    logsDir,
    tokenFile: process.env.ZAVORTH_WEB_AUTH_TOKEN_FILE || path.join(runtimeDir, 'web-api-token.txt'),
    cliBin: path.join(repoRoot, 'bin', 'zavorth.js'),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function emitBootEvent(type, message) {
  const event = { type, message, at: nowIso() };
  lastEvents = [event, ...lastEvents].slice(0, 30);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('zavorth:boot:event', event);
  }
}

function isWeakToken(value) {
  const text = String(value || '').trim();
  return text.length < 32 || /^(changeme|password|token|dev|test)$/iu.test(text);
}

function generateToken() {
  return crypto.randomBytes(36).toString('base64url');
}

function readTokenFile(tokenFile) {
  try {
    const value = fs.readFileSync(tokenFile, 'utf8').trim();
    return value && !isWeakToken(value) ? value : null;
  } catch {
    return null;
  }
}

function resolveAccessToken({ generate = false } = {}) {
  const { tokenFile } = resolveRuntimePaths();
  const envToken = String(process.env.ZAVORTH_WEB_AUTH_TOKEN || '').trim();
  if (envToken && !isWeakToken(envToken)) {
    return { token: envToken, source: 'env' };
  }

  const fileToken = readTokenFile(tokenFile);
  if (fileToken) {
    return { token: fileToken, source: 'file' };
  }

  if (!generate) {
    return { token: '', source: 'missing' };
  }

  const token = generateToken();
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
  fs.writeFileSync(tokenFile, `${token}\n`, 'utf8');
  return { token, source: 'generated' };
}

function buildRuntimeBaseUrl() {
  const rawHost = String(process.env.ZAVORTH_WEB_HOST || '127.0.0.1').trim();
  const host = rawHost && rawHost !== '0.0.0.0' ? rawHost : '127.0.0.1';
  const port = Number(process.env.ZAVORTH_WEB_PORT || process.env.PORT || 3000);
  return `http://${host}:${Number.isFinite(port) ? port : 3000}`;
}

function sanitizeApiPath(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('/api/')) {
    throw new Error('Only local Zavorth API paths are allowed.');
  }
  if (/^[a-z][a-z\d+.-]*:/iu.test(text) || text.includes('\\') || text.includes('..')) {
    throw new Error('Unsafe local API path.');
  }
  return text;
}

function buildLocalApiUrl(pathname, query) {
  const url = new URL(sanitizeApiPath(pathname), buildRuntimeBaseUrl());
  if (query && typeof query === 'object' && !Array.isArray(query)) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function requestJson(url, options) {
  const transport = url.protocol === 'https:' ? https : http;
  const method = options.method || 'GET';
  const headers = options.headers || {};
  const body = options.body || null;
  const timeoutMs = options.timeoutMs || 12000;

  return new Promise(resolve => {
    const req = transport.request(url, { method, headers }, res => {
      const chunks = [];
      let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) {
          req.destroy(new Error('Local API response is too large.'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = text;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        resolve({
          ok: Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
          status: res.statusCode || 0,
          data,
          error: res.statusCode && res.statusCode >= 400 ? `Local API returned ${res.statusCode}.` : '',
        });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Local API request timed out.'));
    });
    req.on('error', error => {
      resolve({
        ok: false,
        status: 0,
        data: null,
        error: error.message || 'Local API request failed.',
      });
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function desktopApiRequest(input = {}) {
  const method = String(input.method || 'GET').toUpperCase();
  const body = input.body === undefined ? null : JSON.stringify(input.body);
  const access = resolveAccessToken({ generate: true });
  if (!access.token) {
    return {
      ok: false,
      status: 401,
      data: null,
      error: 'Local access token is not ready.',
    };
  }

  try {
    const url = buildLocalApiUrl(input.path || '/api/experience/home', input.query);
    return await requestJson(url, {
      method,
      body,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${access.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      timeoutMs: Number(input.timeoutMs || 12000),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : 'Local API request failed.',
    };
  }
}

async function probeRuntime() {
  const result = await desktopApiRequest({
    method: 'GET',
    path: '/api/experience/home',
    query: { surface: 'desktop' },
    timeoutMs: 900,
  });
  return Boolean(result.ok);
}

function cliCommand() {
  const { cliBin } = resolveRuntimePaths();
  if (fs.existsSync(cliBin)) {
    return { command: process.execPath, args: [cliBin] };
  }
  return { command: process.platform === 'win32' ? 'zavorth.cmd' : 'zavorth', args: [] };
}

function startZavorthRuntime() {
  if (runtimeProcess && !runtimeProcess.killed) {
    emitBootEvent('info', 'Runtime is already starting.');
    return runtimeProcess;
  }

  const paths = resolveRuntimePaths();
  fs.mkdirSync(paths.logsDir, { recursive: true });
  const out = fs.openSync(path.join(paths.logsDir, 'zavorth-desktop-runtime.out.log'), 'a');
  const err = fs.openSync(path.join(paths.logsDir, 'zavorth-desktop-runtime.err.log'), 'a');
  const cli = cliCommand();
  const access = resolveAccessToken({ generate: true });

  runtimeProcess = spawn(cli.command, [...cli.args, 'go'], {
    cwd: paths.repoRoot,
    env: {
      ...process.env,
      ZAVORTH_HOME: paths.zavorthHome,
      ZAVORTH_WEB_AUTH_TOKEN: access.token,
    },
    stdio: ['ignore', out, err],
    windowsHide: true,
  });

  runtimeProcess.once('exit', code => {
    emitBootEvent(code === 0 ? 'info' : 'warn', `Runtime process exited with code ${code ?? 'unknown'}.`);
    runtimeProcess = null;
  });
  runtimeProcess.once('error', error => {
    emitBootEvent('error', `Runtime could not start: ${error.message}`);
    runtimeProcess = null;
  });

  emitBootEvent('info', 'Starting local runtime.');
  return runtimeProcess;
}

async function runtimeStatus(message = '') {
  const access = resolveAccessToken({ generate: true });
  const running = await probeRuntime();
  return {
    ok: Boolean(access.token),
    running,
    baseUrl: buildRuntimeBaseUrl(),
    tokenReady: Boolean(access.token),
    tokenSource: access.source,
    runtimePid: runtimeProcess?.pid || null,
    message: message || (running ? 'Local runtime is reachable.' : 'Local runtime is not reachable yet.'),
  };
}

async function loadRenderer() {
  if (!mainWindow) {
    return;
  }

  const rendererUrl = process.env.ZAVORTH_DESKTOP_RENDERER_URL || '';
  if (rendererUrl) {
    await mainWindow.loadURL(rendererUrl);
    return;
  }

  const html = path.join(__dirname, '..', 'dist', 'index.html');
  await mainWindow.loadFile(html);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: '#08090c',
    title: 'Zavorth',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  void loadRenderer();
}

ipcMain.handle('zavorth:runtime:status', async () => runtimeStatus());
ipcMain.handle('zavorth:runtime:start', async () => {
  startZavorthRuntime();
  return runtimeStatus('Runtime launch requested.');
});
ipcMain.handle('zavorth:api:request', async (_event, input) => desktopApiRequest(input));
ipcMain.handle('zavorth:access:repair', async () => {
  resolveAccessToken({ generate: true });
  return runtimeStatus('Local access is ready.');
});
ipcMain.handle('zavorth:setup:start', async () => {
  const cli = cliCommand();
  const command = `${cli.command} ${[...cli.args, 'setup'].join(' ')}`.trim();
  emitBootEvent('info', 'Setup can be opened from the terminal command.');
  return {
    ok: true,
    command,
    message: 'Run this command in a terminal for the guided setup.',
  };
});
ipcMain.handle('zavorth:logs:open', async () => {
  const { logsDir } = resolveRuntimePaths();
  fs.mkdirSync(logsDir, { recursive: true });
  await shell.openPath(logsDir);
  return { ok: true, path: logsDir };
});
ipcMain.handle('zavorth:boot:events', async () => lastEvents);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
