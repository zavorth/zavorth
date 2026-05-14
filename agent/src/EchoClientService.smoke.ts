import assert from 'node:assert/strict';
import http from 'node:http';
import { EchoClientService } from './EchoClientService.js';

type CapturedRequest = {
  method: string;
  path: string;
  body: Record<string, unknown>;
};

const captured: CapturedRequest[] = [];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const body = await readJsonBody(req);
  const canonicalPath = url.pathname.startsWith('/api/v2/nexus/')
    ? url.pathname.replace('/api/v2/nexus/', '/api/v2/echo/')
    : url.pathname;

  captured.push({
    method: req.method || 'GET',
    path: url.pathname,
    body,
  });

  if (req.method === 'POST' && canonicalPath === '/api/v2/echo/execute') {
    writeJson(res, {
      response: 'Agent smoke accepted.',
      toolsExecuted: ['internal_echo'],
      permissionsRequested: [],
      executionEntry: {
        id: 'exec-agent-smoke',
        timestamp: '2026-04-18T12:00:00.000Z',
        prompt: body.prompt,
        llmRaw: null,
        toolCalls: [],
        finalResponse: 'Agent smoke accepted.',
        status: 'success',
        durationMs: 12,
        correlation: {
          traceId: 'trace-agent-smoke',
          runId: 'run-agent-smoke',
          sessionId: body.sessionId,
          approvalId: null,
          artifactId: null,
        },
        runContext: {
          traceId: 'trace-agent-smoke',
          runId: 'run-agent-smoke',
          sessionId: body.sessionId,
          surface: body.surface,
          requestedBy: body.requestedBy,
          profile: body.category,
        },
        metadata: {
          source: 'agent-smoke',
        },
      },
    });
    return;
  }

  if (req.method === 'GET' && canonicalPath === '/api/v2/echo/connection') {
    writeJson(res, {
      online: true,
      model: 'smoke-model',
      latencyMs: 5,
    });
    return;
  }

  if (req.method === 'GET' && canonicalPath === '/api/v2/echo/tools') {
    writeJson(res, []);
    return;
  }

  if (req.method === 'GET' && canonicalPath === '/api/v2/echo/history') {
    writeJson(res, [{
      id: 'exec-agent-smoke',
      timestamp: '2026-04-18T12:00:00.000Z',
      prompt: 'ping echo from agent',
      status: 'success',
      finalResponse: 'Agent smoke accepted.',
      durationMs: 12,
      toolCalls: [{
        toolName: 'internal_echo',
        lifecycle: {
          mode: 'stateless',
          status: 'completed',
          details: {
            mode: 'stateless',
            status: 'completed',
          },
        },
      }],
      correlation: {
        traceId: 'trace-agent-smoke',
        runId: 'run-agent-smoke',
        sessionId: 'agent-smoke-session',
        approvalId: null,
        artifactId: null,
      },
      runContext: {
        traceId: 'trace-agent-smoke',
        runId: 'run-agent-smoke',
        sessionId: 'agent-smoke-session',
        surface: 'agent',
        requestedBy: 'zavorth-agent-smoke',
        profile: 'INTERNAL',
      },
    }]);
    return;
  }

  if (req.method === 'GET' && canonicalPath === '/api/v2/echo/snapshot') {
    writeJson(res, {
      generatedAt: '2026-04-18T12:00:02.000Z',
      summary: {
        totalTools: 2,
        categoryCounts: { os: 1, iot: 1 },
        recentExecutions: 1,
        ollamaOnline: true,
      },
      tools: [],
      recentHistory: [],
      capabilityLifecycle: [],
      watchMode: null,
      signals: {
        recentPhysicalEvents: [{
          id: 'ha-event-smoke',
          source: 'iot_home_assistant',
          timestamp: '2026-04-18T12:00:02.000Z',
          entityId: 'lock.front_door',
          oldState: 'locked',
          newState: 'unlocked',
          feedback: 'Atencao: lock.front_door mudou para unlocked.',
          severity: 'critical',
        }],
      },
    });
    return;
  }

  if (req.method === 'GET' && canonicalPath === '/api/v2/echo/permissions') {
    writeJson(res, [{
      id: 'perm-agent-smoke',
      action: 'os_screenshot',
      resource: '{"mode":"fullscreen"}',
      reason: 'Agent smoke permission.',
      status: 'pending',
      requestedAt: '2026-04-18T12:00:01.000Z',
      metadata: {
        kind: 'tool',
        toolName: 'os_screenshot',
        category: 'OS',
        surface: 'agent',
        requestedBy: 'zavorth-agent-smoke',
        correlation: {
          traceId: 'trace-agent-smoke',
          runId: 'run-agent-smoke',
          sessionId: 'agent-smoke-session',
          approvalId: null,
          artifactId: null,
        },
        runContext: {
          traceId: 'trace-agent-smoke',
          runId: 'run-agent-smoke',
          sessionId: 'agent-smoke-session',
          surface: 'agent',
          requestedBy: 'zavorth-agent-smoke',
          profile: 'OS',
        },
      },
    }]);
    return;
  }

  writeJson(res, { error: 'not found' }, 404);
});

