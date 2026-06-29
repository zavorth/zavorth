const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  shell,
} = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync, spawn } = require('node:child_process');

let mainWindow = null;
let runtimeProcess = null;
let lastEvents = [];
const trustedWorkspaceRoots = new Set();

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
    hostLockFile: path.join(runtimeDir, 'host-supervisor.lock.json'),
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

function readWindowsProcessCommandLine(pid) {
  if (process.platform !== 'win32' || !pid) {
    return '';
  }
  try {
    return String(execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`,
    ], { encoding: 'utf8', windowsHide: true, timeout: 3000 }) || '').trim();
  } catch {
    return '';
  }
}

function repairStaleHostLock() {
  const { hostLockFile } = resolveRuntimePaths();
  let lock = null;
  try {
    lock = JSON.parse(fs.readFileSync(hostLockFile, 'utf8'));
  } catch {
    return false;
  }
  const pid = Number(lock && lock.pid);
  if (!Number.isFinite(pid) || pid <= 0) {
    fs.rmSync(hostLockFile, { force: true });
    emitBootEvent('warn', 'Removed invalid Zavorth host lock.');
    return true;
  }
  try {
    process.kill(pid, 0);
  } catch {
    fs.rmSync(hostLockFile, { force: true });
    emitBootEvent('warn', `Removed stale Zavorth host lock for PID ${pid}.`);
    return true;
  }
  const commandLine = readWindowsProcessCommandLine(pid).toLowerCase();
  const looksLikeHost = commandLine.includes('src\\host.ts')
    || commandLine.includes('src/host.ts')
    || commandLine.includes('dist\\host.js')
    || commandLine.includes('dist/host.js')
    || commandLine.includes('bin\\zavorth.js')
    || commandLine.includes('bin/zavorth.js');
  const looksLikeDesktop = commandLine.includes('electron.exe')
    || commandLine.includes('apps\\zavorth-desktop')
    || commandLine.includes('apps/zavorth-desktop');
  if (!looksLikeHost || looksLikeDesktop) {
    fs.rmSync(hostLockFile, { force: true });
    emitBootEvent('warn', `Removed stale Zavorth host lock pointing at PID ${pid}.`);
    return true;
  }
  return false;
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
  fs.writeFileSync(tokenFile, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(tokenFile, 0o600);
  } catch {
    // Windows may ignore POSIX permissions; the token still stays in the local runtime directory.
  }
  return { token, source: 'generated' };
}

function buildRuntimeBaseUrl() {
  const rawHost = String(process.env.ZAVORTH_WEB_HOST || '127.0.0.1').trim();
  const host = rawHost && rawHost !== '0.0.0.0' ? rawHost : '127.0.0.1';
  const port = Number(process.env.ZAVORTH_WEB_PORT || process.env.PORT || 3000);
  return `http://${host}:${Number.isFinite(port) ? port : 3000}`;
}

function normalizeResolvedPath(value) {
  return path.resolve(String(value || '')).toLowerCase();
}

function rememberTrustedWorkspaceRoot(value) {
  const resolved = path.resolve(String(value || ''));
  trustedWorkspaceRoots.add(normalizeResolvedPath(resolved));
  return resolved;
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function isTrustedWorkspacePath(value) {
  const resolved = path.resolve(String(value || ''));
  const allowedRoots = [
    resolveRepoRoot(),
    resolveZavorthHome(),
    ...Array.from(trustedWorkspaceRoots),
  ].map(normalizeResolvedPath);
  const normalized = normalizeResolvedPath(resolved);
  return allowedRoots.some(root => isPathInside(root, normalized));
}

function validateRendererUrl(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const parsed = new URL(text);
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && localHosts.has(parsed.hostname)) {
    return parsed.toString();
  }
  throw new Error('ZAVORTH_DESKTOP_RENDERER_URL must point to localhost.');
}

function isAllowedNavigationUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol === 'file:') {
      return true;
    }
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
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

function readGoogleOAuthConfig() {
  const clientId = String(process.env.ZAVORTH_GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.ZAVORTH_GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth desktop client is not configured.');
  }
  return { clientId, clientSecret };
}

function exchangeGoogleOAuthCode(input) {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', input.code);
  body.set('client_id', input.clientId);
  body.set('client_secret', input.clientSecret);
  body.set('redirect_uri', input.redirectUri);
  return requestJson(new URL('https://oauth2.googleapis.com/token'), {
    method: 'POST',
    body: body.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeoutMs: 30000,
  });
}

async function loadGoogleAccountEmail(accessToken) {
  const result = await requestJson(new URL('https://openidconnect.googleapis.com/v1/userinfo'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    timeoutMs: 15000,
  });
  const email = result.ok && result.data && typeof result.data === 'object'
    ? String(result.data.email || '').trim()
    : '';
  return email || null;
}

function waitForGoogleOAuthCallback(input) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try {
        server.close();
      } catch {
        // Best effort close.
      }
      reject(new Error('Google authorization timed out.'));
    }, 180000);

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', input.redirectOrigin);
      if (url.pathname !== '/oauth/google/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const state = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      clearTimeout(timeout);
      server.close();
      if (error || state !== input.state || !code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Zavorth</h1><p>Google authorization was not completed.</p>');
        reject(new Error(error || 'Invalid Google authorization callback.'));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Zavorth</h1><p>Google account connected. You can close this tab.</p>');
      resolve(code);
    });

    server.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      input.onReady(port);
    });
  });
}

