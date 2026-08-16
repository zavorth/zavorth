import * as http from 'http';
import { PassThrough } from 'stream';
import { EchoEdgeHardeningService } from '../../src/domain/trust-governance/infrastructure/EchoEdgeHardeningService.js';
import { getDefaultEchoVoiceAssetStore } from '../../src/domain/surface/infrastructure/EchoVoiceAssetStoreService.js';
import { ZavorthControlEchoRouteService } from '../../src/services/ZavorthControlEchoRouteService.js';

type WriteCall = {
  body: any;
  statusCode: number;
};

type MockResponse = http.ServerResponse & {
  headers: Record<string, string>;
  body: Buffer | null;
};

function createReq(
  method: string,
  url: string,
  body?: unknown,
  options: {
    headers?: Record<string, string>;
    remoteAddress?: string;
    rawBody?: string;
  } = {},
): http.IncomingMessage {
  const req = new PassThrough() as unknown as http.IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost', ...(options.headers || {}) };
  (req as any).socket = { remoteAddress: options.remoteAddress || '127.0.0.1' };

  process.nextTick(() => {
    if (options.rawBody !== undefined) {
      req.push(options.rawBody);
    } else if (body !== undefined) {
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

function createDeps() {
  const calls: WriteCall[] = [];
  const echo = {
    listTools: jest.fn((category?: string) => [
      {
        name: 'os_screenshot',
        description: 'Captura a tela local',
        category: category || 'OS',
        dangerLevel: 'moderate',
        requiresPermission: true,
      },
    ]),
    getHistory: jest.fn((limit: number) => [{ id: 'hist-1', limit }]),
    buildSnapshot: jest.fn(async () => ({
      summary: {
        totalTools: 1,
        categoryCounts: { OS: 1 },
        recentExecutions: 1,
        llmOnline: true,
        preferredProvider: 'ollama',
        ollamaOnline: true,
      },
      tools: [{
        name: 'os_screenshot',
        description: 'Captura a tela local',
        category: 'OS',
        dangerLevel: 'moderate',
        requiresPermission: true,
      }],
      recentHistory: [],
      capabilityLifecycle: [{
        capabilityId: 'echo-capability-os_screenshot',
        toolName: 'os_screenshot',
        category: 'OS',
        dangerLevel: 'moderate',
        requiresPermission: true,
        lifecycle: null,
      }],
      watchMode: {
        posture: 'healthy',
        activeStatus: 'idle',
        pendingApprovals: 0,
        nextAction: 'Aguardando pedido.',
        cost: { level: 'low', score: 0, summary: 'buffers e approvals sob controle' },
      },
      voiceMetrics: {
        totalRequests: 1,
        successes: 1,
        failures: 0,
      },
    })),
    buildVoiceMetricsSnapshot: jest.fn(() => ({
      totalRequests: 2,
      successes: 2,
      failures: 0,
      surfaces: [{ surface: 'zavorthControl', requests: 2 }],
    })),
    synthesizeSpeech: jest.fn(async () => ({
      ok: true,
      audio: Buffer.from('voice-bytes'),
      mimeType: 'audio/wav',
      model: 'gemini-2.5-flash',
      voiceName: 'Kore',
      languageCode: 'en-US',
      latencyMs: 42,
    })),
    testConnection: jest.fn(async () => ({
      ok: true,
      provider: 'ollama',
      online: true,
      model: 'gemma2:2b',
      providerName: 'ollama',
      latencyMs: 9,
    })),
    getPendingPermissions: jest.fn(() => [{ id: 'perm-1', toolName: 'os_screenshot' }]),
    resolvePermission: jest.fn(async (id: string, approved: boolean) => ({
      ok: true,
      id,
      approved,
      result: { success: true },
    })),
    processIntent: jest.fn(async (prompt: string) => ({ status: 'success', prompt })),
  };

  return {
    calls,
    deps: {
      echo: echo as any,
      writeJson: (_res: http.ServerResponse, body: unknown, statusCode = 200) => {
        calls.push({ body, statusCode });
      },
    },
    echo,
  };
}

describe('ZavorthControlEchoRouteService', () => {
  afterEach(() => {
    getDefaultEchoVoiceAssetStore().clear();
  });

  it('serves the canonical tools route with real metadata', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();
    const res = createRes();
    const req = createReq('GET', '/api/v2/echo/tools?category=OS');

    const handled = await route.handleRequest(
      req,
      res,
      new URL('http://localhost/api/v2/echo/tools?category=OS'),
      '/api/v2/echo/tools',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.listTools).toHaveBeenCalledWith('OS');
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: [
        expect.objectContaining({
          name: 'os_screenshot',
          category: 'OS',
          dangerLevel: 'moderate',
          requiresPermission: true,
        }),
      ],
    });
    expect(res.headers['X-RateLimit-Limit']).toBe('90');
  });

  it('returns pending permissions and resolves approvals through Echo', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();
    const resPermissions = createRes();
    const resResolve = createRes();

    await route.handleRequest(
      createReq('GET', '/api/v2/echo/permissions'),
      resPermissions,
      new URL('http://localhost/api/v2/echo/permissions'),
      '/api/v2/echo/permissions',
      deps,
    );

    await route.handleRequest(
      createReq('POST', '/api/v2/echo/permissions/resolve', { id: 'perm-1', approved: true }),
      resResolve,
      new URL('http://localhost/api/v2/echo/permissions/resolve'),
      '/api/v2/echo/permissions/resolve',
      deps,
    );

    expect(calls[0]).toEqual({
      statusCode: 200,
      body: [{ id: 'perm-1', toolName: 'os_screenshot' }],
    });
    expect(echo.resolvePermission).toHaveBeenCalledWith('perm-1', true);
    expect(calls[1]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({ ok: true, id: 'perm-1', approved: true }),
    });
    expect(resResolve.headers['X-Zavorth-Echo-Edge']).toBe('resolve');
  });

  it('passes resolver surface context when a Echo surface provides it', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { deps, echo } = createDeps();

    const resolverContext = {
      sessionId: 'telegram-session',
      surface: 'telegram',
      requestedBy: 'telegram:chat-1',
      channel: 'telegram',
      chatId: 'chat-1',
      threadId: 'thread-1',
      userId: 'user-1',
    };

    const handled = await route.handleRequest(
      createReq('POST', '/api/v2/echo/permissions/resolve', {
        id: 'perm-1',
        approved: true,
        ...resolverContext,
      }),
      createRes(),
      new URL('http://localhost/api/v2/echo/permissions/resolve'),
      '/api/v2/echo/permissions/resolve',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.resolvePermission).toHaveBeenCalledWith('perm-1', true, resolverContext);
  });

  it('resolves pending confirmations through the Nexus facade alias', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq('POST', '/api/v2/nexus/permissions/resolve', {
        id: 'perm-1',
        approved: false,
        sessionId: 'command-session',
        surface: 'zavorthControl',
        requestedBy: 'zavorthControl',
      }),
      createRes(),
      new URL('http://localhost/api/v2/nexus/permissions/resolve'),
      '/api/v2/nexus/permissions/resolve',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.resolvePermission).toHaveBeenCalledWith('perm-1', false, {
      sessionId: 'command-session',
      surface: 'zavorthControl',
      requestedBy: 'zavorthControl',
      channel: undefined,
      chatId: undefined,
      threadId: undefined,
      userId: undefined,
    });
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({ ok: true, id: 'perm-1', approved: false }),
    });
  });

  it('rejects malformed permission resolution payloads', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq('POST', '/api/v2/echo/permissions/resolve', { id: 'perm-1', approved: 'false' }),
      createRes(),
      new URL('http://localhost/api/v2/echo/permissions/resolve'),
      '/api/v2/echo/permissions/resolve',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.resolvePermission).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({
      statusCode: 400,
      body: { error: 'Fields "id" (string) and "approved" (boolean) are required.' },
    });
  });

  it('rejects malformed Nexus execute payloads before reaching the runtime', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();
    const agentGateway = {
      handle: jest.fn(),
    };

    const handled = await route.handleRequest(
      createReq('POST', '/api/v2/nexus/execute', {
        prompt: '',
        category: 'OS',
      }),
      createRes(),
      new URL('http://localhost/api/v2/nexus/execute'),
      '/api/v2/nexus/execute',
      { ...deps, agentGateway: agentGateway as any },
    );

    expect(handled).toBe(true);
    expect(agentGateway.handle).not.toHaveBeenCalled();
    expect(echo.processIntent).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({
      statusCode: 400,
      body: { error: 'Field "prompt" is required.' },
    });
  });

  it('rejects malformed Echo categories through the route schema', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq('POST', '/api/v2/echo/execute', {
        prompt: 'listar tools',
        category: 'SHELL',
      }),
      createRes(),
      new URL('http://localhost/api/v2/echo/execute'),
      '/api/v2/echo/execute',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.processIntent).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({
      statusCode: 400,
      body: { error: 'Payload Echo invalid.' },
    });
  });

  it('routes execute and history requests to Echo', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();
    const resExecute = createRes();
    const resHistory = createRes();

    await route.handleRequest(
      createReq('POST', '/api/v2/echo/execute', {
        prompt: 'listar tools',
        category: 'OS',
        requestedBy: 'zavorthControl-ui',
        surface: 'zavorthControl-ui',
      }),
      resExecute,
      new URL('http://localhost/api/v2/echo/execute'),
      '/api/v2/echo/execute',
      deps,
    );

    await route.handleRequest(
      createReq('GET', '/api/v2/echo/history?limit=5'),
      resHistory,
      new URL('http://localhost/api/v2/echo/history?limit=5'),
      '/api/v2/echo/history',
      deps,
    );

    expect(echo.processIntent).toHaveBeenCalledWith('listar tools', {
      category: 'OS',
      sessionId: undefined,
      requestedBy: 'zavorthControl-ui',
      surface: 'zavorthControl-ui',
    });
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: { status: 'success', prompt: 'listar tools' },
    });
    expect(echo.getHistory).toHaveBeenCalledWith(5);
    expect(calls[1]).toEqual({ statusCode: 200, body: [{ id: 'hist-1', limit: 5 }] });
    expect(resExecute.headers['X-Zavorth-Echo-Edge']).toBe('execute');
    expect(resHistory.headers['X-Zavorth-Echo-Edge']).toBe('read');
  });

  it('normalizes Nexus execute requests and sends them through the agent gateway when available', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();
    const agentGateway = {
      handle: jest.fn(async () => ({
        ok: true,
        run: {
          id: 'run-nexus-1',
          summary: 'Resumo via gateway',
        },
        replies: [
          {
            text: 'Resposta via ReplyPipeline.',
          },
        ],
      })),
    };
    const res = createRes();

    const handled = await route.handleRequest(
      createReq('POST', '/api/v2/nexus/execute', {
        prompt: 'abrir o painel de controle',
        category: 'OS',
        requestId: 'request-nexus-1',
        traceId: 'trace-nexus-1',
        sessionId: 'nexus-session',
        requestedBy: 'nexus-agent',
        userId: 'nexus-user',
        requestedTools: ['echo_hands'],
      }),
      res,
      new URL('http://localhost/api/v2/nexus/execute'),
      '/api/v2/nexus/execute',
      { ...deps, agentGateway: agentGateway as any },
    );

    expect(handled).toBe(true);
    expect(echo.processIntent).not.toHaveBeenCalled();
    expect(agentGateway.handle).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'request-nexus-1',
      traceId: 'trace-nexus-1',
      userId: 'nexus-user',
      sessionId: 'nexus-session',
      channel: 'api',
      text: 'abrir o painel de controle',
      requestedTools: ['echo_hands'],
      replyPort: expect.objectContaining({
        id: 'nexus-session:nexus',
        label: 'Nexus',
        kind: 'api',
      }),
      metadata: expect.objectContaining({
        source: 'nexus-surface',
        surface: 'nexus',
        requestedBy: 'nexus-agent',
        category: 'OS',
        route: '/api/v2/nexus/execute',
        normalizedInboundMessage: true,
      }),
    }));
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({
        ok: true,
        source: 'ZavorthAgentGateway',
        response: 'Resposta via ReplyPipeline.',
        normalizedInboundMessage: expect.objectContaining({
          text: 'abrir o painel de controle',
          channel: 'api',
        }),
      }),
    });
    expect(res.headers['X-Zavorth-Echo-Edge']).toBe('execute');
  });

  it('keeps Nexus execute honest when the agent gateway is unavailable', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq('POST', '/api/v2/nexus/execute', {
        prompt: 'listar tools',
        sessionId: 'nexus-session',
        requestedBy: 'nexus-agent',
      }),
      createRes(),
      new URL('http://localhost/api/v2/nexus/execute'),
      '/api/v2/nexus/execute',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.processIntent).toHaveBeenCalledWith('listar tools', {
      category: undefined,
      sessionId: 'nexus-session',
      requestedBy: 'nexus-agent',
      surface: 'nexus',
    });
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({
        status: 'success',
        source: 'ZavorthEchoService',
        normalizedInboundMessage: expect.objectContaining({
          sessionId: 'nexus-session',
          channel: 'api',
          text: 'listar tools',
        }),
        gateway: {
          ok: false,
          reason: 'agent_gateway_unavailable',
          fallback: 'ZavorthEchoService',
        },
      }),
    });
  });

  it('serves Nexus status, capabilities and workbench as a facade over canonical surfaces', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();

    await route.handleRequest(
      createReq('GET', '/api/v2/nexus/status'),
      createRes(),
      new URL('http://localhost/api/v2/nexus/status'),
      '/api/v2/nexus/status',
      deps,
    );

    await route.handleRequest(
      createReq('GET', '/api/v2/nexus/capabilities'),
      createRes(),
      new URL('http://localhost/api/v2/nexus/capabilities'),
      '/api/v2/nexus/capabilities',
      deps,
    );

    await route.handleRequest(
      createReq('GET', '/api/v2/nexus/workbench'),
      createRes(),
      new URL('http://localhost/api/v2/nexus/workbench'),
      '/api/v2/nexus/workbench',
      deps,
    );

    expect(echo.buildSnapshot).toHaveBeenCalledTimes(3);
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({
        ok: true,
        source: 'NexusFacadeService',
        role: 'converged-product-surface',
        primaryRuntime: 'ZavorthEchoService',
        receipts: expect.arrayContaining(['nexus-is-facade-not-parallel-runtime']),
      }),
    });
    expect(calls[1]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({
        ok: true,
        source: 'NexusFacadeService',
        role: 'capability-surface',
        maturity: expect.any(Array),
      }),
    });
    expect(calls[2]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({
        ok: true,
        source: 'NexusFacadeService',
        view: 'nexus-workbench',
        runtime: expect.objectContaining({
          primary: 'ZavorthEchoService',
          echoFallbackAvailable: true,
        }),
        operatorExperience: expect.objectContaining({
          statusLabel: expect.any(String),
          primaryMessage: expect.any(String),
          nextStep: expect.any(String),
          cards: expect.any(Array),
        }),
        approvals: expect.objectContaining({
          pendingCount: 1,
        }),
        capabilities: expect.objectContaining({
          provisionedEdges: expect.arrayContaining([
            expect.objectContaining({
              id: 'browser-mcp',
              readiness: expect.objectContaining({
                itemId: 'mcp:browser-sidecar',
              }),
            }),
            expect.objectContaining({
              id: 'local-voice-dictation',
              readiness: expect.objectContaining({
                itemId: 'runtime-capability:local-voice-dictation',
              }),
            }),
          ]),
        }),
        echoExperience: expect.objectContaining({
          view: 'echo-continuity',
          status: 'waiting_confirmation',
        }),
        actions: expect.arrayContaining([
          expect.not.objectContaining({
            label: expect.any(String),
            description: expect.any(String),
          }),
        ]),
        receipts: expect.arrayContaining(['nexus-workbench-uses-canonical-gateway']),
      }),
    });
    expect(calls[2].body).not.toHaveProperty('headline');
  });

  it('serves Echo continuity as a read-only product snapshot', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq('GET', '/api/v2/echo/experience'),
      createRes(),
      new URL('http://localhost/api/v2/echo/experience'),
      '/api/v2/echo/experience',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.buildSnapshot).toHaveBeenCalledTimes(1);
    expect(echo.testConnection).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({
        source: 'NexusFacadeService',
        view: 'echo-continuity',
        status: 'waiting_confirmation',
        provider: expect.objectContaining({
          online: true,
          providerName: 'ollama',
        }),
        approvals: expect.objectContaining({
          pendingCount: 1,
          route: '/api/v2/echo/permissions',
        }),
        receipts: expect.arrayContaining(['voice-and-fallback-state-visible']),
      }),
    });
  });

  it('resolves permissions through the canonical Nexus route without changing the resolver contract', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();
    const res = createRes();
    const resolverContext = {
      sessionId: 'nexus-session',
      surface: 'nexus',
      requestedBy: 'nexus-agent',
      channel: 'api',
      userId: 'nexus-user',
    };

    const handled = await route.handleRequest(
      createReq('POST', '/api/v2/nexus/permissions/resolve', {
        id: 'perm-1',
        approved: true,
        ...resolverContext,
      }),
      res,
      new URL('http://localhost/api/v2/nexus/permissions/resolve'),
      '/api/v2/nexus/permissions/resolve',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.resolvePermission).toHaveBeenCalledWith('perm-1', true, resolverContext);
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({ ok: true, id: 'perm-1', approved: true }),
    });
    expect(res.headers['X-Zavorth-Echo-Edge']).toBe('resolve');
  });

  it('serves snapshot and connection health routes', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();
    const resSnapshot = createRes();
    const resConnection = createRes();

    await route.handleRequest(
      createReq('GET', '/api/v2/echo/snapshot'),
      resSnapshot,
      new URL('http://localhost/api/v2/echo/snapshot'),
      '/api/v2/echo/snapshot',
      deps,
    );

    await route.handleRequest(
      createReq('GET', '/api/v2/echo/connection'),
      resConnection,
      new URL('http://localhost/api/v2/echo/connection'),
      '/api/v2/echo/connection',
      deps,
    );

    expect(echo.buildSnapshot).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({
        summary: expect.objectContaining({
          preferredProvider: 'ollama',
        }),
        watchMode: expect.objectContaining({
          posture: 'healthy',
        }),
        voiceMetrics: expect.objectContaining({
          totalRequests: 1,
        }),
      }),
    });
    expect(echo.testConnection).toHaveBeenCalledTimes(1);
    expect(calls[1]).toEqual({
      statusCode: 200,
      body: expect.objectContaining({
        ok: true,
        providerName: 'ollama',
        online: true,
      }),
    });
    expect(resConnection.headers['Cache-Control']).toBe('no-store');
  });

  it('serves voice metrics and Gemini audio through the Echo edge', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();
    const metricsRes = createRes();
    const audioRes = createRes();

    await route.handleRequest(
      createReq('GET', '/api/v2/echo/voice-metrics'),
      metricsRes,
      new URL('http://localhost/api/v2/echo/voice-metrics'),
      '/api/v2/echo/voice-metrics',
      deps,
    );

    await route.handleRequest(
      createReq('POST', '/api/v2/echo/audio/speech', {
        input: 'Fale no zavorthControl.',
        surface: 'zavorthControl',
        requestedBy: 'zavorthControl-ui',
        sessionId: 'zavorthControl-session',
      }),
      audioRes,
      new URL('http://localhost/api/v2/echo/audio/speech'),
      '/api/v2/echo/audio/speech',
      deps,
    );

    expect(echo.buildVoiceMetricsSnapshot).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: {
        totalRequests: 2,
        successes: 2,
        failures: 0,
        surfaces: [{ surface: 'zavorthControl', requests: 2 }],
      },
    });
    expect(echo.synthesizeSpeech).toHaveBeenCalledWith({
      text: 'Fale no zavorthControl.',
      surface: 'zavorthControl',
      requestedBy: 'zavorthControl-ui',
      sessionId: 'zavorthControl-session',
      model: undefined,
      voiceName: undefined,
      languageCode: undefined,
    });
    expect(audioRes.body?.toString('utf8')).toBe('voice-bytes');
    expect(audioRes.headers['Content-Type']).toBe('audio/wav');
    expect(audioRes.headers['X-Zavorth-Voice-Model']).toBe('gemini-2.5-flash');
    expect(audioRes.headers['X-Zavorth-Echo-Edge']).toBe('voice');
  });

  it('rejects malformed speech payloads before synthesis', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq('POST', '/api/v2/echo/audio/speech', { input: '   ' }),
      createRes(),
      new URL('http://localhost/api/v2/echo/audio/speech'),
      '/api/v2/echo/audio/speech',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.synthesizeSpeech).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({
      statusCode: 400,
      body: { error: 'Field "input" is required.' },
    });
  });

  it('serves short-lived signed voice assets for external Echo consumers', async () => {
    const route = new ZavorthControlEchoRouteService();
    const { deps } = createDeps();
    const asset = getDefaultEchoVoiceAssetStore().publish({
      audio: Buffer.from('asset-audio'),
      mimeType: 'audio/wav',
      publicBaseUrl: 'https://zavorth.example',
      surface: 'home-assistant',
      traceId: 'voice-trace-1',
    });
    const res = createRes();

    const handled = await route.handleRequest(
      createReq('GET', `/api/v2/echo/audio/assets/${asset.id}/access/${asset.accessToken}`),
      res,
      new URL(`http://localhost/api/v2/echo/audio/assets/${asset.id}/access/${asset.accessToken}`),
      `/api/v2/echo/audio/assets/${asset.id}/access/${asset.accessToken}`,
      deps,
    );

    expect(handled).toBe(true);
    expect(res.body?.toString('utf8')).toBe('asset-audio');
    expect(res.headers['Content-Type']).toBe('audio/wav');
    expect(res.headers['X-Zavorth-Echo-Edge']).toBe('voice-asset');
    expect(res.headers['X-Zavorth-Voice-Surface']).toBe('home-assistant');
  });

  it('rate limits repeated execute requests on the Echo edge', async () => {
    let now = 1_000;
    const route = new ZavorthControlEchoRouteService({
      edgeHardening: new EchoEdgeHardeningService({
        authToken: 'echo-secret',
        allowLoopbackAuthBypass: false,
        rateLimitWindowMs: 60_000,
        executeRateLimitMaxRequests: 1,
        now: () => now,
      }),
    });
    const { calls, deps, echo } = createDeps();

    const first = await route.handleRequest(
      createReq('POST', '/api/v2/echo/execute', { prompt: 'primeiro' }, {
        remoteAddress: '203.0.113.10',
        headers: { authorization: 'Bearer echo-secret' },
      }),
      createRes(),
      new URL('http://localhost/api/v2/echo/execute'),
      '/api/v2/echo/execute',
      deps,
    );

    now += 1000;
    const limitedRes = createRes();
    const second = await route.handleRequest(
      createReq('POST', '/api/v2/echo/execute', { prompt: 'segundo' }, {
        remoteAddress: '203.0.113.10',
        headers: { authorization: 'Bearer echo-secret' },
      }),
      limitedRes,
      new URL('http://localhost/api/v2/echo/execute'),
      '/api/v2/echo/execute',
      deps,
    );

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(echo.processIntent).toHaveBeenCalledTimes(1);
    expect(calls.at(-1)).toEqual({
      statusCode: 429,
      body: expect.objectContaining({ code: 'rate_limit_exceeded' }),
    });
    expect(limitedRes.headers['Retry-After']).toBeDefined();
    expect(limitedRes.headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('requires an Echo edge token for non-loopback requests even before a token is configured', async () => {
    const route = new ZavorthControlEchoRouteService({
      edgeHardening: new EchoEdgeHardeningService({
        authToken: '',
        authTokenFile: '',
        allowLoopbackAuthBypass: true,
      }),
    });
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq('GET', '/api/v2/echo/tools', undefined, { remoteAddress: '203.0.113.10' }),
      createRes(),
      new URL('http://localhost/api/v2/echo/tools'),
      '/api/v2/echo/tools',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.listTools).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({
      statusCode: 401,
      body: expect.objectContaining({ code: 'auth_required' }),
    });
  });

  it('does not trust spoofed forwarded loopback headers from direct remote Echo clients', async () => {
    const route = new ZavorthControlEchoRouteService({
      edgeHardening: new EchoEdgeHardeningService({
        authToken: '',
        authTokenFile: '',
        allowLoopbackAuthBypass: true,
        trustProxyHeaders: true,
      }),
    });
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq('GET', '/api/v2/echo/tools', undefined, {
        remoteAddress: '203.0.113.10',
        headers: { 'x-forwarded-for': '127.0.0.1' },
      }),
      createRes(),
      new URL('http://localhost/api/v2/echo/tools'),
      '/api/v2/echo/tools',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.listTools).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({
      statusCode: 401,
      body: expect.objectContaining({ code: 'auth_required' }),
    });
  });

  it('requires auth token for non-loopback Echo edge requests when configured', async () => {
    const route = new ZavorthControlEchoRouteService({
      edgeHardening: new EchoEdgeHardeningService({
        authToken: 'echo-secret',
        allowLoopbackAuthBypass: false,
      }),
    });
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq('GET', '/api/v2/echo/tools', undefined, { remoteAddress: '203.0.113.10' }),
      createRes(),
      new URL('http://localhost/api/v2/echo/tools'),
      '/api/v2/echo/tools',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.listTools).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({
      statusCode: 401,
      body: expect.objectContaining({ code: 'auth_required' }),
    });
  });

  it('applies Echo edge auth to Nexus facade and Echo product read routes', async () => {
    const route = new ZavorthControlEchoRouteService({
      edgeHardening: new EchoEdgeHardeningService({
        authToken: 'echo-secret',
        allowLoopbackAuthBypass: false,
      }),
    });
    const { calls, deps, echo } = createDeps();

    for (const pathname of [
      '/api/v2/nexus/status',
      '/api/v2/nexus/capabilities',
      '/api/v2/nexus/workbench',
      '/api/v2/echo/experience',
    ]) {
      const handled = await route.handleRequest(
        createReq('GET', pathname, undefined, { remoteAddress: '203.0.113.10' }),
        createRes(),
        new URL(`http://localhost${pathname}`),
        pathname,
        deps,
      );

      expect(handled).toBe(true);
    }

    expect(echo.buildSnapshot).not.toHaveBeenCalled();
    expect(calls).toHaveLength(4);
    expect(calls).toEqual(calls.map(() => ({
      statusCode: 401,
      body: expect.objectContaining({ code: 'auth_required' }),
    })));
  });

  it('applies Echo edge auth to voice metrics and speech synthesis routes', async () => {
    const route = new ZavorthControlEchoRouteService({
      edgeHardening: new EchoEdgeHardeningService({
        authToken: 'echo-secret',
        allowLoopbackAuthBypass: false,
      }),
    });
    const { calls, deps, echo } = createDeps();

    await route.handleRequest(
      createReq('GET', '/api/v2/echo/voice-metrics', undefined, { remoteAddress: '203.0.113.10' }),
      createRes(),
      new URL('http://localhost/api/v2/echo/voice-metrics'),
      '/api/v2/echo/voice-metrics',
      deps,
    );

    await route.handleRequest(
      createReq('POST', '/api/v2/echo/audio/speech', { input: 'oi' }, { remoteAddress: '203.0.113.10' }),
      createRes(),
      new URL('http://localhost/api/v2/echo/audio/speech'),
      '/api/v2/echo/audio/speech',
      deps,
    );

    expect(echo.buildVoiceMetricsSnapshot).not.toHaveBeenCalled();
    expect(echo.synthesizeSpeech).not.toHaveBeenCalled();
    expect(calls).toEqual([
      {
        statusCode: 401,
        body: expect.objectContaining({ code: 'auth_required' }),
      },
      {
        statusCode: 401,
        body: expect.objectContaining({ code: 'auth_required' }),
      },
    ]);
  });

  it('rejects oversized Echo payloads before execution', async () => {
    const route = new ZavorthControlEchoRouteService({
      edgeHardening: new EchoEdgeHardeningService({
        maxBodyBytes: 16,
      }),
    });
    const { calls, deps, echo } = createDeps();

    const handled = await route.handleRequest(
      createReq(
        'POST',
        '/api/v2/echo/execute',
        undefined,
        {
          rawBody: JSON.stringify({ prompt: 'x'.repeat(128) }),
        },
      ),
      createRes(),
      new URL('http://localhost/api/v2/echo/execute'),
      '/api/v2/echo/execute',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.processIntent).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({
      statusCode: 413,
      body: { error: 'Echo error: Payload Echo exceeds safe limit of 16 bytes.' },
    });
  });
});
