import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = require('electron');
const mainPath = resolve(root, 'electron', 'main.cjs');
const receivedRuntimeActions = [];

function runtimeStateSnapshot() {
  return {
    state: {
      model: { id: 'zavorth:core', label: 'Zavorth Core' },
      effort: { level: 'standard' },
      workspace: { id: 'local', label: 'Local', kind: 'local', path: null },
    },
    projections: {
      statusbar: {
        runtimeStatus: 'ready',
        modelLabel: 'Zavorth Core',
        effortLabel: 'standard',
        workspaceLabel: 'Local',
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
      summary: 'Electron smoke runtime ready.',
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
      summary: 'Electron smoke runtime ready.',
      activeTask: null,
      health: 'ready',
      nextSteps: [],
      pendingApprovals: 0,
      pendingLearning: 0,
    },
    actionCards: [],
    nextActions: [],
    health: { status: 'ready', summary: 'Electron smoke runtime ready.', warnings: [] },
    raw: {
      runtimeState: runtimeStateSnapshot(),
    },
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let body = {};
  if (req.method !== 'GET') {
    body = await readBody(req).catch(() => ({}));
  }
  const send = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  if (url.pathname === '/api/experience/runtime-state/action' && req.method === 'POST') {
    receivedRuntimeActions.push(body);
    send(200, {
      ok: true,
      applied: true,
      receipt: { id: `smoke-${receivedRuntimeActions.length}`, action: body.type },
      snapshot: runtimeStateSnapshot(),
    });
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
  send(404, { ok: false, error: `Unhandled smoke endpoint: ${url.pathname}` });
});

await new Promise((resolveListen) => {
  server.listen(0, '127.0.0.1', resolveListen);
});
const port = server.address().port;

const app = await electron.launch({
  executablePath: electronExecutable,
  args: [mainPath],
  cwd: root,
  env: {
    ...process.env,
    ZAVORTH_ROOT: resolve(root, '..', '..'),
    ZAVORTH_WEB_HOST: '127.0.0.1',
    ZAVORTH_WEB_PORT: String(port),
    ZAVORTH_WEB_AUTH_TOKEN: randomBytes(36).toString('base64url'),
  },
});

try {
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForSelector('.zvd-statusbar', { timeout: 15000 });

  const title = await window.title();
  if (title !== 'Zavorth') {
    throw new Error(`Unexpected window title: ${title}`);
  }

  const statusbarItems = await window.locator('.zvd-statusbar button').count();
  if (statusbarItems < 4) {
    throw new Error(`Expected runtime statusbar controls, found ${statusbarItems}.`);
  }

  await window.getByTitle('Toggle terminal (Ctrl+J)').click();
  await window.waitForSelector('.zvd-terminal-panel', { timeout: 5000 });
  await waitForRuntimeAction('session', 'open');

  await window.getByTitle('Model settings').click();
  await waitForRuntimeAction('gateway', 'open');

  await window.getByTitle('Effort settings').click();
  await waitForRuntimeAction('agents', 'sync');

  console.log(JSON.stringify({
    status: 'pass',
    title,
    statusbarItems,
    runtimeActions: receivedRuntimeActions.map((action) => action.payload?.domain),
    checked: [
      'electron-window',
      'renderer-loaded',
      'statusbar-present',
      'bottom-terminal-toggle',
      'desktop-bridge-runtime-action',
      'gateway-model-control-action',
      'agents-effort-control-action',
    ],
  }, null, 2));
} finally {
  await app.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function waitForRuntimeAction(domain, operation) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const found = receivedRuntimeActions.some((action) => (
      action?.payload?.domain?.domain === domain
      && action?.payload?.domain?.operation === operation
    ));
    if (found) {
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Runtime action not received: ${domain}/${operation}`);
}
