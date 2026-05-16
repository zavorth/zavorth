import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

let config = null;
let dashboardServiceModule = null;
let dashboardRuntimeConfig = null;

async function loadConfig() {
  if (config) {
    return config;
  }

  const rootDir = process.cwd();
  const distConfigJsPath = path.resolve(rootDir, 'dist', 'config', 'index.js');
  const sourceConfigTsPath = path.resolve(rootDir, 'src', 'config', 'index.ts');
  const sourceConfigJsPath = path.resolve(rootDir, 'src', 'config', 'index.js');
  const imported = await import(
    fs.existsSync(distConfigJsPath)
      ? pathToFileURL(distConfigJsPath).href
      : fs.existsSync(sourceConfigTsPath)
      ? pathToFileURL(sourceConfigTsPath).href
      : pathToFileURL(sourceConfigJsPath).href,
  );
  config = imported.config;
  return config;
}

async function loadDashboardServiceModule() {
  if (dashboardServiceModule) {
    return {
      module: dashboardServiceModule,
      runtimeConfig: dashboardRuntimeConfig,
    };
  }

  const rootDir = process.cwd();
  const candidates = [
    {
      servicePath: path.resolve(rootDir, 'dist', 'services', 'DashboardService.js'),
      configPath: path.resolve(rootDir, 'dist', 'config', 'index.js'),
    },
    {
      servicePath: path.resolve(rootDir, 'src', 'services', 'DashboardService.js'),
      configPath: path.resolve(rootDir, 'src', 'config', 'index.js'),
    },
    {
      servicePath: path.resolve(rootDir, 'src', 'services', 'DashboardService.ts'),
      configPath: path.resolve(rootDir, 'src', 'config', 'index.ts'),
    },
  ];
  const selected = candidates.find((candidate) => fs.existsSync(candidate.servicePath) && fs.existsSync(candidate.configPath));
  if (!selected) {
    throw new Error('Nao foi possivel localizar DashboardService para o smoke web.');
  }
  dashboardServiceModule = await import(pathToFileURL(selected.servicePath).href);
  const configModule = await import(pathToFileURL(selected.configPath).href);
  dashboardRuntimeConfig = configModule.config;
  return {
    module: dashboardServiceModule,
    runtimeConfig: dashboardRuntimeConfig,
  };
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim();
    if (current === '--base-url') {
      result.baseUrl = String(argv[index + 1] || '').trim();
      index += 1;
    } else if (current === '--token') {
      result.token = String(argv[index + 1] || '').trim();
      index += 1;
    } else if (current === '--wait-ms') {
      const parsed = Number.parseInt(String(argv[index + 1] || '').trim(), 10);
      result.waitMs = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      index += 1;
    }
  }
  return result;
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeLocalBaseUrl(value) {
  const normalized = normalizeBaseUrl(value);
  return normalized.replace('://0.0.0.0:', '://127.0.0.1:');
}

function readRuntimeStateBaseUrl(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return '';
    }
    const payload = JSON.parse(String(fs.readFileSync(filePath, 'utf8') || '{}'));
    return normalizeLocalBaseUrl(payload?.url || '');
  } catch {
    return '';
  }
}

function readTokenFromFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return '';
    }
    return String(fs.readFileSync(filePath, 'utf8') || '').trim();
  } catch {
    return '';
  }
}

function resolveTokenCandidates(explicitToken = '') {
  const candidates = [
    explicitToken,
    readTokenFromFile(config.zavorthWebAuthTokenFile),
    config.zavorthWebAuthToken ? String(config.zavorthWebAuthToken).trim() : '',
  ]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

async function validateToken(baseUrl, token) {
  if (!token) {
    return false;
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ token }),
    }, 5000);
    const payload = await response.json();
    return Boolean(response.ok && payload?.ok);
  } catch {
    return false;
  }
}

