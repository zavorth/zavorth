import { DashboardContractAdapterService } from '../../src/services/DashboardContractAdapterService';

describe('DashboardContractAdapterService', () => {
  it('builds the Dashboard projection from canonical API v1 contracts', async () => {
    const publicApi = {
      readRuntimeStatus: jest.fn(() => ({
        schemaVersion: 1,
        surface: 'runtime-api-v1',
        status: 'ready',
      })),
      readRuntimeHealth: jest.fn(() => ({
        schemaVersion: 1,
        surface: 'runtime-health-v1',
        healthy: true,
      })),
      readProviders: jest.fn(() => ({
        schemaVersion: 1,
        surface: 'provider-mesh-v1',
        providers: [],
      })),
      readChannels: jest.fn(() => ({
        schemaVersion: 1,
        surface: 'channel-mesh-v1',
        entries: [],
      })),
      readApprovals: jest.fn(async () => ({
        schemaVersion: 1,
        surface: 'approvals-v1',
        data: [],
      })),
      readReceipts: jest.fn(() => ({
        surface: 'visual-receipt-ux',
        apiSurface: 'receipts-v1',
      })),
      readMissions: jest.fn(() => ({
        schemaVersion: 1,
        surface: 'missions-v1',
        data: [],
      })),
    };
    const service = new DashboardContractAdapterService(publicApi as any);

    const snapshot = await service.buildSnapshot({
      includeAdvanced: true,
      providerId: 'openai',
      approvalStatus: 'pending',
      missionRequest: 'Review this repo.',
    });

    expect(publicApi.readProviders).toHaveBeenCalledWith({
      includeAdvanced: true,
      selectedTarget: 'openai',
    });
    expect(publicApi.readApprovals).toHaveBeenCalledWith({
      status: 'pending',
      limit: 20,
    });
    expect(snapshot).toEqual(expect.objectContaining({
      surface: 'dashboard-contract-adapter',
      source: expect.objectContaining({
        authority: 'runtime-api-v1',
        dashboardExecutionAuthority: false,
      }),
      parity: expect.objectContaining({
        providersFromCanonicalApi: true,
        channelsFromCanonicalApi: true,
        approvalsFromCanonicalApi: true,
        receiptsFromCanonicalApi: true,
        missionsFromCanonicalApi: true,
      }),
      safety: expect.objectContaining({
        projectionOnly: true,
        rawSecretsSerialized: false,
        policyBrokerRequiredForActions: true,
      }),
    }));
    expect(snapshot.providers.surface).toBe('provider-mesh-v1');
    expect(snapshot.channels.surface).toBe('channel-mesh-v1');
    expect(snapshot.approvals.surface).toBe('approvals-v1');
    expect(snapshot.missions.surface).toBe('missions-v1');
  });
});
