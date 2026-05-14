import { SwarmOrchestrator } from '../../../../src/runtime/sessions/v2/SwarmOrchestrator.js';
import { EventEmitter } from 'events';
import { SessionRegistryService } from '../../../../src/runtime/sessions/v2/SessionRegistryService.js';

function buildEchoRole(label: string, extra: string) {
  return {
    id: label.toLowerCase(),
    label,
    systemPrompt: `You are ${label}`,
    command: process.execPath,
    args: [
      '-e',
      [
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => {",
        `  process.stdout.write(${JSON.stringify(`${extra}:`)} + chunk);`,
        '  process.exit(0);',
        '});',
      ].join(' '),
    ],
  };
}

describe('SwarmOrchestrator', () => {
  it('executes multiple roles and synthesizes the collected outputs', async () => {
    const orchestrator = new SwarmOrchestrator('Ship the release safely', [
      buildEchoRole('Researcher', 'research'),
      buildEchoRole('Reviewer', 'review'),
    ], {
      sessionFactory: (role) => buildFakeSession(role.id === 'researcher' ? 'research' : 'review'),
    });

    const snapshot = await orchestrator.execute();

    expect(snapshot.status).toBe('completed');
    expect(snapshot.roles).toHaveLength(2);
    expect(snapshot.synthesizedOutput).toContain('research:');
    expect(snapshot.synthesizedOutput).toContain('review:');
  });

  it('times out roles that never exit and emits lifecycle events', async () => {
    const orchestrator = new SwarmOrchestrator('Do not hang', [
      {
        id: 'stuck',
        label: 'Stuck',
        systemPrompt: 'Stay alive',
        command: process.execPath,
        args: ['-e', 'setInterval(() => {}, 1000);'],
      },
    ], {
      roleTimeoutMs: 25,
      sessionFactory: () => buildStuckSession(),
    });
    const events: string[] = [];

    orchestrator.on('role:started', (event: any) => events.push(`started:${event.roleId}`));
    orchestrator.on('role:finished', (event: any) => events.push(`finished:${event.roleId}:${event.status}`));

    const snapshot = await orchestrator.execute();

    expect(snapshot.status).toBe('timed_out');
    expect(snapshot.roles[0].status).toBe('TIMEOUT');
    expect(events).toContain('started:stuck');
    expect(events).toContain('finished:stuck:TIMEOUT');
  });

  it('registers swarm role ownership through the existing session factory path', async () => {
    const registry = new SessionRegistryService({
      now: () => new Date('2026-04-27T16:10:00.000Z'),
      idFactory: (prefix) => `${prefix}-swarm`,
    });
    const orchestrator = new SwarmOrchestrator('Ship with ownership', [
      buildEchoRole('Researcher', 'research'),
      buildEchoRole('Reviewer', 'review'),
    ], {
      sessionRegistry: registry,
      runId: 'run-swarm-1',
      sessionId: 'session-swarm-1',
      surface: 'agent-runtime',
      sessionFactory: (role) => buildFakeSession(role.id),
    });

    const snapshot = await orchestrator.execute();

    expect(snapshot.runId).toBe('run-swarm-1');
    expect(snapshot.sessionId).toBe('session-swarm-1');
    expect(registry.getSession('researcher')).toEqual(expect.objectContaining({
      sessionId: 'researcher',
      ownerRef: `swarm:${snapshot.swarmId}:researcher`,
      kind: 'swarm_role',
      surface: 'agent-runtime',
      runId: 'run-swarm-1',
      taskId: 'researcher',
      swarmId: snapshot.swarmId,
      status: 'active',
      metadata: expect.objectContaining({
        roleId: 'researcher',
        roleLabel: 'Researcher',
      }),
    }));
    expect(registry.getSession('reviewer')).toEqual(expect.objectContaining({
      ownerRef: `swarm:${snapshot.swarmId}:reviewer`,
      kind: 'swarm_role',
      runId: 'run-swarm-1',
      taskId: 'reviewer',
    }));
  });

  it('sweeps orphaned swarm role sessions explicitly through GC policy', async () => {
    const registry = new SessionRegistryService({
      now: () => new Date('2026-04-27T16:20:00.000Z'),
      idFactory: (prefix) => `${prefix}-swarm-gc`,
    });
    const sessions = new Map<string, ReturnType<typeof buildFakeSession>>();
    const orchestrator = new SwarmOrchestrator('Clean orphan roles', [
      buildEchoRole('Researcher', 'research'),
      buildEchoRole('Reviewer', 'review'),
    ], {
      sessionRegistry: registry,
      runId: 'run-orphan-swarm',
      sessionGarbageCollectorPolicy: {
        orphanAfterMs: 1000,
        reapAfterMs: 1000,
      },
      sessionFactory: (role) => {
        const session = buildFakeSession(role.id);
        sessions.set(role.id, session);
        return session;
      },
    });

    const snapshot = await orchestrator.execute();
    const orphanSweep = await orchestrator.sweepOrphanedRoleSessions({
      now: '2026-04-27T16:20:02.000Z',
      activeOwnerRefs: [],
    });

    expect(orphanSweep.orphaned).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sessionId: 'researcher',
        ownerRef: `swarm:${snapshot.swarmId}:researcher`,
        status: 'orphaned',
        orphanReason: 'owner_not_active',
      }),
      expect.objectContaining({
        sessionId: 'reviewer',
        ownerRef: `swarm:${snapshot.swarmId}:reviewer`,
        status: 'orphaned',
      }),
    ]));
    expect(sessions.get('researcher')?.kill).not.toHaveBeenCalled();

    const reapSweep = await orchestrator.sweepOrphanedRoleSessions({
      now: '2026-04-27T16:20:04.000Z',
      activeOwnerRefs: [],
    });

    expect(reapSweep.reaped).toHaveLength(2);
    expect(reapSweep.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'reaped',
        sessionId: 'researcher',
        reason: 'orphan_reap_policy',
      }),
      expect.objectContaining({
        action: 'reaped',
        sessionId: 'reviewer',
        reason: 'orphan_reap_policy',
      }),
    ]));
    expect(sessions.get('researcher')?.kill).toHaveBeenCalledTimes(1);
    expect(sessions.get('reviewer')?.kill).toHaveBeenCalledTimes(1);
  });
});

function buildFakeSession(prefix: string) {
  const events = new EventEmitter();
  return {
    getEvents: () => events as any,
    startProcess: jest.fn(),
    write: jest.fn((input: string) => {
      setImmediate(() => {
        events.emit('pty:data', `${prefix}:${input}`);
        events.emit('pty:exit', 0);
      });
    }),
    kill: jest.fn(),
  };
}

function buildStuckSession() {
  const events = new EventEmitter();
  return {
    getEvents: () => events as any,
    startProcess: jest.fn(),
    write: jest.fn(),
    kill: jest.fn(),
  };
}
