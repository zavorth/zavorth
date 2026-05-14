import fs from 'fs';
import { spawnSync } from 'child_process';
import { config } from '../src/config/index.js';

type SmokeStatus = 'PASSOU' | 'FALHOU' | 'PULADO' | 'AVISO';

type SmokeResult = {
  name: string;
  status: SmokeStatus;
  detail: string;
  required: boolean;
};

type PreviewCandidate = {
  path: string;
  label: string;
};

function parseArgs(argv: string[]): { baseUrl?: string; token?: string; waitMs?: number } {
  const result: { baseUrl?: string; token?: string; waitMs?: number } = {};
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

function normalizeBaseUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeLocalBaseUrl(value: string): string {
  return normalizeBaseUrl(value).replace('://0.0.0.0:', '://127.0.0.1:');
}

function readRuntimeStateBaseUrl(filePath: string): string {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return '';
    }
    const payload = JSON.parse(String(fs.readFileSync(filePath, 'utf8') || '{}')) as Record<string, any>;
    return normalizeLocalBaseUrl(String(payload?.url || ''));
  } catch {
    return '';
  }
}

function readTokenFromFile(filePath: string): string {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return '';
    }
    return String(fs.readFileSync(filePath, 'utf8') || '').trim();
  } catch {
    return '';
  }
}

function resolveToken(explicitToken = ''): string {
  if (explicitToken) {
    return explicitToken;
  }
  if (config.zavorthWebAuthToken) {
    return String(config.zavorthWebAuthToken).trim();
  }
  return readTokenFromFile(config.zavorthWebAuthTokenFile);
}

function listBaseUrlCandidates(explicitBaseUrl = ''): string[] {
  const explicit = normalizeLocalBaseUrl(explicitBaseUrl);
  if (explicit) {
    return [explicit];
  }

  const runtimeStateUrl = readRuntimeStateBaseUrl(config.dashboardRuntimeStateFile);
  const fallbackUrl = normalizeLocalBaseUrl(`http://${config.zavorthWebHost}:${config.zavorthWebPort}`);
  return Array.from(new Set([runtimeStateUrl, fallbackUrl].filter(Boolean)));
}

async function inspectCandidateBaseUrl(baseUrl: string): Promise<{ baseUrl: string; reachable: boolean }> {
  const candidate = normalizeLocalBaseUrl(baseUrl);
  if (!candidate) {
    return { baseUrl: '', reachable: false };
  }

  try {
    const shell = await fetchWithTimeout(`${candidate}/dashboard`, {}, 4000);
    if (shell.ok) {
      return { baseUrl: candidate, reachable: true };
    }
  } catch {
    // ignore candidate
  }

  return { baseUrl: candidate, reachable: false };
}

async function resolveBaseUrl(explicitBaseUrl = ''): Promise<string> {
  const candidates = listBaseUrlCandidates(explicitBaseUrl);
  for (const candidate of candidates) {
    const inspected = await inspectCandidateBaseUrl(candidate);
    if (inspected.reachable) {
      return inspected.baseUrl;
    }
  }

  return candidates[0] || normalizeLocalBaseUrl(`http://${config.zavorthWebHost}:${config.zavorthWebPort}`);
}

function ensureHostStarted(): void {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['run', 'ops:up', '--', '--allow-readonly'], {
    cwd: config.projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`ops:up falhou com codigo ${result.status}.`);
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
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

async function waitForAppShell(baseUrl: string, waitMs = 20_000): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/dashboard`, {}, 4000);
      if (response.ok) {
        return true;
      }
    } catch {
      // keep waiting for the host boot window
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

function authHeaders(token: string, extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

function makeResult(name: string, status: SmokeStatus, detail: string, required = true): SmokeResult {
  return { name, status, detail, required };
}

async function smokeHtmlShell(baseUrl: string): Promise<SmokeResult> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/dashboard`, {}, 8000);
    const html = await response.text();
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    const acceptedShells = [
      {
        label: 'dashboard gateway',
        markers: [
          'Hello, Operator',
          'What should Zavorth handle today?',
          'Ask Zavorth',
        ],
      },
    ];
    const matchedShell = acceptedShells.find((shell) => shell.markers.every((marker) => html.includes(marker)));
    if (!matchedShell) {
      const missingByShell = acceptedShells
        .map((shell) => `${shell.label}: ${shell.markers.filter((marker) => !html.includes(marker)).join(', ')}`)
        .join(' | ');
      throw new Error(`HTML sem elementos esperados (${missingByShell})`);
    }

    return makeResult('Dashboard shell', 'PASSOU', `HTML principal do /dashboard carregou o shell ${matchedShell.label}.`);
  } catch (error: any) {
    return makeResult('Dashboard shell', 'FALHOU', error?.message || String(error));
  }
}

async function smokeAuth(baseUrl: string, token: string): Promise<SmokeResult> {
  if (!token) {
    return makeResult('Auth web', 'PULADO', 'Sem token resolvido para validar autenticacao.', false);
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ token }),
    }, 8000);
    const payload = await response.json() as Record<string, any>;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `status ${response.status}`);
    }

    return makeResult('Auth web', 'PASSOU', 'Token validado com sucesso.');
  } catch (error: any) {
    return makeResult('Auth web', 'FALHOU', error?.message || String(error));
  }
}

