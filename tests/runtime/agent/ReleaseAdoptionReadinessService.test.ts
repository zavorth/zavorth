import {
  AgentRunService,
  RELEASE_ADOPTION_READINESS_CONTRACT_VERSION,
  ReleaseAdoptionReadinessService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-release-adoption-${++index}`;
}

function createRun(metadata: Record<string, unknown> = {}) {
  return new AgentRunService({
    now: () => new Date('2026-05-04T06:53:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-release-adoption',
    text: 'prepare release adoption readiness',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata,
  });
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

function pilotReady(overrides: Record<string, unknown> = {}) {
  return {
    status: 'pilot-ready',
    pilot: {
      supportPolicyCount: 3,
      triageRuleCount: 5,
      ledgerEntryCount: 3,
    },
    adoptionLoop: {
      plannedPilotCount: 3,
      dashboardAggregationOnly: true,
      noPayloadPolicy: true,
    },
    policy: {
      noWorkspacePayloadStored: true,
      dashboardAggregatedOnly: true,
    },
    ...overrides,
  };
}

function showcaseReady() {
  return {
    status: 'showcase-ready',
    showcase: {
      vendorCount: 4,
      fixtureReadyCount: 4,
    },
    surface: {
      qaCommand: 'npm run qa:integration-showcase',
    },
  };
}

function releaseTrain(status = 'ready') {
  return {
    stage: '59',
    surface: 'release-train',
    status,
    summary: { ok: status === 'ready', passed: 18, warnings: 0, failed: status === 'ready' ? 0 : 1 },
    baseline: { version: 'v1.0.0', channel: 'stable', packageVersion: '1.1.0' },
    policies: [{ lane: 'baseline' }, { lane: 'patch' }, { lane: 'minor' }, { lane: 'breaking' }],
    calendar: [{ id: 'rc-window' }, { id: 'patch-hotfix' }, { id: 'minor-planning' }, { id: 'lts-review' }],
    releaseCandidateChecklist: [{ id: 'status' }, { id: 'bundle' }, { id: 'distribution' }, { id: 'integrations' }, { id: 'rollback' }, { id: 'changelog' }],
    hotfixPlaybook: [{ id: 'classify' }, { id: 'branch' }, { id: 'validate' }, { id: 'publish' }],
    artifacts: {},
    checks: [],
  };
}

function publicAdoption(status = 'ready') {
  return {
    stage: '53',
    surface: 'public-adoption-readiness',
    status,
    summary: { ok: status === 'ready', passed: 20, warnings: 0, failed: status === 'ready' ? 0 : 1, readinessScore: status === 'ready' ? 95 : 40 },
    baseline: { release: 'v1.0.0', packageName: 'zavorth', packageVersion: '1.1.0' },
    requiredScripts: ['public-adoption', 'qa:public-adoption', 'qa:public-adoption-readiness'],
    launchChecklist: [],
    claims: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }],
    risks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    demoRunbook: [{ route: '/' }, { route: '/demo' }, { route: '/start' }, { route: '/docs' }, { route: '/release' }, { route: '/feedback' }],
    checks: [],
  };
}

function readyMetadata(overrides: Record<string, unknown> = {}) {
  return {
    feedbackTelemetryProductLoop: feedbackReady(),
    publicAdoptionPilotLoop: pilotReady(),
    integrationShowcasePartnerSurface: showcaseReady(),
    releaseTrain: releaseTrain(),
    publicAdoptionReadiness: publicAdoption(),
    ...overrides,
  };
}

describe('ReleaseAdoptionReadinessService Release Adoption Readiness', () => {
  it('condenses release train, public adoption and support loop without deploy or canary', () => {
    const run = createRun(readyMetadata());
    run.metadata = { ...run.metadata, ...readyMetadata() };

    const snapshot = new ReleaseAdoptionReadinessService({
      now: () => new Date('2026-05-04T06:53:00.000Z'),
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: RELEASE_ADOPTION_READINESS_CONTRACT_VERSION,
      source: 'ReleaseAdoptionReadinessService',
      status: 'release-adoption-ready',
      integrationShowcase: expect.objectContaining({
        showcaseReady: true,
        vendorCount: 4,
      }),
      releaseTrain: expect.objectContaining({
        status: 'ready',
        policyCount: 4,
        hotfixStepCount: 4,
      }),
      publicAdoption: expect.objectContaining({
        status: 'ready',
        readinessScore: 95,
        claimCount: 5,
      }),
      supportLoop: expect.objectContaining({
        feedbackLoopReady: true,
        pilotLoopReady: true,
        dashboardAggregatedOnly: true,
        metricsReady: true,
      }),
      readiness: expect.objectContaining({
        canOpenPublicAdoption: true,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noDeployExecuted: true,
        noTelemetryEnabled: true,
        noImplicitCollection: true,
        noCanaryStarted: true,
        releaseRequiresRollbackPreview: true,
        adoptionMetricsAggregatedOnly: true,
      }),
    }));
  });

  it('requires the Integration Showcase integration showcase first', () => {
    const run = createRun(readyMetadata({ integrationShowcasePartnerSurface: { status: 'needs-smoke' } }));
    run.metadata = { ...run.metadata, ...readyMetadata({ integrationShowcasePartnerSurface: { status: 'needs-smoke' } }) };

    const snapshot = new ReleaseAdoptionReadinessService().buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot.status).toBe('needs-integration-showcase');
    expect(snapshot.readiness.integrationShowcaseReady).toBe(false);
  });

  it('blocks if the release train is blocked', () => {
    const run = createRun(readyMetadata({ releaseTrain: releaseTrain('blocked') }));
    run.metadata = { ...run.metadata, ...readyMetadata({ releaseTrain: releaseTrain('blocked') }) };

    const snapshot = new ReleaseAdoptionReadinessService().buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.releaseTrain.failedCheckCount).toBe(1);
  });

  it('separates support readiness from aggregated feedback metrics', () => {
    const run = createRun(readyMetadata({
      publicAdoptionPilotLoop: pilotReady({
        adoptionLoop: {
          plannedPilotCount: 3,
          dashboardAggregationOnly: false,
          noPayloadPolicy: true,
        },
        policy: {
          noWorkspacePayloadStored: true,
          dashboardAggregatedOnly: false,
        },
      }),
    }));
    run.metadata = {
      ...run.metadata,
      ...readyMetadata({
        publicAdoptionPilotLoop: pilotReady({
          adoptionLoop: {
            plannedPilotCount: 3,
            dashboardAggregationOnly: false,
            noPayloadPolicy: true,
          },
          policy: {
            noWorkspacePayloadStored: true,
            dashboardAggregatedOnly: false,
          },
        }),
      }),
    };

    const snapshot = new ReleaseAdoptionReadinessService().buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot.status).toBe('needs-feedback-metrics');
    expect(snapshot.readiness.supportLoopReady).toBe(true);
    expect(snapshot.readiness.feedbackMetricsReady).toBe(false);
  });
});