try {
  await listen(server);
  const address = server.address();
  assert(address && typeof address === 'object', 'server should expose a local port');

  const client = new EchoClientService({
    baseUrl: `http://127.0.0.1:${address.port}`,
    timeoutMs: 5000,
    sessionId: 'agent-smoke-session',
    surface: 'agent',
    requestedBy: 'zavorth-agent-smoke',
  });

  const context = client.getSurfaceContext();
  assert.deepEqual(context, {
    sessionId: 'agent-smoke-session',
    surface: 'agent',
    requestedBy: 'zavorth-agent-smoke',
  });
  assert.equal(client.getApiNamespace(), 'echo');

  const result = await client.processIntent('ping echo from agent', 'INTERNAL');
  assert.equal(result.success, true);
  assert.equal(result.response, 'Agent smoke accepted.');
  assert.deepEqual(result.toolsUsed, ['internal_echo']);
  assert.deepEqual(result.permissionsRequested, []);
  assert.equal(result.durationMs, 12);
  assert.equal(result.executionStatus, 'success');
  assert.equal(result.traceId, 'trace-agent-smoke');
  assert.equal(result.runId, 'run-agent-smoke');
  assert.equal(result.sessionId, 'agent-smoke-session');
  assert.equal(result.runContext?.surface, 'agent');
  assert.equal(result.runContext?.requestedBy, 'zavorth-agent-smoke');
  assert.equal(result.runContext?.profile, 'INTERNAL');

  const executeRequest = captured.find((entry) => entry.path === '/api/v2/echo/execute');
  assert(executeRequest, 'execute request should be captured');
  assert.equal(executeRequest.body.prompt, 'ping echo from agent');
  assert.equal(executeRequest.body.category, 'INTERNAL');
  assert.equal(executeRequest.body.sessionId, 'agent-smoke-session');
  assert.equal(executeRequest.body.surface, 'agent');
  assert.equal(executeRequest.body.requestedBy, 'zavorth-agent-smoke');

  const connection = await client.checkConnection();
  assert.equal(connection.backendOnline, true);
  assert.equal(connection.ollamaOnline, true);
  assert.equal(connection.model, 'smoke-model');

  const alive = await client.isBackendAlive();
  assert.equal(alive, true);

  const history = await client.readHistory(3);
  assert.equal(history.length, 1);
  assert.equal(history[0].runId, 'run-agent-smoke');
  assert.equal(history[0].runContext?.surface, 'agent');
  assert.deepEqual(history[0].toolsUsed, ['internal_echo']);
  assert.equal(history[0].toolStates[0]?.lifecycle?.status, 'completed');

  const permissions = await client.readPendingPermissions();
  assert.equal(permissions.length, 1);
  assert.equal(permissions[0].approvalId, 'perm-agent-smoke');
  assert.equal(permissions[0].runContext?.runId, 'run-agent-smoke');
  assert.equal(permissions[0].surface, 'agent');
  assert.equal(permissions[0].requestedBy, 'zavorth-agent-smoke');

  const surfaceState = await client.readSurfaceState(3);
  assert.equal(surfaceState.summary.pendingApprovals, 1);
  assert.equal(surfaceState.summary.recentRuns, 1);
  assert.equal(surfaceState.summary.lastRunId, 'run-agent-smoke');
  assert.equal(surfaceState.summary.lastStatus, 'success');
  assert.equal(surfaceState.summary.lastCapabilityStatus, 'completed');
  assert.equal(surfaceState.summary.physicalSignals, 1);
  assert.equal(surfaceState.summary.lastPhysicalEventId, 'ha-event-smoke');
  assert.equal(surfaceState.recentPhysicalEvents[0]?.entityId, 'lock.front_door');

  const nexusClient = new EchoClientService({
    baseUrl: `http://127.0.0.1:${address.port}`,
    timeoutMs: 5000,
    sessionId: 'agent-nexus-session',
    surface: 'agent',
    requestedBy: 'zavorth-agent-nexus-smoke',
    apiNamespace: 'nexus',
  });
  assert.equal(nexusClient.getApiNamespace(), 'nexus');

  const nexusResult = await nexusClient.processIntent('ping nexus from agent', 'VOICE');
  assert.equal(nexusResult.success, true);
  assert.equal(nexusResult.response, 'Agent smoke accepted.');
  assert.equal(nexusResult.sessionId, 'agent-nexus-session');

  const nexusExecuteRequest = captured.find((entry) => entry.path === '/api/v2/nexus/execute');
  assert(nexusExecuteRequest, 'nexus execute request should be captured');
  assert.equal(nexusExecuteRequest.body.prompt, 'ping nexus from agent');
  assert.equal(nexusExecuteRequest.body.category, 'VOICE');
  assert.equal(nexusExecuteRequest.body.sessionId, 'agent-nexus-session');
  assert.equal(nexusExecuteRequest.body.surface, 'agent');
  assert.equal(nexusExecuteRequest.body.requestedBy, 'zavorth-agent-nexus-smoke');

  const nexusAlive = await nexusClient.isBackendAlive();
  assert.equal(nexusAlive, true);
  assert(captured.some((entry) => entry.path === '/api/v2/nexus/tools'), 'nexus tools request should be captured');

  console.log('[agent:echo-smoke] ok');
} finally {
  await close(server);
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
