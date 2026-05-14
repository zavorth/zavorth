import { GatewayHealthRenewalService } from '../../src/services/GatewayHealthRenewalService';

describe('GatewayHealthRenewalService', () => {
  it('recommends renewal when passed checks are stale', () => {
    const service = new GatewayHealthRenewalService();

    const report = service.inspect({
      runtime: {
        nodeMeshSmoke: { status: 'passed', stale: true },
        systemOverlordSmoke: { status: 'passed', stale: false },
        channelProviderDoctor: { status: 'passed', stale: true },
        remoteTransportDoctor: { status: 'missing', stale: false },
      },
    } as any);

    expect(report.status).toBe('renewal_recommended');
    expect(report.commands).toEqual(
      expect.arrayContaining(['npm run test:nodes:smoke', 'npm run test:channels:smoke']),
    );
  });

  it('stays fresh when snapshots are missing or already current', () => {
    const service = new GatewayHealthRenewalService();

    const report = service.inspect({
      runtime: {
        nodeMeshSmoke: { status: 'missing', stale: false },
      },
    } as any);

    expect(report.status).toBe('fresh');
    expect(report.items).toEqual([]);
  });
});
