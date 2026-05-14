import { ZavorthHookPipelineService } from '../../src/services/ZavorthHookPipelineService.js';

describe('ZavorthHookPipelineService', () => {
  it('maps workspace hooks into a broader canonical hook pipeline', async () => {
    const service = new ZavorthHookPipelineService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      workspaceProfileService: {
        getProfile: jest.fn(async () => ({
          workspace: 'C:/repo',
          workspace_hooks: [
            { event: 'before-publish', command: 'npm run docs:site:build' },
            { event: 'before-runtime-exec', command: 'npm run lint' },
          ],
        })),
      } as any,
      workspaceHookService: {
        listHooks: jest.fn((profile: any) => profile.workspace_hooks),
        getHooksForEvent: jest.fn((profile: any, event: string) =>
          profile.workspace_hooks.filter((hook: any) => hook.event === event),
        ),
        runHooksForEvent: jest.fn(async ({ event }: any) => ({
          event,
          workspace: 'C:/repo',
          hooks: [],
          dryRun: true,
          ok: true,
          results: [],
        })),
      } as any,
    });

    const snapshot = await service.buildSnapshot('C:/repo');
    const plan = await service.buildExecutionPlan({
      workspace: 'C:/repo',
      event: 'before-runtime-exec',
    });

    expect(snapshot.summary.totalRegistered).toBe(2);
    expect(snapshot.summary.coveredEvents).toBe(2);
    expect(snapshot.registered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mappedEvent: 'before-publish' }),
        expect.objectContaining({ mappedEvent: 'before-runtime-exec' }),
      ]),
    );
    expect(plan).toEqual([
      expect.objectContaining({
        event: 'before-runtime-exec',
        hook: expect.objectContaining({ command: 'npm run lint' }),
      }),
    ]);
  });

  it('resolves dot-notation aliases from runtime/session/plugin/transport back to canonical events', async () => {
    const service = new ZavorthHookPipelineService();

    expect(service.resolveCanonicalEvent('session.before_send')).toBe('before-session-send');
    expect(service.resolveCanonicalEvent('tool.before_execute')).toBe('before-runtime-exec');
    expect(service.resolveCanonicalEvent('plugin.after_action')).toBe('after-plugin-action');
    expect(service.resolveCanonicalEvent('transport.before_action')).toBe('before-transport-action');
  });
});
