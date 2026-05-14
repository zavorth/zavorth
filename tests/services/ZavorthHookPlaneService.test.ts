import { ZavorthHookPlaneService } from '../../src/services/ZavorthHookPlaneService.js';

describe('ZavorthHookPlaneService', () => {
  it('projects canonical hook coverage from workspace registrations and alias mapping', () => {
    const service = new ZavorthHookPlaneService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      workspaceExtensions: {
        listEntries: jest.fn(() => [
          {
            workspace: 'C:/repo',
            workspaceName: 'repo',
            hooks: [
              { event: 'session.before_send', command: 'npm run lint' },
              { event: 'plugin.after_action', command: 'npm run docs' },
              { event: 'custom-hook', command: 'echo custom' },
            ],
          },
        ]),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-02T12:00:00.000Z');
    expect(snapshot.summary.registeredHooks).toBe(3);
    expect(snapshot.summary.coveredEvents).toBe(2);
    expect(snapshot.summary.customEvents).toBe(1);
    expect(snapshot.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'before-session-send',
          registeredHooks: 1,
        }),
        expect.objectContaining({
          id: 'after-plugin-action',
          registeredHooks: 1,
        }),
      ]),
    );
  });
});