async function resolveWorkingToken(baseUrl, explicitToken = '') {
  const candidates = resolveTokenCandidates(explicitToken);
  for (const candidate of candidates) {
    if (await validateToken(baseUrl, candidate)) {
      return candidate;
    }
  }

  return candidates[0] || '';
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function reserveFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        if (!address || typeof address === 'string') {
          reject(new Error('Nao foi possivel reservar uma porta livre para o smoke web.'));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function fetchJsonWithRetry(url, init = {}, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 8000;
  const retries = Number.isFinite(options.retries) ? options.retries : 2;
  const retryDelayMs = Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : 1000;

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);
      const payload = await response.json();
      return { response, payload };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        throw error;
      }
      await wait(retryDelayMs);
    }
  }

  throw lastError || new Error('Falha inesperada ao consultar JSON.');
}

async function inspectCandidateBaseUrl(baseUrl) {
  const candidate = normalizeLocalBaseUrl(baseUrl);
  if (!candidate) {
    return { baseUrl: '', reachable: false, webReady: false };
  }

  try {
    const authStatus = await fetchWithTimeout(`${candidate}/api/auth/status`, {}, 4000);
    if (authStatus.ok) {
      const payload = await authStatus.json();
      return {
        baseUrl: candidate,
        reachable: true,
        webReady: Boolean(payload?.webReady),
      };
    }
  } catch {
    // keep probing /dashboard below
  }

  try {
    const shell = await fetchWithTimeout(`${candidate}/dashboard`, {}, 4000);
    if (shell.ok) {
      return {
        baseUrl: candidate,
        reachable: true,
        webReady: false,
      };
    }
  } catch {
    // ignore candidate
  }

  return { baseUrl: candidate, reachable: false, webReady: false };
}

async function resolveBaseUrl(explicitBaseUrl = '') {
  const candidates = listBaseUrlCandidates(explicitBaseUrl);
  const fallbackUrl = candidates[0] || normalizeLocalBaseUrl(`http://${config.zavorthWebHost}:${config.zavorthWebPort}`);

  for (const candidate of candidates) {
    const inspected = await inspectCandidateBaseUrl(candidate);
    if (inspected.reachable && inspected.webReady) {
      return inspected.baseUrl;
    }
  }

  for (const candidate of candidates) {
    const inspected = await inspectCandidateBaseUrl(candidate);
    if (inspected.reachable) {
      return inspected.baseUrl;
    }
  }

  return fallbackUrl;
}

function listBaseUrlCandidates(explicitBaseUrl = '') {
  const explicit = normalizeLocalBaseUrl(explicitBaseUrl);
  if (explicit) {
    return [explicit];
  }

  const runtimeStateUrl = readRuntimeStateBaseUrl(config.dashboardRuntimeStateFile);
  const fallbackUrl = normalizeLocalBaseUrl(`http://${config.zavorthWebHost}:${config.zavorthWebPort}`);
  return Array.from(new Set([runtimeStateUrl, fallbackUrl].filter(Boolean)));
}

async function resolveAuthorizedBaseUrl(explicitBaseUrl = '', explicitToken = '') {
  const candidates = listBaseUrlCandidates(explicitBaseUrl);
  for (const candidate of candidates) {
    const inspected = await inspectCandidateBaseUrl(candidate);
    if (!inspected.reachable) {
      continue;
    }

    const token = await resolveWorkingToken(candidate, explicitToken);
    if (token && await validateToken(candidate, token)) {
      return {
        baseUrl: candidate,
        token,
      };
    }
  }

  return {
    baseUrl: candidates[0] || '',
    token: '',
  };
}

