import { CanonicalPublicApiService } from '../../src/api/public/CanonicalPublicApiService';

function createService(input: {
  runtimePresent?: boolean;
  maintenanceStartedAt?: string | null;
  maintenanceFinishedAt?: string | null;
  lastError?: {
    level?: string | null;
    message?: string | null;
    timestamp?: string | null;
    category?: string | null;
  } | null;
} = {}) {
  const snapshot = {
    maintenance: {
      startedAt: input.maintenanceStartedAt ?? null,
      finishedAt: input.maintenanceFinishedAt ?? null,
    },
    errors: {
      lastError: input.lastError ?? null,
    },
  };

  return new CanonicalPublicApiService({
    getRuntime: () => (input.runtimePresent === false ? null : ({} as any)),
    getGateway: () => null,
    getSessionPlane: () => null,
    getNodeMesh: () => null,
    getPlatformRegistry: () => null,
    getRemoteTransports: () => null,
    getOperationsHealth: () => ({
      readSnapshotFast: () => snapshot as any,
      readSnapshotLive: () => snapshot as any,
    }),
    getLearningPlane: () => null,
    getLayeredMemory: () => null,
  });
}

describe('CanonicalPublicApiService', () => {
  it('ignores stale unfinished maintenance snapshots when reporting gateway status', () => {
    const service = createService({
      runtimePresent: true,
      maintenanceStartedAt: '2026-03-29T06:08:52.807Z',
      maintenanceFinishedAt: null,
    });

    expect(service.readGatewayStatus().status).toBe('ready');
  });

  it('keeps ops health healthy when the latest operational signal is only a warning', () => {
    const service = createService({
      runtimePresent: true,
      lastError: {
        level: 'warn',
        category: 'Bootstrap',
        message: 'Discord nativo ativo por escolha operacional.',
        timestamp: '2026-04-11T02:20:57.000Z',
      },
    });

    expect(service.readOpsHealth().healthy).toBe(true);
  });

  it('marks ops health unhealthy when the latest operational signal is an error', () => {
    const service = createService({
      runtimePresent: true,
      lastError: {
        level: 'error',
        category: 'Database',
        message: 'Falha ao abrir o banco.',
        timestamp: '2026-04-11T02:20:57.000Z',
      },
    });

    expect(service.readOpsHealth().healthy).toBe(false);
  });

  it('exposes canonical runtime api projections without granting execution authority', async () => {
    const service = createService({
      runtimePresent: true,
    });

    const status = service.readRuntimeStatus();
    const health = service.readRuntimeHealth();
    const providers = service.readProviders();
    const channels = service.readChannels();
    const approvals = await service.readApprovals({ status: 'all' });
    const receipts = service.readReceipts();
    const missions = service.readMissions({ request: 'Review the project safely.' });
    const chat = await service.submitChat({ message: 'Review the project safely.' });
    const events = await service.readRuntimeEvents({ sessionId: 'session-1' });

    expect(status).toEqual(expect.objectContaining({
      surface: 'runtime-api-v1',
      runtime: expect.objectContaining({
        attached: true,
        executionAuthority: false,
      }),
    }));
    expect(health).toEqual(expect.objectContaining({
      surface: 'runtime-health-v1',
      safety: expect.objectContaining({
        publicApiCanBypassPolicy: false,
      }),
    }));
    expect(providers).toEqual(expect.objectContaining({
      surface: 'provider-mesh-v1',
      safety: expect.objectContaining({
        rawSecretsSerialized: false,
        selectionRequiresGovernedApply: true,
      }),
    }));
    expect(channels).toEqual(expect.objectContaining({
      surface: 'channel-mesh-v1',
      safety: expect.objectContaining({
        telegramPrivileged: false,
      }),
    }));
    expect(approvals).toEqual(expect.objectContaining({
      surface: 'approvals-v1',
      status: 'all',
      approvalCards: expect.objectContaining({
        surface: 'approval-action-cards-ux',
      }),
      trustUx: expect.objectContaining({
        surface: 'approval-receipt-trust-ux',
        decisionFlow: expect.objectContaining({
          previewFirst: true,
          approvalDoesNotExecuteTargetAction: true,
          targetActionRequiresRuntimeGate: true,
        }),
      }),
      safety: expect.objectContaining({
        dashboardCanExecute: false,
        approvalDoesNotExecuteTargetAction: true,
        receiptsRequiredForTrustDecisions: true,
      }),
    }));
    expect(receipts).toEqual(expect.objectContaining({
      surface: 'visual-receipt-ux',
      apiSurface: 'receipts-v1',
      trustUx: expect.objectContaining({
        surface: 'approval-receipt-trust-ux',
        safety: expect.objectContaining({
          dashboardCanExecuteTargetAction: false,
        }),
      }),
    }));
    expect(missions).toEqual(expect.objectContaining({
      surface: 'missions-v1',
      projection: expect.objectContaining({
        sourceOfTruth: 'runtime-api',
      }),
    }));
    expect(chat).toEqual(expect.objectContaining({
      surface: 'chat-v1',
      accepted: true,
      live: false,
      mode: 'preview',
      receipt: expect.objectContaining({
        surface: 'visual-receipt',
        missionId: chat.mission.id,
      }),
      flow: expect.objectContaining({
        stage: 'preview',
        previewFirst: true,
        sourceOfTruth: 'runtime-api',
        receiptReady: true,
        eventTypes: expect.arrayContaining(['mission.updated', 'approval.request', 'receipt.ready']),
      }),
      safety: expect.objectContaining({
        dryRunByDefault: true,
      }),
    }));
    expect(events).toEqual(expect.objectContaining({
      surface: 'runtime-events-v1',
      sessionId: 'session-1',
      streaming: expect.objectContaining({
        ssePath: '/api/v1/events?sessionId=session-1',
        canonicalEventTypes: expect.arrayContaining(['approval.request', 'runtime.status', 'receipt.ready']),
      }),
      safety: expect.objectContaining({
        dashboardCanExecute: false,
      }),
    }));
  });

  it('does not submit live chat when the mission requires approval, dry-run, or a blocked sandbox', async () => {
    const conversationService = {
      processChatSend: jest.fn(async () => ({
        sessionId: 'session-live-1',
        taskId: 'task-live-1',
        snapshot: { state: 'accepted' },
      })),
    };
    const service = new CanonicalPublicApiService({
      getRuntime: () => ({} as any),
      getGateway: () => null,
      getSessionPlane: () => null,
      getNodeMesh: () => null,
      getPlatformRegistry: () => null,
      getRemoteTransports: () => null,
      getOperationsHealth: () => null,
      getLearningPlane: () => null,
      getLayeredMemory: () => null,
      getConversationService: () => conversationService,
    } as any);

    const result = await service.submitChat({
      sessionId: 'session-live-1',
      message: 'Audit this workspace for security risks.',
      live: true,
    });

    expect(result.mode).toEqual(expect.stringMatching(/^(approval_required|dry_run_only|blocked)$/));
    expect(result.accepted).toBe(false);
    expect(result.flow.approvalGate.risk).toEqual(expect.stringMatching(/^(medium|high|low)$/));
    expect(result.flow.eventTypes).toEqual(expect.arrayContaining(['mission.updated', 'approval.request', 'receipt.ready']));
    expect(conversationService.processChatSend).not.toHaveBeenCalled();
  });
});
