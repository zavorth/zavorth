import {
  AgentRunService,
  FEEDBACK_TELEMETRY_PRODUCT_LOOP_CONTRACT_VERSION,
  FeedbackTelemetryProductLoopService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-feedback-loop-${++index}`;
}

function createRun(metadata: Record<string, unknown> = {}) {
  return new AgentRunService({
    now: () => new Date('2026-05-04T03:50:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-feedback-loop',
    text: 'prepare feedback loop',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata,
  });
}

function publicSync(status = 'synced-preview') {
  return {
    contractVersion: '2026-05-04.docs-demo',
    source: 'PublicSiteDocsDemoSyncService',
    status,
    sync: {
      releasePathLinked: true,
      releaseBundleLinked: true,
      publicRoutes: ['/', '/docs', '/privacy', '/examples', '/demo', '/release'],
    },
    readiness: {
      canPublishSitePreview: true,
      canAnnounceStable: false,
      canStartCanary: false,
    },
    policy: {
      noPublicDeployExecuted: true,
      noDemoLiveExecution: true,
      noStableClaimPublished: true,
    },
    surface: {
      websiteRoute: '/',
      docsRoute: '/docs',
      examplesRoute: '/examples',
      demoRoute: '/demo',
      releaseRoute: '/release',
    },
  };
}

function feedbackTelemetry(status = 'ready') {
  return {
    stage: '52',
    surface: 'feedback-loop',
    generatedAt: '2026-05-04T03:50:00.000Z',
    status,
    websiteRoot: '<website>',
    summary: { ok: status !== 'blocked', passed: 11, warnings: 0, failed: status === 'blocked' ? 1 : 0 },
    route: '/feedback',
    fixturePath: 'data/feedback-loop.ts',
    requiredCommands: ['feedback:preview', 'feedback:revoke', 'feedback:delete'],
    screenshots: [],
    checks: [
      {
        id: 'feedback-loop:route-contract',
        title: 'Feedback route contract',
        status: status === 'blocked' ? 'fail' : 'pass',
        reason: 'Product feedback ledger and issue/report template ready.',
        evidence: ['product-feedback-ledger.json', 'feedback-preview-redacted.json', 'issue/report template'],
      },
    ],
    nextRecommendedStage: {
      stage: 'complete',
      title: 'Product feedback loop ready',
      reason: 'opt-in preview sem envio externo',
    },
  };
}

describe('FeedbackTelemetryProductLoopService Feedback Telemetry', () => {
  it('publishes an opt-in-only product loop without enabling telemetry or sending feedback', () => {
    const run = createRun({
      publicSiteDocsDemoSync: publicSync(),
      feedbackTelemetry: feedbackTelemetry(),
    });
    run.metadata.publicSiteDocsDemoSync = publicSync();

    const snapshot = new FeedbackTelemetryProductLoopService({
      now: () => new Date('2026-05-04T03:50:00.000Z'),
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: FEEDBACK_TELEMETRY_PRODUCT_LOOP_CONTRACT_VERSION,
      source: 'FeedbackTelemetryProductLoopService',
      status: 'opt-in-ready',
      readiness: expect.objectContaining({
        publicSiteDocsDemoSyncLinked: true,
        feedbackTelemetryContractLinked: true,
        feedbackRouteReady: true,
        canCollectFeedbackPreview: true,
        canSendFeedbackExternally: false,
        canEnableTelemetry: false,
      }),
      telemetry: expect.objectContaining({
        enabledByDefault: false,
        optInRequired: true,
        externalTelemetryEnabled: false,
        rawPayloadAllowed: false,
        consentAssumed: false,
      }),
      policy: expect.objectContaining({
        noTelemetryEnabled: true,
        noFeedbackSent: true,
        noExternalNetworkCall: true,
        noRawPayloadSerialized: true,
        noConsentAssumed: true,
        revokeDeleteAvailable: true,
        optInRequired: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.feedback.requiredCommands).toEqual(['feedback:preview', 'feedback:revoke', 'feedback:delete']);
    expect(snapshot.productLoop).toEqual(expect.objectContaining({
      ledgerPath: 'product-feedback-ledger.json',
      previewArtifactPath: 'feedback-preview-redacted.json',
      ledgerAvailable: true,
      productLearningEnabled: true,
    }));
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'telemetry-disabled-by-default', status: 'ready' }),
    ]));
  });

  it('requires public sync before exposing the feedback product loop', () => {
    const run = createRun({
      feedbackTelemetry: feedbackTelemetry(),
    });
    delete run.metadata.publicSiteDocsDemoSync;

    const snapshot = new FeedbackTelemetryProductLoopService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('needs-public-sync');
    expect(snapshot.readiness.publicSiteDocsDemoSyncLinked).toBe(false);
    expect(snapshot.nextSafeAction).toContain('Channel mesh9');
  });

  it('blocks when the underlying feedback telemetry contract is blocked', () => {
    const run = createRun({
      publicSiteDocsDemoSync: publicSync(),
      feedbackTelemetry: feedbackTelemetry('blocked'),
    });
    run.metadata.publicSiteDocsDemoSync = publicSync();

    const snapshot = new FeedbackTelemetryProductLoopService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.feedback.contractStatus).toBe('blocked');
    expect(snapshot.policy.noTelemetryEnabled).toBe(true);
  });
});