async function resolveAuthorizedTargets(explicitBaseUrl = '', explicitToken = '') {
  const candidates = listBaseUrlCandidates(explicitBaseUrl);
  const targets = [];
  for (const candidate of candidates) {
    const inspected = await inspectCandidateBaseUrl(candidate);
    if (!inspected.reachable) {
      continue;
    }

    const token = await resolveWorkingToken(candidate, explicitToken);
    targets.push({
      baseUrl: candidate,
      token,
      authorized: Boolean(token && await validateToken(candidate, token)),
    });
  }

  const ranked = targets
    .filter((entry) => entry.authorized)
    .concat(targets.filter((entry) => !entry.authorized));

  return ranked.filter((entry, index, array) => {
    return array.findIndex((candidate) => candidate.baseUrl === entry.baseUrl) === index;
  });
}

async function waitForAppShell(baseUrl, waitMs = 20_000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/dashboard`, {}, 4000);
      if (response.ok) {
        return true;
      }
    } catch {
      // continue waiting inside the boot window
    }
    await wait(1500);
  }
  return false;
}

function authHeaders(token, extra = {}) {
  const headers = new Headers(extra);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

function snapshotDashboardConfig(targetConfig) {
  return {
    zavorthWebHost: targetConfig.zavorthWebHost,
    zavorthWebPort: targetConfig.zavorthWebPort,
    zavorthWebAuthToken: targetConfig.zavorthWebAuthToken,
    dashboardRuntimeStateFile: targetConfig.dashboardRuntimeStateFile,
  };
}

function suppressSkillLoaderNoise() {
  const suppressedPrefixes = [
    'Skill carregada:',
    'Skill ignorada por configuracao:',
    'Total de skills carregadas:',
    'Skill sem SKILL.md ignorada:',
  ];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const shouldSuppress = (args) => {
    const message = args.map((entry) => String(entry ?? '')).join(' ');
    return suppressedPrefixes.some((prefix) => message.startsWith(prefix));
  };

  console.log = (...args) => {
    if (shouldSuppress(args)) {
      return;
    }
    originalLog(...args);
  };
  console.warn = (...args) => {
    if (shouldSuppress(args)) {
      return;
    }
    originalWarn(...args);
  };

  return () => {
    console.log = originalLog;
    console.warn = originalWarn;
  };
}

function createTemporaryWebRuntimeDeps() {
  const tasks = [];
  const taskManager = {
    getRecentTasksByChat: (chatId, limit = 25) => tasks.filter((task) => task.chat_id === chatId).slice(0, limit),
    getRecentTasksByUsers: (userIds, limit = 25) => tasks.filter((task) => userIds.includes(task.user_id)).slice(0, limit),
    getRecentTasks: (limit = 25, userId = null) => tasks.filter((task) => !userId || task.user_id === userId).slice(0, limit),
    getTask: (taskId) => tasks.find((task) => task.task_id === taskId) || null,
  };
  const parser = {
    parse: (text) => ({
      normalized_message: text,
      command_type: '/task',
    }),
  };
  const taskOrchestrationController = {
    handleTaskMessage: async (_ctx, payload) => {
      const task = {
        task_id: `web-smoke-task-${tasks.length + 1}`,
        source: payload?.source || 'web',
        chat_id: payload?.chatId || 'web:smoke',
        user_id: payload?.userId || 'web-smoke-user',
        workspace: payload?.surfaceMetadata?.workspace || process.cwd(),
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        status: 'queued',
        raw_message: payload?.text || '',
        result_summary: 'Dispatch aceito no smoke temporario.',
        metadata: {
          runtime_user_id: payload?.userId || 'web-smoke-user',
          surface_identity: {
            chatId: payload?.chatId || 'web:smoke',
            sessionId: payload?.surfaceMetadata?.sessionId || null,
            runtime_user_id: payload?.userId || 'web-smoke-user',
          },
        },
      };
      tasks.unshift(task);
      return task;
    },
  };
  const permissionService = {
    listRequests: async () => [],
  };
  const permissionController = {
    formatPermissionCreatedMessage: () => '',
    resolvePermissionReference: async () => null,
    handlePermissionCallback: async () => undefined,
    shortPermissionId: () => 'perm-smoke',
    handleApproval: async () => undefined,
    handleRejection: async () => undefined,
  };

  return {
    taskManager,
    parser,
    taskOrchestrationController,
    permissionService,
    permissionController,
    webUserId: 'web-smoke-user',
  };
}

async function startTemporaryDashboardService() {
  const { module, runtimeConfig } = await loadDashboardServiceModule();
  const { DashboardService } = module;
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-smoke-'));
  const previousConfig = snapshotDashboardConfig(runtimeConfig);
  const port = await reserveFreePort();
  const logRepo = {
    log: () => undefined,
    getRecentLogs: () => [],
  };
  const restoreConsole = suppressSkillLoaderNoise();

  runtimeConfig.zavorthWebHost = '127.0.0.1';
  runtimeConfig.zavorthWebPort = port;
  runtimeConfig.zavorthWebAuthToken = 'web-smoke-temporary-token';
  runtimeConfig.dashboardRuntimeStateFile = path.join(runtimeRoot, 'dashboard-runtime.json');

  const service = new DashboardService(logRepo, createTemporaryWebRuntimeDeps());
  const baseUrl = await service.start();
  const token = await resolveWorkingToken(baseUrl, runtimeConfig.zavorthWebAuthToken);

  return {
    baseUrl,
    token,
    cleanup: async () => {
      try {
        await service.stopAsync();
        runtimeConfig.zavorthWebHost = previousConfig.zavorthWebHost;
        runtimeConfig.zavorthWebPort = previousConfig.zavorthWebPort;
        runtimeConfig.zavorthWebAuthToken = previousConfig.zavorthWebAuthToken;
        runtimeConfig.dashboardRuntimeStateFile = previousConfig.dashboardRuntimeStateFile;
        fs.rmSync(runtimeRoot, { recursive: true, force: true });
      } finally {
        restoreConsole();
      }
    },
  };
}

function makeResult(name, status, detail, required = true) {
  return { name, status, detail, required };
}

async function smokeHtmlShell(baseUrl) {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/dashboard`, {}, 8000);
    const html = await response.text();
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    const requiredMarkers = [
      'Hello, Operator',
      'Choose a mode, then start a mission.',
      'Personal',
      'Developer',
      'Business',
      'Ask Zavorth',
    ];
    const missing = requiredMarkers.filter((marker) => !html.includes(marker));
    if (missing.length) {
      throw new Error(`HTML sem elementos esperados: ${missing.join(', ')}`);
    }

    return makeResult('Dashboard shell', 'PASSOU', 'HTML principal do /dashboard carregou com o gateway oficial.');
  } catch (error) {
    return makeResult('Dashboard shell', 'FALHOU', error?.message || String(error));
  }
}

