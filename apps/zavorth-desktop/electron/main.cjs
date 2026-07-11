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
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync, spawn } = require('node:child_process');
const {
  buildRuntimeBaseUrl,
  resolveAccessToken,
  resolveRepoRoot,
  resolveRuntimePaths,
  resolveZavorthHome,
} = require('./runtime-access.cjs');
const {
  sanitizeApiPath,
  isAllowedNavigationUrl,
  isAllowedExternalUrl,
  validateRendererUrl,
} = require('./api-path.cjs');
const desktopUpdates = require('./desktop-updates.cjs');
const {
  buildAutomationHistoryLogs,
  createAutomationSweepRunner,
  createDesktopAutomationStore,
} = require('./desktop-automations.cjs');
const {
  getCodeBridgeSummary,
  startCodeBridgeHeartbeat,
  stopCodeBridgeHeartbeat,
} = require('./code-bridge.cjs');

let mainWindow = null;
let runtimeProcess = null;
let lastEvents = [];
let desktopAutomationStore = null;
let desktopAutomationTimer = null;
const trustedWorkspaceRoots = new Set();

/** App renderer dist root — only file: navigation under this path is allowed. */
function getAllowedFileNavigationRoots() {
  return [path.join(__dirname, '..', 'dist')];
}

function navigationUrlAllowed(url) {
  return isAllowedNavigationUrl(url, { allowedFileRoots: getAllowedFileNavigationRoots() });
}

/**
 * Open only http(s)/mailto URLs in the system browser.
 * Silently no-ops for file:, javascript:, custom schemes, etc.
 */
