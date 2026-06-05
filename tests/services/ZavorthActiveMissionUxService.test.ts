import { ZavorthActiveMissionUxService } from '../../src/services/ZavorthActiveMissionUxService.js';

describe('ZavorthActiveMissionUxService', () => {
  it('builds an idle mission projection without execution authority', () => {
    const service = new ZavorthActiveMissionUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({});

    expect(snapshot.surface).toBe('active-mission-ux');
    expect(snapshot.status).toBe('idle');
    expect(snapshot.safety.zavorthControlCanExecute).toBe(false);
    expect(snapshot.zavorthControlProjection.executionAuthority).toBe(false);
    expect(snapshot.timeline[0]?.source).toBe('system');
  });

  it('merges active run and sensitive approval state into one timeline', () => {
    const service = new ZavorthActiveMissionUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      runtimeSnapshot: {
        activeRun: {
          id: 'run_1',
          traceId: 'trace_1',
          sessionId: 'session_1',
          title: 'Edit config',
          status: 'running',
          summary: 'Preparing config edit.',
          providerLabel: 'OpenAI',
          modelLabel: 'GPT',
          events: [
            { id: 'event_1', title: 'Planning', detail: 'Plan ready.', status: 'done' },
          ],
        },
      },
      sensitiveActionFlowUx: {
        card: {
          id: 'saf_1',
          title: 'Approval needed',
          subtitle: 'medium risk',
          status: 'needs_approval',
          risk: 'medium',
          request: 'edit config',
          steps: [
            { id: 'approval', label: 'Approval', summary: 'Approval pending.', status: 'pending', tone: 'warn' },
          ],
          actions: [
            { id: 'approve-once', label: 'Allow once', command: 'zavorth sensitive-flow --decision=approve', kind: 'approve_once', requiresApproval: true },
          ],
        },
      },
    });

    expect(snapshot.status).toBe('needs_approval');
    expect(snapshot.mission.runId).toBe('run_1');
    expect(snapshot.counts.approvalsPending).toBe(1);
    expect(snapshot.timeline.some((event) => event.source === 'run')).toBe(true);
    expect(snapshot.timeline.some((event) => event.source === 'sensitive-flow')).toBe(true);
    expect(snapshot.actions.map((action) => action.kind)).toContain('approve_once');
  });

  it('redacts secret-like values from mission and action commands', () => {
    const service = new ZavorthActiveMissionUxService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      runtimeSnapshot: {
        activeRun: {
          id: 'run_secret',
          title: 'Use OPENAI_API_KEY=sk-secret-value',
          status: 'running',
          summary: 'Use OPENAI_API_KEY=sk-secret-value',
          events: [],
        },
      },
      sensitiveActionFlowUx: {
        card: {
          id: 'saf_secret',
          title: 'Approval needed',
          status: 'needs_approval',
          risk: 'high',
          request: 'send OPENAI_API_KEY=sk-secret-value',
          steps: [],
          actions: [
            { id: 'preview', label: 'Preview', command: 'zavorth sensitive-flow --request="OPENAI_API_KEY=sk-secret-value"', kind: 'preview' },
          ],
        },
      },
    });

    expect(JSON.stringify(snapshot)).not.toContain('sk-secret-value');
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
  });
});
