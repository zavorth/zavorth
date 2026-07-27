import {
  PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION,
  PersonalOpsAutopilotService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-personal-ops-1',
    traceId: 'trace-personal-ops-1',
    requestId: 'request-personal-ops-1',
    sessionId: 'session-personal-ops-1',
    userId: 'grey',
    channel: 'cli',
    title: 'Personal ops run',
    input: 'observe runtime',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    status: 'completed',
    createdAt: '2026-05-04T00:39:00.000Z',
    updatedAt: '2026-05-04T00:39:00.000Z',
    summary: 'Runtime observado.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'workspace read disponivel',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'openai',
      modelLabel: 'gpt-test',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {
      runBudget: {
        source: 'RunBudgetPolicy',
        degraded: true,
        reason: 'estimated cost above budget',
        estimatedCostUnits: 8,
        maxEstimatedCostUnits: 3,
      },
      providerArena: {
        summary: {
          hasProviderEvidence: true,
          fallbackUsed: true,
          readyCandidateCount: 0,
          recommendedProviderLabel: 'openai',
          recommendedModelLabel: 'gpt-test',
          decisionSource: 'observed',
        },
        candidates: [],
      },
      naturalCapabilityDiscovery: {
        recommendations: [
          {
            id: 'runtime-doctor',
            label: 'Runtime doctor',
            reason: 'Diagnostico operacional recomendado.',
            toolIds: ['runtime.doctor'],
          },
        ],
        safety: {
          requiresApproval: true,
          previewRequired: true,
          approvalRequiredToolIds: ['runtime.repair'],
          previewRequiredToolIds: ['runtime.doctor'],
        },
      },
      artifactMemory: {
        status: 'needs-index',
        summary: {
          reusableCount: 2,
          memoryEntryCount: 3,
          linkedMemoryReceiptCount: 1,
        },
        entries: [
          {
            artifactId: 'artifact-plan',
            title: 'Reusable plan',
          },
        ],
      },
    },
    ...overrides,
  };
}

describe('PersonalOpsAutopilotService Personal Ops Autopilot', () => {
  it('builds governed suggestions without executing mutable actions', () => {
    const snapshot = new PersonalOpsAutopilotService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
    }).buildSnapshot({
      run: createRun(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION,
      source: 'PersonalOpsAutopilotService',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        suggestionCount: expect.any(Number),
        approvalRequiredCount: expect.any(Number),
        providerIssueCount: 1,
        budgetIssueCount: 1,
        artifactOpportunityCount: 1,
        naturalIntentObserved: true,
        runObservatoryLinked: true,
      }),
      policy: expect.objectContaining({
        noMutableActionExecuted: true,
        noAutorepairStarted: true,
        approvalsRequiredForMutation: true,
        previewBeforeAutorepair: true,
        naturalLanguageDoesNotBypassPolicy: true,
        usesReceiptsForSuggestions: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'provider',
        requiresApproval: true,
        mutableAction: true,
      }),
      expect.objectContaining({
        category: 'budget',
      }),
      expect.objectContaining({
        category: 'artifact-memory',
        relatedArtifactIds: expect.arrayContaining(['artifact-plan']),
      }),
    ]));
  });

  it('redacts secrets from suggestion text', () => {
    const snapshot = new PersonalOpsAutopilotService().buildSnapshot({
      run: createRun({
        metadata: {
          runBudget: {
            degraded: true,
            reason: 'token=super-secret should not leak',
          },
        },
      }),
    });

    const budgetSuggestion = snapshot.suggestions.find((suggestion) => suggestion.category === 'budget');
    expect(budgetSuggestion?.cause).toContain('token=[redacted]');
    expect(budgetSuggestion?.cause).not.toContain('super-secret');
    expect(snapshot.policy.noMutableActionExecuted).toBe(true);
  });
});