async function connectGooglePersonalOps() {
  const { clientId, clientSecret } = readGoogleOAuthConfig();
  const runtimeReady = await ensureRuntimeReadyForOAuth();
  if (!runtimeReady) {
    throw new Error('Local runtime is not reachable yet. Start Zavorth runtime and try Google again.');
  }
  const state = crypto.randomBytes(24).toString('base64url');
  let redirectUri = '';
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/tasks',
  ];
  const codePromise = waitForGoogleOAuthCallback({
    state,
    redirectOrigin: 'http://127.0.0.1',
    onReady: port => {
      redirectUri = `http://127.0.0.1:${port}/oauth/google/callback`;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('include_granted_scopes', 'true');
      authUrl.searchParams.set('prompt', 'consent');
      shell.openExternal(authUrl.toString()).catch(error => {
        emitBootEvent('error', `Could not open Google authorization: ${error.message}`);
      });
    },
  });

  emitBootEvent('info', 'Google authorization opened in your browser.');
  const code = await codePromise;
  const tokenResult = await exchangeGoogleOAuthCode({ code, clientId, clientSecret, redirectUri });
  if (!tokenResult.ok || !tokenResult.data || typeof tokenResult.data !== 'object') {
    throw new Error('Google token exchange failed.');
  }
  const accessToken = String(tokenResult.data.access_token || '').trim();
  const refreshToken = String(tokenResult.data.refresh_token || '').trim();
  const expiresIn = Number(tokenResult.data.expires_in || 0);
  if (!accessToken) {
    throw new Error('Google access token was not returned.');
  }
  const accountEmail = await loadGoogleAccountEmail(accessToken);
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;
  const connectorBase = {
    provider: 'google',
    accountEmail,
    label: accountEmail ? `Google ${accountEmail}` : 'Google account',
    accessToken,
    refreshToken,
    oauthToken: accessToken,
    scopes,
    expiresAt,
    approved: true,
  };
  const results = [];
  for (const kind of ['email', 'calendar', 'task']) {
    const connectorId = accountEmail
      ? `${kind}:${accountEmail.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
      : `${kind}:google`;
    const result = await desktopApiRequest({
      method: 'POST',
      path: '/api/experience/runtime-state/action',
      body: {
        type: 'register-personal-connector',
        surface: 'api',
        userId: 'desktop-user',
        source: 'zavorth-desktop-google-oauth',
        approved: true,
        payload: {
          personalConnector: {
            ...connectorBase,
            id: connectorId,
            kind,
            configured: true,
            enabled: true,
            status: 'configured',
          },
          metadata: {
            provider: 'google',
            accountEmailDomain: accountEmail && accountEmail.includes('@') ? accountEmail.split('@').pop() : null,
          },
        },
      },
      timeoutMs: 20000,
    });
    results.push({ kind, ok: result.ok, status: result.status, error: result.error || null });
  }
  const failed = results.filter(result => !result.ok);
  if (failed.length > 0) {
    throw new Error('Google account authorized, but Zavorth could not register every connector.');
  }
  emitBootEvent('info', 'Google Personal Ops account connected.');
  return {
    ok: true,
    provider: 'google',
    accountEmail,
    connectors: results.map(result => result.kind),
    message: 'Google account connected to Personal Ops.',
  };
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
        'X-Zavorth-Desktop-Bridge': '1',
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
    query: { surface: 'web' },
    timeoutMs: 900,
  });
  return Boolean(result.ok);
}

async function ensureRuntimeReadyForOAuth() {
  if (await probeRuntime()) {
    return true;
  }
  startZavorthRuntime();
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 750));
    if (await probeRuntime()) {
      return true;
    }
  }
  return false;
}

function nodeCommand() {
  const fromEnv = String(process.env.ZAVORTH_NODE_BINARY || process.env.npm_node_execpath || '').trim();
  if (fromEnv) {
    return fromEnv;
  }
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function runtimeCommand() {
  const paths = resolveRuntimePaths();
  const sourceHostBin = path.join(paths.repoRoot, 'src', 'host.ts');
  const hostBin = path.join(paths.repoRoot, 'dist', 'host.js');
  const tsxBin = path.join(paths.repoRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs');
  const node = nodeCommand();

  if (fs.existsSync(sourceHostBin) && fs.existsSync(tsxBin)) {
    return {
      command: node,
      args: ['--import', pathToFileURL(tsxBin).href, sourceHostBin],
      label: 'src/host.ts',
    };
  }

  if (fs.existsSync(hostBin)) {
    return {
      command: node,
      args: [hostBin],
      label: 'dist/host.js',
    };
  }

  if (fs.existsSync(paths.cliBin)) {
    return {
      command: node,
      args: [paths.cliBin, 'go'],
      label: 'bin/zavorth.js go',
    };
  }

  return {
    command: process.platform === 'win32' ? 'zavorth.cmd' : 'zavorth',
    args: ['go'],
    label: 'zavorth go',
  };
}

function startZavorthRuntime() {
  if (runtimeProcess && !runtimeProcess.killed) {
    emitBootEvent('info', 'Runtime is already starting.');
    return runtimeProcess;
  }

  const paths = resolveRuntimePaths();
  repairStaleHostLock();
  fs.mkdirSync(paths.logsDir, { recursive: true });
  const out = fs.openSync(path.join(paths.logsDir, 'zavorth-desktop-runtime.out.log'), 'a');
  const err = fs.openSync(path.join(paths.logsDir, 'zavorth-desktop-runtime.err.log'), 'a');
  const runtime = runtimeCommand();
  const access = resolveAccessToken({ generate: true });
  let logDescriptorsClosed = false;
  const closeLogDescriptors = () => {
    if (logDescriptorsClosed) {
      return;
    }
    logDescriptorsClosed = true;
    for (const descriptor of [out, err]) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Best effort cleanup for parent-side descriptors.
      }
    }
  };

  try {
    runtimeProcess = spawn(runtime.command, runtime.args, {
      cwd: paths.repoRoot,
      env: {
        ...process.env,
        ZAVORTH_NODE_BINARY: nodeCommand(),
        ZAVORTH_HOME: paths.zavorthHome,
        ZAVORTH_WEB_AUTH_TOKEN: access.token,
      },
      stdio: ['ignore', out, err],
      windowsHide: true,
    });
  } catch (error) {
    closeLogDescriptors();
    throw error;
  }
  closeLogDescriptors();

  runtimeProcess.once('exit', code => {
    closeLogDescriptors();
    emitBootEvent(code === 0 ? 'info' : 'warn', `Runtime process exited with code ${code ?? 'unknown'}.`);
    runtimeProcess = null;
  });
  runtimeProcess.once('error', error => {
    closeLogDescriptors();
    emitBootEvent('error', `Runtime could not start: ${error.message}`);
    runtimeProcess = null;
  });

  emitBootEvent('info', `Starting local runtime via ${runtime.label}.`);
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

  const rendererUrl = validateRendererUrl(process.env.ZAVORTH_DESKTOP_RENDERER_URL || '');
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
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigationUrl(url)) {
      return { action: 'allow' };
    }
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationUrl(url)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  void loadRenderer();
  mainWindow.webContents.openDevTools();
}

ipcMain.handle('zavorth:runtime:status', async () => runtimeStatus());
ipcMain.handle('zavorth:runtime:start', async () => {
  startZavorthRuntime();
  return runtimeStatus('Runtime launch requested.');
});
ipcMain.handle('zavorth:api:request', async (_event, input) => desktopApiRequest(input));
ipcMain.handle('zavorth:personal-ops:google-connect', async () => {
  try {
    return await connectGooglePersonalOps();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google authorization failed.';
    emitBootEvent('error', message);
    return {
      ok: false,
      provider: 'google',
      accountEmail: null,
      connectors: [],
      error: message,
    };
  }
});
ipcMain.handle('zavorth:workspace:select-folder', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { canceled: true, path: null, label: null };
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Zavorth workspace folder',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, path: null, label: null };
  }
  const selectedPath = path.resolve(result.filePaths[0]);
  rememberTrustedWorkspaceRoot(selectedPath);
  return {
    canceled: false,
    path: selectedPath,
    label: path.basename(selectedPath) || selectedPath,
  };
});
ipcMain.handle('zavorth:access:repair', async () => {
  resolveAccessToken({ generate: true });
  return runtimeStatus('Local access is ready.');
});
ipcMain.handle('zavorth:setup:start', async () => {
  const paths = resolveRuntimePaths();
  const command = fs.existsSync(paths.cliBin)
    ? `${nodeCommand()} "${paths.cliBin}" setup`
    : `${process.platform === 'win32' ? 'zavorth.cmd' : 'zavorth'} setup`;
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
  const openError = await shell.openPath(logsDir);
  return openError
    ? { ok: false, path: logsDir, error: openError }
    : { ok: true, path: logsDir };
});
ipcMain.handle('zavorth:boot:events', async () => lastEvents);

ipcMain.handle('zavorth:notification:send', async (_event, input) => {
  const title = String(input?.title || 'Zavorth').slice(0, 200);
  const body = String(input?.body || '').slice(0, 1000);
  const silent = Boolean(input?.silent);

  if (!Notification.isSupported()) {
    return { ok: false, error: 'Notifications not supported on this platform.' };
  }

  const notification = new Notification({
    title,
    body,
    silent,
    icon: path.join(__dirname, '..', 'dist', 'favicon.png'),
  });

  notification.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  notification.show();
  return { ok: true };
});

ipcMain.handle('zavorth:notification:permission', async () => {
  if (!Notification.isSupported()) return 'denied';
  return Notification.permission;
});

ipcMain.handle('zavorth:sessions:list', async () => {
  const result = await desktopApiRequest({
    method: 'GET',
    path: '/api/experience/sessions',
    timeoutMs: 8000,
  });
  if (!result.ok || !Array.isArray(result.data)) {
    return [];
  }
  return result.data.map((session) => ({
    id: String(session.id || session.sessionId || ''),
    label: String(session.label || session.name || session.id || 'Unnamed'),
    createdAt: String(session.createdAt || session.startedAt || ''),
    messageCount: Number(session.messageCount || session.turns || 0),
    surface: String(session.surface || ''),
    lastMessage: String(session.lastMessage || session.preview || ''),
  }));
});

ipcMain.handle('zavorth:sessions:switch', async (_event, sessionId) => {
  const result = await desktopApiRequest({
    method: 'POST',
    path: '/api/experience/sessions/switch',
    body: { sessionId: String(sessionId || '') },
    timeoutMs: 8000,
  });
  return result;
});

ipcMain.handle('zavorth:files:read-tree', async (_event, rootPath) => {
  const safePath = String(rootPath || '').trim();
  if (!safePath || /\.\./.test(safePath) || !path.isAbsolute(path.resolve(safePath))) {
    return { ok: false, error: 'Invalid path.' };
  }
  const resolvedRoot = path.resolve(safePath);
  if (!isTrustedWorkspacePath(resolvedRoot)) {
    return { ok: false, error: 'Folder is not trusted for desktop file browsing.' };
  }

  function readDir(dirPath, relativeTo, depth = 0) {
    if (depth > 8) return [];
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    return entries
      .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist')
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 200)
      .map((e) => {
        const fullPath = path.join(dirPath, e.name);
        const relativePath = path.relative(relativeTo, fullPath).replace(/\\/g, '/');
        if (e.isDirectory()) {
          return {
            name: e.name,
            relativePath,
            type: 'directory',
            children: readDir(fullPath, relativeTo, depth + 1),
          };
        }
        return {
          name: e.name,
          relativePath,
          type: 'file',
        };
      });
  }

  try {
    const tree = readDir(resolvedRoot, resolvedRoot);
    return { ok: true, tree };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to read directory.' };
  }
});

let kaelWindow = null;

function kaelOverlayUrl() {
  const rendererUrl = process.env.ZAVORTH_DESKTOP_RENDERER_URL || '';
  if (rendererUrl) {
    return `${rendererUrl}?win=overlay#/`;
  }
  return `${pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString()}?win=overlay#/`;
}

