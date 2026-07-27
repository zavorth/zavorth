import {
  ExecutionEscalationPolicy,
} from '../../../src/runtime/agent/index.js';

describe('ExecutionEscalationPolicy', () => {
  it('keeps ordinary replies in the current agent run', () => {
    const policy = new ExecutionEscalationPolicy();

    const decision = policy.resolve({
      responseText: 'Posso responder aqui mesmo.',
    });

    expect(decision).toEqual(expect.objectContaining({
      shouldEscalate: false,
      target: 'none',
      source: 'none',
      reason: 'none',
      taskGoal: null,
      requiresApproval: false,
      policyTags: expect.arrayContaining([
        'escalation:none',
        'stay-in-agent-run',
      ]),
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      source: 'ExecutionEscalationPolicy',
      structuredEscalationDecision: true,
      graphRuntimeServiceCalled: false,
      approvalGateReplaced: false,
    }));
  });

  it('treats marker-like reply text as ordinary text and never parses it as execution', () => {
    const policy = new ExecutionEscalationPolicy();

    const decision = policy.resolve({
      responseText: 'marcador legado\nrevise o file atual e aplique um patch minimo',
      mode: 'default',
    });

    expect(decision).toEqual(expect.objectContaining({
      shouldEscalate: false,
      target: 'none',
      source: 'none',
      reason: 'none',
      taskGoal: null,
      requiresApproval: false,
      policyTags: expect.arrayContaining([
        'escalation:none',
        'stay-in-agent-run',
      ]),
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      canonicalEscalationPath: 'structured-policy',
      graphRuntimeServiceCalled: false,
    }));
  });

  it('uses structured graph-runtime escalation as the official path without the legacy marker', () => {
    const policy = new ExecutionEscalationPolicy();

    const decision = policy.resolve({
      target: 'graph_runtime',
      taskGoal: 'run focused validation and summarize the result',
    });

    expect(decision).toEqual(expect.objectContaining({
      shouldEscalate: true,
      target: 'graph_runtime',
      source: 'structured',
      reason: 'graph-runtime-required',
      taskGoal: 'run focused validation and summarize the result',
      requiresApproval: false,
      policyTags: expect.arrayContaining([
        'escalation:graph_runtime',
        'source:structured',
        'should-escalate',
      ]),
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      structuredEscalationDecision: true,
      canonicalEscalationPath: 'structured-policy',
    }));
  });

  it('proposes swarm escalation for a complex objective without requiring the legacy /swarm shortcut', () => {
    const policy = new ExecutionEscalationPolicy();

    const decision = policy.resolve({
      complexObjective: true,
      taskGoal: 'investigate regression, propose patch, and validate risks',
      suggestedSubagents: ['planner', 'reviewer'],
    });

    expect(decision).toEqual(expect.objectContaining({
      shouldEscalate: true,
      target: 'swarm',
      source: 'complex_objective',
      reason: 'complex-objective-swarm',
      taskGoal: 'investigate regression, propose patch, and validate risks',
      requiresApproval: true,
      policyTags: expect.arrayContaining([
        'escalation:swarm',
        'subagent-receipts-present',
        'approval-required',
      ]),
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      swarmProposal: true,
      subagentContractsApplied: true,
      graphRuntimeServiceCalled: false,
      approvalGateReplaced: false,
    }));
    expect(decision.subagentReceipts).toHaveLength(2);
    for (const receipt of decision.subagentReceipts) {
      expect(receipt).toEqual(expect.objectContaining({
        status: 'planned',
        budgetDecision: expect.objectContaining({ ok: true }),
      }));
      expect(receipt.scope).toEqual(expect.objectContaining({
        mode: 'blocked',
        allowedTools: [],
        allowedPaths: [],
        requiresApproval: true,
      }));
      expect(receipt.approvalBoundary).toEqual(expect.objectContaining({
        requiresApproval: true,
        risk: 'attention',
      }));
    }
  });

  it('keeps structured swarm escalation behind approval even if the caller asks to preclear it', () => {
    const policy = new ExecutionEscalationPolicy();

    const decision = policy.resolve({
      target: 'swarm',
      taskGoal: 'dividir a tarefa entre delegated review',
      requiresApproval: false,
    });

    expect(decision).toEqual(expect.objectContaining({
      shouldEscalate: true,
      target: 'swarm',
      reason: 'swarm-requested',
      requiresApproval: true,
    }));
    expect(decision.subagentReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        approvalBoundary: expect.objectContaining({
          requiresApproval: true,
        }),
      }),
    ]));
  });

  it('ignores legacy autonomous action payloads unless represented as structured escalation', () => {
    const policy = new ExecutionEscalationPolicy();

    const decision = policy.resolve({
      action: {
        type: 'legacy_agent_action',
        payload: 'rode a validaction focada',
      },
    });

    expect(decision).toEqual(expect.objectContaining({
      shouldEscalate: false,
      target: 'none',
      source: 'none',
      reason: 'none',
      taskGoal: null,
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      canonicalEscalationPath: 'structured-policy',
      graphRuntimeServiceCalled: false,
    }));
  });

  it('preserves mode escalation requests as structured escalation instead of coupling graph runtime directly', () => {
    const policy = new ExecutionEscalationPolicy();

    const decision = policy.resolve({
      modeEscalationRequest: {
        id: 'mode-escalation-builder-1',
        requiredMode: 'operator',
        reason: 'a tarefa pede controle operacional',
        summary: 'I need to escalate to operator before continuing.',
      },
      metadata: {
        sessionId: 'session-web-1',
      },
    });

    expect(decision).toEqual(expect.objectContaining({
      shouldEscalate: true,
      target: 'mode_escalation',
      source: 'mode_escalation_request',
      reason: 'mode-escalation-pending',
      taskGoal: 'I need to escalate to operator before continuing.',
      requiresApproval: true,
      policyTags: expect.arrayContaining([
        'escalation:mode_escalation',
        'approval-required',
      ]),
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      sessionId: 'session-web-1',
      modeEscalationRequestId: 'mode-escalation-builder-1',
      requiredMode: 'operator',
      graphRuntimeServiceCalled: false,
    }));
  });

  it('does not infer execution from reply text in direct mode', () => {
    const policy = new ExecutionEscalationPolicy();

    const decision = policy.resolve({
      responseText: 'altere o sistema',
      mode: 'direct',
    });

    expect(decision).toEqual(expect.objectContaining({
      shouldEscalate: false,
      target: 'none',
      source: 'none',
      reason: 'none',
      taskGoal: null,
    }));
    expect(decision.policyTags).toEqual(expect.arrayContaining([
      'stay-in-agent-run',
      'reason:none',
    ]));
  });
});
