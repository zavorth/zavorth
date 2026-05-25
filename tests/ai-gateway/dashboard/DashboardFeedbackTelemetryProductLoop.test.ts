import { buildDashboardDashboardViewModel } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.js';
import { buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ProductEntryRuntimeService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-feedback-loop-${++index}`;
}

function productEntryRuntime() {
  return new ProductEntryRuntimeService({
    now: () => new Date('2026-05-04T03:50:00.000Z'),
    firstRunProfileService: {
      buildPlan: () => ({
        nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
        generatedAt: '2026-05-04T03:50:00.000Z',
        mode: 'dry-run',
        status: 'ready',
        dryRun: true,
        nonInteractiveSafe: true,
        paths: {
          storageRoot: '<workspace>',
          runtimeDir: 'data/runtime/first-run',
          profilePath: 'data/runtime/first-run/profile.json',
          workspacePath: 'data/runtime/first-run/workspace.json',
          identityPath: 'data/runtime/first-run/identity.json',
          policyPath: 'data/runtime/first-run/policy.json',
        },
        questions: [],
        writes: [],
        summary: ['Profile pronto.'],
      } as any),
      buildWorkspaceIdentitySnapshot: () => ({
        nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
        configured: true,
        profilePath: 'data/runtime/first-run/profile.json',
        userDisplayName: 'Ermys',
        agentDisplayName: 'Zavorth',
        tonePreference: 'equilibrado',
        workspaceRoot: '<workspace>',
        memoryMode: 'local-metadata',
        safetyPosture: 'preview-first',
        providerStatus: 'deferred',
      } as any),
      resolvePaths: () => ({ profilePath: 'data/runtime/first-run/profile.json' } as any),
    },
    personalizationService: {
      getStatus: () => ({
        pending: false,
        reasons: [],
        files: {
          identity: 'IDENTITY.md',
          soul: 'SOUL.md',
          user: 'USER.md',
          bootstrap: 'BOOTSTRAP.md',
        },
        bootstrapExists: false,
        missingUserFields: [],
        identityName: 'Zavorth',
      }),
    },
  });
}

function publicMetadata() {
  return {
    productizationContract: {
      source: 'ZavorthProductizationContractService',
      stage: 'C9',
      status: 'ready',
      control: { ready: true },
      cli: { ready: true },
      sdk: { ready: true },
      docs: { ready: true },
      website: { ready: true },
    },
    releaseStatus: {
      status: 'preview',
      channel: 'preview',
      version: 'v0.1-preview',
      rollbackAvailable: true,
    },
    websitePublic: {
      stage: '46',
      surface: 'website-public',
      generatedAt: '2026-05-04T03:50:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 12, warnings: 0, failed: 0 },
      requiredRoutes: [{ route: '/' }, { route: '/docs' }, { route: '/privacy' }, { route: '/security' }],
      forbiddenClaims: [],
      checks: [],
    },
    publicDocsRecipes: {
      stage: '56',
      surface: 'public-docs-recipes',
      generatedAt: '2026-05-04T03:50:00.000Z',
      status: 'ready',
      projectRoot: '<core>',
      websiteRoot: '<website>',
      artifactDir: '<artifacts>',
      summary: { ok: true, passed: 9, warnings: 0, failed: 0 },
      routes: ['/docs', '/examples'],
      recipes: [{ id: 'quickstart' }, { id: 'release' }],
      troubleshooting: [],
      noSecretsMatrix: [{ id: 'first-run', runsWithoutSecrets: true }],
      artifacts: { fixtureSmokePath: '<artifact>' },
      checks: [],
    },
    publicDemo: {
      stage: '47',
      surface: 'public-demo',
      generatedAt: '2026-05-04T03:50:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 9, warnings: 0, failed: 0 },
      route: '/demo',
      fixturePath: 'data/public-demo.ts',
      requiredStates: ['request', 'Approval', 'artifact', 'replay', 'summary'],
      requiredArtifacts: ['demo-build-fix-report.md'],
      screenshots: [],
      checks: [],
    },
    publicReleaseBundle: {
      stage: '51',
      surface: 'release-bundle',
      generatedAt: '2026-05-04T03:50:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 9, warnings: 0, failed: 0 },
      route: '/release',
      fixturePath: 'data/release-bundle.ts',
      requiredCommands: ['release:status:fast', 'doctor:fast', 'release:rollback-preview'],
      screenshots: [],
      checks: [],
    },
    feedbackTelemetry: {
      stage: '52',
      surface: 'feedback-loop',
      generatedAt: '2026-05-04T03:50:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 11, warnings: 0, failed: 0 },
      route: '/feedback',
      fixturePath: 'data/feedback-loop.ts',
      requiredCommands: ['feedback:preview', 'feedback:revoke', 'feedback:delete'],
      screenshots: [],
      checks: [
        {
          id: 'feedback-loop:route-contract',
          title: 'Feedback route contract',
          status: 'pass',
          reason: 'Product feedback ledger and issue/report template ready.',
          evidence: ['product-feedback-ledger.json', 'feedback-preview-redacted.json', 'issue/report template'],
        },
      ],
      nextRecommendedStage: {
        stage: 'complete',
        title: 'Product feedback loop ready',
        reason: 'opt-in preview sem envio externo',
      },
    },
  };
}

describe('Dashboard Feedback Telemetry Product Loop Feedback Telemetry', () => {
  it('projects feedbackTelemetryProductLoop metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T03:50:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-feedback-loop',
      text: 'abrir feedback loop',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: publicMetadata(),
    });

    const viewModel = buildDashboardDashboardViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
      publicSiteDocsDemoSync: run.metadata.publicSiteDocsDemoSync as any,
      feedbackTelemetryProductLoop: run.metadata.feedbackTelemetryProductLoop as any,
    });

    expect(viewModel.feedbackTelemetryProductLoop).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.feedback-telemetry',
      status: 'opt-in-ready',
      readiness: expect.objectContaining({
        publicSiteDocsDemoSyncLinked: true,
        feedbackTelemetryContractLinked: true,
        canCollectFeedbackPreview: true,
        canSendFeedbackExternally: false,
        canEnableTelemetry: false,
      }),
      policy: expect.objectContaining({
        noTelemetryEnabled: true,
        noFeedbackSent: true,
        noExternalNetworkCall: true,
        noRawPayloadSerialized: true,
      }),
    }));
    expect(viewModel.feedbackTelemetryProductLoop?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with Feedback Telemetry Product Loop into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T03:50:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com feedback loop',
        replyText: 'ok',
      }),
    } as any);

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-feedback-loop-live',
      text: 'abrir feedback loop',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: publicMetadata(),
    });

    const projection = buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.feedbackTelemetryProductLoop).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.feedback-telemetry',
      status: 'opt-in-ready',
      telemetry: expect.objectContaining({
        enabledByDefault: false,
        externalTelemetryEnabled: false,
        rawPayloadAllowed: false,
        consentAssumed: false,
      }),
      policy: expect.objectContaining({
        noTelemetryEnabled: true,
        noFeedbackSent: true,
        noExternalNetworkCall: true,
        noRawPayloadSerialized: true,
      }),
    }));
    expect(projection.feedbackTelemetryProductLoop?.gates.length).toBeGreaterThan(0);
  });
});
