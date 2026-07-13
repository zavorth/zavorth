import * as http from 'http';
import { once } from 'events';
import { WebSocket } from 'ws';
import { ZavorthGatewayControlSocketService } from '../../src/services/ZavorthGatewayControlSocketService.js';

async function waitForSocketMessage(
  messages: Array<Record<string, any>>,
  matcher: (payload: Record<string, any>) => boolean,
  timeoutMs: number = 4_000,
): Promise<Record<string, any>> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const match = messages.find(matcher);
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Mensagem esperada nao chegou a tempo no gateway WebSocket.');
}

describe('ZavorthGatewayControlSocketService', () => {
  it('serves ready/runtime/hydrate and request-response flows over the canonical gateway websocket', async () => {
    const socketService = new ZavorthGatewayControlSocketService('/api/web/gateway/ws');
    const server = http.createServer();
    const unsubscribe = jest.fn();
    const subscribeRealtime = jest.fn((sessionId: string, listener: (event: Record<string, any>) => void) => {
      setTimeout(() => {
        listener({
          id: 'evt-1',
          type: 'snapshot',
          createdAt: '2026-04-12T18:10:00.000Z',
          payload: {
            sessionId,
            chatId: `web:${sessionId}`,
            tasks: [],
            permissions: [],
            messages: [],
            continuity: null,
            replay: null,
            handoff: null,
            workflowRuns: [],
          },
        } as any);
      }, 25);
      return unsubscribe;
    });

    server.on('upgrade', (req, socket, head) => {
      const patchSession = jest.fn(async (input) => ({
        ok: true,
        sessionId: input.sessionId,
        metadata: {
          label: input.label || null,
          workspaceHint: input.workspaceHint || null,
          pinned: input.pinned === true,
          modelProfile: input.modelProfile || null,
        },
      }));
      const listApprovals = jest.fn(async (sessionId: string) => ({
        generatedAt: '2026-04-12T18:00:00.000Z',
        sessionId,
        pending: [],
        recent: [],
        mutationPlans: [],
      }));
      const resolveApproval = jest.fn(async (input) => ({
        ok: true,
        approvalId: input.approvalId,
        decision: input.decision,
      }));
      const listArtifacts = jest.fn(async (input) => ({
        ok: true,
        sessionId: input.sessionId,
        artifacts: [{ id: 'artifact-1', toolRunId: input.toolRunId || 'run-1' }],
        toolRuns: [],
        filesTouched: [],
      }));
      const readArtifactDiff = jest.fn(async (input) => ({
        ok: true,
        sessionId: input.sessionId,
        toolRunId: input.toolRunId,
        diff: {
          summary: 'Patch aplicado.',
          patches: [{ path: 'C:/repo/src/app.ts', diff: '@@\\n+ok\\n', summary: null }],
        },
      }));
      const previewMemoryRecall = jest.fn(async (input) => ({
        ok: true,
        contractVersion: 'hybrid-memory-v1',
        generatedAt: '2026-04-14T12:00:00.000Z',
        sessionId: input.sessionId,
        query: input.query || '',
        mode: 'hybrid',
        embeddingStatus: 'ready',
        budget: {
          topK: input.limit || 8,
          contextTokenBudget: 2000,
          estimatedTokens: 12,
        },
        summary: {
          total: 2,
          ledger: 1,
          recall: 1,
          returned: 2,
          ledgerAuthoritative: true,
        },
        sources: [{ id: 'ledger:session', type: 'ledger', kind: 'session', label: 'Gateway ledger' }],
        context: '- Gateway ledger',
        warnings: [],
      }));
      const listMemorySources = jest.fn(async (input) => ({
        ok: true,
        contractVersion: 'hybrid-memory-v1',
        generatedAt: '2026-04-14T12:00:00.000Z',
        sessionId: input.sessionId,
        sources: [{ id: 'ledger:session', status: 'available', count: 1 }],
        warnings: [],
      }));
      const listCapabilities = jest.fn(async () => ({
        ok: true,
        capabilities: [{ id: 'watch-mode', state: 'dormant' }],
      }));
      const enableCapability = jest.fn(async (input) => ({
        ok: false,
        status: 'waiting_approval',
        capability: { id: input.capabilityId, state: 'dormant' },
        mutationPlan: { id: 'plan-cap-1', status: 'waiting_approval' },
      }));
      const disableCapability = jest.fn(async (input) => ({
        ok: true,
        status: 'applied',
        capability: { id: input.capabilityId, state: 'dormant' },
      }));
      const previewSelfmod = jest.fn(async (input) => ({
        ok: true,
        status: 'preview_ready',
        preview: {
          success: true,
          mode: input.mode,
          previewId: 'preview-1',
        },
      }));
      const applySelfmod = jest.fn(async (input) => ({
        ok: false,
        status: 'waiting_approval',
        mutationPlan: { id: 'plan-selfmod-1', payload: { previewId: input.previewId } },
      }));
      const rollbackSelfmod = jest.fn(async (input) => ({
        ok: true,
        status: 'applied',
        result: { changeId: input.changeId, success: true },
      }));
      const abortChat = jest.fn(async (input) => ({
        ok: true,
        sessionId: input.sessionId,
        status: 'abort_requested',
        supported: false,
      }));
      const handled = socketService.handleUpgrade(req, socket, head, {
        path: '/api/web/gateway/ws',
        authorize: (_request, url) => String(url.searchParams.get('token') || '') === 'ws-secret',
        resolveSessionId: (url) => String(url.searchParams.get('sessionId') || '').trim() || 'ws-session-1',
        createSession: () => 'ws-created-1',
        getChatId: (sessionId) => `web:${sessionId}`,
        getUserId: () => 'telegram-admin',
        ensureSession: jest.fn(),
        captureBaseline: jest.fn(async () => undefined),
        subscribeRealtime,
        buildCanonicalState: jest.fn(async (sessionId: string) => ({
          gateway: null,
          session: { sessionId, chatId: `web:${sessionId}`, tasks: [], permissions: [] },
          sessions: null,
          sessionsSummary: null,
          gatewaySessionTools: null,
          snapshot: {
            sessionId,
            chatId: `web:${sessionId}`,
            tasks: [],
            permissions: [],
            messages: [],
          },
          productMode: {
            id: 'builder',
            label: 'Zavorth Builder',
            summary: 'Modo builder.',
            description: 'Builder',
            defaultRuntimeProfile: 'core',
            runtimeProfile: 'core',
            profileAligned: true,
            visibleSurfaces: ['chat', 'tool-cards'],
            hiddenByDefault: ['companions'],
            escalationTargets: ['operator'],
            commands: {
              show: '/mode',
              set: '/mode <chat|assistant|builder|operator>',
              cliStatus: 'npm run mode:status',
              cliSet: 'npm run mode:use -- <chat|assistant|builder|operator>',
            },
          },
          memoryPlane: null,
          controlPlane: null,
          sessionPlane: null,
          resourcePlane: {
            status: 'moderate',
            topConsumers: [{ label: 'Codex' }],
          },
          companionPlane: {
            companions: [{ id: 'docker-desktop', status: 'idle' }],
          },
          runtimeWarnings: ['Host em pressao moderada.'],
          actionRecommendations: [{ plane: 'resources', label: 'Inspecionar companions' }],
        }) as any),
        buildCanonicalHistory: jest.fn(async (sessionId: string) => ({
          gateway: null,
          session: {
            sessionId,
            chatId: `web:${sessionId}`,
            tasks: [],
            permissions: [],
          },
          sessions: null,
          sessionsSummary: null,
          gatewaySessionTools: null,
        }) as any),
        patchSession,
        listApprovals,
        resolveApproval,
        listArtifacts,
        readArtifactDiff,
        previewMemoryRecall,
        listMemorySources,
        getProductMode: jest.fn(async () => ({
          ok: true,
          productMode: {
            id: 'builder',
            runtimeProfile: 'core',
            defaultRuntimeProfile: 'core',
          },
        })),
        getModeEscalation: jest.fn(async () => ({
          ok: true,
          modeEscalation: {
            sessionId: 'ws-session-1',
            status: 'pending',
            pendingRequest: {
              id: 'mode-escalation-builder-1',
            },
          },
        })),
        setProductMode: jest.fn(async (input) => ({
          ok: true,
          productMode: {
            id: input.mode,
            runtimeProfile: input.mode === 'operator' ? 'ops' : 'core',
            defaultRuntimeProfile: input.mode === 'operator' ? 'ops' : 'core',
          },
        })),
        resolveModeEscalation: jest.fn(async () => ({
          ok: true,
          decision: 'approve',
          summary: 'Escalonamento aprovado.',
          snapshot: {
            effectiveMode: {
              id: 'builder',
            },
          },
        })),
        listCapabilities,
        enableCapability,
        disableCapability,
        previewSelfmod,
        applySelfmod,
        rollbackSelfmod,
        abortChat,
        readDesktopResources: jest.fn(async () => ({
          version: 1,
          generatedAt: '2026-04-12T18:00:01.000Z',
          host: {
            hostname: 'WORKSTATION',
            platform: 'win32',
            totalVisibleMemoryMb: 8192,
            freePhysicalMemoryMb: 2048,
            totalPhysicalMemoryMb: 8192,
            usedPhysicalMemoryMb: 6144,
            memoryLoadPercent: 75,
            pressure: 'moderate',
          },
          totals: {
            processesTracked: 3,
            groupsTracked: 2,
            memoryTrackedMb: 512,
            companionMemoryMb: 256,
            zavorthMemoryMb: 128,
            externalMemoryMb: 128,
          },
          groups: [],
          items: [],
          topConsumers: [],
          recommendedActions: [],
          warnings: [],
          recommendations: [],
        })),
        buildRuntime: jest.fn(async (input) => ({
          generatedAt: '2026-04-12T18:00:00.000Z',
          auth: {
            enabled: true,
            source: 'env',
            tokenFile: 'C:/tmp/token.txt',
          },
          health: {
            status: 'ready',
            runtimeAttached: true,
            operationsAttached: true,
            realtimeAttached: true,
            gatewayAvailable: true,
            sessionPlaneAvailable: true,
            authEnabled: true,
            gatewaySource: 'runtime',
            issues: [],
            summary: 'Gateway WS pronto.',
          },
          controlPlane: {
            preferredTransport: 'ws',
            availableTransports: ['http', 'sse', 'ws'],
            websocketPath: '/api/web/gateway/ws',
            ssePath: '/api/web/events',
            statePath: '/api/web/state',
            historyPath: '/api/web/gateway/sessions/history',
            sendPath: '/api/web/gateway/sessions/send',
            spawnPath: '/api/web/gateway/sessions/spawn',
            heartbeatIntervalMs: 15000,
            reconnectStrategy: 'reuse-session-state',
            sessionId: input.sessionId,
            chatId: input.chatId,
          },
          sessionBus: {
            transport: 'sse',
            pollIntervalMs: 2000,
            sessionsTracked: 1,
            listenersAttached: 1,
            activeSessionIds: [input.sessionId || 'ws-session-1'],
          },
          gateway: {
            generatedAt: '2026-04-12T18:00:00.000Z',
            summary: {
              channelsReady: 2,
            },
            narrative: {
              headline: 'Gateway',
              operatorSummary: 'Gateway ready.',
            },
          },
        })),
        processChatSend: jest.fn(async (body) => ({
          sessionId: String(body.sessionId || 'ws-session-1'),
          taskId: 'task-send-1',
          snapshot: {
            acknowledged: true,
          },
        })),
        spawnSession: jest.fn(async () => ({
          sessionId: 'ws-session-2',
          spawnedFrom: 'ws-session-1',
          spawn: {
            sessionId: 'ws-session-2',
          },
          snapshot: {
            sessionId: 'ws-session-2',
          },
        })),
      });
      if (!handled) {
        socket.destroy();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Porta TCP indisponivel para o teste do gateway WebSocket.');
    }

    const query = new URLSearchParams({
      token: 'ws-secret',
      sessionId: 'ws-session-1',
      replay: 'full',
    });
    const client = new WebSocket(
      `ws://127.0.0.1:${address.port}/api/web/gateway/ws?${query.toString()}`,
    );
    const messages: Array<Record<string, any>> = [];
    client.on('message', (payload) => {
      messages.push(JSON.parse(payload.toString()));
    });

    await once(client, 'open');

    const ready = await waitForSocketMessage(messages, (payload) => payload.type === 'ready');
    const runtime = await waitForSocketMessage(messages, (payload) => payload.type === 'runtime');
    const hydrate = await waitForSocketMessage(messages, (payload) => payload.type === 'hydrate');
    const resourceEvent = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'event' && payload.event?.kind === 'health.resource',
    );
    const realtimeEvent = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'event' && payload.event?.kind === 'session',
    );

    expect(ready).toEqual(
      expect.objectContaining({
        contractVersion: 'v1',
        protocolVersion: 'zavorth-gateway-ws/1',
        sessionId: 'ws-session-1',
        controlPlane: expect.objectContaining({
          websocketPath: '/api/web/gateway/ws',
          preferredTransport: 'ws',
        }),
        methods: expect.arrayContaining([
          'memory.recall.preview',
          'memory.sources.list',
        ]),
      }),
    );
    expect(runtime).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          controlPlane: expect.objectContaining({
            preferredTransport: 'ws',
          }),
        }),
      }),
    );
    expect(hydrate).toEqual(
      expect.objectContaining({
        replayMode: 'full',
        state: expect.objectContaining({
          snapshot: expect.objectContaining({
            sessionId: 'ws-session-1',
          }),
        }),
      }),
    );
    expect(resourceEvent).toEqual(
      expect.objectContaining({
        channel: 'realtime',
        event: expect.objectContaining({
          kind: 'health.resource',
          type: 'resource',
        }),
      }),
    );
    expect(realtimeEvent).toEqual(
      expect.objectContaining({
        channel: 'realtime',
        event: expect.objectContaining({
          kind: 'session',
          type: 'snapshot',
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'state-1', method: 'session.state' }));
    const stateResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'state-1',
    );
    expect(stateResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          snapshot: expect.objectContaining({
            sessionId: 'ws-session-1',
          }),
          resourcePlane: expect.objectContaining({
            status: 'moderate',
          }),
          companionPlane: expect.objectContaining({
            companions: expect.arrayContaining([
              expect.objectContaining({ id: 'docker-desktop' }),
            ]),
          }),
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'send-1', method: 'chat.send', params: { message: 'oi zavorth' } }));
    const sendResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'send-1',
    );
    expect(sendResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          sessionId: 'ws-session-1',
          taskId: 'task-send-1',
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'patch-1', method: 'session.patch', params: { label: 'Gateway principal', pinned: true } }));
    const patchResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'patch-1',
    );
    expect(patchResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          metadata: expect.objectContaining({
            label: 'Gateway principal',
            pinned: true,
          }),
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'caps-1', method: 'capability.list' }));
    const capsResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'caps-1',
    );
    expect(capsResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          capabilities: expect.arrayContaining([
            expect.objectContaining({ id: 'watch-mode' }),
          ]),
        }),
      }),
    );

    client.send(JSON.stringify({
      id: 'memory-recall-1',
      method: 'memory.recall.preview',
      params: { query: 'gateway ledger', limit: 3 },
    }));
    const memoryRecallResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'memory-recall-1',
    );
    expect(memoryRecallResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          contractVersion: 'hybrid-memory-v1',
          mode: 'hybrid',
          query: 'gateway ledger',
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'memory-sources-1', method: 'memory.sources.list' }));
    const memorySourcesResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'memory-sources-1',
    );
    expect(memorySourcesResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          contractVersion: 'hybrid-memory-v1',
          sources: expect.arrayContaining([
            expect.objectContaining({ id: 'ledger:session' }),
          ]),
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'mode-get-1', method: 'runtime.mode.get' }));
    const modeGetResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'mode-get-1',
    );
    expect(modeGetResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          productMode: expect.objectContaining({
            id: 'builder',
          }),
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'mode-set-1', method: 'runtime.mode.set', params: { mode: 'operator' } }));
    const modeSetResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'mode-set-1',
    );
    expect(modeSetResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          productMode: expect.objectContaining({
            id: 'operator',
            runtimeProfile: 'ops',
          }),
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'mode-escalation-get-1', method: 'runtime.modeEscalation.get' }));
    const modeEscalationGetResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'mode-escalation-get-1',
    );
    expect(modeEscalationGetResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          modeEscalation: expect.objectContaining({
            status: 'pending',
          }),
        }),
      }),
    );

    client.send(JSON.stringify({
      id: 'mode-escalation-resolve-1',
      method: 'runtime.modeEscalation.resolve',
      params: {
        requestId: 'mode-escalation-builder-1',
        decision: 'approve',
        scope: 'session',
      },
    }));
    const modeEscalationResolveResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'mode-escalation-resolve-1',
    );
    expect(modeEscalationResolveResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          decision: 'approve',
          summary: 'Escalonamento aprovado.',
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'abort-1', method: 'chat.abort' }));
    const abortResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'abort-1',
    );
    expect(abortResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          status: 'abort_requested',
        }),
      }),
    );

    client.send(JSON.stringify({ id: 'spawn-1', method: 'session.create', params: { message: 'nova sessao' } }));
    const spawnResponse = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'response' && payload.id === 'spawn-1',
    );
    const secondReady = await waitForSocketMessage(
      messages,
      (payload) => payload.type === 'ready' && payload.sessionId === 'ws-session-2',
    );

    expect(spawnResponse).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          sessionId: 'ws-session-2',
          spawn: expect.objectContaining({
            sessionId: 'ws-session-2',
          }),
        }),
      }),
    );
    expect(secondReady).toEqual(
      expect.objectContaining({
        sessionId: 'ws-session-2',
      }),
    );

    client.close();
    await once(client, 'close');
    socketService.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(subscribeRealtime).toHaveBeenCalled();
  });
});
