import { EventEmitter } from 'events';
import { configureCanonicalPublicApi } from '../../../src/api/public/endpoints';
import { PublicApiRouter } from '../../../src/api/public/PublicApiRouter';
import { CanonicalPublicApiService } from '../../../src/api/public/CanonicalPublicApiService';
import { PublicRuntimeEventService } from '../../../src/services/PublicRuntimeEventService';
import type { WebRealtimeEvent } from '../../../src/services/WebRealtimeService';

const AUTH_TOKEN = 'runtime-api-v1-gui-readiness-token';

class MockRequest extends EventEmitter {
  public headers: Record<string, string>;

  constructor(
    public method: string,
    public url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    super();
    this.headers = {
      host: 'localhost',
      authorization: `Bearer ${AUTH_TOKEN}`,
      ...headers,
    };

    if (body !== undefined) {
      process.nextTick(() => {
        this.emit('data', Buffer.from(JSON.stringify(body)));
        this.emit('end');
      });
    }
  }
}

class MockResponse extends EventEmitter {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public body = '';
  public headersSent = false;

  public setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  public writeHead(statusCode: number, headers: Record<string, string> = {}): void {
    this.statusCode = statusCode;
    for (const [key, value] of Object.entries(headers)) {
      this.setHeader(key, value);
    }
    this.headersSent = true;
  }

  public write(chunk: string): void {
    this.body += String(chunk || '');
  }

  public end(body = ''): void {
    this.body += String(body || '');
    this.emit('finish');
  }
}

function permissionFixture(status: 'pending' | 'approved' | 'rejected' = 'pending') {
  return {
    permission_id: 'perm-gui-1',
    created_at: '2026-05-14T00:00:00.000Z',
    updated_at: '2026-05-14T00:00:00.000Z',
    task_id: 'task-gui-1',
    executor: 'runtime',
    kind: 'workspace.write',
    status,
    scope: 'once',
    workspace: 'C:/workspace/zavorth-core/Zavorth',
    requested_value: 'Edit src/index.ts',
    resolved_value: null,
    reason: 'GUI readiness approval fixture.',
    requested_by: 'agent',
    decided_by: status === 'pending' ? null : 'user-gui',
    decision_note: null,
    metadata: {
      risk: 'medium',
      files: ['src/index.ts'],
      policy: 'workspace.write.requires_approval',
    },
  };
}

function buildRuntime(overrides: Record<string, any> = {}) {
  const operationsHealth = {
    readSnapshotFast: () => ({
      healthy: true,
      maintenance: { startedAt: null, finishedAt: null },
      errors: { lastError: null },
      generatedAt: '2026-05-14T00:00:00.000Z',
    }),
    readSnapshotLive: () => ({
      healthy: true,
      maintenance: { startedAt: null, finishedAt: null },
      errors: { lastError: null },
      generatedAt: '2026-05-14T00:00:00.000Z',
    }),
  };

  return {
    getRuntime: () => ({}),
    getGateway: () => null,
    getSessionPlane: () => null,
    getNodeMesh: () => null,
    getPlatformRegistry: () => null,
    getRemoteTransports: () => null,
    getOperationsHealth: () => operationsHealth,
    getLearningPlane: () => null,
    getLayeredMemory: () => null,
    ...overrides,
  } as any;
}

