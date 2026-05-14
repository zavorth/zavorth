import {
  AgentRunService,
  PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-personal-ops-${++index}`;
}

describe('AgentRunService Personal Ops Autopilot Wave 39', () => {
  it('publishes run.metadata.personalOpsAutopilot during the agent run lifecycle', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:39:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Autopilot observou budget e provider.',
        replyText: 'ok',
        metadata: {
          runBudget: {
            source: 'RunBudgetPolicy',
            degraded: true,
            reason: 'executor budget acima do esperado',
            estimatedCostUnits: 5,
            maxEstimatedCostUnits: 2,
          },
          providerArena: {
            summary: {
              hasProviderEvidence: true,
              fallbackUsed: true,
              readyCandidateCount: 1,
              recommendedProviderLabel: 'openai',
              recommendedModelLabel: 'gpt-test',
              decisionSource: 'observed',
            },
          },
        },
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-personal-ops',
      text: 'publique personal ops autopilot',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
    });

    const autopilot = result.run.metadata.personalOpsAutopilot as any;
    expect(result.run.status).toBe('completed');
    expect(autopilot).toEqual(expect.objectContaining({
      contractVersion: PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION,
      source: 'PersonalOpsAutopilotService',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        suggestionCount: expect.any(Number),
        providerIssueCount: 1,
        budgetIssueCount: 1,
        approvalRequiredCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        noMutableActionExecuted: true,
        noAutorepairStarted: true,
        previewBeforeAutorepair: true,
      }),
    }));
    expect(autopilot.suggestions.some((suggestion: any) => suggestion.category === 'provider')).toBe(true);
    expect(autopilot.suggestions.some((suggestion: any) => suggestion.category === 'budget')).toBe(true);
  });
});
