import {
  AgentRunService,
  ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION,
  AskBeforeAssumptionPolicyService,
} from '../../../src/runtime/agent/index.js';

describe('AskBeforeAssumptionPolicyService Channel mesh2', () => {
  it('turns ambiguous mutable requests into blocking questions without executing assumptions', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:42:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-ask-policy',
      text: 'apague isso e publique do jeito certo',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.write'],
      metadata: {
        universalPreviewMode: {
          source: 'UniversalPreviewModeService',
          risk: {
            previewRequired: true,
            requiresApproval: true,
            previewRequiredToolIds: ['workspace.write'],
          },
        },
        capabilityNegotiation: {
          source: 'CapabilityNegotiationService',
          status: 'waiting-approval',
        },
        crossChannelContinuity: {
          source: 'CrossChannelContinuityService',
          status: 'handoff-ready',
        },
      },
    });

    const snapshot = new AskBeforeAssumptionPolicyService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION,
      source: 'AskBeforeAssumptionPolicyService',
      status: 'blocked',
      summary: expect.objectContaining({
        assumptionCount: expect.any(Number),
        questionCount: expect.any(Number),
        blockerCount: expect.any(Number),
        mutableActionBlockedCount: expect.any(Number),
        previewLinked: true,
        capabilityNegotiationLinked: true,
      }),
      policy: expect.objectContaining({
        noAssumptionActedOn: true,
        noMutationExecuted: true,
        asksBeforeMutation: true,
        previewBeforeRiskyAction: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.assumptions.some((assumption) => assumption.category === 'missing-target')).toBe(true);
    expect(snapshot.assumptions.some((assumption) => assumption.category === 'risky-tool')).toBe(true);
    expect(snapshot.questions.some((question) => question.blocksMutation)).toBe(true);
    expect(snapshot.receipts.some((receipt) => receipt.kind === 'policy' && receipt.status === 'needs-answer')).toBe(true);
  });

  it('keeps read-only clear requests non-blocking', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:42:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-ask-policy-clear',
      text: 'resuma o status atual',
      requestedTools: ['workspace.read'],
    });

    const snapshot = new AskBeforeAssumptionPolicyService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('clear');
    expect(snapshot.summary.questionCount).toBe(0);
    expect(snapshot.policy.noMutationExecuted).toBe(true);
    expect(snapshot.nextSafeAction).toContain('Sem pergunta obrigatoria');
  });
});
