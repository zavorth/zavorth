import { buildDashboardDashboardViewModel } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.js';
import { buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-pre-canary-${++index}`;
}

function releaseAdoptionReady() {
  return {
    contractVersion: '2026-05-04.release-readiness',
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

function agentService() {
  return new AgentRunService({
    now: () => new Date('2026-05-04T06:54:00.000Z'),
    idFactory: createIdFactory(),
    releaseAdoptionReadiness: { buildSnapshot: () => releaseAdoptionReady() } as any,
  });
}

describe('Dashboard Release Candidate Pre-Canary Gate Pre-Canary Gate', () => {
  it('projects releaseCandidatePreCanaryGate metadata into the dashboard view model', () => {
    const run = agentService().createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-pre-canary',
      text: 'abrir pre-canary gate',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: metadata(),
    });

    const viewModel = buildDashboardDashboardViewModel({
      runtime: { status: 'ready' },
      wsStatus: 'connected',
      agentRun: { id: run.id, status: 'completed', metadata: run.metadata },
      releaseCandidatePreCanaryGate: run.metadata.releaseCandidatePreCanaryGate as any,
    });

    expect(viewModel.releaseCandidatePreCanaryGate).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.pre-canary',
      status: 'pre-canary-ready',
      evidencePack: expect.objectContaining({
        evidencePackReady: true,
        passCount: 5,
      }),
      readiness: expect.objectContaining({
        canOpenPreCanary: true,
        canStartCanary: false,
        rolloutStarted: false,
      }),
      policy: expect.objectContaining({
        noCanaryStarted: true,
        noRolloutStarted: true,
        noAutoPromoteEnabled: true,
        goNoGoRequiresExplicitApproval: true,
      }),
    }));
    expect(viewModel.releaseCandidatePreCanaryGate?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with pre-canary gate into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T06:54:00.000Z'),
      idFactory: createIdFactory(),
      releaseAdoptionReadiness: { buildSnapshot: () => releaseAdoptionReady() },
      executor: () => ({ status: 'completed', summary: 'ok com pre-canary', replyText: 'ok' }),
    } as any);

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-pre-canary-live',
      text: 'abrir pre-canary gate',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: metadata(),
    });

    const projection = buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.releaseCandidatePreCanaryGate).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.pre-canary',
      status: 'pre-canary-ready',
      goNoGo: expect.objectContaining({
        decision: 'go',
        ready: true,
      }),
      policy: expect.objectContaining({
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noGlobalRolloutEnabled: true,
      }),
    }));
    expect(projection.releaseCandidatePreCanaryGate?.gates.length).toBeGreaterThan(0);
  });
});