async function smokeAuth(baseUrl, token) {
  if (!token) {
    return makeResult('Auth web', 'PULADO', 'Sem token resolvido para validar autenticacao.', false);
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ token }),
    }, 8000);
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `status ${response.status}`);
    }

    return makeResult('Auth web', 'PASSOU', 'Token validado com sucesso.');
  } catch (error) {
    return makeResult('Auth web', 'FALHOU', error?.message || String(error));
  }
}

async function smokeHostStatus(baseUrl, token) {
  try {
    const { response, payload } = await fetchJsonWithRetry(
      `${baseUrl}/api/web/host/status`,
      {
        headers: authHeaders(token),
      },
      { timeoutMs: 20_000, retries: 1, retryDelayMs: 1200 },
    );
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `status ${response.status}`);
    }

    const localReady = Boolean(payload?.readiness?.local?.ready);
    const remoteReady = Boolean(payload?.readiness?.remote?.ready);
    const authorization = String(payload?.authorization?.status || 'desconhecida');
    return makeResult(
      'Host status',
      'PASSOU',
      `Host respondeu; autorizacao ${authorization}; local ${localReady ? 'pronto' : 'pendente'}; remoto ${remoteReady ? 'pronto' : 'pendente'}.`,
    );
  } catch (error) {
    return makeResult('Host status', 'FALHOU', error?.message || String(error));
  }
}

