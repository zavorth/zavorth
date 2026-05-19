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
      text: 'compile uma equipe de agentes para implementar e validar a wave',
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

    expect(snapshot).toEqual(expect.objectContaining({
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
    }));
    expect(snapshot.roles.every((role) => role.budget.maxToolCalls === 0)).toBe(true);
    expect(snapshot.roles.every((role) => role.scope.mode === 'blocked')).toBe(true);
    expect(snapshot.roles[0]?.provider).toEqual(expect.objectContaining({
      providerLabel: 'openai',
      modelLabel: 'gpt-test',
      advisoryOnly: true,
    }));
    expect(snapshot.receipts.some((receipt) => receipt.kind === 'subagent-contract')).toBe(true);
  });

  it('stays idle when no team intent is present', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-team-idle',
      text: 'resuma o estado atual',
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
});
