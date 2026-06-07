const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
} = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
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

function publicDashboardUrl() {
  const host = process.env.ZAVORTH_WEB_HOST && process.env.ZAVORTH_WEB_HOST !== '0.0.0.0'
    ? process.env.ZAVORTH_WEB_HOST
    : '127.0.0.1';
  const port = Number(process.env.ZAVORTH_WEB_PORT || process.env.PORT || 3000);
  return `http://${host}:${Number.isFinite(port) ? port : 3000}/dashboard`;
}

function buildDashboardUrl() {
  const access = resolveAccessToken({ generate: true });
  const publicUrl = publicDashboardUrl();
  return {
    publicUrl,
    dashboardUrl: `${publicUrl}#token=${encodeURIComponent(access.token)}`,
    tokenSource: access.source,
    tokenReady: Boolean(access.token),
  };
}

function probeDashboard(publicUrl) {
  return new Promise(resolve => {
    const req = http.get(publicUrl, res => {
      res.resume();
      resolve(res.statusCode ? res.statusCode < 500 : false);
    });
    req.setTimeout(900, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
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
  const url = buildDashboardUrl();
  const running = await probeDashboard(url.publicUrl);
  return {
    ok: Boolean(url.tokenReady),
    running,
    dashboardUrl: url.dashboardUrl,
    publicUrl: url.publicUrl,
    tokenReady: url.tokenReady,
    tokenSource: url.tokenSource,
    runtimePid: runtimeProcess?.pid || null,
    message: message || (running ? 'Local dashboard is reachable.' : 'Local dashboard is not reachable yet.'),
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
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: '#07080a',
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
ipcMain.handle('zavorth:dashboard:open', async () => {
  const before = await runtimeStatus();
  if (!before.running) {
    startZavorthRuntime();
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  const next = await runtimeStatus('Opening local chat.');
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadURL(next.dashboardUrl);
  }
  return next;
});
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