function buildService() {
  const permissionService = {
    listRequests: jest.fn(async () => [permissionFixture()]),
    getRequest: jest.fn(async () => permissionFixture()),
    approveRequest: jest.fn(async () => permissionFixture('approved')),
    rejectRequest: jest.fn(async () => permissionFixture('rejected')),
  };
  const providerControlPlane = {
    listProviders: jest.fn(({ includeAdvanced } = {}) => includeAdvanced
      ? [
          { id: 'openai', label: 'OpenAI', readiness: 'needs_probe' },
          { id: 'ollama', label: 'Ollama', readiness: 'needs_config' },
          { id: 'openrouter', label: 'OpenRouter', readiness: 'ready' },
        ]
      : [
          { id: 'openai', label: 'OpenAI', readiness: 'needs_probe' },
          { id: 'openrouter', label: 'OpenRouter', readiness: 'ready' },
        ]),
    listProfiles: jest.fn(() => [{ id: 'balanced', label: 'Balanced' }]),
    buildModelPickerContract: jest.fn(() => ({ schemaVersion: 1, groups: [] })),
    resolveSelectedModelProfile: jest.fn(() => ({ primary: null })),
  };
  const channelMesh = {
    buildSnapshot: jest.fn(() => ({
      generatedAt: '2026-05-14T00:00:00.000Z',
      summary: { total: 2, ready: 1, needsSetup: 1 },
      channels: [
        { id: 'telegram', label: 'Telegram', readiness: 'ready', actions: ['status'] },
        { id: 'whatsapp', label: 'WhatsApp', readiness: 'needs_setup', actions: ['login-qr'] },
      ],
      selected: null,
    })),
  };
  const channelActions = {
    execute: jest.fn(async () => ({
      generatedAt: '2026-05-14T00:00:00.000Z',
      channelId: 'telegram',
      actionId: 'status',
      status: 'applied',
      ok: true,
      summary: 'Channel status returned.',
      details: [],
      selected: null,
      snapshot: {},
    })),
  };
  const providerReadiness = {
    buildLiveSnapshot: jest.fn(async ({ providerId, live }: any) => ({
      schemaVersion: 1,
      surface: 'provider-readiness-matrix',
      generatedAt: '2026-05-14T00:00:00.000Z',
      mode: live ? 'live' : 'preview',
      status: providerId === 'openrouter' ? 'ready' : 'needs_probe',
      entries: [
        { id: providerId, status: providerId === 'openrouter' ? 'ready' : 'needs_probe' },
      ],
      summary: { ready: providerId === 'openrouter' ? 1 : 0, needsProbe: providerId === 'openrouter' ? 0 : 1 },
    })),
  };
  const supervisedExecutionGateway = {
    cancelAction: jest.fn(async () => ({ actionId: 'mission-gui-1', status: 'cancelled' })),
  };
  const conversationService = {
    processChatSend: jest.fn(async () => ({
      sessionId: 'session-gui-1',
      taskId: 'task-gui-1',
      snapshot: { state: 'accepted' },
    })),
  };

  return {
    service: new CanonicalPublicApiService(buildRuntime({
      getPermissionService: () => permissionService,
      getProviderControlPlane: () => providerControlPlane,
      getChannelMesh: () => channelMesh,
      getChannelActions: () => channelActions,
      getProviderReadiness: () => providerReadiness,
      getSupervisedExecutionGateway: () => supervisedExecutionGateway,
      getConversationService: () => conversationService,
    })),
    permissionService,
    providerControlPlane,
    channelMesh,
    channelActions,
    providerReadiness,
    supervisedExecutionGateway,
    conversationService,
  };
}

async function call(router: PublicApiRouter, method: string, url: string, body?: unknown) {
  const res = new MockResponse();
  await router.route(new MockRequest(method, url, body) as any, res as any);
  const parsed = res.body ? JSON.parse(res.body) : null;
  return { res, body: parsed };
}