async function smokeSession(baseUrl, token) {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/web/session`, {
      headers: authHeaders(token),
    }, 8000);
    const payload = await response.json();
    if (!response.ok || !payload.ok || !payload.sessionId) {
      throw new Error(payload.error || `status ${response.status}`);
    }

    return {
      result: makeResult('Sessao web', 'PASSOU', `Sessao ${String(payload.sessionId).slice(0, 8)} aberta com continuidade carregada.`),
      sessionId: String(payload.sessionId),
      tasks: [],
      continuity: payload.continuity || null,
    };
  } catch (error) {
    return {
      result: makeResult('Sessao web', 'FALHOU', error?.message || String(error)),
      sessionId: '',
      tasks: [],
      continuity: null,
    };
  }
}

async function smokeState(baseUrl, token, sessionId) {
  try {
    const { response, payload } = await fetchJsonWithRetry(
      `${baseUrl}/api/web/state?sessionId=${encodeURIComponent(sessionId)}`,
      {
        headers: authHeaders(token),
      },
      { timeoutMs: 30000, retries: 3, retryDelayMs: 1500 },
    );
    const snapshot = payload.snapshot || {};
    if (!response.ok || !payload.ok || !snapshot) {
      throw new Error(payload.error || `status ${response.status}`);
    }

    const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
    const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
    return {
      result: makeResult('Estado web', 'PASSOU', `${messages.length} mensagem(ns), ${tasks.length} task(s) e snapshot valido.`),
      tasks,
    };
  } catch (error) {
    return {
      result: makeResult('Estado web', 'FALHOU', error?.message || String(error)),
      tasks: [],
    };
  }
}

async function smokeCatalog(baseUrl, token, sessionId) {
  try {
    const { response, payload } = await fetchJsonWithRetry(
      `${baseUrl}/api/web/catalog?sessionId=${encodeURIComponent(sessionId)}`,
      {
        headers: authHeaders(token),
      },
      { timeoutMs: 30000, retries: 3, retryDelayMs: 1500 },
    );
    const catalog = payload.catalog || {};
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `status ${response.status}`);
    }

    const commands = Array.isArray(catalog.commands) ? catalog.commands.length : 0;
    const suggestions = Array.isArray(catalog.suggestedActions) ? catalog.suggestedActions.length : 0;
    return makeResult('Catalogo', 'PASSOU', `${commands} comando(s) e ${suggestions} sugestao(oes) disponiveis.`);
  } catch (error) {
    return makeResult('Catalogo', 'FALHOU', error?.message || String(error));
  }
}

async function runSmokeAttempt(baseUrl, token) {
  const results = [];
  results.push(await smokeHtmlShell(baseUrl));
  results.push(await smokeAuth(baseUrl, token));
  results.push(await smokeHostStatus(baseUrl, token));

  const session = await smokeSession(baseUrl, token);
  results.push(session.result);

  let tasks = [];
  if (session.sessionId) {
    await wait(750);
    const stateResult = await smokeState(baseUrl, token, session.sessionId);
    results.push(stateResult.result);
    tasks = stateResult.tasks;
    results.push(await smokeCatalog(baseUrl, token, session.sessionId));
    results.push(await smokeEvents(baseUrl, token, session.sessionId));
  }

  results.push(await smokePreview(baseUrl, token, tasks));
  return results;
}

async function runSmokeAttemptWithTimeout(baseUrl, token, timeoutMs = 45_000) {
  return await Promise.race([
    runSmokeAttempt(baseUrl, token),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Smoke real excedeu ${timeoutMs}ms em ${baseUrl}.`));
      }, timeoutMs);
    }),
  ]);
}

