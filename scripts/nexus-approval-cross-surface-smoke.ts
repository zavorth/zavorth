import assert from 'node:assert/strict';
import type * as http from 'node:http';
import { PassThrough } from 'node:stream';
import { ZavorthControlEchoRouteService } from '../src/services/ZavorthControlEchoRouteService.js';

type WriteCall = {
  body: any;
  statusCode: number;
};

type MockResponse = http.ServerResponse & {
  headers: Record<string, string>;
  body: Buffer | null;
};

type ResolverContext = {
  sessionId: string;
  surface: string;
  requestedBy: string;
  channel?: string;
  chatId?: string;
  threadId?: string;
  userId?: string;
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const route = new ZavorthControlEchoRouteService();
  const calls: WriteCall[] = [];
  const resolverContexts: ResolverContext[] = [];
  const gatewayInputs: any[] = [];
  const echo = createEchoDouble(resolverContexts);
  const agentGateway = {
    handle: async (input: any) => {
      gatewayInputs.push(input);
      return {
        ok: true,
        run: {
          id: 'run-cross-surface-1',
          summary: 'Resumo via gateway Nexus.',
          status: 'completed',
        },
        replies: [{ text: 'Response through Agent Gateway.' }],
      };
    },
  };
  const deps = {
    echo: echo as any,
    agentGateway: agentGateway as any,
    writeJson: (_res: http.ServerResponse, body: unknown, statusCode = 200) => {
      calls.push({ body, statusCode });
    },
  };

  const executeHandled = await route.handleRequest(
    createReq('POST', '/api/v2/nexus/execute', {
      prompt: 'verifique o estado operational do Zavorth',
      requestId: 'request-cross-surface-1',
      traceId: 'trace-cross-surface-1',
      sessionId: 'nexus-cross-surface-session',
      requestedBy: 'nexus-smoke',
      userId: 'nexus-user',
      requestedTools: ['echo_hands'],
      category: 'OS',
    }),
    createRes(),
    new URL('http://localhost/api/v2/nexus/execute'),
    '/api/v2/nexus/execute',
    deps,
  );

  assert.equal(executeHandled, true);
  assert.equal(gatewayInputs.length, 1);
  assert.equal(gatewayInputs[0].text, 'verifique o estado operational do Zavorth');
  assert.equal(gatewayInputs[0].channel, 'api');
  assert.equal(gatewayInputs[0].sessionId, 'nexus-cross-surface-session');
  assert.equal(gatewayInputs[0].metadata.source, 'nexus-surface');
  assert.equal(gatewayInputs[0].metadata.route, '/api/v2/nexus/execute');
  assert.equal(calls[0].statusCode, 200);
  assert.equal(calls[0].body.source, 'ZavorthAgentGateway');
  assert.equal(calls[0].body.response, 'Response through Agent Gateway.');

  const resolverContext: ResolverContext = {
    sessionId: 'telegram-session',
    surface: 'telegram',
    requestedBy: 'telegram:chat-1',
    channel: 'telegram',
    chatId: 'chat-1',
    threadId: 'thread-1',
    userId: 'user-1',
  };
  const resolveHandled = await route.handleRequest(
    createReq('POST', '/api/v2/nexus/permissions/resolve', {
      id: 'approval-cross-surface-1',
      approved: true,
      ...resolverContext,
    }),
    createRes(),
    new URL('http://localhost/api/v2/nexus/permissions/resolve'),
    '/api/v2/nexus/permissions/resolve',
    deps,
  );

  assert.equal(resolveHandled, true);
  assert.deepEqual(resolverContexts[0], resolverContext);
  assert.equal(calls[1].statusCode, 200);
  assert.equal(calls[1].body.ok, true);
  assert.equal(calls[1].body.id, 'approval-cross-surface-1');
  assert.equal(calls[1].body.approved, true);

  const workbenchHandled = await route.handleRequest(
    createReq('GET', '/api/v2/nexus/workbench'),
    createRes(),
    new URL('http://localhost/api/v2/nexus/workbench'),
    '/api/v2/nexus/workbench',
    deps,
  );

  assert.equal(workbenchHandled, true);
  assert.equal(calls[2].statusCode, 200);
  assert.equal(calls[2].body.source, 'NexusFacadeService');
  assert.equal(calls[2].body.view, 'nexus-workbench');
  assert.equal(calls[2].body.runtime.primary, 'ZavorthAgentGateway');
  assert.equal(calls[2].body.approvals.pendingCount, 1);
  assert(calls[2].body.receipts.includes('nexus-workbench-uses-canonical-gateway'));

  console.log('[qa:approval-cross-surface] ok');
}

function createEchoDouble(resolverContexts: ResolverContext[]) {
  const pendingPermission = {
    id: 'approval-cross-surface-1',
    action: 'os_screenshot',
    reason: 'Shared permission used to validate cross-surface parity.',
    requestedAt: '2026-04-18T12:00:00.000Z',
    status: 'pending',
  };

  return {
    listTools: () => [],
    getHistory: () => [{
      id: 'exec-cross-surface-1',
      timestamp: '2026-04-18T12:00:00.000Z',
      prompt: 'capture the screen',
      status: 'permission_pending',
      durationMs: 12,
      finalResponse: 'Action requires permission.',
      toolCalls: [{ toolName: 'os_screenshot' }],
    }],
    buildSnapshot: async () => ({
      summary: {
        totalTools: 1,
        categoryCounts: { OS: 1 },
        recentExecutions: 1,
        llmOnline: true,
        preferredProvider: 'smoke-provider',
      },
      tools: [{
        name: 'os_screenshot',
        description: 'Captures the local screen',
        category: 'OS',
        dangerLevel: 'moderate',
        requiresPermission: true,
      }],
      recentHistory: [],
      capabilityLifecycle: [],
      watchMode: {
        posture: 'healthy',
        activeStatus: 'idle',
        pendingApprovals: 1,
        nextAction: 'Waiting for approval.',
      },
      voiceMetrics: {
        totalRequests: 0,
        successes: 0,
        failures: 0,
        surfaces: [],
      },
    }),
    testConnection: async () => ({
      ok: true,
      online: true,
      provider: 'smoke-provider',
      providerName: 'smoke-provider',
      model: 'smoke-model',
      latencyMs: 4,
    }),
    getPendingPermissions: () => [pendingPermission],
    resolvePermission: async (id: string, approved: boolean, context: ResolverContext) => {
      resolverContexts.push(context);
      return {
        ok: true,
        id,
        approved,
        status: approved ? 'approved' : 'denied',
        resolvedBy: context,
      };
    },
    processIntent: async (prompt: string) => ({
      status: 'success',
      prompt,
      source: 'ZavorthEchoService',
    }),
  };
}

function createReq(method: string, url: string, body?: unknown): http.IncomingMessage {
  const req = new PassThrough() as unknown as http.IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost' };
  (req as any).socket = { remoteAddress: '127.0.0.1' };

  process.nextTick(() => {
    if (body !== undefined) {
      req.push(JSON.stringify(body));
    }
    req.push(null);
  });

  return req;
}

function createRes(): MockResponse {
  const headers: Record<string, string> = {};
  return {
    headers,
    body: null,
    setHeader: (name: string, value: string) => {
      headers[String(name)] = String(value);
    },
    end(chunk?: any) {
      this.body = chunk ? Buffer.from(chunk) : Buffer.alloc(0);
      return this;
    },
  } as MockResponse;
}
