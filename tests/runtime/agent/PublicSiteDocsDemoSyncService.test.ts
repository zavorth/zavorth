import {
  AgentRunService,
  PUBLIC_SITE_DOCS_DEMO_SYNC_CONTRACT_VERSION,
  PublicSiteDocsDemoSyncService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-public-sync-${++index}`;
}

function createRun(metadata: Record<string, unknown> = {}) {
  return new AgentRunService({
    now: () => new Date('2026-05-04T02:49:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-public-sync',
    text: 'prepare public sync',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata,
  });
}

function releasePath(status = 'preview-ready') {
  return {
    contractVersion: '2026-05-04.release-rollback',
    source: 'ReleaseInstallerRollbackPathService',
    status,
    release: {
      channel: 'preview',
      version: 'v0.1-preview',
      stableAllowed: false,
      releaseBundleLinked: true,
      releaseBundleStatus: 'ready',
      route: '/release',
    },
    installer: {
      previewAvailable: true,
      installerExecuted: false,
      dryRunCommand: 'zavorth release install --dry-run',
      requiredCommands: ['release:status:fast'],
      hostedInstallerAllowed: true,
      checksumRequired: true,
    },
    rollback: {
      rollbackAvailable: true,
      rollbackExecuted: false,
      rollbackCommand: 'zavorth release rollback --dry-run',
      cleanupPreviewRequired: true,
      scope: 'local-artifacts-only',
    },
    readiness: {
      canPublishStable: false,
      canStartCanary: false,
    },
    policy: {
      noReleasePublished: true,
      noInstallerExecuted: true,
      noCanaryStarted: true,
    },
  };
}

function websitePublic(status = 'ready') {
  return {
    stage: '46',
    surface: 'website-public',
    generatedAt: '2026-05-04T02:49:00.000Z',
    status,
    websiteRoot: '<website>',
    summary: { ok: status !== 'blocked', passed: 12, warnings: 0, failed: status === 'blocked' ? 1 : 0 },
    requiredRoutes: [
      { route: '/', label: 'landing principal' },
      { route: '/docs', label: 'documentacao publica' },
      { route: '/security', label: 'seguranca' },
    ],
    forbiddenClaims: [],
    checks: [],
  };
}

function publicDocs(status = 'ready') {
  return {
    stage: '56',
    surface: 'public-docs-recipes',
    generatedAt: '2026-05-04T02:49:00.000Z',
    status,
    projectRoot: '<core>',
    websiteRoot: '<website>',
    artifactDir: '<artifacts>',
    summary: { ok: status !== 'blocked', passed: 9, warnings: 0, failed: status === 'blocked' ? 1 : 0 },
    routes: ['/docs', '/examples'],
    recipes: [{ id: 'quickstart' }, { id: 'release' }],
    troubleshooting: [],
    noSecretsMatrix: [{ id: 'first-run', runsWithoutSecrets: true }],
    artifacts: { fixtureSmokePath: '<artifact>' },
    checks: [],
  };
}

function publicDemo(status = 'ready') {
  return {
    stage: '47',
    surface: 'public-demo',
    generatedAt: '2026-05-04T02:49:00.000Z',
    status,
    websiteRoot: '<website>',
    summary: { ok: status !== 'blocked', passed: 9, warnings: 0, failed: status === 'blocked' ? 1 : 0 },
    route: '/demo',
    fixturePath: 'data/public-demo.ts',
    requiredStates: ['request', 'Approval', 'artifact', 'replay', 'summary'],
    requiredArtifacts: ['demo-build-fix-report.md'],
    screenshots: [],
    checks: [],
  };
}

function releaseBundle(status = 'ready') {
  return {
    stage: '51',
    surface: 'release-bundle',
    generatedAt: '2026-05-04T02:49:00.000Z',
    status,
    websiteRoot: '<website>',
    summary: { ok: status !== 'blocked', passed: 9, warnings: 0, failed: status === 'blocked' ? 1 : 0 },
    route: '/release',
    fixturePath: 'data/release-bundle.ts',
    requiredCommands: ['release:status:fast'],
    screenshots: [],
    checks: [],
  };
}

describe('PublicSiteDocsDemoSyncService Channel mesh9', () => {
  it('syncs public site, docs, demo and release path in preview-only mode', () => {
    const run = createRun();
    run.metadata.releaseInstallerRollbackPath = releasePath();
    run.metadata.websitePublic = websitePublic();
    run.metadata.publicDocsRecipes = publicDocs();
    run.metadata.publicDemo = publicDemo();
    run.metadata.publicReleaseBundle = releaseBundle();

    const snapshot = new PublicSiteDocsDemoSyncService({
      now: () => new Date('2026-05-04T02:49:00.000Z'),
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: PUBLIC_SITE_DOCS_DEMO_SYNC_CONTRACT_VERSION,
      source: 'PublicSiteDocsDemoSyncService',
      status: 'synced-preview',
      sync: expect.objectContaining({
        releasePathLinked: true,
        websiteLinked: true,
        docsLinked: true,
        demoLinked: true,
        releaseBundleLinked: true,
      }),
      releaseNarrative: expect.objectContaining({
        previewOnly: true,
        stableClaimAllowed: false,
        installerDryRun: true,
        rollbackDryRun: true,
        canaryDormant: true,
      }),
      readiness: expect.objectContaining({
        docsDemoAligned: true,
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
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'preview-only-narrative', status: 'ready' }),
    ]));
  });

  it('blocks stable claims when release path is stable without stable readiness', () => {
    const run = createRun();
    run.metadata.releaseInstallerRollbackPath = {
      ...releasePath(),
      release: {
        ...releasePath().release,
        channel: 'stable',
      },
      readiness: {
        canPublishStable: false,
        canStartCanary: false,
      },
    };
    run.metadata.websitePublic = websitePublic();
    run.metadata.publicDocsRecipes = publicDocs();
    run.metadata.publicDemo = publicDemo();
    run.metadata.publicReleaseBundle = releaseBundle();

    const snapshot = new PublicSiteDocsDemoSyncService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('stable-claim-blocked');
    expect(snapshot.readiness.canAnnounceStable).toBe(false);
    expect(snapshot.policy.noStableClaimPublished).toBe(true);
    expect(snapshot.nextSafeAction).toContain('Remove the stable claim');
  });
});
