import {
  AgentRunService,
  BLUEPRINT_COMPLETION_GATE_CONTRACT_VERSION,
  BlueprintCompletionGateService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-blueprint-${++index}`;
}

function createRun(metadata: Record<string, unknown> = {}) {
  return new AgentRunService({
    now: () => new Date('2026-05-04T07:00:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-blueprint',
    text: 'complete blueprint',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata,
  });
}

export function blueprintMetadata(overrides: Record<string, unknown> = {}) {
  return {
    releaseAdoptionReadiness: {
      status: 'release-adoption-ready',
      readiness: {
        canOpenPublicAdoption: true,
        canStartCanary: false,
      },
    },
    releaseCandidateEvidencePack: {
      status: 'ready',
      checkCount: 5,
      passCount: 5,
      artifactCount: 5,
      releaseNotesReady: true,
      changelogReady: true,
      rollbackPreviewReady: true,
      knownIssuesReady: true,
    },
    ecosystemPublishing: {
      status: 'publishable',
      integrationCount: 4,
      fixtureReadyCount: 4,
      docsReady: true,
      matrixReady: true,
      partnerSurfaceReady: true,
      noFormalPartnerClaim: true,
    },
    capabilityAutopilotReleaseCandidate: {
      status: 'release_candidate_ready',
      recommendation: 'promote_to_release_candidate',
      releaseCandidateReady: true,
      summary: { ok: true, passed: 12, warnings: 0, failed: 0 },
      readinessControls: {
        rollbackRehearsalFresh: true,
        stagedRolloutPlanReady: true,
        killSwitchReady: true,
      },
      governance: {
        telemetryReviewPassed: true,
        privacyReviewPassed: true,
        rcFlagDefaultOff: true,
        globalRolloutEnabled: false,
        autoPromoteEnabled: false,
      },
      blockers: [],
    },
    goNoGoDecision: {
      decision: 'go',
      explicitApproval: true,
      approverId: 'release-owner',
      approvalReceiptId: 'receipt-go',
      rollbackOwner: 'rollback-owner',
      incidentOwner: 'incident-owner',
      reasons: ['ready'],
    },
    releaseCandidatePreCanaryGate: {
      status: 'pre-canary-ready',
      readiness: { canOpenPreCanary: true },
    },
    capabilityAutopilotReleaseRolloutPlan: {
      status: 'rollout_plan_ready',
      rollout: { canaryPercent: 5 },
      safeguards: {
        manualPromotionRequired: true,
        globalRolloutEnabled: false,
        autoRolloutEnabled: false,
      },
    },
    capabilityAutopilotReleaseExecution: {
      status: 'release_execution_ready',
      executionIntent: {
        manualOperatorPresent: true,
        releaseVersion: 'v1.1.0',
        releaseTag: 'v1.1.0',
      },
      canary: { initialCanaryPercent: 5 },
      safeguards: {
        autoExecuteEnabled: false,
        globalRolloutEnabled: false,
        skipCanaryEnabled: false,
      },
    },
    capabilityAutopilotCanaryPromotion: {
      status: 'canary_promotion_ready',
      incidents: { rollbackRecommended: false },
      promotion: {
        promotionApproved: true,
        nextCohortPercent: 25,
      },
      safeguards: {
        autoPromoteEnabled: false,
        globalRolloutEnabled: false,
        skipApprovalEnabled: false,
      },
    },
    capabilityAutopilotReleaseDecision: {
      decision: 'ship_v1_1_flagged',
      releaseChannel: 'alpha',
      riskPosture: 'medium',
      missingPhases: [],
      failedPhases: [],
      featureFlag: { defaultEnabled: false },
    },
    ...overrides,
  };
}

describe('BlueprintCompletionGateService final gate', () => {
  it('marks the blueprint complete when final runtime gates are ready', () => {
    const run = createRun(blueprintMetadata());
    run.metadata = { ...run.metadata, ...blueprintMetadata() };

    const snapshot = new BlueprintCompletionGateService({
      now: () => new Date('2026-05-04T07:00:00.000Z'),
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: BLUEPRINT_COMPLETION_GATE_CONTRACT_VERSION,
      source: 'BlueprintCompletionGateService',
      status: 'blueprint-complete',
      summary: expect.objectContaining({
        completedGateCount: 5,
        requiredGateCount: 5,
        blueprintComplete: true,
        releaseDecision: 'ship_v1_1_flagged',
      }),
      readiness: expect.objectContaining({
        preCanaryReady: true,
        rolloutPlanReady: true,
        releaseExecutionReady: true,
        canaryPromotionReady: true,
        releaseDecisionReady: true,
        safeguardsReady: true,
        blueprintComplete: true,
      }),
      policy: expect.objectContaining({
        noUngovernedDeploy: true,
        manualPromotionRequired: true,
        noAutoExecute: true,
        noGlobalRolloutByDefault: true,
        noSkipCanary: true,
        noSkipApproval: true,
        rollbackPathRequired: true,
        auditReceiptsRequired: true,
      }),
    }));
  });

  it('requires the pre-canary gate first', () => {
    const run = createRun(blueprintMetadata({ releaseCandidatePreCanaryGate: { status: 'needs-go-no-go', readiness: {} } }));
    run.metadata = { ...run.metadata, ...blueprintMetadata({ releaseCandidatePreCanaryGate: { status: 'needs-go-no-go', readiness: {} } }) };

    const snapshot = new BlueprintCompletionGateService().buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot.status).toBe('needs-pre-canary');
    expect(snapshot.readiness.preCanaryReady).toBe(false);
  });

  it('blocks unsafe automatic rollout shortcuts', () => {
    const run = createRun(blueprintMetadata({
      capabilityAutopilotReleaseExecution: {
        status: 'release_execution_ready',
        executionIntent: { manualOperatorPresent: true },
        safeguards: {
          autoExecuteEnabled: true,
          globalRolloutEnabled: false,
          skipCanaryEnabled: false,
        },
      },
    }));
    run.metadata = {
      ...run.metadata,
      ...blueprintMetadata({
        capabilityAutopilotReleaseExecution: {
          status: 'release_execution_ready',
          executionIntent: { manualOperatorPresent: true },
          safeguards: {
            autoExecuteEnabled: true,
            globalRolloutEnabled: false,
            skipCanaryEnabled: false,
          },
        },
      }),
    };

    const snapshot = new BlueprintCompletionGateService().buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.releaseExecution.autoExecuteEnabled).toBe(true);
  });
});