async function smokePublicJson(baseUrl, token, endpoint, name, detailBuilder, required = true, timeoutMs = 12000) {
  try {
    const { response, payload } = await fetchJsonWithRetry(
      `${baseUrl}${endpoint}`,
      { headers: authHeaders(token) },
      { timeoutMs, retries: 1, retryDelayMs: 800 },
    );
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `status ${response.status}`);
    }
    return makeResult(name, 'PASSOU', detailBuilder(payload));
  } catch (error) {
    return makeResult(name, required ? 'FALHOU' : 'AVISO', error?.message || String(error), required);
  }
}

async function runFallbackSmokeAttempt(baseUrl, token) {
  const results = [];
  results.push(await smokeHtmlShell(baseUrl));
  results.push(await smokeAuth(baseUrl, token));
  results.push(await smokePublicJson(
    baseUrl,
    token,
    '/api/auth/status',
    'Auth status',
    (payload) => `Auth status respondeu; webReady=${payload?.webReady ? 'sim' : 'nao'}.`,
  ));
  results.push(await smokePublicJson(
    baseUrl,
    token,
    '/api/v1/gateway/status',
    'Gateway publico',
    (payload) => {
      const lifecycle = String(payload?.lifecycle?.status || payload?.status || 'desconhecido');
      return `Gateway publico respondeu com lifecycle ${lifecycle}.`;
    },
  ));
  results.push(await smokePublicJson(
    baseUrl,
    token,
    '/api/v1/platform/status',
    'Platform publico',
    (payload) => {
      const total = Number(payload?.summary?.total || 0);
      return `Platform publico respondeu com ${total} item(ns).`;
    },
    false,
    20000,
  ));
  results.push(await smokePublicJson(
    baseUrl,
    token,
    '/api/v1/ops/quality',
    'Quality gate',
    (payload) => {
      const state = String(payload?.gate?.state || 'desconhecido');
      return `Ops quality respondeu com gate ${state}.`;
    },
    false,
    25000,
  ));
  return results;
}

async function runRealHostSurfaceSmokeAttempt(baseUrl, token) {
  const results = [];
  results.push(await smokeHtmlShell(baseUrl));
  results.push(await smokeAuth(baseUrl, token));
  results.push(await smokePublicJson(
    baseUrl,
    token,
    '/api/auth/status',
    'Auth status',
    (payload) => `Auth status respondeu; webReady=${payload?.webReady ? 'sim' : 'nao'}.`,
    true,
    10000,
  ));
  return results;
}

function collectPreviewCandidate(tasks) {
  for (const task of tasks) {
    const artifacts = Array.isArray(task?.artifacts) ? task.artifacts : [];
    for (const artifact of artifacts) {
      const targetPath = String(artifact?.path || '').trim();
      if (targetPath) {
        return {
          path: targetPath,
          label: String(artifact?.name || artifact?.key || targetPath).trim(),
        };
      }
    }

    const targetFiles = Array.isArray(task?.target_files) ? task.target_files : [];
    const firstTarget = targetFiles.find((entry) => String(entry || '').trim());
    if (firstTarget) {
      return {
        path: String(firstTarget).trim(),
        label: String(firstTarget).trim(),
      };
    }
  }
  return null;
}

