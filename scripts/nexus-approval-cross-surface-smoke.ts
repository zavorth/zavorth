import assert from 'node:assert/strict';
import http from 'node:http';
import { NexusClientService } from '../agent/src/NexusClientService.ts';
import {
  createNexusSurfaceClient,
  type PermissionRequest,
} from '../../Zavorth-Modern-UI/src/api/nexusSurfaceClient.ts';
import { TelegramNexusSurfaceClient } from '../src/telegram/TelegramNexusSurfaceClient.ts';

const approvalId = 'approval-cross-surface-1';
const runId = 'run-cross-surface-1';
const traceId = 'trace-cross-surface-1';
const agentSessionId = 'agent-cross-surface-session';
const modernSessionId = 'modern-ui-cross-surface-session';
const telegramChatId = 'telegram-cross-surface-chat';
const telegramUserId = 'telegram-cross-surface-user';
const telegramSessionId = 'telegram-cross-surface-session';

let pending = true;

const pendingEntry = buildExecutionEntry({
  status: 'permission_pending',
  finalResponse: `Acao "os_screenshot" requer permissao. ID: ${approvalId}.`,
});
const history: Array<ReturnType<typeof buildExecutionEntry>> = [pendingEntry];

const captured: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const body = await readJsonBody(req);
  captured.push({
    method: req.method || 'GET',
    path: url.pathname,
    body,
  });

  if (req.method === 'GET' && url.pathname === '/api/v2/nexus/history') {
    writeJson(res, history);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/v2/nexus/permissions') {
    writeJson(res, pending ? [buildPermission()] : []);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/v2/nexus/permissions/resolve') {
    const id = String(body.id || '');
    const approved = body.approved === true;
    const resolvedBy = readResolverContext(body);
    if (id !== approvalId || !pending) {
      writeJson(res, { ok: false, id, error: 'approval unavailable' }, 404);
      return;
    }

    pending = false;
    const resolvedEntry = buildExecutionEntry({
      status: approved ? 'success' : 'permission_denied',
      finalResponse: approved
        ? 'Approval cross-surface aprovado.'
        : 'Approval cross-surface negado.',
      resolvedBy,
    });
    history.unshift(resolvedEntry);
    writeJson(res, {
      ok: true,
      id,
      status: approved ? 'approved' : 'denied',
      response: resolvedEntry.finalResponse,
      toolsExecuted: approved ? ['os_screenshot'] : [],
      executionEntry: resolvedEntry,
      correlation: resolvedEntry.correlation,
      resolvedBy,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/v2/nexus/tools') {
    writeJson(res, []);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/v2/nexus/connection') {
    writeJson(res, { online: true, model: 'smoke-model', latencyMs: 4 });
    return;
  }

  writeJson(res, { error: 'not found' }, 404);
});

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  await listen(server);
  try {
    const address = server.address();
    assert(address && typeof address === 'object', 'server should expose a local port');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const agentClient = new NexusClientService({
      baseUrl,
      sessionId: agentSessionId,
      surface: 'agent',
      requestedBy: 'zavorth-agent-smoke',
    });
    const modernClient = createNexusSurfaceClient({
      baseUrl,
      surfaceContext: {
        sessionId: modernSessionId,
        surface: 'modern-ui',
        requestedBy: 'zavorth-modern-ui-smoke',
      },
    });
    const telegramClient = new TelegramNexusSurfaceClient({
      baseUrl,
      chatId: telegramChatId,
      userId: telegramUserId,
      sessionId: telegramSessionId,
      requestedBy: 'zavorth-telegram-smoke',
    });

    const agentBefore = await agentClient.readSurfaceState(5);
    const modernPermissionsBefore = await modernClient.readPermissions();
    const modernHistoryBefore = await modernClient.readHistory(5);
    const telegramBefore = await telegramClient.readSurfaceState(5);

    assert.equal(agentBefore.summary.pendingApprovals, 1);
    assert.equal(agentBefore.pendingPermissions[0]?.approvalId, approvalId);
    assert.equal(agentBefore.pendingPermissions[0]?.runContext?.runId, runId);
    assert.equal(modernPermissionsBefore.length, 1);
    assert.equal(modernPermissionsBefore[0]?.id, approvalId);
    assert.equal(readPermissionCorrelation(modernPermissionsBefore[0])?.runId, runId);
    assert.equal(modernHistoryBefore[0]?.correlation?.runId, runId);
    assert.equal(modernHistoryBefore[0]?.correlation?.approvalId, approvalId);
    assert.equal(telegramBefore.context.surface, 'telegram');
    assert.equal(telegramBefore.context.sessionId, telegramSessionId);
    assert.equal(telegramBefore.summary.pendingApprovals, 1);
    assert.equal(telegramBefore.pendingPermissions[0]?.approvalId, approvalId);
    assert.equal(telegramBefore.pendingPermissions[0]?.correlation?.runId, runId);
    assert.equal(telegramBefore.summary.lastRunId, runId);

    const resolution = await telegramClient.resolvePermission(approvalId, true);
    assert.equal(resolution.ok, true);
    assert.equal(resolution.status, 'approved');
    assert.equal(resolution.executionEntry?.correlation?.runId, runId);
    assert.equal(resolution.executionEntry?.correlation?.approvalId, approvalId);
    assert.equal(resolution.resolvedBy?.surface, 'telegram');
    assert.equal(resolution.resolvedBy?.sessionId, telegramSessionId);
    assert.equal(resolution.resolvedBy?.chatId, telegramChatId);

    const agentAfter = await agentClient.readSurfaceState(5);
    const modernPermissionsAfter = await modernClient.readPermissions();
    const modernHistoryAfter = await modernClient.readHistory(5);
    const telegramAfter = await telegramClient.readSurfaceState(5);

    assert.equal(agentAfter.summary.pendingApprovals, 0);
    assert.equal(agentAfter.summary.lastRunId, runId);
    assert.equal(agentAfter.summary.lastStatus, 'success');
    assert.equal(modernPermissionsAfter.length, 0);
    assert.equal(modernHistoryAfter[0]?.correlation?.runId, runId);
    assert.equal(modernHistoryAfter[0]?.correlation?.approvalId, approvalId);
    assert.equal(readResolvedBySurface(modernHistoryAfter[0]?.metadata), 'telegram');
    assert.equal(telegramAfter.summary.pendingApprovals, 0);
    assert.equal(telegramAfter.summary.lastRunId, runId);
    assert.equal(telegramAfter.summary.lastStatus, 'success');
    assert.equal(readResolvedBySurface(telegramAfter.recentHistory[0]?.metadata), 'telegram');

    const resolveRequest = captured.find((entry) => (
      entry.method === 'POST' && entry.path === '/api/v2/nexus/permissions/resolve'
    ));
    assert(resolveRequest, 'telegram should resolve through the public permission endpoint');
    assert.deepEqual(resolveRequest.body, {
      id: approvalId,
      approved: true,
      sessionId: telegramSessionId,
      surface: 'telegram',
      requestedBy: 'zavorth-telegram-smoke',
      channel: 'telegram',
      chatId: telegramChatId,
      threadId: null,
      userId: telegramUserId,
    });

    console.log('[qa:approval-cross-surface] ok');
  } finally {
    await close(server);
  }
}

