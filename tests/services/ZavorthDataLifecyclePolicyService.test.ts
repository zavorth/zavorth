import { ZavorthDataLifecyclePolicyService } from '../../src/services/ZavorthDataLifecyclePolicyService';

const NOW = new Date('2026-05-10T12:00:00.000Z');

describe('ZavorthDataLifecyclePolicyService', () => {
  it('covers the complete operational data lifecycle', () => {
    const service = new ZavorthDataLifecyclePolicyService({
      now: () => NOW,
      projectRoot: 'C:/fixture/zavorth',
      existsSync: () => true,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-data-lifecycle.v1');
    expect(snapshot.summary.releaseReady).toBe(true);
    expect(snapshot.summary.total).toBeGreaterThanOrEqual(10);
    expect(snapshot.defaults).toEqual(expect.objectContaining({
      dryRunByDefault: true,
      destructiveDeleteRequiresExplicitFlag: true,
      rawSecretExportAllowed: false,
      userContentNeedsLifecycle: true,
    }));
    expect(snapshot.datasets.map((dataset) => dataset.id)).toEqual(expect.arrayContaining([
      'app-logs',
      'media-cache',
      'db-backups',
      'session-history',
      'approval-receipts',
      'skill-cache',
    ]));
    expect(snapshot.datasets.every((dataset) =>
      dataset.commands.inspect && dataset.commands.export && dataset.commands.delete)).toBe(true);
  });

  it('blocks release when evidence is missing', () => {
    const service = new ZavorthDataLifecyclePolicyService({
      now: () => NOW,
      projectRoot: 'C:/fixture/zavorth',
      existsSync: () => false,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.releaseReady).toBe(false);
    expect(snapshot.issues.length).toBeGreaterThan(0);
    expect(snapshot.issues[0]).toEqual(expect.objectContaining({
      field: 'evidence',
    }));
  });
});