async function smokePreview(baseUrl, token, tasks) {
  const candidate = collectPreviewCandidate(tasks);
  if (!candidate) {
    return makeResult('Preview arquivo', 'PULADO', 'Nenhum arquivo com caminho disponivel para preview.', false);
  }

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/web/file-preview?path=${encodeURIComponent(candidate.path)}`,
      { headers: authHeaders(token) },
      8000,
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok || !payload.preview) {
      throw new Error(payload.error || `status ${response.status}`);
    }

    const previewText = String(payload.preview.text || payload.preview.previewText || '').trim();
    return makeResult(
      'Preview arquivo',
      'PASSOU',
      previewText
        ? `Preview carregado para ${candidate.label}.`
        : `Preview respondeu para ${candidate.label}.`,
    );
  } catch (error) {
    return makeResult('Preview arquivo', 'AVISO', error?.message || String(error), false);
  }
}

async function smokeEvents(baseUrl, token, sessionId) {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/web/events?sessionId=${encodeURIComponent(sessionId)}`,
      {
        headers: authHeaders(token),
      },
      5000,
    );
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    if (!contentType.includes('text/event-stream')) {
      throw new Error(`content-type inesperado: ${contentType || 'vazio'}`);
    }
    if (response.body) {
      await response.body.cancel().catch(() => undefined);
    }

    return makeResult('Stream SSE', 'PASSOU', 'Endpoint SSE respondeu com content-type correto.');
  } catch (error) {
    return makeResult('Stream SSE', 'AVISO', error?.message || String(error), false);
  }
}

async function run() {
  await loadConfig();
  const args = parseArgs(process.argv.slice(2));
  let baseUrl = await resolveBaseUrl(args.baseUrl || '');
  const waitMs = Number.isFinite(args.waitMs) ? Number(args.waitMs) : 20_000;

  console.log(`Smoke do app web em ${baseUrl}\n`);

  let ready = await waitForAppShell(baseUrl, waitMs);
  if (!ready) {
    console.log(`Host nao respondeu em ${baseUrl}/dashboard dentro de ${waitMs}ms; seguindo para o fallback deterministico.\n`);
  }

  const authorized = await resolveAuthorizedBaseUrl(args.baseUrl || '', args.token || '');
  const targets = await resolveAuthorizedTargets(args.baseUrl || '', args.token || '');
  const candidateTargets = targets.length > 0
    ? targets
    : [{ baseUrl: authorized.baseUrl || baseUrl, token: authorized.token || await resolveWorkingToken(baseUrl, args.token || '') }];

  let finalResults = [];
  let finalBaseUrl = baseUrl;
  for (const target of candidateTargets) {
    const candidateBaseUrl = normalizeBaseUrl(target.baseUrl || '');
    const candidateToken = String(target.token || '').trim();
    if (!candidateBaseUrl) {
      continue;
    }

    finalBaseUrl = candidateBaseUrl;
    finalResults = await runRealHostSurfaceSmokeAttempt(candidateBaseUrl, candidateToken);

    const blockingFailures = finalResults.filter((entry) => entry.required && entry.status === 'FALHOU');
    if (blockingFailures.length === 0) {
      break;
    }
  }

  const blockingFailures = finalResults.filter((entry) => entry.required && entry.status === 'FALHOU');
  if (blockingFailures.length > 0) {
    console.log('\nHost real nao respondeu ao smoke leve; iniciando dashboard temporario para validacao deterministica.\n');
    const temporaryDashboard = await startTemporaryDashboardService();
    try {
      await waitForAppShell(temporaryDashboard.baseUrl, Math.max(waitMs, 30_000));
      finalBaseUrl = temporaryDashboard.baseUrl;
      finalResults = await runFallbackSmokeAttempt(temporaryDashboard.baseUrl, temporaryDashboard.token);
    } finally {
      await temporaryDashboard.cleanup();
    }
  }

  console.log(`Resumo do smoke web (${finalBaseUrl}):`);
  for (const result of finalResults) {
    console.log(`${result.name.padEnd(18, ' ')} ${result.status.padEnd(6, ' ')} ${result.detail}`);
  }

  const finalBlockingFailures = finalResults.filter((entry) => entry.required && entry.status === 'FALHOU');
  if (finalBlockingFailures.length) {
    console.log('\nSmoke do app web terminou com falhas bloqueantes.');
    process.exit(1);
  }

  console.log('\nSmoke do app web finalizado sem falhas bloqueantes.');
}

run().catch((error) => {
  console.error('Falha inesperada no smoke do app web:', error);
  process.exit(1);
});
