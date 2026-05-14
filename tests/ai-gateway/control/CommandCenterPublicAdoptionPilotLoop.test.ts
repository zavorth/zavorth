import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ProductEntryRuntimeService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-public-adoption-pilot-${++index}`;
}

function productEntryRuntime() {
  return new ProductEntryRuntimeService({
    now: () => new Date('2026-05-04T04:51:00.000Z'),
    firstRunProfileService: {
      buildPlan: () => ({
        nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
        generatedAt: '2026-05-04T04:51:00.000Z',
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
    productizationContract: { source: 'ZavorthProductizationContractService', phase: 'C9', status: 'ready', control: { ready: true }, cli: { ready: true }, sdk: { ready: true }, docs: { ready: true }, website: { ready: true } },
    releaseStatus: { status: 'preview', channel: 'preview', version: 'v0.1-preview', rollbackAvailable: true },
    websitePublic: { phase: '46', surface: 'website-public', generatedAt: '2026-05-04T04:51:00.000Z', status: 'ready', websiteRoot: '<website>', summary: { ok: true, passed: 12, warnings: 0, failed: 0 }, requiredRoutes: [{ route: '/' }, { route: '/docs' }, { route: '/privacy' }, { route: '/security' }], forbiddenClaims: [], checks: [] },
    publicDocsRecipes: { phase: '56', surface: 'public-docs-recipes', generatedAt: '2026-05-04T04:51:00.000Z', status: 'ready', projectRoot: '<core>', websiteRoot: '<website>', artifactDir: '<artifacts>', summary: { ok: true, passed: 9, warnings: 0, failed: 0 }, routes: ['/docs', '/examples'], recipes: [{ id: 'quickstart' }, { id: 'release' }], troubleshooting: [], noSecretsMatrix: [{ id: 'first-run', runsWithoutSecrets: true }], artifacts: { fixtureSmokePath: '<artifact>' }, checks: [] },
    publicDemo: { phase: '47', surface: 'public-demo', generatedAt: '2026-05-04T04:51:00.000Z', status: 'ready', websiteRoot: '<website>', summary: { ok: true, passed: 9, warnings: 0, failed: 0 }, route: '/demo', fixturePath: 'data/public-demo.ts', requiredStates: ['request', 'Approval', 'artifact', 'replay', 'summary'], requiredArtifacts: ['demo-build-fix-report.md'], screenshots: [], checks: [] },
    publicReleaseBundle: { phase: '51', surface: 'release-bundle', generatedAt: '2026-05-04T04:51:00.000Z', status: 'ready', websiteRoot: '<website>', summary: { ok: true, passed: 9, warnings: 0, failed: 0 }, route: '/release', fixturePath: 'data/release-bundle.ts', requiredCommands: ['release:status:fast', 'doctor:fast', 'release:rollback-preview'], screenshots: [], checks: [] },
    feedbackTelemetry: { phase: '52', surface: 'feedback-loop', generatedAt: '2026-05-04T04:51:00.000Z', status: 'ready', websiteRoot: '<website>', summary: { ok: true, passed: 11, warnings: 0, failed: 0 }, route: '/feedback', fixturePath: 'data/feedback-loop.ts', requiredCommands: ['feedback:preview', 'feedback:revoke', 'feedback:delete'], screenshots: [], checks: [{ id: 'feedback-loop:route-contract', title: 'Feedback route contract', status: 'pass', reason: 'Product feedback ledger and issue/report template ready.', evidence: ['product-feedback-ledger.json', 'feedback-preview-redacted.json', 'issue/report template'] }], nextRecommendedPhase: { phase: 'complete', title: 'Product feedback loop ready', reason: 'opt-in preview sem envio externo' } },
    pilotLoop: {
      phase: '57',
      surface: 'pilot-loop',
      generatedAt: '2026-05-04T04:51:00.000Z',
      status: 'ready',
      projectRoot: '<core>',
      websiteRoot: '<website>',
      artifactDir: '.qa/pilot-loop',
      summary: { ok: true, passed: 16, warnings: 0, failed: 0 },
      artifacts: { feedbackPreviewPath: '.qa/pilot-loop/feedback-preview-redacted.json', pilotLedgerPath: '.qa/pilot-loop/pilot-ledger.json', dashboardPath: '.qa/pilot-loop/support-dashboard.json' },
      templates: [{ id: 'bug' }, { id: 'docs' }, { id: 'install' }, { id: 'feature' }],
      triageRules: [{ id: 'install-high', severity: 'high' }, { id: 'bug-medium', severity: 'medium' }, { id: 'docs-low', severity: 'low' }, { id: 'release-high', severity: 'high' }, { id: 'feature-low', severity: 'low' }],
      pilotLedger: [{ id: 'pilot-local-engineering', status: 'planned', dataPolicy: 'redacted-only' }, { id: 'pilot-release-operator', status: 'planned', dataPolicy: 'no-workspace-payload' }, { id: 'pilot-feedback-loop', status: 'planned', dataPolicy: 'redacted-only' }],
      supportPolicy: [{ id: 'privacy-first' }, { id: 'install-runtime' }, { id: 'feature-planning' }],
      dashboardMetrics: [{ id: 'feedback-count-by-area', aggregateOnly: true, excludesPayload: true }, { id: 'severity-mix', aggregateOnly: true, excludesPayload: true }, { id: 'pilot-status', aggregateOnly: true, excludesPayload: true }, { id: 'follow-up-aging', aggregateOnly: true, excludesPayload: true }],
      checks: [{ id: 'pilot-loop:feedback-preview', status: 'pass' }, { id: 'pilot-loop:pilot-ledger', status: 'pass' }, { id: 'pilot-loop:dashboard', status: 'pass' }],
      nextRecommendedPhase: { phase: '58', title: 'Integration Showcase And Partner Surface', reason: 'fixture e degradacao segura' },
    },
  };
}

describe('Command Center Public Adoption Pilot Loop Wave 51', () => {
  it('projects publicAdoptionPilotLoop metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T04:51:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-public-adoption-pilot',
      text: 'abrir public adoption pilot',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: publicMetadata(),
    });

    const viewModel = buildDashboardCommandCenterViewModel({
      runtime: { status: 'ready' },
      wsStatus: 'connected',
      agentRun: { id: run.id, status: 'completed', metadata: run.metadata },
      publicAdoptionPilotLoop: run.metadata.publicAdoptionPilotLoop as any,
    });

    expect(viewModel.publicAdoptionPilotLoop).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.wave-51',
      status: 'pilot-ready',
      readiness: expect.objectContaining({
        feedbackProductLoopReady: true,
        pilotLoopContractLinked: true,
        canStartControlledPilot: true,
        canPublishPilotMetrics: true,
      }),
      policy: expect.objectContaining({
        noImplicitCollection: true,
        noExternalSubmission: true,
        noWorkspacePayloadStored: true,
      }),
    }));
    expect(viewModel.publicAdoptionPilotLoop?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with Public Adoption Pilot Loop into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T04:51:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
      executor: () => ({ status: 'completed', summary: 'ok com public adoption pilot', replyText: 'ok' }),
    } as any);

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-public-adoption-pilot-live',
      text: 'abrir public adoption pilot',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: publicMetadata(),
    });

    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.publicAdoptionPilotLoop).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.wave-51',
      status: 'pilot-ready',
      adoptionLoop: expect.objectContaining({
        plannedPilotCount: 3,
        dashboardAggregationOnly: true,
        noPayloadPolicy: true,
      }),
      policy: expect.objectContaining({
        noImplicitCollection: true,
        noTelemetryEnabled: true,
        noWorkspacePayloadStored: true,
      }),
    }));
    expect(projection.publicAdoptionPilotLoop?.gates.length).toBeGreaterThan(0);
  });
});