function openExternalSafe(url) {
  if (!isAllowedExternalUrl(url)) {
    return Promise.resolve();
  }
  return shell.openExternal(String(url));
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
      openExternalSafe(authUrl.toString()).catch(error => {
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

function getDesktopAutomationStore() {
  if (!desktopAutomationStore) {
    desktopAutomationStore = createDesktopAutomationStore({
      filePath: path.join(app.getPath('userData'), 'automations.json'),
    });
    desktopAutomationStore.recoverRunningTasks();
  }
  return desktopAutomationStore;
}

function emitAutomationUpdate() {
  const tasks = getDesktopAutomationStore().listTasks();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('zavorth:automations:updated', tasks);
  }
  return tasks;
}

async function runDesktopAutomationTask(taskId) {
  const store = getDesktopAutomationStore();
  const task = store.listTasks().find(item => item.id === String(taskId || ''));
  if (!task) return { ok: false, error: 'Automação não encontrada.' };
  if (task.status === 'running') return { ok: false, error: 'Esta automação já está em execução.' };

  const sessionId = `automation-${task.id}-${Date.now().toString(36)}`;
  store.markRunning(task.id, sessionId);
  emitAutomationUpdate();

  const result = await desktopApiRequest({
    method: 'POST',
    path: '/api/experience/ask',
    body: {
      text: task.prompt,
      sessionId,
      surface: 'api',
      userId: 'desktop-automation',
      responseProfile: task.profile,
      model: task.model,
      metadata: {
        client: 'zavorth-desktop',
        source: 'desktop-automation',
        automationId: task.id,
        automationName: task.name,
        project: task.project,
        effort: task.effort,
        profile: task.profile,
        model: task.model,
        workspace: task.workspace,
      },
    },
    timeoutMs: 120000,
  });

  const payload = result.data && typeof result.data === 'object' ? result.data : {};
  const message = result.ok
    ? String(payload.error || payload.message || 'Execução concluída pelo runtime Zavorth.')
    : String(result.error || 'O runtime Zavorth não concluiu a automação.');
  const completed = store.markCompleted(task.id, {
    ok: result.ok && !payload.error,
    sessionId: String(payload.sessionId || sessionId),
    message,
  });
  emitAutomationUpdate();
  return { ok: Boolean(result.ok && !payload.error), task: completed, sessionId, error: result.ok ? '' : message };
}

const runDueDesktopAutomations = createAutomationSweepRunner({
  getDueTasks: () => getDesktopAutomationStore().getDueTasks(),
  runTask: taskId => runDesktopAutomationTask(taskId),
});

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
  const standaloneName = process.platform === 'win32' ? 'zavorth.exe' : 'zavorth';
  const standaloneCandidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'dist-standalone', standaloneName) : null,
    path.join(paths.repoRoot, 'dist-standalone', standaloneName),
  ].filter(Boolean);

  for (const candidate of standaloneCandidates) {
    if (fs.existsSync(candidate)) {
      return {
        command: candidate,
        args: ['go'],
        label: `dist-standalone/${standaloneName}`,
      };
    }
  }

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
    if (navigationUrlAllowed(url)) {
      return { action: 'allow' };
    }
    // External handoff: http(s)/mailto only — never file:/javascript:/custom schemes
    void openExternalSafe(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!navigationUrlAllowed(url)) {
      event.preventDefault();
      void openExternalSafe(url).catch(() => {});
    }
  });

  void loadRenderer();
  if (process.env.ZAVORTH_DESKTOP_RENDERER_URL) {
    mainWindow.webContents.openDevTools();
  }
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
async function launchGuidedSetup(extra = {}) {
  const paths = resolveRuntimePaths();
  const command = fs.existsSync(paths.cliBin)
    ? `${nodeCommand()} "${paths.cliBin}" setup`
    : `${process.platform === 'win32' ? 'zavorth.cmd' : 'zavorth'} setup`;

  // Prefer opening a real terminal/console with the setup command when possible.
  let launched = false;
  try {
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', command], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();
      launched = true;
    } else if (process.platform === 'darwin') {
      const child = spawn('osascript', [
        '-e',
        `tell application "Terminal" to do script ${JSON.stringify(command)}`,
      ], { detached: true, stdio: 'ignore' });
      child.unref();
      launched = true;
    } else {
      const child = spawn('x-terminal-emulator', ['-e', 'bash', '-lc', `${command}; exec bash`], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      launched = true;
    }
  } catch {
    launched = false;
  }

  // If a package download URL exists for this install path, also surface it.
  if (extra?.downloadUrl) {
    try {
      await openExternalSafe(String(extra.downloadUrl));
    } catch {
      // ignore external open failures
    }
  }

  emitBootEvent('info', launched
    ? `Setup launched in a terminal: ${command}`
    : `Setup command ready: ${command}`);

  return {
    ok: true,
    command,
    launched,
    latestVersion: extra?.latestVersion || null,
    message: launched
      ? (extra?.latestVersion
        ? `Setup opened to install ${extra.latestVersion}. Terminal command: ${command}`
        : `Setup opened in a terminal. Command: ${command}`)
      : `Run this command in a terminal for the guided setup: ${command}`,
  };
}

ipcMain.handle('zavorth:setup:start', async () => launchGuidedSetup());
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

