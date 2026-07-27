/**
 * Shared Electron + local runtime fixture harness for visual / a11y / smoke checks.
 */
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const electronExecutable = require('electron');
const mainPath = resolve(root, 'electron', 'main.cjs');

function runtimeStateSnapshot() {
  return {
    state: {
      model: { id: 'zavorth:core', label: 'Zavorth Core' },
      effort: { level: 'standard' },
      workspace: { id: 'local', label: 'local', kind: 'local', path: null },
    },
    projections: {
      statusbar: {
        runtimeStatus: 'ready',
        modelLabel: 'Zavorth Core',
        effortLabel: 'standard',
        workspaceLabel: 'local',
        pendingApprovals: 0,
      },
    },
  };
}

function homeSnapshot() {
  return {
    contractVersion: 'experience.snapshot/1',
    generatedAt: new Date().toISOString(),
    surface: 'web',
    sessionId: 'desktop-main',
    workspace: null,
    agent: {
      status: 'ready',
      label: 'Zavorth Experience Core',
      summary: 'Desktop harness runtime ready.',
      activeRunId: null,
      activeRunStatus: null,
      modelLabel: 'Zavorth Core',
      providerLabel: 'Zavorth',
    },
    chat: { messages: [], suggestions: [] },
    approvals: [],
    timeline: [],
    receipts: [],
    memory: { signals: [], summary: 'Memory ready.' },
    learning: { candidates: [], summary: 'No learning pending.', pending: 0 },
    daily: {
      summary: 'Desktop harness runtime ready.',
      activeTask: null,
      health: 'ready',
      nextSteps: [],
      pendingApprovals: 0,
      pendingLearning: 0,
    },
    actionCards: [],
    nextActions: [],
    health: { status: 'ready', summary: 'Desktop harness runtime ready.', warnings: [] },
    raw: { runtimeState: runtimeStateSnapshot() },
  };
}

