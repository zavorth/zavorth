import * as http from 'http';
import { WebAppRuntimeRouteService, type WebAppRuntimeRouteDeps } from '../../../../../src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

function makeDeps(body: Record<string, unknown>, overrides: Partial<WebAppRuntimeRouteDeps> = {}): WebAppRuntimeRouteDeps {
  return {
    auth: {} as any,
    accessReadiness: {} as any,
    accessManifest: {} as any,
    installJourney: {} as any,
    officialRemoteAccess: { inspect: jest.fn(), runAction: jest.fn() } as any,
    remoteAccess: { inspect: jest.fn() } as any,
    surfaceConsistency: {} as any,
    consoleAssets: {} as any,
    runtime: {} as any,
    realtime: {} as any,
    runtimeGateway: null,
    runtimeSessionTools: null,
    sessionTools: null,
    runtimeGatewaySessionTools: null,
    buildMemoryPlaneSnapshot: jest.fn(async () => null),
    buildLayeredMemoryStatus: jest.fn(async () => null),
    buildLearningPlaneStatus: jest.fn(async () => null),
    buildLearningPlaneSnapshot: jest.fn(async () => null),
    buildLearningPlaneMetrics: jest.fn(async () => null),
    executeLearningAction: jest.fn(),
    searchLayeredMemory: jest.fn(async () => null),
    readLayeredMemoryProcedures: jest.fn(async () => null),
    readLayeredMemoryMetrics: jest.fn(async () => null),
    buildOpsQuality: jest.fn(async () => null),
    buildSessionPlaneSnapshot: jest.fn(async () => null),
    buildSessionPlaneStatusSummary: jest.fn(async () => null),
    processChatSend: jest.fn(async () => ({
      taskId: 'task-chat-1',
      nextAction: 'done',
      snapshot: {
        sessionId: body.sessionId || 'side-session',
        messages: [{ role: 'assistant', content: 'runtime reply' }],
      },
    })),
    resolveSessionId: jest.fn(() => 'session-web-1'),
    resolveSessionIdFromPermission: jest.fn(),
    resolveSessionIdFromTask: jest.fn(),
    createWebContext: jest.fn(),
    openEventStream: jest.fn(),
    writeJson: jest.fn(),
    readJsonBody: jest.fn(async () => body),
    getComposerCatalog: jest.fn(),
    getGatewaySessionTools: jest.fn(),
    ...overrides,
  };
}

describe('WebAppRuntimeRouteService chat extensions', () => {
  it('preserves string experience profiles in dashboard chat payloads', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const deps = makeDeps({
      message: 'review this plan',
      sessionId: 'session-main',
      experienceProfile: 'developer',
      composerSettings: { effort: 'deep' },
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/dashboard/chat-v1'),
      '/api/web/dashboard/chat-v1',
      deps,
    );

    expect(handled).toBe(true);
    expect(deps.processChatSend).toHaveBeenCalledWith(expect.objectContaining({
      message: 'review this plan',
      source: 'zavorth-control',
      experienceProfile: 'developer',
      metadata: expect.objectContaining({
        dashboardChat: true,
        composerSettings: { effort: 'deep' },
        experienceProfile: 'developer',
      }),
    }));
  });

  it('routes detached side chat through the canonical web conversation runtime', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const deps = makeDeps({
      message: 'check this aside',
      sessionId: 'session-main',
      kind: 'btw',
      attachments: [{ name: 'notes.txt', type: 'text/plain', text: 'hello' }],
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/chat/side'),
      '/api/web/chat/side',
      deps,
    );

    expect(handled).toBe(true);
    expect(deps.processChatSend).toHaveBeenCalledWith(expect.objectContaining({
      message: 'check this aside',
      sessionId: expect.stringMatching(/^session-main:btw:/),
      source: 'zavorth-control-side-channel',
      detached: true,
      excludeFromTranscript: true,
      parentSessionId: 'session-main',
      metadata: expect.objectContaining({
        detachedSideChannel: true,
        sideChannelKind: 'btw',
        parentSessionId: 'session-main',
      }),
    }));
    expect(deps.writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        detached: true,
        excludeFromTranscript: true,
        sideSessionId: expect.stringMatching(/^session-main:btw:/),
        safety: expect.objectContaining({
          delegatedToCanonicalWebRuntime: true,
          parentTranscriptUntouched: true,
          sideSessionIsolated: true,
        }),
      }),
      200,
    );
  });

  it('routes steering into the current session with active-run metadata', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const steering = {
      id: 'agent-steer-1',
      runId: 'run-active-1',
      sessionId: 'session-main',
      text: 'keep this constraint',
      source: 'zavorth-control-steer',
      status: 'accepted',
      createdAt: '2026-05-30T10:00:00.000Z',
      updatedAt: '2026-05-30T10:00:00.000Z',
      ackId: 'steering-ack-1',
      attempts: 0,
      maxAttempts: 2,
      backoffMs: 1500,
      metadata: {},
    };
    const steer = jest.fn(() => ({
      ok: true,
      action: 'add',
      ack: {
        id: 'steering-ack-1',
        runId: 'run-active-1',
        steeringId: 'agent-steer-1',
        status: 'accepted',
        createdAt: '2026-05-30T10:00:00.000Z',
      },
      steering,
      run: {
        id: 'run-active-1',
        sessionId: 'session-main',
        status: 'running',
        steering: [steering],
        events: [],
      },
      error: null,
    }));
    const deps = makeDeps({
      message: 'keep this constraint',
      sessionId: 'session-main',
      runId: 'run-active-1',
      queueItemId: 'queue-1',
      backoffMs: 1500,
      maxAttempts: 2,
    }, {
      agentGateway: {
        steer,
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/chat/steer'),
      '/api/web/chat/steer',
      deps,
    );

    expect(handled).toBe(true);
    expect(deps.processChatSend).not.toHaveBeenCalled();
    expect(steer).toHaveBeenCalledWith(expect.objectContaining({
      action: 'add',
      text: 'keep this constraint',
      sessionId: 'session-main',
      runId: 'run-active-1',
      source: 'zavorth-control-steer',
      queueItemId: 'queue-1',
      backoffMs: 1500,
      maxAttempts: 2,
      metadata: expect.objectContaining({
        activeRunSteer: true,
        nativeAgentRunSteering: true,
        steerTargetRunId: 'run-active-1',
      }),
    }));
    expect(deps.writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        steered: true,
        ack: expect.objectContaining({
          id: 'steering-ack-1',
        }),
        steering: expect.objectContaining({
          id: 'agent-steer-1',
        }),
        runId: 'run-active-1',
        sessionId: 'session-main',
        safety: expect.objectContaining({
          delegatedToNativeAgentGateway: true,
          nativeAgentRunSteering: true,
          transcriptScope: 'active-session',
        }),
      }),
      200,
    );
  });
});
