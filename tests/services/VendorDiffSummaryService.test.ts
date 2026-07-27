import { VendorDiffSummaryService } from '../../src/services/VendorDiffSummaryService.js';

describe('VendorDiffSummaryService', () => {
  it('marks updates when the source head diverges from the lock', () => {
    const service = new VendorDiffSummaryService();

    const summary = service.buildSummary({
      vendorId: 'AIGateway',
      displayName: 'AIGateway',
      lockedCommit: 'aaaaaaaa11111111',
      worktreeCommit: 'aaaaaaaa11111111',
      sourceHead: 'bbbbbbbb22222222',
      lastActionType: 'update',
      lastActionAt: '2026-04-07T15:00:00.000Z',
      trimmed: '512 MB',
    });

    expect(summary.status).toBe('update_available');
    expect(summary.changed).toBe(true);
    expect(summary.summary).toContain('update pendente');
  });

  it('marks vendors without lock as unlocked', () => {
    const service = new VendorDiffSummaryService();

    const summary = service.buildSummary({
      vendorId: 'omni-zavorth-bridge-remote-chat',
      displayName: 'Zavorth Remote Terminal Sidecar',
      lockedCommit: null,
      worktreeCommit: 'cccccccc33333333',
      sourceHead: 'cccccccc33333333',
    });

    expect(summary.status).toBe('unlocked');
    expect(summary.summary).toContain('ainda was not promovido');
  });
});
