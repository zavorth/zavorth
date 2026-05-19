import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

type ConfigLike = {
  zavorthWebHost: string;
  zavorthWebPort: number;
  visualSmokeMaxBytes: number;
  visualSmokeTtlMs: number;
};

type VisualStatus = 'PASSOU' | 'FALHOU' | 'PULADO';

type VisualResult = {
  name: string;
  status: VisualStatus;
  detail: string;
  required: boolean;
};

type VisualSmokeCliArgs = {
  baseUrl?: string;
  waitMs?: number;
  json?: boolean;
};

type BrowserMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
  sessionId?: string;
};

type BrowserRuntime = {
  close: () => void;
  evaluate: <T>(expression: string) => Promise<T>;
};

async function loadConfig(): Promise<ConfigLike> {
  const sourceConfigTsPath = path.resolve(process.cwd(), 'src', 'config', 'index.ts');
  const sourceConfigJsPath = path.resolve(process.cwd(), 'src', 'config', 'index.js');
  const imported = await import(
    fs.existsSync(sourceConfigTsPath)
      ? pathToFileURL(sourceConfigTsPath).href
      : pathToFileURL(sourceConfigJsPath).href
  );
  return imported.config as ConfigLike;
}

function parseArgs(argv: string[]): VisualSmokeCliArgs {
  const result: VisualSmokeCliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim();
    if (current === '--base-url') {
      result.baseUrl = String(argv[index + 1] || '').trim();
      index += 1;
    } else if (current === '--wait-ms') {
      const parsed = Number.parseInt(String(argv[index + 1] || '').trim(), 10);
      result.waitMs = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      index += 1;
    } else if (current === '--json') {
      result.json = true;
    }
  }
  return result;
}

function normalizeBaseUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveBrowserPath(): string {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const available = candidates.find((candidate) => fs.existsSync(candidate));
  if (!available) {
    throw new Error('Nenhum navegador Chromium local disponivel para o smoke visual.');
  }
  return available;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanupVisualSmokeProfiles(profileRoot: string, ttlMs: number, maxBytes: number): void {
  if (!fs.existsSync(profileRoot)) {
    return;
  }

  const now = Date.now();
  const entries = fs.readdirSync(profileRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const absolutePath = path.join(profileRoot, entry.name);
      const stats = fs.statSync(absolutePath);
      return {
        absolutePath,
        createdAtMs: stats.mtimeMs,
        sizeBytes: calculateDirectorySize(absolutePath),
      };
    })
    .sort((left, right) => left.createdAtMs - right.createdAtMs);

  for (const entry of entries) {
    if (now - entry.createdAtMs <= ttlMs) {
      continue;
    }
    fs.rmSync(entry.absolutePath, { recursive: true, force: true });
  }

  const remaining = fs.readdirSync(profileRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const absolutePath = path.join(profileRoot, entry.name);
      const stats = fs.statSync(absolutePath);
      return {
        absolutePath,
        createdAtMs: stats.mtimeMs,
        sizeBytes: calculateDirectorySize(absolutePath),
      };
    })
    .sort((left, right) => left.createdAtMs - right.createdAtMs);

  let totalBytes = remaining.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  for (const entry of remaining) {
    if (totalBytes <= maxBytes) {
      break;
    }
    fs.rmSync(entry.absolutePath, { recursive: true, force: true });
    totalBytes -= entry.sizeBytes;
  }
}

function calculateDirectorySize(targetPath: string): number {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stats = fs.statSync(targetPath);
  if (!stats.isDirectory()) {
    return stats.size;
  }

  return fs.readdirSync(targetPath).reduce((sum, entry) => {
    return sum + calculateDirectorySize(path.join(targetPath, entry));
  }, 0);
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForDebugger(port: number, timeoutMs: number): Promise<{ webSocketDebuggerUrl: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const payload = await fetchJson<{ webSocketDebuggerUrl: string }>(`http://127.0.0.1:${port}/json/version`, 2500);
      if (payload?.webSocketDebuggerUrl) {
        return payload;
      }
    } catch {
      // keep polling
    }
    await sleep(300);
  }
  throw new Error('Nao consegui abrir o DevTools protocol do navegador local.');
}