function buildExecutionEntry(input: {
  status: 'permission_pending' | 'success' | 'permission_denied';
  finalResponse: string;
  resolvedBy?: Record<string, unknown> | null;
}) {
  const metadata: Record<string, unknown> = {
    source: 'cross-surface-smoke',
    toolsExecuted: input.status === 'success' ? ['os_screenshot'] : [],
  };
  if (input.resolvedBy) {
    metadata.resolvedBy = input.resolvedBy;
  }

  return {
    id: `exec-${input.status}`,
    timestamp: '2026-04-18T12:00:00.000Z',
    prompt: 'capture a tela',
    llmRaw: null,
    toolCalls: [{
      toolName: 'os_screenshot',
      args: { mode: 'fullscreen' },
      securityDecision: input.status === 'permission_pending' ? 'permission_required' : 'approved',
      result: input.finalResponse,
      durationMs: 9,
      correlation: buildCorrelation(),
    }],
    finalResponse: input.finalResponse,
    status: input.status,
    durationMs: 12,
    correlation: buildCorrelation(),
    runContext: {
      traceId,
      runId,
      sessionId: agentSessionId,
      surface: 'agent',
      requestedBy: 'zavorth-agent-smoke',
      profile: 'OS',
    },
    metadata,
  };
}

function buildPermission() {
  return {
    id: approvalId,
    action: 'os_screenshot',
    resource: '{"mode":"fullscreen"}',
    reason: 'Permissao compartilhada para validar paridade cross-surface.',
    status: 'pending',
    requestedAt: '2026-04-18T12:00:00.000Z',
    metadata: {
      kind: 'tool',
      toolName: 'os_screenshot',
      category: 'OS',
      surface: 'agent',
      requestedBy: 'zavorth-agent-smoke',
      correlation: buildCorrelation(),
      runContext: {
        traceId,
        runId,
        sessionId: agentSessionId,
        surface: 'agent',
        requestedBy: 'zavorth-agent-smoke',
        profile: 'OS',
      },
    },
  };
}

function buildCorrelation() {
  return {
    traceId,
    runId,
    sessionId: agentSessionId,
    approvalId,
    artifactId: null,
  };
}

function readPermissionCorrelation(permission: PermissionRequest | undefined) {
  const metadata = isRecord(permission?.metadata) ? permission.metadata : {};
  const correlation = isRecord(metadata.correlation) ? metadata.correlation : {};
  return {
    traceId: String(correlation.traceId || ''),
    runId: String(correlation.runId || ''),
    sessionId: String(correlation.sessionId || '') || null,
    approvalId: String(correlation.approvalId || '') || null,
    artifactId: String(correlation.artifactId || '') || null,
  };
}

function readResolverContext(body: Record<string, unknown>): Record<string, unknown> {
  return {
    sessionId: normalizeNullableText(body.sessionId),
    surface: normalizeNullableText(body.surface) || 'unknown',
    requestedBy: normalizeNullableText(body.requestedBy) || 'unknown',
    channel: normalizeNullableText(body.channel),
    chatId: normalizeNullableText(body.chatId),
    threadId: normalizeNullableText(body.threadId),
    userId: normalizeNullableText(body.userId),
  };
}

function readResolvedBySurface(metadata: unknown): string | null {
  const resolvedBy = isRecord(metadata) && isRecord(metadata.resolvedBy) ? metadata.resolvedBy : null;
  return normalizeNullableText(resolvedBy?.surface);
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(isRecord(parsed) ? parsed : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function writeJson(res: http.ServerResponse, body: unknown, statusCode = 200): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function listen(target: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    target.once('error', reject);
    target.listen(0, '127.0.0.1', () => {
      target.off('error', reject);
      resolve();
    });
  });
}

function close(target: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    target.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