async function smokeHostStatus(baseUrl: string, token: string): Promise<SmokeResult> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/web/host/status`, {
      headers: authHeaders(token),
    }, 8000);
    const payload = await response.json() as Record<string, any>;
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
  } catch (error: any) {
    return makeResult('Host status', 'FALHOU', error?.message || String(error));
  }
}

async function smokeSession(baseUrl: string, token: string): Promise<{ result: SmokeResult; sessionId: string; tasks: any[]; continuity: any; }> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/web/session`, {
      headers: authHeaders(token),
    }, 8000);
    const payload = await response.json() as Record<string, any>;
    if (!response.ok || !payload.ok || !payload.sessionId) {
      throw new Error(payload.error || `status ${response.status}`);
    }

    return {
      result: makeResult('Sessao web', 'PASSOU', `Sessao ${String(payload.sessionId).slice(0, 8)} aberta com continuidade carregada.`),
      sessionId: String(payload.sessionId),
      tasks: [],
      continuity: payload.continuity || null,
    };
  } catch (error: any) {
    return {
      result: makeResult('Sessao web', 'FALHOU', error?.message || String(error)),
      sessionId: '',
      tasks: [],
      continuity: null,
    };
  }
}

async function smokeState(baseUrl: string, token: string, sessionId: string): Promise<{ result: SmokeResult; tasks: any[]; }> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/web/state?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: authHeaders(token),
    }, 8000);
    const payload = await response.json() as Record<string, any>;
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
  } catch (error: any) {
    return {
      result: makeResult('Estado web', 'FALHOU', error?.message || String(error)),
      tasks: [],
    };
  }
}

async function smokeCatalog(baseUrl: string, token: string, sessionId: string): Promise<SmokeResult> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/web/catalog?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: authHeaders(token),
    }, 30000);
    const payload = await response.json() as Record<string, any>;
    const catalog = payload.catalog || {};
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `status ${response.status}`);
    }

    const commands = Array.isArray(catalog.commands) ? catalog.commands.length : 0;
    const suggestions = Array.isArray(catalog.suggestedActions) ? catalog.suggestedActions.length : 0;
    return makeResult('Catalogo', 'PASSOU', `${commands} comando(s) e ${suggestions} sugestao(oes) disponiveis.`);
  } catch (error: any) {
    return makeResult('Catalogo', 'FALHOU', error?.message || String(error));
  }
}

function collectPreviewCandidate(tasks: any[]): PreviewCandidate | null {
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
    const firstTarget = targetFiles.find((entry: unknown) => String(entry || '').trim());
    if (firstTarget) {
      return {
        path: String(firstTarget).trim(),
        label: String(firstTarget).trim(),
      };
    }
  }
  return null;
}

async function smokePreview(baseUrl: string, token: string, tasks: any[]): Promise<SmokeResult> {
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
    const payload = await response.json() as Record<string, any>;
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
  } catch (error: any) {
    return makeResult('Preview arquivo', 'AVISO', error?.message || String(error), false);
  }
}

async function smokeEvents(baseUrl: string, token: string, sessionId: string): Promise<SmokeResult> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/web/events?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: authHeaders(token) },
      3000,
    );
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    if (!contentType.includes('text/event-stream')) {
      throw new Error(`content-type inesperado: ${contentType || 'vazio'}`);
    }

    return makeResult('Stream SSE', 'PASSOU', 'Endpoint SSE respondeu com content-type correto.');
  } catch (error: any) {
    return makeResult('Stream SSE', 'AVISO', error?.message || String(error), false);
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let baseUrl = await resolveBaseUrl(args.baseUrl || '');
  const token = resolveToken(args.token || '');
  const waitMs = Number.isFinite(args.waitMs) ? Number(args.waitMs) : 20_000;

  console.log(`Smoke do app web em ${baseUrl}\n`);

  let ready = await waitForAppShell(baseUrl, waitMs);
  if (!ready) {
    console.log('Host ainda nao respondeu; tentando subir pelo caminho oficial.\n');
    ensureHostStarted();
    baseUrl = await resolveBaseUrl(args.baseUrl || '');
    ready = await waitForAppShell(baseUrl, Math.max(waitMs, 60_000));
  }
  if (!ready) {
    console.log(`Host nao respondeu em ${baseUrl}/dashboard dentro de ${waitMs}ms.\n`);
  }

  const results: SmokeResult[] = [];
  results.push(await smokeHtmlShell(baseUrl));
  results.push(await smokeAuth(baseUrl, token));
  results.push(await smokeHostStatus(baseUrl, token));

  const session = await smokeSession(baseUrl, token);
  results.push(session.result);

  let tasks: any[] = [];
  if (session.sessionId) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const stateResult = await smokeState(baseUrl, token, session.sessionId);
    results.push(stateResult.result);
    tasks = stateResult.tasks;
    results.push(await smokeCatalog(baseUrl, token, session.sessionId));
    results.push(await smokeEvents(baseUrl, token, session.sessionId));
  }

  results.push(await smokePreview(baseUrl, token, tasks));

  console.log('Resumo do smoke web:');
  for (const result of results) {
    console.log(`${result.name.padEnd(18, ' ')} ${result.status.padEnd(6, ' ')} ${result.detail}`);
  }

  const blockingFailures = results.filter((entry) => entry.required && entry.status === 'FALHOU');
  if (blockingFailures.length) {
    console.log('\nSmoke do app web terminou com falhas bloqueantes.');
    process.exit(1);
  }

  console.log('\nSmoke do app web finalizado sem falhas bloqueantes.');
}

run().catch((error) => {
  console.error('Falha inesperada no smoke do app web:', error);
  process.exit(1);
});
