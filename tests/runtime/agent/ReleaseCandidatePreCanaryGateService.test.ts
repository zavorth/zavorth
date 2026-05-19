import {
  AgentRunService,
  RELEASE_CANDIDATE_PRE_CANARY_GATE_CONTRACT_VERSION,
  ReleaseCandidatePreCanaryGateService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-pre-canary-${++index}`;
}

function createRun(metadata: Record<string, unknown> = {}) {
  return new AgentRunService({
    now: () => new Date('2026-05-04T06:54:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-pre-canary',
    text: 'prepare release candidate pre-canary',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata,
  });
}

function releaseAdoptionReady() {
  return {
    status: 'release-adoption-ready',
    readiness: {
      canOpenPublicAdoption: true,
      canStartCanary: false,
    },
  };
}

function evidencePackReady(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ready',
    checkCount: 5,
    passCount: 5,
    artifactCount: 5,
    releaseNotesReady: true,
    changelogReady: true,
    rollbackPreviewReady: true,
    knownIssuesReady: true,
    ...overrides,
  };
}

function ecosystemReady(overrides: Record<string, unknown> = {}) {
  return {
    status: 'publishable',
    integrationCount: 4,
    fixtureReadyCount: 4,
    docsReady: true,
    matrixReady: true,
    partnerSurfaceReady: true,
    noFormalPartnerClaim: true,
    ...overrides,
  };
}

function autopilotReady(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function goNoGoReady(overrides: Record<string, unknown> = {}) {
  return {
    decision: 'go',
    explicitApproval: true,
    approverId: 'release-owner',
    approvalReceiptId: 'receipt-go',
    rollbackOwner: 'rollback-owner',
    incidentOwner: 'incident-owner',
    reasons: ['all gates ready'],
    ...overrides,
  };
}

function readyMetadata(overrides: Record<string, unknown> = {}) {
  return {
    releaseAdoptionReadiness: releaseAdoptionReady(),
    releaseCandidateEvidencePack: evidencePackReady(),
    ecosystemPublishing: ecosystemReady(),
    capabilityAutopilotReleaseCandidate: autopilotReady(),
    goNoGoDecision: goNoGoReady(),
    ...overrides,
  };
}

describe('ReleaseCandidatePreCanaryGateService Pre-Canary Gate', () => {
  it('condenses evidence, ecosystem, Autopilot RC and go/no-go without canary or rollout', () => {
    const run = createRun(readyMetadata());
    run.metadata = { ...run.metadata, ...readyMetadata() };

    const snapshot = new ReleaseCandidatePreCanaryGateService({
      now: () => new Date('2026-05-04T06:54:00.000Z'),
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: RELEASE_CANDIDATE_PRE_CANARY_GATE_CONTRACT_VERSION,
      source: 'ReleaseCandidatePreCanaryGateService',
      status: 'pre-canary-ready',
      releaseAdoption: expect.objectContaining({
        ready: true,
        canOpenPublicAdoption: true,
        canStartCanary: false,
      }),
      evidencePack: expect.objectContaining({
        evidencePackReady: true,
        passCount: 5,
      }),
      ecosystem: expect.objectContaining({
        ecosystemPublishingReady: true,
        noFormalPartnerClaim: true,
      }),
      autopilot: expect.objectContaining({
        releaseCandidateReady: true,
        rcFlagDefaultOff: true,
        globalRolloutEnabled: false,
        autoPromoteEnabled: false,
      }),
      goNoGo: expect.objectContaining({
        decision: 'go',
        ready: true,
        canaryStarted: false,
        rolloutStarted: false,
      }),
      readiness: expect.objectContaining({
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
        goNoGoRequiresExplicitApproval: true,
        rollbackPreviewRequired: true,
      }),
    }));
  });

  it('requires release adoption readiness before checking later gates', () => {
    const run = createRun(readyMetadata({ releaseAdoptionReadiness: { status: 'needs-support-loop', readiness: {} } }));
    run.metadata = { ...run.metadata, ...readyMetadata({ releaseAdoptionReadiness: { status: 'needs-support-loop', readiness: {} } }) };

    const snapshot = new ReleaseCandidatePreCanaryGateService().buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot.status).toBe('needs-release-adoption-readiness');
    expect(snapshot.readiness.releaseAdoptionReady).toBe(false);
  });

  it('requires explicit go/no-go approval with ownership', () => {
    const run = createRun(readyMetadata({ goNoGoDecision: { decision: 'go', explicitApproval: false } }));
    run.metadata = { ...run.metadata, ...readyMetadata({ goNoGoDecision: { decision: 'go', explicitApproval: false } }) };

    const snapshot = new ReleaseCandidatePreCanaryGateService().buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot.status).toBe('needs-go-no-go');
    expect(snapshot.goNoGo.ready).toBe(false);
  });

  it('blocks if global rollout or auto-promote are already enabled', () => {
    const run = createRun(readyMetadata({
      capabilityAutopilotReleaseCandidate: autopilotReady({
        governance: {
          telemetryReviewPassed: true,
          privacyReviewPassed: true,
          rcFlagDefaultOff: true,
          globalRolloutEnabled: true,
          autoPromoteEnabled: false,
        },
      }),
    }));
    run.metadata = {
      ...run.metadata,
      ...readyMetadata({
        capabilityAutopilotReleaseCandidate: autopilotReady({
          governance: {
            telemetryReviewPassed: true,
            privacyReviewPassed: true,
            rcFlagDefaultOff: true,
            globalRolloutEnabled: true,
            autoPromoteEnabled: false,
          },
        }),
      }),
    };

    const snapshot = new ReleaseCandidatePreCanaryGateService().buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.autopilot.globalRolloutEnabled).toBe(true);
  });
});
