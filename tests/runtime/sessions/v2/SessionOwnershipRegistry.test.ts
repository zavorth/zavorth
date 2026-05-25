import { SessionGarbageCollector } from '../../../../src/runtime/sessions/v2/SessionGarbageCollector.js';
import { SessionRegistryService } from '../../../../src/runtime/sessions/v2/SessionRegistryService.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('Session ownership registry', () => {
  it('registers canonical ownership for a run-owned session', () => {
    const registry = new SessionRegistryService({
      now: () => new Date('2026-04-27T15:00:00.000Z'),
      idFactory: createIdFactory(),
    });

    const record = registry.registerSession({
      sessionId: 'session-run-1',
      kind: 'agent_run',
      surface: 'web',
      runId: 'run-1',
      taskId: 'task-1',
      metadata: {
        route: 'dashboard',
      },
    });

    expect(record).toEqual(expect.objectContaining({
      ownershipId: 'session-owner-1',
      sessionId: 'session-run-1',
      ownerRef: 'run:run-1',
      kind: 'agent_run',
      surface: 'web',
      status: 'active',
      runId: 'run-1',
      taskId: 'task-1',
      createdAt: '2026-04-27T15:00:00.000Z',
      lastSeenAt: '2026-04-27T15:00:00.000Z',
      metadata: {
        route: 'dashboard',
      },
    }));
  });

  it('marks stale owned sessions as orphaned and reaps them through policy', async () => {
    const terminateSession = jest.fn();
    const registry = new SessionRegistryService({
      now: () => new Date('2026-04-27T15:00:00.000Z'),
      idFactory: createIdFactory(),
    });
    registry.registerSession({
      sessionId: 'session-stale-1',
      kind: 'agent_run',
      surface: 'cli',
      runId: 'run-stale',
    });
    const collector = new SessionGarbageCollector({
      registry,
      now: () => new Date('2026-04-27T15:00:02.000Z'),
      policy: {
        orphanAfterMs: 1000,
        reapAfterMs: 1000,
      },
      terminateSession,
    });

    const orphanSweep = await collector.sweep();

    expect(orphanSweep.orphaned).toEqual([
      expect.objectContaining({
        sessionId: 'session-stale-1',
        status: 'orphaned',
        orphanReason: 'owner_stale',
      }),
    ]);
    expect(orphanSweep.receipts).toEqual([
      expect.objectContaining({
        action: 'marked_orphan',
        sessionId: 'session-stale-1',
        reason: 'owner_stale',
      }),
    ]);
    expect(terminateSession).not.toHaveBeenCalled();

    const reapSweep = await collector.sweep({ now: '2026-04-27T15:00:04.000Z' });

    expect(terminateSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-stale-1',
      status: 'orphaned',
    }));
    expect(reapSweep.reaped).toEqual([
      expect.objectContaining({
        sessionId: 'session-stale-1',
        status: 'reaped',
      }),
    ]);
    expect(reapSweep.receipts).toEqual([
      expect.objectContaining({
        action: 'reaped',
        sessionId: 'session-stale-1',
        reason: 'orphan_reap_policy',
      }),
    ]);
  });

  it('keeps valid owners and protected standalone live sessions during sweep', async () => {
    const terminateSession = jest.fn();
    const registry = new SessionRegistryService({
      now: () => new Date('2026-04-27T15:00:00.000Z'),
      idFactory: createIdFactory(),
    });
    registry.registerSession({
      sessionId: 'session-valid-1',
      kind: 'agent_run',
      surface: 'web',
      runId: 'run-valid',
    });
    registry.registerSession({
      sessionId: 'session-live-1',
      kind: 'live_terminal',
      surface: 'web',
      taskId: 'terminal-live-1',
    });
    const collector = new SessionGarbageCollector({
      registry,
      now: () => new Date('2026-04-27T15:10:00.000Z'),
      policy: {
        orphanAfterMs: 1000,
        reapAfterMs: 1000,
      },
      terminateSession,
    });

    const sweep = await collector.sweep({
      activeOwnerRefs: ['run:run-valid'],
    });

    expect(sweep.orphaned).toHaveLength(0);
    expect(sweep.reaped).toHaveLength(0);
    expect(terminateSession).not.toHaveBeenCalled();
    expect(registry.getSession('session-valid-1')?.status).toBe('active');
    expect(registry.getSession('session-live-1')?.status).toBe('active');
  });
});