ipcMain.handle('zavorth:sessions:create', async (_event, input = {}) => {
  const sessionId = String(input.sessionId || '').trim()
    || `desktop-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const label = String(input.label || 'New Chat').trim() || 'New Chat';
  const surface = String(input.surface || input.workspaceId || 'desktop').trim() || 'desktop';
  const workspaceId = input.workspaceId ? String(input.workspaceId) : null;

  const createResult = await desktopApiRequest({
    method: 'POST',
    path: '/api/experience/sessions',
    body: { sessionId, label, surface, workspaceId },
    timeoutMs: 12000,
  });

  if (createResult.ok) {
    const data = createResult.data && typeof createResult.data === 'object' ? createResult.data : {};
    return {
      ok: true,
      status: createResult.status,
      data: {
        sessionId: String(data.sessionId || data.id || sessionId),
        label: String(data.label || data.name || label),
        surface: String(data.surface || surface),
      },
      error: '',
    };
  }

  // Lazy-create fallback when runtime only supports switch/home.
  const switchResult = await desktopApiRequest({
    method: 'POST',
    path: '/api/experience/sessions/switch',
    body: { sessionId, label, surface },
    timeoutMs: 8000,
  });

  return {
    ok: true,
    status: switchResult.ok ? switchResult.status : 200,
    data: { sessionId, label, surface },
    error: switchResult.ok ? '' : (createResult.error || switchResult.error || ''),
  };
});

ipcMain.handle('zavorth:automations:list', async () => getDesktopAutomationStore().listTasks());
ipcMain.handle('zavorth:automations:create', async (_event, input = {}) => {
  const task = getDesktopAutomationStore().createTask({
    name: String(input.name || '').trim(),
    project: String(input.project || 'Local').trim(),
    prompt: String(input.prompt || '').trim(),
    intervalMinutes: Math.max(1, Number(input.intervalMinutes || 60)),
    workspace: input.workspace,
    model: input.model,
    profile: input.profile,
    effort: input.effort,
  });
  emitAutomationUpdate();
  return task;
});
ipcMain.handle('zavorth:automations:delete', async (_event, taskId) => {
  const ok = getDesktopAutomationStore().deleteTask(String(taskId || ''));
  emitAutomationUpdate();
  return { ok };
});
ipcMain.handle('zavorth:automations:toggle', async (_event, taskId, enabled) => {
  const task = getDesktopAutomationStore().toggleTask(String(taskId || ''), Boolean(enabled));
  emitAutomationUpdate();
  return task;
});
ipcMain.handle('zavorth:automations:run', async (_event, taskId) => runDesktopAutomationTask(taskId));
ipcMain.handle('zavorth:automations:logs', async (_event, sessionId) => {
  const safeSessionId = String(sessionId || '');
  const result = await desktopApiRequest({
    method: 'GET',
    path: '/api/experience/home',
    query: { surface: 'web', sessionId: safeSessionId },
    timeoutMs: 12000,
  });
  const data = result.data && typeof result.data === 'object' ? result.data : {};
  const runtimeMessages = result.ok ? (data.chat?.messages || data.messages || []) : [];
  if (Array.isArray(runtimeMessages) && runtimeMessages.length > 0) return runtimeMessages;

  return buildAutomationHistoryLogs(getDesktopAutomationStore().listTasks(), safeSessionId);
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


// Auto-updates and companion voice IPC
function updateHomeDir() {
  try {
    return resolveZavorthHome();
  } catch {
    return path.join(app.getPath('userData'), 'updates');
  }
}

ipcMain.handle('zavorth:check-updates', async () => {
  return desktopUpdates.checkUpdates({
    currentVersion: app.getVersion(),
    homeDir: updateHomeDir(),
  });
});

ipcMain.handle('zavorth:updates:download', async () => {
  return desktopUpdates.downloadUpdate({
    currentVersion: app.getVersion(),
    homeDir: updateHomeDir(),
  });
});

ipcMain.handle('zavorth:updates:defer', async (_event, input = {}) => {
  return desktopUpdates.deferUpdate({
    homeDir: updateHomeDir(),
    days: input.days || 7,
  });
});

ipcMain.handle('zavorth:updates:install', async () => {
  return desktopUpdates.installUpdate({
    currentVersion: app.getVersion(),
    homeDir: updateHomeDir(),
    allowSetupFallback: true,
    startSetup: async (extra = {}) => launchGuidedSetup(extra),
  });
});

ipcMain.handle('zavorth:updates:rollback', async () => {
  return desktopUpdates.rollbackUpdate({ homeDir: updateHomeDir() });
});

ipcMain.handle('zavorth:updates:open-github', async () => {
  return desktopUpdates.openGithubReleases({});
});

function isProcessAlive(pid) {
  const id = Number(pid);
  if (!Number.isFinite(id) || id <= 0) return false;
  try {
    process.kill(id, 0);
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle('zavorth:voice-agent:status', async () => {
  const home = resolveZavorthHome();
  const statusFile = path.join(home, 'agent-voice-status.json');
  try {
    const raw = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    const pid = raw.pid || null;
    const alive = Boolean(raw.running) && isProcessAlive(pid);
    if (!alive && (raw.running || pid)) {
      // Stale status file: companion exited without cleanup.
      try {
        fs.writeFileSync(statusFile, `${JSON.stringify({
          ...raw,
          running: false,
          updatedAt: new Date().toISOString(),
          message: 'Voice companion is not running. Desktop dictation (Web Speech) remains available.',
        }, null, 2)}\n`, 'utf8');
      } catch {
        // ignore write failures
      }
    }
    return {
      ok: true,
      running: alive,
      pid: alive ? pid : null,
      mode: alive ? (raw.mode || 'companion') : 'desktop-dictation',
      hotkey: raw.hotkey || 'Ctrl+Shift+Space',
      wakeWord: alive ? (raw.wakeWord || 'hey zavorth') : null,
      updatedAt: raw.updatedAt || null,
      message: alive
        ? (raw.message || 'Voice companion is running.')
        : 'Voice companion is not running. Desktop dictation (Web Speech) remains available.',
    };
  } catch {
    return {
      ok: true,
      running: false,
      pid: null,
      mode: 'desktop-dictation',
      hotkey: 'Ctrl+Shift+Space',
      wakeWord: null,
      updatedAt: null,
      message: 'Voice companion is not running. Desktop dictation (Web Speech) remains available.',
    };
  }
});

ipcMain.handle('zavorth:voice-agent:start', async () => {
  const repoRoot = resolveRepoRoot();
  const agentEntry = path.join(repoRoot, 'agent', 'src', 'index.ts');
  const statusFile = path.join(resolveZavorthHome(), 'agent-voice-status.json');
  if (!fs.existsSync(agentEntry)) {
    return {
      ok: false,
      error: 'Voice companion package was not found in this install (agent/src/index.ts).',
    };
  }
  try {
    const child = spawn(nodeCommand(), ['--import', 'tsx', agentEntry], {
      cwd: path.join(repoRoot, 'agent'),
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        ZAVORTH_AGENT_STATUS_FILE: statusFile,
        ZAVORTH_AGENT_FROM_DESKTOP: '1',
      },
      windowsHide: true,
    });
    child.unref();
    fs.mkdirSync(path.dirname(statusFile), { recursive: true });
    fs.writeFileSync(statusFile, `${JSON.stringify({
      running: true,
      pid: child.pid,
      mode: 'companion',
      hotkey: 'Ctrl+Shift+Space',
      wakeWord: 'hey zavorth',
      updatedAt: new Date().toISOString(),
      message: 'Voice companion started from Desktop.',
    }, null, 2)}\n`, 'utf8');
    emitBootEvent('info', `Voice companion started (pid ${child.pid}).`);
    return { ok: true, pid: child.pid, message: 'Voice companion started.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not start voice companion.' };
  }
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

ipcMain.handle('zavorth:code-bridge:summary', async () => getCodeBridgeSummary());

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
  void startCodeBridgeHeartbeat({ name: 'Zavorth Desktop' }).catch((error) => {
    emitBootEvent('warn', `Code bridge heartbeat unavailable: ${error instanceof Error ? error.message : String(error)}`);
  });
  void runDueDesktopAutomations();
  desktopAutomationTimer = setInterval(() => {
    void runDueDesktopAutomations();
  }, 30000);
  try {
    const { globalShortcut } = require('electron');
    const ok = globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('zavorth:voice:hotkey');
      }
    });
    if (ok) {
      emitBootEvent('info', 'Voice hotkey registered: Ctrl+Shift+Space');
    }
  } catch {
    // globalShortcut may be unavailable in smoke/test hosts
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  stopCodeBridgeHeartbeat();
  if (desktopAutomationTimer) {
    clearInterval(desktopAutomationTimer);
    desktopAutomationTimer = null;
  }
  try {
    const { globalShortcut } = require('electron');
    globalShortcut.unregisterAll();
  } catch {
    // ignore
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