function runtimeCapabilitiesSnapshot() {
  return {
    contractVersion: 'zavorth-runtime-capabilities/1',
    generatedAt: new Date().toISOString(),
    capabilities: {
      summary: { available: 2, blocked: 0, configurable: 1, pending: 0 },
      available: [{ id: 'chat.ask', label: 'Ask Zavorth', domain: 'chat' }],
      blocked: [],
      configurable: [],
      pending: [],
    },
    permissions: { domains: {} },
    modelSpecs: {
      selectedSpecId: 'daily',
      selectedEffort: 'standard',
      specs: [{ id: 'daily', label: 'Daily', summary: 'Balanced.', estimatedCost: 'low', maxEffort: 'standard', preferredModelIds: ['zavorth:core'] }],
    },
    providers: {
      connected: [{ id: 'zavorth', label: 'Zavorth Core', status: 'configured', targetHost: '127.0.0.1', localLoopback: true, defaultRouteAllowed: true }],
      configurable: [],
      blocked: [],
      all: [{ id: 'zavorth', label: 'Zavorth Core', status: 'configured', targetHost: '127.0.0.1', localLoopback: true, defaultRouteAllowed: true }],
      selectableModelIds: ['zavorth:core'],
      selectedModelId: 'zavorth:core',
      routingReason: 'Harness route.',
    },
    workspace: { id: 'local', label: 'local', path: null, isolation: 'chat', knowledgeSourceCount: 0, untrustedContextWrapping: true },
    workspaceKnowledge: {
      workspaceId: 'local',
      activeWorkspaceLabel: 'local',
      isolation: 'chat',
      trustedWorkspaceIds: ['local'],
      allowedPaths: [],
      ragSources: [],
      untrustedContextWrapping: true,
    },
    personalOps: { connectors: [] },
    mcpTrust: { servers: [], externalServersRequireTrust: true },
    skillHistory: { entries: [] },
    streamSession: { status: 'idle', resumeToken: null, resumable: false },
    jobs: { status: 'ok', summary: 'No jobs.', actionIds: [] },
    safety: { sanitized: true, rawSecretsSerialized: false },
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function createLocalRuntimeFixtureServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method !== 'GET') {
      await readBody(req).catch(() => ({}));
    }
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    if (url.pathname === '/api/experience/runtime-state/action' && req.method === 'POST') {
      send(200, { ok: true, applied: true, receipt: { id: 'harness-1' }, snapshot: runtimeStateSnapshot() });
      return;
    }
    if (url.pathname === '/api/experience/home') {
      send(200, homeSnapshot());
      return;
    }
    if (url.pathname === '/api/experience/approvals') {
      send(200, { approvals: [] });
      return;
    }
    if (url.pathname === '/api/experience/learning') {
      send(200, { candidates: [] });
      return;
    }
    if (url.pathname === '/api/runtime/capabilities') {
      send(200, runtimeCapabilitiesSnapshot());
      return;
    }
    if (url.pathname === '/desktop-update.json') {
      send(200, {
        latestVersion: '0.1.0',
        changelog: ['Deterministic Desktop visual-test release fixture.'],
        downloadUrl: null,
      });
      return;
    }
    if (url.pathname === '/api/v2/echo/tools') {
      send(200, { tools: [] });
      return;
    }
    if (url.pathname === '/api/v2/nexus/status') {
      send(200, { status: 'ready' });
      return;
    }
    if (url.pathname === '/api/experience/memory/encryption') {
      send(200, { status: null });
      return;
    }
    if (url.pathname.startsWith('/api/v2/workspace/')) {
      if (url.pathname.endsWith('/pending') || url.pathname.endsWith('/active')) {
        send(200, url.pathname.endsWith('/active') ? null : { data: [] });
        return;
      }
      if (url.pathname.endsWith('/status')) {
        send(200, { trusted: false, status: 'untrusted' });
        return;
      }
    }
    send(200, { ok: true });
  });

  return {
    server,
    async listen() {
      await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
      return server.address().port;
    },
    async close() {
      await new Promise((resolveClose) => server.close(resolveClose));
    },
  };
}