describe('Runtime API v1 GUI readiness certification', () => {
  it('serves every canonical GUI v1 endpoint through stable envelopes', async () => {
    const { service } = buildService();
    const router = configureCanonicalPublicApi(
      new PublicApiRouter({ authToken: AUTH_TOKEN, principalUserId: 'user-gui' }),
      service,
    );

    const endpointCalls: Array<[string, string, unknown?]> = [
      ['GET', '/api/v1/status'],
      ['GET', '/api/v1/health'],
      ['GET', '/api/v1/providers'],
      ['GET', '/api/v1/channels'],
      ['GET', '/api/v1/approvals'],
      ['GET', '/api/v1/receipts'],
      ['GET', '/api/v1/missions?q=Review%20the%20project'],
      ['POST', '/api/v1/chat', { message: 'Review this repository safely.' }],
      ['GET', '/api/v1/events?sessionId=session-gui-1'],
      ['POST', '/api/v1/approvals/perm-gui-1/approve', { note: 'Approved from GUI.' }],
      ['POST', '/api/v1/approvals/perm-gui-1/deny', { reason: 'Denied from GUI.' }],
      ['POST', '/api/v1/missions/mission-gui-1/cancel', { reason: 'User cancelled.' }],
      ['POST', '/api/v1/providers/openrouter/test', {}],
      ['POST', '/api/v1/channels/telegram/action', { actionId: 'status' }],
    ];

    for (const [method, url, payload] of endpointCalls) {
      const result = await call(router, method, url, payload);
      expect(result.res.statusCode).toBe(200);
      expect(result.body).toEqual(expect.objectContaining({
        ok: true,
        data: expect.anything(),
        error: null,
        traceId: expect.stringMatching(/^api_/),
      }));
    }
  });

  it('keeps provider and channel readiness honest instead of claiming live readiness', async () => {
    const { service } = buildService();

    const providers = service.readProviders();
    const channels = service.readChannels();

    expect(providers.summary.ready).toBe(1);
    expect(providers.summary.needsConfig).toBe(0);
    expect(providers.summary.needsProbe).toBe(1);
    expect(providers.safety).toEqual(expect.objectContaining({
      secretRefsOnly: true,
      rawSecretsSerialized: false,
      catalogSupportIsNotLiveProof: true,
      defaultRoutingRequiresLiveProof: true,
    }));
    expect(providers.liveCompletion).toEqual(expect.objectContaining({
      providerSelectionRequiresLiveProof: true,
      catalogSupportIsNotLiveProof: true,
      rawSecretsSerialized: false,
    }));
    expect(channels).toEqual(expect.objectContaining({
      surface: 'channel-mesh-v1',
      safety: expect.objectContaining({
        liveBridgeRequiresPolicyBroker: true,
        telegramPrivileged: false,
      }),
    }));
    expect((channels as any).channels).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'whatsapp', readiness: 'needs_setup' }),
    ]));
  });

  it('requires policy approval before sensitive actions and never mutates directly from controllers', async () => {
    const { service, channelActions } = buildService();

    const denied = await service.executeChannelAction({
      channelId: 'telegram',
      actionId: 'logout',
      requestedBy: 'user-gui',
    });

    expect(denied).toEqual(expect.objectContaining({
      surface: 'governed-action-v1',
      ok: false,
      status: 'needs_approval',
      safety: expect.objectContaining({
        controllerMutatedDirectly: false,
        policyBrokerEvaluated: true,
      }),
    }));
    expect(channelActions.execute).not.toHaveBeenCalled();
  });

  it('creates a traceable mission from chat without live execution by default', async () => {
    const { service, conversationService } = buildService();

    const preview = await service.submitChat({
      sessionId: 'session-gui-1',
      message: 'Audit this project and summarize risk.',
    });

    expect(preview).toEqual(expect.objectContaining({
      surface: 'chat-v1',
      accepted: true,
      live: false,
      mode: 'preview',
      sessionId: 'session-gui-1',
      taskId: null,
      mission: expect.objectContaining({
        title: expect.any(String),
        status: expect.any(String),
      }),
      safety: expect.objectContaining({
        dryRunByDefault: true,
        policyBrokerRequiredForTools: true,
      }),
      receipt: expect.objectContaining({
        surface: 'visual-receipt',
      }),
      flow: expect.objectContaining({
        stage: 'preview',
        previewFirst: true,
        approvalGate: expect.objectContaining({
          required: expect.any(Boolean),
        }),
        eventTypes: expect.arrayContaining(['mission.updated', 'approval.request', 'receipt.ready']),
      }),
    }));
    expect(conversationService.processChatSend).not.toHaveBeenCalled();
  });

  it('blocks live chat submission until mission approval, sandbox and policy state allow it', async () => {
    const { service, conversationService } = buildService();

    const live = await service.submitChat({
      sessionId: 'session-gui-1',
      message: 'Audit this project for security risks.',
      live: true,
    });

    expect(live.accepted).toBe(false);
    expect(live.mode).toEqual(expect.stringMatching(/^(approval_required|dry_run_only|blocked)$/));
    expect(live.flow).toEqual(expect.objectContaining({
      sourceOfTruth: 'runtime-api',
      receiptReady: true,
      eventTypes: expect.arrayContaining(['mission.updated', 'approval.request', 'receipt.ready']),
    }));
    expect(conversationService.processChatSend).not.toHaveBeenCalled();
  });

  it('supports approval.request to approval decision to receipt.ready event flow', async () => {
    const { service, permissionService } = buildService();
    const events = new PublicRuntimeEventService();

    const [approvalRequest] = events.mapWebRealtimeEvent({
      id: 'event-approval-1',
      type: 'permission',
      createdAt: '2026-05-14T10:00:00.000Z',
      payload: {
        permission_id: 'perm-gui-1',
        task_id: 'task-gui-1',
        kind: 'workspace.write',
        reason: 'Edit one file.',
        requested_value: 'src/index.ts',
        metadata: {
          risk: 'medium',
          files: ['src/index.ts'],
          policy: 'workspace.write.requires_approval',
        },
      },
    } as WebRealtimeEvent);
    const approved = await service.approveApproval({
      approvalId: 'perm-gui-1',
      decidedBy: 'user-gui',
    });
    const receiptEvents = events.mapWebRealtimeEvent({
      id: 'event-tool-1',
      type: 'tool',
      createdAt: '2026-05-14T10:01:00.000Z',
      payload: {
        runId: 'run-gui-1',
        taskId: 'task-gui-1',
        workflowRunId: 'mission-gui-1',
        toolName: 'apply_patch',
        status: 'completed',
        filesTouched: ['src/index.ts'],
        artifacts: [{ id: 'artifact-gui-1' }],
        diff: { summary: 'Changed one file.' },
      },
    } as WebRealtimeEvent);

    expect(approvalRequest.type).toBe('approval.request');
    expect(approvalRequest.data).toEqual(expect.objectContaining({
      approvalId: 'perm-gui-1',
      taskId: 'task-gui-1',
    }));
    expect(approved.status).toBe('applied');
    expect(permissionService.approveRequest).toHaveBeenCalledWith('perm-gui-1', 'user-gui', expect.any(Object));
    expect(receiptEvents.map((event) => event.type)).toContain('receipt.ready');
    expect(receiptEvents.find((event) => event.type === 'receipt.ready')).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        missionId: 'mission-gui-1',
        taskId: 'task-gui-1',
        rollbackAvailable: true,
      }),
    }));
  });
});
