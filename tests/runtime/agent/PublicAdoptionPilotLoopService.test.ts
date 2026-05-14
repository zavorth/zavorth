import {
  AgentRunService,
  PUBLIC_ADOPTION_PILOT_LOOP_CONTRACT_VERSION,
  PublicAdoptionPilotLoopService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-public-adoption-pilot-${++index}`;
}

function createRun(metadata: Record<string, unknown> = {}) {
  return new AgentRunService({
    now: () => new Date('2026-05-04T04:51:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-public-adoption-pilot',
    text: 'prepare public adoption pilot',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata,
  });
}

function feedbackProductLoop(status = 'opt-in-ready') {
  return {
    contractVersion: '2026-05-04.wave-50',
    source: 'FeedbackTelemetryProductLoopService',
    status,
    surface: {
      previewCommand: 'npm run feedback:preview',
      revokeCommand: 'npm run feedback:revoke',
      deleteCommand: 'npm run feedback:delete',
    },
    policy: {
      noTelemetryEnabled: true,
      noFeedbackSent: true,
      noExternalNetworkCall: true,
      noRawPayloadSerialized: true,
    },
  };
}

function pilotLoop(status = 'ready') {
  return {
    phase: '57',
    surface: 'pilot-loop',
    generatedAt: '2026-05-04T04:51:00.000Z',
    status,
    projectRoot: '<core>',
    websiteRoot: '<website>',
    artifactDir: '.qa/pilot-loop',
    summary: { ok: status !== 'blocked', passed: 16, warnings: 0, failed: status === 'blocked' ? 1 : 0 },
    artifacts: {
      feedbackPreviewPath: '.qa/pilot-loop/feedback-preview-redacted.json',
      pilotLedgerPath: '.qa/pilot-loop/pilot-ledger.json',
      dashboardPath: '.qa/pilot-loop/support-dashboard.json',
    },
    templates: [{ id: 'bug' }, { id: 'docs' }, { id: 'install' }, { id: 'feature' }],
    triageRules: [
      { id: 'install-high', severity: 'high' },
      { id: 'bug-medium', severity: 'medium' },
      { id: 'docs-low', severity: 'low' },
      { id: 'release-high', severity: 'high' },
      { id: 'feature-low', severity: 'low' },
    ],
    pilotLedger: [
      { id: 'pilot-local-engineering', status: 'planned', dataPolicy: 'redacted-only' },
      { id: 'pilot-release-operator', status: 'planned', dataPolicy: 'no-workspace-payload' },
      { id: 'pilot-feedback-loop', status: 'planned', dataPolicy: 'redacted-only' },
    ],
    supportPolicy: [{ id: 'privacy-first' }, { id: 'install-runtime' }, { id: 'feature-planning' }],
    dashboardMetrics: [
      { id: 'feedback-count-by-area', aggregateOnly: true, excludesPayload: true },
      { id: 'severity-mix', aggregateOnly: true, excludesPayload: true },
      { id: 'pilot-status', aggregateOnly: true, excludesPayload: true },
      { id: 'follow-up-aging', aggregateOnly: true, excludesPayload: true },
    ],
    checks: [
      { id: 'pilot-loop:feedback-preview', status: 'pass' },
      { id: 'pilot-loop:pilot-ledger', status: 'pass' },
      { id: 'pilot-loop:dashboard', status: 'pass' },
    ],
    nextRecommendedPhase: {
      phase: '58',
      title: 'Integration Showcase And Partner Surface',
      reason: 'fixture e degradacao segura',
    },
  };
}

describe('PublicAdoptionPilotLoopService Wave 51', () => {
  it('publishes a controlled pilot loop without implicit collection or raw payload storage', () => {
    const run = createRun({
      feedbackTelemetryProductLoop: feedbackProductLoop(),
      pilotLoop: pilotLoop(),
    });
    run.metadata.feedbackTelemetryProductLoop = feedbackProductLoop();
    run.metadata.pilotLoop = pilotLoop();

    const snapshot = new PublicAdoptionPilotLoopService({
      now: () => new Date('2026-05-04T04:51:00.000Z'),
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: PUBLIC_ADOPTION_PILOT_LOOP_CONTRACT_VERSION,
      source: 'PublicAdoptionPilotLoopService',
      status: 'pilot-ready',
      feedbackProductLoop: expect.objectContaining({
        linked: true,
        optInReady: true,
      }),
      readiness: expect.objectContaining({
        feedbackProductLoopReady: true,
        pilotLoopContractLinked: true,
        templatesReady: true,
        triageReady: true,
        ledgerReady: true,
        supportReady: true,
        dashboardReady: true,
        canStartControlledPilot: true,
        canCollectPublicFeedback: true,
        canPublishPilotMetrics: true,
      }),
      policy: expect.objectContaining({
        noImplicitCollection: true,
        noTelemetryEnabled: true,
        noExternalSubmission: true,
        noWorkspacePayloadStored: true,
        noSecretsSerialized: true,
        dashboardAggregatedOnly: true,
        pilotRequiresExplicitOwner: true,
      }),
    }));
    expect(snapshot.adoptionLoop).toEqual(expect.objectContaining({
      plannedPilotCount: 3,
      dashboardAggregationOnly: true,
      noPayloadPolicy: true,
    }));
  });

  it('requires the Wave 50 feedback product loop before opening pilots', () => {
    const run = createRun({
      pilotLoop: pilotLoop(),
    });
    delete run.metadata.feedbackTelemetryProductLoop;
    run.metadata.pilotLoop = pilotLoop();

    const snapshot = new PublicAdoptionPilotLoopService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('needs-feedback-product-loop');
    expect(snapshot.readiness.feedbackProductLoopReady).toBe(false);
    expect(snapshot.nextSafeAction).toContain('Wave 50');
  });

  it('requires generated pilot artifacts before controlled adoption', () => {
    const run = createRun({
      feedbackTelemetryProductLoop: feedbackProductLoop(),
      pilotLoop: {
        ...pilotLoop(),
        checks: [],
      },
    });
    run.metadata.feedbackTelemetryProductLoop = feedbackProductLoop();
    run.metadata.pilotLoop = {
      ...pilotLoop(),
      checks: [],
    };

    const snapshot = new PublicAdoptionPilotLoopService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('needs-artifacts');
    expect(snapshot.artifacts.feedbackPreviewReady).toBe(false);
    expect(snapshot.policy.noImplicitCollection).toBe(true);
  });
});