function spawnKaelWindow(bounds) {
  const isMac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: Math.max(80, Math.round(bounds?.width || 220)),
    height: Math.max(80, Math.round(bounds?.height || 220)),
    x: Number.isFinite(bounds?.x) ? Math.round(bounds.x) : undefined,
    y: Number.isFinite(bounds?.y) ? Math.round(bounds.y) : undefined,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: !isMac,
    hasShadow: false,
    alwaysOnTop: true,
    type: isMac ? 'panel' : undefined,
    hiddenInMissionControl: isMac,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver');
  win.setHiddenInMissionControl?.(true);
  try {
    win.setVisibleOnAllWorkspaces(true, isMac ? { visibleOnFullScreen: true, skipTransformProcessType: true } : undefined);
  } catch {}

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.showInactive();
  });

  win.on('closed', () => {
    if (kaelWindow === win) {
      kaelWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('zavorth:kael-overlay:control', { type: 'pop-in' });
    }
  });

  win.loadURL(kaelOverlayUrl());
  return win;
}

ipcMain.handle('zavorth:kael-overlay:open', async (_event, bounds) => {
  if (kaelWindow && !kaelWindow.isDestroyed()) {
    if (bounds) {
      kaelWindow.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.max(80, Math.round(bounds.width)),
        height: Math.max(80, Math.round(bounds.height))
      });
    }
    kaelWindow.showInactive();
    return { ok: true };
  }
  kaelWindow = spawnKaelWindow(bounds);
  return { ok: true };
});

