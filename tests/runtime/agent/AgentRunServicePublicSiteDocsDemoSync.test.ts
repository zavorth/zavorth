import {
  AgentRunService,
  ProductEntryRuntimeService,
  PUBLIC_SITE_DOCS_DEMO_SYNC_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-public-sync-${++index}`;
}

function productEntryRuntime() {
  return new ProductEntryRuntimeService({
    now: () => new Date('2026-05-04T02:49:00.000Z'),
    firstRunProfileService: {
      buildPlan: () => ({
        nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
        generatedAt: '2026-05-04T02:49:00.000Z',
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
      generatedAt: '2026-05-04T02:49:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 12, warnings: 0, failed: 0 },
      requiredRoutes: [{ route: '/' }, { route: '/docs' }, { route: '/security' }],
      forbiddenClaims: [],
      checks: [],
    },
    publicDocsRecipes: {
      stage: '56',
      surface: 'public-docs-recipes',
      generatedAt: '2026-05-04T02:49:00.000Z',
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
      generatedAt: '2026-05-04T02:49:00.000Z',
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
      generatedAt: '2026-05-04T02:49:00.000Z',
      status: 'ready',
      websiteRoot: '<website>',
      summary: { ok: true, passed: 9, warnings: 0, failed: 0 },
      route: '/release',
      fixturePath: 'data/release-bundle.ts',
      requiredCommands: ['release:status:fast', 'doctor:fast', 'release:rollback-preview'],
      screenshots: [],
      checks: [],
    },
  };
}

describe('AgentRunService Public Site Docs Demo Sync Channel mesh9', () => {
  it('publishes run.metadata.publicSiteDocsDemoSync after Release Installer Rollback Path', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T02:49:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Public sync pronto.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-public-sync',
      text: 'go public sync',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: publicMetadata(),
    });

    const publicSync = result.run.metadata.publicSiteDocsDemoSync as any;
    expect(result.run.metadata.releaseInstallerRollbackPath).toBeTruthy();
    expect(publicSync).toEqual(expect.objectContaining({
      contractVersion: PUBLIC_SITE_DOCS_DEMO_SYNC_CONTRACT_VERSION,
      source: 'PublicSiteDocsDemoSyncService',
      status: 'synced-preview',
      readiness: expect.objectContaining({
        releaseInstallerRollbackPathLinked: true,
        websitePublicLinked: true,
        publicDocsRecipesLinked: true,
        publicDemoLinked: true,
        canPublishSitePreview: true,
        canAnnounceStable: false,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noWebsiteBuildExecuted: true,
        noPublicDeployExecuted: true,
        noDemoLiveExecution: true,
        noStableClaimPublished: true,
        secretsSerialized: false,
      }),
    }));
  });
});
