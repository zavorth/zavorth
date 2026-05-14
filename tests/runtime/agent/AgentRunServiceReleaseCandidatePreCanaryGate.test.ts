import {
  AgentRunService,
  RELEASE_CANDIDATE_PRE_CANARY_GATE_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-pre-canary-${++index}`;
}

function releaseAdoptionReady() {
  return {
    contractVersion: '2026-05-04.wave-53',
    source: 'ReleaseAdoptionReadinessService',
    status: 'release-adoption-ready',
    readiness: {
      canOpenPublicAdoption: true,
      canStartCanary: false,
    },
  };
}

function metadata() {
  return {
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
  };
}

describe('AgentRunService Release Candidate Pre-Canary Gate Wave 54', () => {
  it('publishes run.metadata.releaseCandidatePreCanaryGate after releaseAdoptionReadiness', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T06:54:00.000Z'),
      idFactory: createIdFactory(),
      releaseAdoptionReadiness: { buildSnapshot: () => releaseAdoptionReady() } as any,
      executor: () => ({
        status: 'completed' as const,
        summary: 'Pre-canary gate pronto.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-pre-canary',
      text: 'go release candidate pre-canary',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: metadata(),
    });

    const snapshot = result.run.metadata.releaseCandidatePreCanaryGate as any;
    expect(result.run.metadata.releaseAdoptionReadiness).toBeTruthy();
    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: RELEASE_CANDIDATE_PRE_CANARY_GATE_CONTRACT_VERSION,
      source: 'ReleaseCandidatePreCanaryGateService',
      status: 'pre-canary-ready',
      readiness: expect.objectContaining({
        releaseAdoptionReady: true,
        evidencePackReady: true,
        ecosystemPublishingReady: true,
        autopilotReleaseCandidateReady: true,
        goNoGoReady: true,
        canOpenPreCanary: true,
        canStartCanary: false,
        rolloutStarted: false,
      }),
      policy: expect.objectContaining({
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noGlobalRolloutEnabled: true,
        noAutoPromoteEnabled: true,
      }),
    }));
  });
});