ipcMain.handle('zavorth:kael-overlay:close', async () => {
  if (kaelWindow && !kaelWindow.isDestroyed()) {
    kaelWindow.close();
  }
  kaelWindow = null;
  return { ok: true };
});

ipcMain.on('zavorth:kael-overlay:set-bounds', (_event, bounds) => {
  if (kaelWindow && !kaelWindow.isDestroyed() && bounds) {
    kaelWindow.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.max(80, Math.round(bounds.width)),
      height: Math.max(80, Math.round(bounds.height))
    });
  }
});

ipcMain.on('zavorth:kael-overlay:ignore-mouse', (_event, ignore) => {
  if (kaelWindow && !kaelWindow.isDestroyed()) {
    kaelWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  }
});

ipcMain.on('zavorth:kael-overlay:set-focusable', (_event, focusable) => {
  if (kaelWindow && !kaelWindow.isDestroyed()) {
    kaelWindow.setFocusable(Boolean(focusable));
    if (focusable) {
      kaelWindow.focus();
    }
  }
});

ipcMain.on('zavorth:kael-overlay:state', (_event, payload) => {
  if (kaelWindow && !kaelWindow.isDestroyed()) {
    kaelWindow.webContents.send('zavorth:kael-overlay:state', payload);
  }
});

ipcMain.on('zavorth:kael-overlay:control', (_event, payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (payload?.type === 'toggle-main-window') {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
        mainWindow.focus();
      } else if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.minimize();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
      return;
    }
    mainWindow.webContents.send('zavorth:kael-overlay:control', payload);
  }
});


// Phase 4 - Auto-Updates and Multiple Windows IPC Handlers
ipcMain.handle('zavorth:check-updates', async () => {
  // Simulates check updates
  return {
    hasUpdate: false,
    version: app.getVersion(),
    latestVersion: app.getVersion(),
    changelog: 'Nenhuma atualização disponível no momento.'
  };
});

ipcMain.handle('zavorth:open-window', async () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: require('path').join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(require('path').join(__dirname, '../dist/index.html'));
  }
  return { ok: true };
});

// Deep link open-url listener
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    mainWindow.webContents.send('zavorth:deeplink', url);
  }
});

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
