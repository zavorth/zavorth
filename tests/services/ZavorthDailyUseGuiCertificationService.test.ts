import { ZavorthDailyUseGuiCertificationService } from '../../src/services/ZavorthDailyUseGuiCertificationService';

function buildPublicApi(overrides: Record<string, any> = {}) {
  return {
    readRuntimeStatus: jest.fn(() => ({
      surface: 'runtime-api-v1',
      status: 'ready',
      runtime: { executionAuthority: false },
    })),
    readRuntimeHealth: jest.fn(() => ({
      surface: 'runtime-health-v1',
      healthy: true,
      safety: { dashboardCanExecute: false },
    })),
    readProviders: jest.fn(() => ({
      surface: 'provider-mesh-v1',
      summary: { total: 2 },
      safety: { rawSecretsSerialized: false },
    })),
    readChannels: jest.fn(() => ({
      surface: 'channel-mesh-v1',
      channels: [{ id: 'telegram' }],
      safety: { telegramPrivileged: false },
    })),
    readApprovals: jest.fn(async () => ({
      surface: 'approvals-v1',
      total: 1,
      safety: { approvalScopedToExactAction: true },
    })),
    readReceipts: jest.fn(() => ({
      apiSurface: 'receipts-v1',
      cards: [{ id: 'receipt-1' }],
    })),
    readMissions: jest.fn(() => ({
      surface: 'missions-v1',
      total: 1,
      projection: { sourceOfTruth: 'runtime-api' },
    })),
    submitChat: jest.fn(async () => ({
      surface: 'chat-v1',
      accepted: true,
      live: false,
      safety: { dryRunByDefault: true },
    })),
    readRuntimeEvents: jest.fn(async () => ({
      surface: 'events-v1',
      streamable: true,
      data: [{ type: 'heartbeat' }],
    })),
    approveApproval: jest.fn(),
    denyApproval: jest.fn(),
    cancelMission: jest.fn(),
    testProvider: jest.fn(),
    executeChannelAction: jest.fn(),
    ...overrides,
  } as any;
}

describe('ZavorthDailyUseGuiCertificationService', () => {
  it('certifies every daily-use GUI surface without triggering live chat or governed mutations', async () => {
    const publicApi = buildPublicApi();
    const service = new ZavorthDailyUseGuiCertificationService();

    const snapshot = await service.certify({
      publicApi,
      sessionId: 'session-gui',
      request: 'Certify GUI readiness.',
    });

    expect(snapshot).toEqual(expect.objectContaining({
      schemaVersion: 1,
      surface: 'daily-use-gui-certification-v1',
      summary: expect.objectContaining({
        status: 'ready',
        ready: 10,
        total: 10,
      }),
      safety: expect.objectContaining({
        dashboardCanExecute: false,
        desktopCanBypassRuntime: false,
        policyBrokerRequiredForMutableActions: true,
        previewFirstChat: true,
        rawSecretsSerialized: false,
      }),
    }));
    expect(snapshot.checks.map((check) => check.id)).toEqual([
      'status',
      'health',
      'providers',
      'channels',
      'approvals',
      'receipts',
      'missions',
      'chat',
      'events',
      'actions',
    ]);
    expect(publicApi.submitChat).toHaveBeenCalledWith({
      message: 'Certify GUI readiness.',
      sessionId: 'session-gui',
      live: false,
    });
    expect(publicApi.approveApproval).not.toHaveBeenCalled();
    expect(publicApi.cancelMission).not.toHaveBeenCalled();
    expect(publicApi.executeChannelAction).not.toHaveBeenCalled();
  });

  it('marks certification blocked when a required surface fails', async () => {
    const publicApi = buildPublicApi({
      readProviders: jest.fn(() => {
        throw new Error('provider mesh unavailable');
      }),
    });
    const service = new ZavorthDailyUseGuiCertificationService();

    const snapshot = await service.certify({ publicApi });

    expect(snapshot.summary.status).toBe('blocked');
    expect(snapshot.checks.find((check) => check.id === 'providers')).toEqual(expect.objectContaining({
      status: 'blocked',
      evidence: ['provider mesh unavailable'],
    }));
  });
});
