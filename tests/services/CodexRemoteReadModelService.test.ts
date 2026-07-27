import { CodexRemoteReadModelService } from '../../src/services/CodexRemoteReadModelService';

describe('CodexRemoteReadModelService', () => {
  it('builds a read model with command summary, presence and guardrail details', async () => {
    const service = new CodexRemoteReadModelService({
      now: () => new Date('2026-04-07T18:30:00.000Z'),
      profileRegistryService: {
        buildSnapshot: jest.fn(() => ({
          activeProfileId: 'default',
          profiles: [{ id: 'default', enabled: true }],
        })),
        resolveExecutionProfile: jest.fn(() => ({
          id: 'default',
          label: 'Default Codex',
        })),
      } as any,
      sessionBrokerService: {
        listSessions: jest.fn(() => [
          {
            sessionId: 'codex-1',
            title: 'Session 1',
            status: 'running',
            profileId: 'default',
            updatedAt: '2026-04-07T18:30:00.000Z',
            runCount: 1,
            handoffCommand: '/open-session session-web-1',
            lastOutput: 'done',
            lastError: null,
            lastHeartbeatAt: '2026-04-07T18:29:30.000Z',
            pid: 4321,
            maxRuntimeSeconds: 1800,
            metadata: {
              codexRemotePresence: {
                state: 'running',
                alive: true,
                pid: 4321,
                runtimeSeconds: 30,
                heartbeatAgeMs: 30000,
                lastHeartbeatAt: '2026-04-07T18:29:30.000Z',
                stale: false,
                observedAt: '2026-04-07T18:30:00.000Z',
              },
              codexRemoteGuardrails: {
                timeoutSeconds: 1800,
                remainingSeconds: 1770,
                deadlineAt: '2026-04-07T19:00:00.000Z',
                staleAfterMs: 15000,
                state: 'healthy',
                summary: 'Guardrail saudavel; faltam 1770s de 1800s.',
              },
            },
            events: [{ message: 'Session criada.' }],
          },
        ]),
        readSession: jest.fn(async () => ({
          record: {
            sessionId: 'codex-1',
            title: 'Session 1',
            status: 'running',
            profileId: 'default',
            prompt: 'continue',
            handoffCommand: '/open-session session-web-1',
            events: [],
            metadata: {
              codexRemotePresence: {
                state: 'running',
                alive: true,
                pid: 4321,
                runtimeSeconds: 30,
                heartbeatAgeMs: 30000,
                lastHeartbeatAt: '2026-04-07T18:29:30.000Z',
                stale: false,
                observedAt: '2026-04-07T18:30:00.000Z',
              },
              codexRemoteGuardrails: {
                timeoutSeconds: 1800,
                remainingSeconds: 1770,
                deadlineAt: '2026-04-07T19:00:00.000Z',
                staleAfterMs: 15000,
                state: 'healthy',
                summary: 'Guardrail saudavel; faltam 1770s de 1800s.',
              },
            },
          },
          tail: {
            sessionId: 'codex-1',
            status: 'running',
            logLines: ['working'],
            lastOutput: 'done',
            lastError: null,
          },
          operatorSummary: 'Session running.',
          canResume: false,
          canStop: true,
          canOpenWeb: true,
          presence: {
            alive: true,
            processId: 4321,
            runtimeSeconds: 30,
            lastHeartbeatAt: '2026-04-07T18:29:30.000Z',
            heartbeatAgeMs: 30000,
            observedAt: '2026-04-07T18:30:00.000Z',
            stale: false,
            state: 'running',
          },
          guardrails: {
            timeoutSeconds: 1800,
            remainingSeconds: 1770,
            deadlineAt: '2026-04-07T19:00:00.000Z',
            staleAfterMs: 15000,
            state: 'healthy',
            summary: 'Guardrail saudavel; faltam 1770s de 1800s.',
          },
          visibility: {
            mode: 'full-user-visible',
            pendingApprovals: 0,
            approvalBridge: 'visible-when-present',
            note: 'Sem approvescoes ocultas.',
          },
        })),
      } as any,
    });

    const snapshot = await service.buildSnapshot({ selectedSessionId: 'codex-1' });

    expect(snapshot.summary.totalSessions).toBe(1);
    expect(snapshot.summary.visibilityMode).toBe('full-user-visible');
    expect(snapshot.summary.staleRunningSessions).toBe(1);
    expect(snapshot.selected?.record.sessionId).toBe('codex-1');
    expect(snapshot.visibility.mode).toBe('full-user-visible');
    expect(snapshot.telegramSummary).toContain('Visibilidade: total');
    expect(snapshot.sessions[0]).toEqual(
      expect.objectContaining({
        presenceState: 'running',
        guardrailState: 'healthy',
        guardrailSummary: expect.stringContaining('Guardrail'),
      }),
    );
  });
});
