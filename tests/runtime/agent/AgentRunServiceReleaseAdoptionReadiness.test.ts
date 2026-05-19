import {
  AgentRunService,
  RELEASE_ADOPTION_READINESS_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-release-adoption-${++index}`;
}

function feedbackReady() {
  return {
    status: 'opt-in-ready',
    policy: {
      noTelemetryEnabled: true,
      noFeedbackSent: true,
      noRawPayloadSerialized: true,
    },
  };
}

function pilotReady() {
  return {
    status: 'pilot-ready',
    pilot: { supportPolicyCount: 3, triageRuleCount: 5, ledgerEntryCount: 3 },
    adoptionLoop: { plannedPilotCount: 3, dashboardAggregationOnly: true, noPayloadPolicy: true },
    policy: { noWorkspacePayloadStored: true, dashboardAggregatedOnly: true },
  };
}

function showcaseReady() {
  return {
    status: 'showcase-ready',
    showcase: { vendorCount: 4, fixtureReadyCount: 4 },
    surface: { qaCommand: 'npm run qa:integration-showcase' },
  };
}

function releaseTrain() {
  return {
    stage: '59',
    surface: 'release-train',
    status: 'ready',
    summary: { ok: true, passed: 18, warnings: 0, failed: 0 },
    baseline: { version: 'v1.0.0', channel: 'stable', packageVersion: '1.1.0' },
    policies: [{ lane: 'baseline' }, { lane: 'patch' }, { lane: 'minor' }, { lane: 'breaking' }],
    calendar: [{ id: 'rc-window' }, { id: 'patch-hotfix' }, { id: 'minor-planning' }, { id: 'lts-review' }],
    releaseCandidateChecklist: [{ id: 'status' }, { id: 'bundle' }, { id: 'distribution' }, { id: 'integrations' }, { id: 'rollback' }, { id: 'changelog' }],
    hotfixPlaybook: [{ id: 'classify' }, { id: 'branch' }, { id: 'validate' }, { id: 'publish' }],
    artifacts: {},
    checks: [],
  };
}

function publicAdoption() {
  return {
    stage: '53',
    surface: 'public-adoption-readiness',
    status: 'ready',
    summary: { ok: true, passed: 20, warnings: 0, failed: 0, readinessScore: 95 },
    baseline: { release: 'v1.0.0', packageName: 'zavorth', packageVersion: '1.1.0' },
    requiredScripts: ['public-adoption', 'qa:public-adoption', 'qa:stage:53'],
    launchChecklist: [],
    claims: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }],
    risks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    demoRunbook: [{ route: '/' }, { route: '/demo' }, { route: '/start' }, { route: '/docs' }, { route: '/release' }, { route: '/feedback' }],
    checks: [],
  };
}

describe('AgentRunService Release Adoption Readiness Release Adoption Readiness', () => {
  it('publishes run.metadata.releaseAdoptionReadiness after integrationShowcasePartnerSurface', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T06:53:00.000Z'),
      idFactory: createIdFactory(),
      feedbackTelemetryProductLoop: { buildSnapshot: () => feedbackReady() } as any,
      publicAdoptionPilotLoop: { buildSnapshot: () => pilotReady() } as any,
      integrationShowcasePartnerSurface: { buildSnapshot: () => showcaseReady() } as any,
      executor: () => ({
        status: 'completed' as const,
        summary: 'Release adoption pronto.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-release-adoption',
      text: 'go release adoption readiness',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        releaseTrain: releaseTrain(),
        publicAdoptionReadiness: publicAdoption(),
      },
    });

    const snapshot = result.run.metadata.releaseAdoptionReadiness as any;
    expect(result.run.metadata.integrationShowcasePartnerSurface).toBeTruthy();
    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: RELEASE_ADOPTION_READINESS_CONTRACT_VERSION,
      source: 'ReleaseAdoptionReadinessService',
      status: 'release-adoption-ready',
      readiness: expect.objectContaining({
        integrationShowcaseReady: true,
        releaseTrainReady: true,
        publicAdoptionReady: true,
        supportLoopReady: true,
        feedbackMetricsReady: true,
        canOpenPublicAdoption: true,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noDeployExecuted: true,
        noTelemetryEnabled: true,
        noCanaryStarted: true,
        releaseRequiresRollbackPreview: true,
      }),
    }));
  });
});
