import {
  ZAVORTH_COMMAND_CENTER_ASSIMILATION_VERSION,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/contracts/index.js';
import {
  ZavorthCommandCenterRealtimeStore,
  buildZavorthCommandCenterAssimilationSnapshot,
  buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot,
  scanCommandCenterSnapshotForSourceIdentityLeaks,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';
import {
  ExternalAgentCapabilityProvider,
  ExternalAgentChannelBridge,
  ExternalAgentSessionMemoryBridge,
} from '../../../src/runtime/external-agents/index.js';
import {
  FixtureExternalExecutorSidecarClient,
  QuarantinedExternalExecutorSidecarAdapter,
} from '../../../src/runtime/external-agents/external-executor/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-phase7-${index}`;
  };
}

describe('Plan 111 Phase 7 Command Center assimilation', () => {
  it('projects a bridged external event into Zavorth-owned Command Center view models', async () => {
    const client = new FixtureExternalExecutorSidecarClient();
    const adapter = new QuarantinedExternalExecutorSidecarAdapter({
      client,
      now: () => new Date('2026-04-27T22:00:00.000Z'),
    });
    const capabilityProvider = new ExternalAgentCapabilityProvider({
      adapter,
      now: () => new Date('2026-04-27T22:01:00.000Z'),
    });
    const capabilityInventory = await capabilityProvider.buildInventory({
      skillManifests: [
        {
          id: 'source-summary-skill',
          title: 'External summary skill',
          description: 'Fixture metadata only; execution remains Zavorth-governed.',
          tools: ['read_file'],
          risk: 'safe',
          trustState: 'safe',
        },
      ],
    });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T22:02:00.000Z'),
      idFactory: createIdFactory(),
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'Command Center recebeu o evento bridged como runtime Zavorth.',
        replyText: 'Evento bridged visivel no Command Center.',
        artifacts: [
          {
            id: 'artifact-phase7-bridged-event',
            title: 'Bridged event report',
            kind: 'report',
            createdAt: run.createdAt,
            sessionId: run.sessionId,
            status: 'ready',
          },
        ],
        memorySignals: [
          {
            id: 'memory-phase7-bridged-event',
            title: 'Evento externo normalizado',
            layer: 'episodic',
            summary: 'Evento entrou pelo gateway Zavorth antes do dashboard.',
          },
        ],
      }),
    });
    const channelBridge = new ExternalAgentChannelBridge({
      adapter,
      gateway,
      now: () => new Date('2026-04-27T22:03:00.000Z'),
    });

    const [sourceEvent] = await adapter.pullTestEvents();
    const bridged = await channelBridge.bridgeInboundEvent(sourceEvent);
    const [sourceSession] = await adapter.listSessions();
    const sessionBridge = new ExternalAgentSessionMemoryBridge({
      adapter,
      now: () => new Date('2026-04-27T22:04:00.000Z'),
    });
    const sessionReadModel = await sessionBridge.importSession({
      session: sourceSession,
      channelHistory: bridged.history,
      transcript: [
        {
          id: 'source-dashboard-private',
          sessionId: sourceSession.id,
          role: 'user',
          text: 'dashboard-private-secret',
          createdAt: '2026-04-27T22:04:30.000Z',
          visibility: 'private',
        },
      ],
    });
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: bridged.result.run.id }),
    );

    const snapshot = buildZavorthCommandCenterAssimilationSnapshot({
      projection,
      capabilityInventory,
      channelHealth: bridged.channelHealth,
      deliveryReceipts: bridged.deliveries,
      sessionReadModels: [sessionReadModel],
      identityLeakTerms: ['ExternalExecutor'],
      now: () => new Date('2026-04-27T22:05:00.000Z'),
    });

    expect(snapshot.contractVersion).toBe(ZAVORTH_COMMAND_CENTER_ASSIMILATION_VERSION);
    expect(snapshot.runtime).toEqual(expect.objectContaining({
      id: 'zavorth-command-center-runtime',
      status: 'ready',
      transportStatus: 'connected',
      activeSessionId: 'external:source-session-1',
      viewModelSource: 'zavorth-command-center-projection',
    }));
    expect(snapshot.sessionTimelines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external:source-session-1',
        replayId: sessionReadModel.replay.id,
        handoffId: sessionReadModel.handoff.id,
        entries: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            text: 'verifique o health do sidecar pelo gateway Zavorth',
          }),
          expect.objectContaining({
            role: 'assistant',
            text: 'Evento bridged visivel no Command Center.',
          }),
        ]),
      }),
    ]));
    expect(snapshot.channelActivity).toEqual([
      expect.objectContaining({
        id: 'external-channel:external-channel:source-inbox',
        status: 'ready',
        outbound: 'reply-pipeline-only',
        deliveryCount: 1,
        latestDeliveryStatus: 'delivered',
      }),
    ]);
    expect(snapshot.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external-capability:source-skill-catalog',
        kind: 'skill',
        status: 'degraded',
      }),
      expect.objectContaining({
        id: 'external-capability:source-tool-exec',
        kind: 'tool',
        status: 'blocked',
      }),
      expect.objectContaining({
        id: 'external-capability:source-summary-skill',
        kind: 'skill',
        status: 'available',
      }),
    ]));
    expect(snapshot.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'artifact-phase7-bridged-event',
        kind: 'report',
      }),
      expect.objectContaining({
        id: sessionReadModel.handoff.artifact.id,
        kind: 'handoff',
      }),
    ]));
    expect(snapshot.memorySignals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'memory-phase7-bridged-event',
        layer: 'episodic',
      }),
    ]));
    expect(snapshot.workflows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'sessions.resume',
        enabled: true,
      }),
      expect.objectContaining({
        id: 'channels.review',
        enabled: true,
      }),
      expect.objectContaining({
        id: 'capabilities.review',
        status: 'attention',
      }),
    ]));
    expect(snapshot.identityLeakScan).toEqual(expect.objectContaining({
      checked: true,
      passed: true,
      leakCount: 0,
    }));
    expect(JSON.stringify(snapshot)).not.toContain('dashboard-private-secret');
    expect(JSON.stringify(snapshot)).not.toContain('ExternalExecutor');
  });

  it('covers realtime update, reconnect, empty, offline and failure states in a Zavorth-owned store', async () => {
    const store = new ZavorthCommandCenterRealtimeStore({
      now: () => new Date('2026-04-27T23:00:00.000Z'),
      identityLeakTerms: ['ExternalExecutor'],
    });

    expect(store.getSnapshot().uiState).toEqual(expect.objectContaining({
      empty: true,
      loading: false,
      offline: false,
      error: null,
    }));

    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T23:01:00.000Z'),
      idFactory: createIdFactory(),
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'Realtime projection atualizada.',
        replyText: 'Atualizacao visivel.',
        artifacts: [
          {
            id: 'artifact-phase7-realtime',
            title: 'Realtime update',
            kind: 'log',
            createdAt: run.createdAt,
            sessionId: run.sessionId,
            status: 'ready',
          },
        ],
      }),
    });
    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-phase7-realtime',
      text: 'atualize o dashboard',
    });
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    const liveSnapshot = store.apply({
      type: 'projection.snapshot',
      projection,
    });
    expect(liveSnapshot.uiState.empty).toBe(false);
    expect(liveSnapshot.sessionTimelines).toEqual([
      expect.objectContaining({
        id: 'session-phase7-realtime',
        status: 'active',
      }),
    ]);
    expect(liveSnapshot.artifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-phase7-realtime',
      }),
    ]);

    const reconnecting = store.apply({ type: 'transport.reconnecting' });
    expect(reconnecting.runtime).toEqual(expect.objectContaining({
      status: 'degraded',
      transportStatus: 'reconnecting',
    }));
    expect(reconnecting.uiState.degraded).toBe(true);

    const connected = store.apply({ type: 'transport.connected' });
    expect(connected.runtime).toEqual(expect.objectContaining({
      status: 'ready',
      transportStatus: 'connected',
    }));

    const offline = store.apply({
      type: 'transport.disconnected',
      reason: 'socket closed',
    });
    expect(offline.runtime).toEqual(expect.objectContaining({
      status: 'offline',
      transportStatus: 'disconnected',
    }));
    expect(offline.uiState.offline).toBe(true);

    const failed = store.apply({
      type: 'runtime.failure',
      error: 'projection reducer failed',
    });
    expect(failed.runtime.status).toBe('blocked');
    expect(failed.uiState).toEqual(expect.objectContaining({
      error: 'projection reducer failed',
      offline: false,
    }));

    const empty = store.apply({ type: 'reset.empty' });
    expect(empty.uiState.empty).toBe(true);
    expect(empty.identityLeakScan.passed).toBe(true);
  });

  it('detects source identity leaks only through the explicit diagnostic scanner', () => {
    const leakScan = scanCommandCenterSnapshotForSourceIdentityLeaks({
      label: 'ExternalExecutor dashboard widget',
      nested: {
        route: '/control/source-dashboard',
      },
    }, ['ExternalExecutor']);
    const cleanScan = scanCommandCenterSnapshotForSourceIdentityLeaks({
      label: 'Zavorth runtime activity',
      nested: {
        route: '/control/command-center',
      },
    }, ['ExternalExecutor']);

    expect(leakScan).toEqual(expect.objectContaining({
      passed: false,
      leakCount: 1,
      leaks: [
        expect.objectContaining({
          path: '$.label',
          value: 'ExternalExecutor dashboard widget',
        }),
      ],
    }));
    expect(cleanScan).toEqual(expect.objectContaining({
      passed: true,
      leakCount: 0,
    }));
  });
});