export async function launchDesktopHarness(options = {}) {
  const fixtureServer = createLocalRuntimeFixtureServer();
  const port = await fixtureServer.listen();
  const userDataDir = mkdtempSync(resolve(tmpdir(), 'zavorth-desktop-e2e-'));
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [`--user-data-dir=${userDataDir}`, mainPath],
    cwd: root,
    env: {
      ...process.env,
      ZAVORTH_ROOT: resolve(root, '..', '..'),
      ZAVORTH_HOME: userDataDir,
      ZAVORTH_WEB_HOST: '127.0.0.1',
      ZAVORTH_WEB_PORT: String(port),
      ZAVORTH_WEB_AUTH_TOKEN: randomBytes(36).toString('base64url'),
      ZAVORTH_UPDATE_MANIFEST_URL: `http://127.0.0.1:${port}/desktop-update.json`,
      ...(options.env || {}),
    },
  });

  const window = await app.firstWindow();
  if (options.logConsole) {
    window.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    window.on('pageerror', (err) => console.error('PAGE ERROR:', err.stack || err.message));
  }

  await window.waitForSelector('.zvd-app', { timeout: options.timeoutMs || 20000 });

  // Dismiss first-run onboarding so shell surfaces are reachable unless a visual
  // check explicitly needs to capture the onboarding itself.
  if (options.dismissOnboarding !== false) {
    try {
      const skip = window.locator('.zvd-onboarding-overlay button', { hasText: /Pular|Skip/i }).first();
      if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skip.click({ force: true });
        await window.waitForSelector('.zvd-onboarding-overlay', { state: 'detached', timeout: 5000 }).catch(() => undefined);
      }
    } catch {
      // already onboarded
    }
  }

  await window.waitForSelector('.zvd-statusbar, .zvd-thread, .zvd-sidebar', { timeout: 8000 }).catch(() => undefined);

  return {
    root,
    app,
    window,
    fixtureServer,
    async close() {
      await app.close().catch(() => undefined);
      await fixtureServer.close().catch(() => undefined);
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

/**
 * Open a sidebar panel by stable data-panel id (preferred) or visible label pattern.
 * Secondary panels live under the "More" overflow.
 */
export async function openSidebarPanel(window, panelOrPattern) {
  const isId = typeof panelOrPattern === 'string' && !panelOrPattern.includes('/') && panelOrPattern.length < 32
    && !panelOrPattern.startsWith('(');

  if (typeof panelOrPattern === 'string' && /^[a-z][a-z0-9-]*$/i.test(panelOrPattern)) {
    let btn = window.locator(`.zvd-sidebar-nav button[data-panel="${panelOrPattern}"]`).first();
    if (!(await btn.count())) {
      // Expand More for secondary panels
      const more = window.locator('.zvd-sidebar-more-toggle').first();
      if (await more.count()) {
        const expanded = await more.getAttribute('aria-expanded');
        if (expanded !== 'true') {
          await more.click({ force: true });
          await window.waitForTimeout(150);
        }
      }
      btn = window.locator(`.zvd-sidebar-nav button[data-panel="${panelOrPattern}"]`).first();
    }
    if (await btn.count()) {
      await btn.click({ force: true });
      await window.waitForTimeout(200);
      return true;
    }
  }

  const namePattern = panelOrPattern;
  const btn = window.locator('.zvd-sidebar-nav button', { hasText: namePattern }).first();
  if (await btn.count()) {
    await btn.click({ force: true });
    return true;
  }
  const more = window.locator('.zvd-sidebar-more-toggle').first();
  if (await more.count()) {
    const expanded = await more.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await more.click({ force: true });
      await window.waitForTimeout(150);
    }
  }
  const again = window.locator('.zvd-sidebar-nav button', { hasText: namePattern }).first();
  if (await again.count()) {
    await again.click({ force: true });
    return true;
  }
  return false;
}

/** Stabilize animations before screenshots / a11y scans. */
export async function stabilizePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
  }).catch(() => undefined);
  await page.evaluate(() => {
    try {
      document.documentElement.dataset.density = document.documentElement.dataset.density || 'comfortable';
    } catch {
      // ignore
    }
  }).catch(() => undefined);
  await page.waitForTimeout(100);
}

/**
 * Capture a PNG of the Electron window.
 * Prefers a CSS-viewport renderer capture; native capturePage is a fallback
 * because Windows can expose transient partial repaints between lazy panels.
 */
export async function captureScreenshot(page, outPath, app = null) {
  await stabilizePage(page);

  try {
    const nativeViewport = app
      ? await app.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
          if (!win) return null;
          const [width, height] = win.getContentSize();
          return { width, height };
        })
      : null;
    const viewport = nativeViewport || await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    }));
    await page.screenshot({
      path: outPath,
      clip: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      },
      animations: 'disabled',
      caret: 'hide',
      timeout: 10000,
    });
    return true;
  } catch (error) {
    if (!app) {
      throw new Error(`screenshot failed for ${outPath}: ${error.message}`);
    }
    console.warn(`WARN  renderer screenshot failed; using Electron fallback: ${error.message}`);
  }

  try {
    const { writeFileSync } = await import('node:fs');
    const png = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (!win) return null;
      const image = await win.capturePage();
      return image.toPNG().toString('base64');
    });
    if (png) {
      writeFileSync(outPath, Buffer.from(png, 'base64'));
      return true;
    }
  } catch (error) {
    throw new Error(`screenshot failed for ${outPath}: ${error.message}`);
  }

  throw new Error(`screenshot failed for ${outPath}: no renderer or Electron image available`);
}

export { root };
