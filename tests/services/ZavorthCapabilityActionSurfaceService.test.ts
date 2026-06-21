import { ZavorthCapabilityActionSurfaceService } from '../../src/services/ZavorthCapabilityActionSurfaceService.js';

describe('ZavorthCapabilityActionSurfaceService', () => {
  test('projects verified exposures into dashboard, TUI and setup without live activation', () => {
    const service = new ZavorthCapabilityActionSurfaceService({
      now: () => new Date('2026-06-02T12:00:00.000Z'),
      exposures: {
        snapshot: () => ({
          summary: {
            exposures: 1,
            exposed: 1,
            blocked: 0,
            receipts: 1,
          },
          exposures: [
            {
              id: 'capability-action-exposure:research-pack',
              actionId: 'capability.candidate.research-pack',
              verificationId: 'verification:research-pack',
              title: 'Research pack',
              status: 'exposed',
              nextSafeAction: 'Preview the candidate before activation.',
            },
          ],
          receipts: [
            {
              id: 'receipt:research-pack',
              at: '2026-06-02T11:59:00.000Z',
              actor: 'operator',
              operation: 'expose-capability-action',
              status: 'applied',
              verificationId: 'verification:research-pack',
              exposureId: 'capability-action-exposure:research-pack',
              summary: 'Verified adapter exposed as a governed Action Harness candidate.',
            },
          ],
        } as any),
      },
      verifiedActions: [],
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.surface).toBe('capability-action-surface');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary).toMatchObject({
      exposed: 1,
      blocked: 0,
      receipts: 1,
      visibleSurfaces: 3,
    });
    expect(snapshot.items[0]).toMatchObject({
      actionId: 'capability.candidate.research-pack',
      status: 'available',
      previewCommand: 'zavorth actions preview capability.candidate.research-pack',
    });
    expect(snapshot.placement.dashboard.apiPath).toBe('/api/operations/capabilities');
    expect(snapshot.placement.tui.visible).toBe(true);
    expect(snapshot.placement.setup.visible).toBe(true);
    expect(snapshot.safety.readOnlyProjection).toBe(true);
    expect(snapshot.safety.noLiveActivation).toBe(true);
  });

  test('renders an honest empty state when no verified action is exposed', () => {
    const service = new ZavorthCapabilityActionSurfaceService({
      exposures: {
        snapshot: () => ({
          summary: { exposures: 0, exposed: 0, blocked: 0, receipts: 0 },
          exposures: [],
          receipts: [],
        } as any),
      },
      verifiedActions: [],
    });

    const snapshot = service.buildSnapshot();
    expect(snapshot.status).toBe('available');
    expect(snapshot.items).toEqual([]);
    expect(service.renderText(snapshot)).toContain('- none yet');
  });

  test('projects built-in verified Action Harness actions by default', () => {
    const service = new ZavorthCapabilityActionSurfaceService();

    const snapshot = service.buildSnapshot();

    expect(snapshot.items.map((item) => item.actionId)).toEqual(expect.arrayContaining([
      'workspace.create_file',
      'workspace.read_file',
      'web.search',
    ]));
  });
});
