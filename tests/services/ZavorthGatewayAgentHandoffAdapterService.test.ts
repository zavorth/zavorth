import {
  ZAVORTH_AGENT_GATEWAY_HANDOFF_VERSION,
} from '../../src/contracts/ZavorthAgentGatewayHandoffContract.js';
import {
  ZavorthGatewayAgentHandoffAdapterService,
} from '../../src/services/ZavorthGatewayAgentHandoffAdapterService.js';

describe('ZavorthGatewayAgentHandoffAdapterService', () => {
  it('assembles a prepared handoff snapshot without wiring the agent loop', async () => {
    const gatewaySnapshot = {
      generatedAt: '2026-04-20T12:00:00.000Z',
      summary: {
        channelsReady: 2,
        channelsTotal: 2,
        runtimeModesReady: 1,
        securityPosture: 'summary',
        memoryArtifacts: 0,
        teams: 0,
        integrationsReady: 1,
        nodesPaired: 0,
        remoteTransportsReady: 1,
        sessionTargets: 0,
        toolFamilies: 0,
        plugins: 0,
      },
      narrative: {
        headline: 'Gateway handoff shell.',
        operatorSummary: 'Gateway ready for handoff.',
      },
      memoryPlane: {
        generatedAt: '2026-04-20T12:00:00.000Z',
        summary: {},
        narrative: {},
      },
      controlPlane: {
        generatedAt: '2026-04-20T12:00:00.000Z',
        summary: {},
        narrative: {},
      },
    } as any;
    const health = {
      status: 'ready',
      runtimeAttached: true,
      operationsAttached: true,
      realtimeAttached: true,
      gatewayAvailable: true,
      sessionPlaneAvailable: true,
      authEnabled: true,
      gatewaySource: 'runtime',
      issues: [],
      summary: 'Gateway runtime ready.',
    } as any;
    const runtimeSnapshot = {
      generatedAt: '2026-04-20T12:00:00.000Z',
      auth: { enabled: true },
      health,
      controlPlane: {
        preferredTransport: 'ws',
        availableTransports: ['http', 'sse', 'ws'],
        websocketPath: '/api/web/gateway/ws',
        ssePath: '/api/web/events',
        statePath: '/api/web/state',
        historyPath: '/api/web/gateway/sessions/history',
        sendPath: '/api/web/gateway/sessions/send',
        spawnPath: '/api/web/gateway/sessions/spawn',
        heartbeatIntervalMs: 15_000,
        reconnectStrategy: 'reuse-session-state',
        sessionId: null,
        chatId: null,
      },
      sessionBus: null,
      gateway: gatewaySnapshot,
    } as any;
    const gateway = {
      buildShellSnapshot: jest.fn(() => gatewaySnapshot),
    };
    const runtime = {
      buildHealthSnapshot: jest.fn(() => health),
      buildCanonicalSnapshot: jest.fn(async () => runtimeSnapshot),
    };
    const service = new ZavorthGatewayAgentHandoffAdapterService({
      gateway,
      runtime,
      now: () => new Date('2026-04-20T12:00:00.000Z'),
    });

    const snapshot = await service.buildHandoffSnapshot({
      workspaceHint: 'workspace-alpha',
    });

    expect(snapshot.version).toBe(ZAVORTH_AGENT_GATEWAY_HANDOFF_VERSION);
    expect(snapshot.generatedAt).toBe('2026-04-20T12:00:00.000Z');
    expect(snapshot.phase).toBe('prepared');
    expect(snapshot.blockers).toEqual([]);
    expect(snapshot.guardrails.join(' ')).toContain('Do not fuse ingress');
    expect(snapshot.planes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gateway-core', status: 'ready' }),
        expect.objectContaining({ id: 'legacy-pass-through-plane', status: 'ready' }),
        expect.objectContaining({ id: 'proxy-transport-plane', status: 'ready' }),
        expect.objectContaining({ id: 'session-control-plane', status: 'ready' }),
      ]),
    );
    expect(snapshot.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'handoff-contract-defined', status: 'ready' }),
        expect.objectContaining({ id: 'legacy-pass-through-equivalents-mapped', status: 'ready' }),
        expect.objectContaining({ id: 'single-entrypoint-wiring-gate', status: 'pending' }),
        expect.objectContaining({ id: 'agent-loop-fusion-deferred', status: 'pending' }),
      ]),
    );
    expect(snapshot.nextIntegrationSteps.join(' ')).toContain('CoreOrchestrator -> SurfaceTaskDispatchService');
    expect(snapshot.guardrails.join(' ')).toContain('existing ZavorthAgentGateway');
    expect(snapshot.checklist.find((item) => item.id === 'single-entrypoint-wiring-gate')?.evidence.join(' ')).toContain(
      'Telegram natural requests already use the existing ZavorthAgentGateway',
    );
    expect(runtime.buildCanonicalSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceHint: 'workspace-alpha' }),
    );
    expect(gateway.buildShellSnapshot).toHaveBeenCalledWith({
      sessionId: null,
      chatId: null,
      userId: null,
      workspaceHint: 'workspace-alpha',
      hydrated: false,
    });
  });

  it('surfaces convergence blockers when runtime and gateway readers are incomplete', async () => {
    const health = {
      status: 'degraded',
      runtimeAttached: false,
      operationsAttached: false,
      realtimeAttached: false,
      gatewayAvailable: false,
      sessionPlaneAvailable: false,
      authEnabled: false,
      gatewaySource: 'none',
      issues: ['Gateway runtime is not attached.'],
      summary: 'Gateway runtime is not attached.',
    } as any;
    const service = new ZavorthGatewayAgentHandoffAdapterService({
      runtime: {
        buildHealthSnapshot: jest.fn(() => health),
      },
      now: () => new Date('2026-04-20T12:00:00.000Z'),
    });

    const snapshot = await service.buildHandoffSnapshot();

    expect(snapshot.phase).toBe('blocked');
    expect(snapshot.blockers).toEqual(
      expect.arrayContaining([
        'Gateway runtime is not attached.',
        'ZavorthGatewayService reader was not provided for the handoff adapter.',
        'Gateway snapshot source is unavailable.',
        'Session plane is not fully attached to the gateway runtime yet.',
      ]),
    );
    expect(snapshot.planes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gateway-core', status: 'blocked' }),
        expect.objectContaining({ id: 'session-control-plane', status: 'blocked' }),
      ]),
    );
    expect(snapshot.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'runtime-health-gated', status: 'blocked' }),
        expect.objectContaining({ id: 'compat-boundaries-isolated', status: 'blocked' }),
      ]),
    );
  });
});
