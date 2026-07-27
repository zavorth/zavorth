import {
  AGENT_TEAM_COMPILER_CONTRACT_VERSION,
  AgentRunService,
  AgentTeamCompilerService,
} from '../../../src/runtime/agent/index.js';

describe('AgentTeamCompilerService Channel mesh0', () => {
  it('compiles governed subagent roles without launching a team', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-team-service',
      // Free text is ignored for team intent; structured metadata drives compilation.
      text: 'help me ship this delivery with clear validation',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'implementer', 'verifier'],
      },
    });
    run.metadata.providerArena = {
      selected: {
        candidateId: 'candidate-openai',
        providerLabel: 'openai',
        modelLabel: 'gpt-test',
      },
      summary: {
        recommendedProviderLabel: 'openai',
        recommendedModelLabel: 'gpt-test',
      },
    };
    run.metadata.capabilityNegotiation = {
      status: 'waiting-approval',
    };

    const snapshot = new AgentTeamCompilerService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        contractVersion: AGENT_TEAM_COMPILER_CONTRACT_VERSION,
        source: 'AgentTeamCompilerService',
        status: 'waiting-approval',
        summary: expect.objectContaining({
          roleCount: 3,
          approvalRequiredCount: 3,
          providerAssignedCount: 3,
          requestedSwarm: true,
          providerArenaLinked: true,
          capabilityNegotiationLinked: true,
          subagentReceiptsPrepared: true,
          compilerOnly: true,
        }),
        policy: expect.objectContaining({
          noSubagentsLaunched: true,
          approvalRequiredBeforeLaunch: true,
          budgetsDefaultToZero: true,
          providerSelectionIsAdvisory: true,
          naturalLanguageDoesNotBypassPolicy: true,
          secretsSerialized: false,
        }),
      }),
    );
    expect(snapshot.roles.every((role) => role.budget.maxToolCalls === 0)).toBe(true);
    expect(snapshot.roles.every((role) => role.scope.mode === 'blocked')).toBe(true);
    expect(snapshot.roles[0]?.provider).toEqual(
      expect.objectContaining({
        providerLabel: 'openai',
        modelLabel: 'gpt-test',
        advisoryOnly: true,
      }),
    );
    expect(snapshot.receipts.some((receipt) => receipt.kind === 'subagent-contract')).toBe(true);
  });

  it('stays idle when no team intent is present', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-team-idle',
      text: 'summarize the current state',
      requestedTools: ['workspace.read'],
    });

    const snapshot = new AgentTeamCompilerService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('not-needed');
    expect(snapshot.summary.roleCount).toBe(0);
    expect(snapshot.policy.noSubagentsLaunched).toBe(true);
  });

  it('does not compile a team from free-text team/swarm phrases alone', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-team-no-keyword',
      text: 'compile uma equipe de agentes swarm multi-agent team of subagents for this delivery',
      requestedTools: ['workspace.read'],
    });

    const snapshot = new AgentTeamCompilerService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('not-needed');
    expect(snapshot.summary.requestedSwarm).toBe(false);
    expect(snapshot.summary.roleCount).toBe(0);
    expect(snapshot.receipts.some((r) => r.kind === 'swarm-escalation' && /free text/i.test(r.detail))).toBe(true);
  });

  it('blocks team launch without the matching approval id', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-team-launch-blocked',
      text: 'implement and review this delivery with a structured team',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'implementer', 'verifier'],
      },
    });
    const service = new AgentTeamCompilerService({
      now: () => new Date('2026-05-04T00:42:00.000Z'),
    });
    const snapshot = service.buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const result = service.launchApprovedTeam(snapshot, {
      approvalId: 'agent-team-approval:wrong',
      generatedAt: '2026-05-04T00:42:00.000Z',
    });

    expect(result.status).toBe('blocked');
    expect(result.approval.matched).toBe(false);
    expect(result.blockedReasons).toContain('approval-id-mismatch');
    expect(result.turns).toHaveLength(0);
    expect(result.policy.noDirectToolExecution).toBe(true);
  });

  it('prepares an approved review-gated team board with final synthesis evidence', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-team-launch-approved',
      text: 'implement, debate, review, and validate with a structured team board',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'implementer', 'verifier', 'safety-reviewer'],
      },
    });
    const service = new AgentTeamCompilerService({
      now: () => new Date('2026-05-04T00:42:00.000Z'),
    });
    const snapshot = service.buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const result = service.launchApprovedTeam(snapshot, {
      approvalId: snapshot.approval.approvalId,
      generatedAt: '2026-05-04T00:42:00.000Z',
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'prepared',
        compilerRunId: run.id,
        approval: expect.objectContaining({
          required: true,
          matched: true,
        }),
        policy: expect.objectContaining({
          noDirectToolExecution: true,
          mutationRequiresSubagentGateway: true,
          peerReviewRequiredBeforeSynthesis: true,
          receiptsRequiredBeforeCompletion: true,
          secretsSerialized: false,
        }),
      }),
    );
    expect(result.roles).toHaveLength(4);
    expect(result.roles.every((role) => role.status === 'prepared')).toBe(true);
    expect(result.turns.some((turn) => turn.phase === 'peer-review')).toBe(true);
    for (const role of result.roles) {
      expect(result.turns.some((turn) => turn.phase === 'peer-review' && turn.targetRoleId === role.roleId)).toBe(true);
    }
    expect(result.turns.some((turn) => turn.phase === 'synthesis-input')).toBe(true);
    expect(result.synthesis.status).toBe('ready-for-final-synthesis');
    expect(result.synthesis.requiredEvidenceRefs.length).toBe(result.turns.length);
  });

  it('blocks synthesis readiness when peer-review coverage is impossible', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-team-peer-review-gap',
      text: 'review this with a single structured worker role',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner'],
      },
    });
    const service = new AgentTeamCompilerService({
      now: () => new Date('2026-05-04T00:42:00.000Z'),
    });
    const snapshot = service.buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const result = service.launchApprovedTeam(snapshot, {
      approvalId: snapshot.approval.approvalId,
      generatedAt: '2026-05-04T00:42:00.000Z',
    });

    expect(result.status).toBe('blocked');
    expect(result.blockedReasons).toEqual(
      expect.arrayContaining(['peer-review-missing', 'peer-review-missing:planner']),
    );
    expect(result.synthesis.status).toBe('blocked');
  });

  it('redacts secret-like content from team launch turns and receipts', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-team-launch-secret',
      text: 'assemble an agent team with token=sk-secret-value to review',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'verifier'],
      },
    });
    const service = new AgentTeamCompilerService({
      now: () => new Date('2026-05-04T00:42:00.000Z'),
    });
    const snapshot = service.buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });
    const result = service.launchApprovedTeam(snapshot, {
      approvalId: snapshot.approval.approvalId,
      generatedAt: '2026-05-04T00:42:00.000Z',
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('sk-secret-value');
    expect(serialized).toContain('[redacted]');
  });
});
