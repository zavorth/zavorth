import { DashboardOperationsOverviewReaderBridgeService } from '../../src/domain/surface/presentation/dashboard/DashboardOperationsOverviewReaderBridgeService.js';

describe('DashboardOperationsOverviewReaderBridgeService', () => {
  it('delegates all canonical overview reads through the shared snapshot service', async () => {
    const deps = {
      workspaceRoot: 'C:/workspace',
      continuityUserId: '1',
    } as any;
    const getDeps = jest.fn(() => deps);
    const snapshots = {
      readOperationalOverviewSnapshot: jest.fn().mockResolvedValue({ summary: { posture: 'healthy' } }),
      readTrustOverviewSnapshot: jest.fn().mockResolvedValue({ summary: { posture: 'attention' } }),
      readProductOverviewSnapshot: jest.fn().mockResolvedValue({ summary: { posture: 'critical' } }),
    } as any;

    const bridge = new DashboardOperationsOverviewReaderBridgeService(getDeps, snapshots);
    const readers = bridge.buildReaders();

    await expect(bridge.readOperationalOverviewSnapshot()).resolves.toEqual({ summary: { posture: 'healthy' } });
    await expect(readers.readTrustOverviewSnapshot?.()).resolves.toEqual({ summary: { posture: 'attention' } });
    await expect(readers.readProductOverviewSnapshot?.()).resolves.toEqual({ summary: { posture: 'critical' } });

    expect(getDeps).toHaveBeenCalledTimes(3);
    expect(snapshots.readOperationalOverviewSnapshot).toHaveBeenCalledWith(deps);
    expect(snapshots.readTrustOverviewSnapshot).toHaveBeenCalledWith(deps);
    expect(snapshots.readProductOverviewSnapshot).toHaveBeenCalledWith(deps);
  });
});
