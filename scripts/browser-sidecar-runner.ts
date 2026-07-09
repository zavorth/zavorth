#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';

import fs from 'fs';
import http from 'http';
import path from 'path';

type BrowserSidecarState = 'ready' | 'stopped' | 'failed';

type BrowserSidecarStatus = {
  version: 1;
  id: 'browser';
  state: BrowserSidecarState;
  running: boolean;
  ready: boolean;
  pid: number | null;
  port: number;
  healthUrl: string;
  spawnedByZavorth: boolean;
  browserAttached: boolean;
  currentUrl: string | null;
  currentTitle: string | null;
  message: string;
  updatedAt: string;
};

type BrowserRuntime = {
  browser: any | null;
  page: any | null;
  currentUrl: string | null;
  currentTitle: string | null;
  browserAttached: boolean;
};

function readArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

const statusFile = path.resolve(process.cwd(), readArg('status-file', 'data/runtime/browser-sidecar-v2.json'));
const screenshotFile = path.resolve(
  process.cwd(),
  readArg('screenshot-file', 'data/runtime/browser-sidecar-latest-screenshot.png'),
);
const port = clampNumber(readArg('port', '20187'), 20187, 1024, 65535);
const heartbeatMs = clampNumber(readArg('heartbeat-ms', '5000'), 5_000, 1_000, 60_000);
const idleTimeoutMs = clampNumber(readArg('idle-timeout-ms', '180000'), 180_000, 10_000, 3_600_000);
const healthUrl = `http://127.0.0.1:${port}/health`;
const runtime: BrowserRuntime = {
  browser: null,
  page: null,
  currentUrl: null,
  currentTitle: null,
  browserAttached: false,
};

let closed = false;
let heartbeat: NodeJS.Timeout | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let server: http.Server | null = null;

function writeStatus(state: BrowserSidecarState, message: string): void {
  fs.mkdirSync(path.dirname(statusFile), { recursive: true });
  const status: BrowserSidecarStatus = {
    version: 1,
    id: 'browser',
    state,
    running: state === 'ready',
    ready: state === 'ready',
    pid: state === 'ready' ? process.pid : null,
    port,
    healthUrl,
    spawnedByZavorth: state === 'ready',
    browserAttached: runtime.browserAttached,
    currentUrl: runtime.currentUrl,
    currentTitle: runtime.currentTitle,
    message,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(statusFile, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
}

function respondJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(body);
}

function readRequestBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function normalizeUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error('Missing url.');
  }
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https URLs are allowed.');
  }
  if (url.hostname === '169.254.169.254') {
    throw new Error('Metadata service URLs are not allowed.');
  }
  return url.toString();
}

async function ensurePage(): Promise<any> {
  if (runtime.page && !runtime.page.isClosed()) {
    return runtime.page;
  }
  const playwright = await import('playwright');
  runtime.browser = runtime.browser || await playwright.chromium.launch({ headless: true });
  runtime.page = await runtime.browser.newPage();
  runtime.browserAttached = true;
  writeStatus('ready', 'Browser automation attached on demand.');
  return runtime.page;
}

async function closeBrowser(): Promise<void> {
  if (runtime.page && !runtime.page.isClosed()) {
    await runtime.page.close().catch(() => undefined);
  }
  runtime.page = null;
  if (runtime.browser) {
    await runtime.browser.close().catch(() => undefined);
  }
  runtime.browser = null;
  runtime.browserAttached = false;
}

function refreshIdleTimer(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  idleTimer = setTimeout(() => {
    shutdown('idle-timeout').catch(() => process.exit(1));
  }, idleTimeoutMs);
  idleTimer.unref();
}