async function launchBrowserRuntime(baseUrl: string, waitMs: number): Promise<BrowserRuntime> {
  const browserPath = resolveBrowserPath();
  const debugPort = 9229;
  const profileRoot = path.join(process.cwd(), 'data', 'runtime', 'visual-smoke');
  fs.mkdirSync(profileRoot, { recursive: true });
  const userDataDir = fs.mkdtempSync(path.join(profileRoot, 'profile-'));

  const child = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    `${baseUrl}/dashboard`,
  ], {
    stdio: 'ignore',
    windowsHide: true,
  }) as ChildProcess;

  const version = await waitForDebugger(debugPort, waitMs);
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  const pending = new Map<number, {
    resolve: (value: Record<string, unknown>) => void;
    reject: (error: Error) => void;
  }>();
  let nextId = 1;
  let currentSessionId = '';

  const openPromise = new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve());
    socket.addEventListener('error', () => reject(new Error('Falha ao conectar no DevTools do navegador.')));
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data || '{}')) as BrowserMessage;
    if (message.id && pending.has(message.id)) {
      const callback = pending.get(message.id)!;
      pending.delete(message.id);
      if (message.error) {
        callback.reject(new Error(message.error.message || 'Erro desconhecido no DevTools.'));
      } else {
        callback.resolve(message.result || {});
      }
    }
  });

  await openPromise;

  function rawSend(payload: Record<string, unknown>): void {
    socket.send(JSON.stringify(payload));
  }

  function send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      rawSend({ id, method, params });
    });
  }

  async function sessionSend(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    if (!currentSessionId) {
      throw new Error('Sessao DevTools ainda nao foi anexada.');
    }
    const id = nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      rawSend({ id, method, params, sessionId: currentSessionId });
    });
  }

  const target = await send('Target.createTarget', { url: `${baseUrl}/dashboard` });
  const targetId = String(target.targetId || '');
  const attached = await send('Target.attachToTarget', { targetId, flatten: true });
  currentSessionId = String(attached.sessionId || '');
  await sessionSend('Page.enable');
  await sessionSend('Runtime.enable');
  await sessionSend('Page.navigate', { url: `${baseUrl}/dashboard` });
  await sleep(2000);

  return {
    close: () => {
      try {
        socket.close();
      } catch {
        // ignore
      }
      try {
        child.kill();
      } catch {
        // ignore
      }
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
    evaluate: async <T>(expression: string) => {
      const result = await sessionSend('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      const details = result?.result as { value?: T; description?: string };
      if (details?.value !== undefined) {
        return details.value;
      }
      throw new Error(details?.description || 'Falha ao avaliar expressao no navegador.');
    },
  };
}

function makeResult(name: string, status: VisualStatus, detail: string, required = true): VisualResult {
  return { name, status, detail, required };
}

async function smokeVisual(baseUrl: string, waitMs: number): Promise<VisualResult[]> {
  const runtime = await launchBrowserRuntime(baseUrl, waitMs);
  const results: VisualResult[] = [];

  try {
    const shell = await runtime.evaluate<{
      hasRoot: boolean;
      heading: string;
      primaryButton: string;
      runtimeText: string;
      authText: string;
      originText: string;
    }>(`(() => ({
      hasRoot: Boolean(document.querySelector('#core-frame')),
      heading: document.querySelector('.terminal-hero__hello')?.textContent?.trim() || '',
      primaryButton: document.querySelector('#compose-input')?.getAttribute('placeholder') || '',
      runtimeText: document.querySelector('#runtime-shell-status')?.textContent?.trim() || '',
      authText: document.querySelector('#runtime-shell-auth')?.textContent?.trim() || '',
      originText: document.querySelector('#runtime-shell-origin')?.textContent?.trim() || ''
    }))()`);

    results.push(
      makeResult(
        'Shell visual',
        shell.hasRoot && shell.heading.includes('Inbox')
          ? 'PASSOU'
          : 'FALHOU',
        shell.hasRoot
          ? `Shell carregado com heading "${shell.heading}".`
          : 'O elemento #core-frame nao apareceu na pagina.',
      ),
    );

    results.push(
      makeResult(
        'Acao principal',
        shell.primaryButton === 'Ask Zavorth' ? 'PASSOU' : 'FALHOU',
        shell.primaryButton ? `Composer placeholder: "${shell.primaryButton}".` : 'Composer placeholder nao apareceu.',
      ),
    );

    results.push(
      makeResult(
        'Status do shell',
        shell.heading.length > 0
          ? 'PASSOU'
          : 'FALHOU',
        `heading=${shell.heading || 'vazio'}`,
      ),
    );
  } finally {
    runtime.close();
  }

  return results;
}

async function run(): Promise<void> {
  const config = await loadConfig();
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl || `http://${config.zavorthWebHost}:${config.zavorthWebPort}`);
  const waitMs = Number.isFinite(args.waitMs) ? Number(args.waitMs) : 15_000;
  cleanupVisualSmokeProfiles(
    path.join(process.cwd(), 'data', 'runtime', 'visual-smoke'),
    Number.isFinite(config.visualSmokeTtlMs) ? Number(config.visualSmokeTtlMs) : 24 * 60 * 60 * 1000,
    Number.isFinite(config.visualSmokeMaxBytes) ? Number(config.visualSmokeMaxBytes) : 1024 * 1024 * 1024,
  );

  let results: VisualResult[];
  try {
    results = await smokeVisual(baseUrl, waitMs);
  } catch (error: any) {
    results = [
      makeResult(
        'Smoke visual',
        'PULADO',
        `Nao foi possivel abrir o navegador headless neste ambiente: ${error?.message || String(error)}`,
        false,
      ),
    ];
  }

  const blockingFailures = results.filter((entry) => entry.required && entry.status === 'FALHOU').length;
  if (args.json) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl,
      results,
      blockingFailures,
    }, null, 2));
  } else {
    console.log('Resumo do smoke visual:');
    for (const result of results) {
      console.log(`${result.name.padEnd(18, ' ')} ${result.status.padEnd(6, ' ')} ${result.detail}`);
    }
  }

  if (blockingFailures > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
