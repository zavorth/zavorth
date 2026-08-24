import {
  AgentRunService,
  ProductEntryRuntimeService,
  RELEASE_INSTALLER_ROLLBACK_PATH_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-release-path-${++index}`;
}

function productEntryRuntime() {
  return new ProductEntryRuntimeService({
    now: () => new Date('2026-05-04T02:48:00.000Z'),
    firstRunProfileService: {
      buildPlan: () => ({
        nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
        generatedAt: '2026-05-04T02:48:00.000Z',
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
        writes: [{ path: 'data/runtime/first-run/profile.json', action: 'skip', reason: 'profile existente' }],
        summary: ['Profile pronto.'],
      } as any),
      buildWorkspaceIdentitySnapshot: () => ({
        nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
        configured: true,
        profilePath: 'data/runtime/first-run/profile.json',
        userDisplayName: 'Ermys',
        agentDisplayName: 'Zavorth',
        tonePreference: 'balanced',
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

function releaseBundle() {
  return {
    stage: '51',
    surface: 'release-bundle',
    generatedAt: '2026-05-04T02:48:00.000Z',
    status: 'ready',
    websiteRoot: '<website>',
    summary: { ok: true, passed: 10, warnings: 0, failed: 0 },
    route: '/release',
    fixturePath: 'data/release-bundle.ts',
    requiredCommands: ['release:status:fast', 'doctor:fast', 'release:changelog', 'release:rollback-preview'],
    screenshots: [],
    checks: [],
    nextRecommendedGate: {
      stage: '52',
      title: 'Feedback, Telemetry Opt-In And Product Loop',
      reason: 'proximo passo',
    },
  };
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('AgentRunService Release Installer Rollback Path Channel mesh8', () => {
  it('publishes run.metadata.releaseInstallerRollbackPath after Product Entry Runtime', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T02:48:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Release path pronto.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-release-path',
      text: 'go release path',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
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
        publicReleaseBundle: releaseBundle(),
      },
    });

    const releasePath = result.run.metadata.releaseInstallerRollbackPath as any;
    expect(result.run.metadata.productizationEvidence).toBeTruthy();
    expect(result.run.metadata.productEntryRuntime).toBeTruthy();
    expect(releasePath).toEqual(expect.objectContaining({
      contractVersion: RELEASE_INSTALLER_ROLLBACK_PATH_CONTRACT_VERSION,
      source: 'ReleaseInstallerRollbackPathService',
      status: 'preview-ready',
      readiness: expect.objectContaining({
        productEntryRuntimeLinked: true,
        productizationEvidenceLinked: true,
        releaseBundleReady: true,
        firstRunReady: true,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noReleasePublished: true,
        noInstallerExecuted: true,
        noRollbackExecuted: true,
        noStableTagMoved: true,
        secretsSerialized: false,
      }),
    }));
  });
});