async function handleAction(route: string, body: Record<string, unknown>): Promise<unknown> {
  const startedAt = Date.now();
  refreshIdleTimer();
  if (route === '/navigate') {
    const page = await ensurePage();
    const url = normalizeUrl(body.url);
    const waitUntil = ['load', 'domcontentloaded', 'networkidle', 'commit'].includes(String(body.waitUntil || 'load'))
      ? String(body.waitUntil || 'load')
      : 'load';
    const timeout = clampNumber(body.timeoutMs, 30_000, 1_000, 120_000);
    await page.goto(url, { waitUntil, timeout });
    runtime.currentUrl = page.url();
    runtime.currentTitle = await page.title().catch(() => null);
    writeStatus('ready', `Navigated to ${runtime.currentUrl}.`);
    return { ok: true, url: runtime.currentUrl, title: runtime.currentTitle, elapsedMs: Date.now() - startedAt };
  }
  if (route === '/screenshot') {
    const page = await ensurePage();
    const fullPage = body.fullPage !== false;
    const buffer = await page.screenshot({ fullPage, type: 'png' });
    fs.mkdirSync(path.dirname(screenshotFile), { recursive: true });
    fs.writeFileSync(screenshotFile, buffer);
    return {
      ok: true,
      file: screenshotFile,
      bytes: buffer.length,
      base64: body.base64 ? buffer.toString('base64') : undefined,
      elapsedMs: Date.now() - startedAt,
    };
  }
  if (route === '/extract-text') {
    const page = await ensurePage();
    const maxChars = clampNumber(body.maxChars, 20_000, 1_000, 200_000);
    const text = await page.locator('body').innerText({ timeout: clampNumber(body.timeoutMs, 10_000, 1_000, 60_000) });
    return { ok: true, text: text.slice(0, maxChars), truncated: text.length > maxChars, elapsedMs: Date.now() - startedAt };
  }
  if (route === '/click') {
    const page = await ensurePage();
    const selector = String(body.selector || '').trim();
    if (!selector) {
      throw new Error('Missing selector.');
    }
    await page.click(selector, { timeout: clampNumber(body.timeoutMs, 10_000, 1_000, 60_000) });
    return { ok: true, elapsedMs: Date.now() - startedAt };
  }
  if (route === '/type') {
    const page = await ensurePage();
    const selector = String(body.selector || '').trim();
    if (!selector) {
      throw new Error('Missing selector.');
    }
    await page.fill(selector, String(body.text || ''), { timeout: clampNumber(body.timeoutMs, 10_000, 1_000, 60_000) });
    return { ok: true, elapsedMs: Date.now() - startedAt };
  }
  if (route === '/close') {
    await closeBrowser();
    writeStatus('ready', 'Browser closed; sidecar remains ready.');
    return { ok: true, elapsedMs: Date.now() - startedAt };
  }
  if (route === '/shutdown') {
    respondLaterShutdown();
    return { ok: true, shuttingDown: true, elapsedMs: Date.now() - startedAt };
  }
  throw new Error(`Unknown browser sidecar route: ${route}`);
}

function respondLaterShutdown(): void {
  setImmediate(() => {
    shutdown('api-shutdown').catch(() => process.exit(1));
  });
}

async function shutdown(signal: string): Promise<void> {
  if (closed) {
    return;
  }
  closed = true;
  if (heartbeat) {
    clearInterval(heartbeat);
  }
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  await closeBrowser();
  writeStatus('stopped', `Browser sidecar stopped by ${signal}.`);
  if (server) {
    server.close(() => process.exit(0));
    return;
  }
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(() => process.exit(1));
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(() => process.exit(1));
});
process.on('uncaughtException', (error) => {
  writeStatus('failed', `Browser sidecar failed: ${error.message}`);
  process.exit(1);
});

server = http.createServer(async (request, response) => {
  const route = new URL(request.url || '/', healthUrl).pathname;
  if (request.method === 'GET' && route === '/health') {
    respondJson(response, 200, {
      ok: true,
      id: 'browser',
      pid: process.pid,
      ready: true,
      browserAttached: runtime.browserAttached,
      currentUrl: runtime.currentUrl,
      currentTitle: runtime.currentTitle,
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  if (request.method !== 'POST') {
    respondJson(response, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }
  try {
    const body = await readRequestBody(request);
    const payload = await handleAction(route, body);
    respondJson(response, 200, payload);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    respondJson(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.on('error', (error) => {
  writeStatus('failed', `Browser sidecar server failed: ${error.message}`);
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  writeStatus('ready', `Browser sidecar API ready at ${healthUrl}.`);
  refreshIdleTimer();
  heartbeat = setInterval(() => {
    writeStatus('ready', 'Browser sidecar heartbeat.');
  }, heartbeatMs);
  heartbeat.unref();
});
