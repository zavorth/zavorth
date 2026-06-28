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
const receivedApiPaths = [];

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

function runtimeCapabilitiesSnapshot() {
  return {
    contractVersion: 'zavorth-runtime-capabilities/1',
    generatedAt: new Date().toISOString(),
    capabilities: {
      summary: { available: 4, blocked: 0, configurable: 3, pending: 1 },
      available: [{ id: 'chat.ask', label: 'Ask Zavorth', domain: 'chat' }],
      blocked: [],
      configurable: [{ id: 'provider.anthropic', label: 'Anthropic', reason: 'Needs setup' }],
      pending: [{ id: 'mcp.filesystem', label: 'Filesystem MCP', reason: 'Trust review' }],
    },
    permissions: {
      domains: {
        filesystem: {
          label: 'Filesystem',
          actions: {
            read: { default: 'allow', requiresApproval: false, scope: 'workspace', reason: 'Workspace read only.' },
            write: { default: 'approval', requiresApproval: true, scope: 'workspace', reason: 'Writes need approval.' },
          },
        },
      },
    },
    modelSpecs: {
      selectedSpecId: 'daily',
      selectedEffort: 'standard',
      specs: [
        {
          id: 'daily',
          label: 'Daily',
          summary: 'Balanced daily work.',
          estimatedCost: 'low',
          maxEffort: 'standard',
          preferredModelIds: ['zavorth:core'],
        },
        {
          id: 'coding',
          label: 'Coding',
          summary: 'Code-heavy work with safer fallbacks.',
          estimatedCost: 'medium',
          maxEffort: 'high',
          preferredModelIds: ['openai:gpt-5'],
        },
      ],
    },
    providers: {
      connected: [{
        id: 'zavorth',
        label: 'Zavorth Core',
        status: 'configured',
        targetHost: '127.0.0.1',
        localLoopback: true,
        defaultRouteAllowed: true,
      }],
      configurable: [{
        id: 'anthropic',
        label: 'Anthropic',
        status: 'needs-setup',
        targetHost: null,
        localLoopback: false,
        defaultRouteAllowed: false,
      }],
      blocked: [],
      all: [{
        id: 'zavorth',
        label: 'Zavorth Core',
        status: 'configured',
        targetHost: '127.0.0.1',
        localLoopback: true,
        defaultRouteAllowed: true,
      }, {
        id: 'anthropic',
        label: 'Anthropic',
        status: 'needs-setup',
        targetHost: null,
        localLoopback: false,
        defaultRouteAllowed: false,
      }],
      selectableModelIds: ['zavorth:core'],
      selectedModelId: 'zavorth:core',
      routingReason: 'Smoke route.',
    },
    workspace: {
      id: 'local',
      label: 'Local',
      path: null,
      isolation: 'chat',
      knowledgeSourceCount: 1,
      untrustedContextWrapping: true,
    },
    workspaceKnowledge: {
      workspaceId: 'local',
      activeWorkspaceLabel: 'Local',
      isolation: 'chat',
      trustedWorkspaceIds: ['local'],
      allowedPaths: [],
      ragSources: [{ id: 'docs', kind: 'document', label: 'Smoke docs', trusted: false }],
      untrustedContextWrapping: true,
    },
    personalOps: {
      connectors: [{
        id: 'email:primary',
        kind: 'email',
        label: 'Primary email',
        status: 'disabled',
        enabled: false,
        readAllowed: false,
        draftAllowed: false,
        sendRequiresApproval: true,
        writeRequiresApproval: true,
      }],
    },
    mcpTrust: {
      servers: [{
        id: 'mcp:filesystem',
        label: 'Filesystem MCP',
        origin: 'local',
        trustState: 'review',
        toolNames: ['read_file'],
        risk: 'medium',
        networkAccess: 'blocked',
        exposedToModel: false,
      }],
      externalServersRequireTrust: true,
    },
    skillHistory: {
      entries: [{
        id: 'skill-history-1',
        skillId: 'native:write-file',
        skillName: 'Write file',
        mode: 'manual',
        source: 'native',
        receiptId: null,
        at: new Date().toISOString(),
      }],
    },
    streamSession: {
      status: 'resumable',
      resumeToken: 'stream-token-smoke',
      resumable: true,
    },
    jobs: {
      status: 'attention',
      summary: '1 orphaned scheduled job detected; 1 recoverable.',
      actionIds: ['runtime.cron.recover'],
    },
    safety: {
      sanitized: true,
      rawSecretsSerialized: false,
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
  receivedApiPaths.push(`${req.method || 'GET'} ${url.pathname}`);
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
  if (url.pathname === '/api/runtime/capabilities') {
    send(200, runtimeCapabilitiesSnapshot());
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
  if (url.pathname === '/api/v2/workspace/approvals/pending') {
    send(200, { data: [] });
    return;
  }
  if (url.pathname === '/api/v2/workspace/task-mandates/pending') {
    send(200, { data: [] });
    return;
  }
  if (url.pathname === '/api/v2/workspace/task-mandates/active') {
    send(200, null);
    return;
  }
  if (url.pathname === '/api/v2/workspace/trust/status') {
    send(200, { trusted: false, status: 'untrusted' });
    return;
  }
  if (url.pathname === '/api/v2/workspace/host-commands/pending') {
    send(200, { data: [] });
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

  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  await window.waitForSelector('.zvd-settings-section[aria-label="Runtime"]', { timeout: 5000 });
  const runtimeTabs = () => window.locator('.zvd-settings-section[aria-label="Runtime"] .zvd-text-tabs button');

  async function clickDetailAction(rowText, buttonText) {
    const deadline = Date.now() + 12000;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const row = window.locator('.zvd-detail-row', { hasText: rowText }).first();
        await row.waitFor({ state: 'visible', timeout: 2000 });
        const button = row.locator('button', { hasText: buttonText }).first();
        await button.waitFor({ state: 'visible', timeout: 2000 });
        const enabled = await button.evaluate((element) => !element.disabled);
        if (!enabled) {
          throw new Error(`Button ${buttonText} in row ${rowText} is disabled.`);
        }
        await button.dispatchEvent('click', { bubbles: true, cancelable: true });
        return;
      } catch (error) {
        lastError = error;
        await window.waitForTimeout(150);
      }
    }
    const visibleText = await window.locator('.zvd-settings-section[aria-label="Runtime"]').innerText().catch(() => '');
    throw new Error(`Could not click ${buttonText} in row ${rowText}. Last error: ${lastError?.message || 'none'}. Visible runtime text: ${visibleText}`);
  }

  await window.getByRole('tab', { name: /Permissions/i }).click();
  try {
    await window.getByText('Code-heavy work with safer fallbacks.').waitFor({ state: 'visible', timeout: 10000 });
  } catch (error) {
    const runtimeText = await window.locator('.zvd-settings-section[aria-label="Runtime"]').innerText().catch(() => '');
    throw new Error(`Runtime permissions tab did not render model spec rows. API paths: ${receivedApiPaths.join(', ')}. Visible runtime text: ${runtimeText}`);
  }
  await clickDetailAction('Coding', 'Select');
  await waitForRuntimeActionType('select-model-spec');
  await clickDetailAction('Anthropic', 'Setup');
  await waitForRuntimeActionType('set-provider-connection');

  await window.getByRole('tab', { name: /Workspace/i }).click();
  await clickDetailAction('Smoke docs', 'Trust source');
  await waitForRuntimeActionType('set-workspace-knowledge');

  await window.getByRole('tab', { name: /^MCP/i }).click();
  await clickDetailAction('Filesystem MCP', 'Trust');
  await waitForRuntimeActionType('set-mcp-trust');

  await window.getByRole('tab', { name: /Skills/i }).click();
  await clickDetailAction('Write file', 'Execute');
  await waitForRuntimeActionType('skill-lifecycle');

  await window.getByRole('tab', { name: /Jobs/i }).click();
  await clickDetailAction('Scheduled jobs', 'Recover');
  await waitForRuntimeActionType('recover-scheduled-jobs');
  await clickDetailAction('Stream session', 'Resume');
  await waitForRuntimeActionType('resume-stream');

  await window.getByRole('tab', { name: /Personal Ops/i }).click();
  await window.locator('.zvd-detail-row', { hasText: 'Primary email' }).locator('button', { hasText: 'Connect Google' }).waitFor();

  console.log(JSON.stringify({
    status: 'pass',
    title,
    statusbarItems,
    runtimeActions: receivedRuntimeActions.map((action) => action.payload?.domain || { type: action.type }),
    checked: [
      'electron-window',
      'renderer-loaded',
      'statusbar-present',
      'bottom-terminal-toggle',
      'desktop-bridge-runtime-action',
      'gateway-model-control-action',
      'agents-effort-control-action',
      'settings-provider-setup-action',
      'settings-model-spec-action',
      'settings-workspace-knowledge-action',
      'settings-mcp-trust-action',
      'settings-skill-lifecycle-action',
      'settings-job-recovery-action',
      'settings-stream-resume-action',
    ],
  }, null, 2));
} finally {
  await app.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function waitForRuntimeActionType(type) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const found = receivedRuntimeActions.some((action) => action?.type === type);
    if (found) {
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Runtime action type not received: ${type}`);
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
