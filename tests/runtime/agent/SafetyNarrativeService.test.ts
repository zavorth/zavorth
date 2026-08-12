import {
  SAFETY_NARRATIVE_CONTRACT_VERSION,
  SafetyNarrativeService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-safety-1',
    traceId: 'trace-safety-1',
    requestId: 'request-safety-1',
    sessionId: 'session-safety-1',
    userId: 'grey',
    channel: 'cli',
    title: 'Safety run',
    input: 'corrija arquivo',
    status: 'waiting_approval',
    createdAt: '2026-05-03T22:00:00.000Z',
    updatedAt: '2026-05-03T22:00:00.000Z',
    summary: 'Aguardando approval',
    events: [],
    toolExposure: {
      mode: 'restricted',
      summary: '1 ferramenta exposta.',
      tools: [
        {
          id: 'write_file',
          label: 'Write file',
          risk: 'danger',
          requiresApproval: true,
          description: 'write_file pode alterar o ambiente e deve passar por aprovacao.',
        },
      ],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'provider',
      modelLabel: 'model',
      routingPolicy: 'direct',
    },
    approvals: [
      {
        id: 'approval-safety-1',
        runId: 'run-safety-1',
        title: 'Aprovar Write file',
        reason: 'editar C:\\Users\\grey\\secrets\\token.txt com api_key=sk-secret1234567890',
        risk: 'danger',
        status: 'pending',
        createdAt: '2026-05-03T22:00:00.000Z',
      },
    ],
    artifacts: [],
    memorySignals: [],
    metadata: {},
    ...overrides,
  };
}

describe('SafetyNarrativeService Safety Narrative', () => {
  it('explains high-risk blocks with safe alternatives and redaction', () => {
    const snapshot = new SafetyNarrativeService({
      now: () => new Date('2026-05-03T22:01:00.000Z'),
    }).buildSnapshot({
      run: createRun(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: SAFETY_NARRATIVE_CONTRACT_VERSION,
      status: 'waiting-approval',
      highRiskBlockPresent: true,
      policy: expect.objectContaining({
        naturalLanguageDoesNotBypassPolicy: true,
        alternativesDoNotExecute: true,
        approvalsRemainRequired: true,
      }),
      redaction: expect.objectContaining({
        pathRedactionApplied: true,
        secretRedactionApplied: true,
        rawSecretSerialized: false,
      }),
    }));
    expect(snapshot.reasons[0]).toEqual(expect.objectContaining({
      kind: 'approval-required',
      risk: 'danger',
      redactionApplied: true,
    }));
    expect(snapshot.reasons[0].detail).toContain('<workspace-path>');
    expect(snapshot.reasons[0].detail).toContain('<redacted-secret>');
    expect(snapshot.reasons[0].detail).not.toContain('C:\\Users\\grey');
    expect(snapshot.alternatives).toEqual(expect.arrayContaining([
      expect.objectContaining({
        safe: true,
      }),
    ]));
  });

  it('documents quarantine and keeps quarantine required', () => {
    const snapshot = new SafetyNarrativeService().buildSnapshot({
      run: createRun({
        approvals: [],
        toolExposure: {
          mode: 'unknown',
          summary: 'blocked',
          tools: [],
          blockedTools: [
            {
              id: 'mcp.untrusted.write',
              label: 'MCP untrusted write',
              reason: 'blocked-by-imported-capability-trust',
            },
          ],
        },
      }),
    });

    expect(snapshot.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'imported-capability-quarantine',
        source: 'ToolExposurePolicy',
      }),
    ]));
    expect(snapshot.policy.quarantineRemainsRequired).toBe(true);
    expect(snapshot.nextSafeAction).toContain('quarentena');
  });
});
