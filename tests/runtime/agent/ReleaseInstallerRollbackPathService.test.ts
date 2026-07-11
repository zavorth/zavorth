import {
  AgentRunService,
  RELEASE_INSTALLER_ROLLBACK_PATH_CONTRACT_VERSION,
  ReleaseInstallerRollbackPathService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-release-path-${++index}`;
}

function createRun(metadata: Record<string, unknown> = {}) {
  return new AgentRunService({
    now: () => new Date('2026-05-04T02:48:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-release-path',
    text: 'prepare release path',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata,
  });
}

function releaseBundle(status = 'ready') {
  return {
    stage: '51',
    surface: 'release-bundle',
    generatedAt: '2026-05-04T02:48:00.000Z',
    status,
    websiteRoot: '<website>',
    summary: { ok: status !== 'blocked', passed: 10, warnings: status === 'attention' ? 1 : 0, failed: status === 'blocked' ? 1 : 0 },
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
  } as any;
}

describe('ReleaseInstallerRollbackPathService Channel mesh8', () => {
  it('links Product Entry, Productization Evidence and Public Release Bundle without executing release actions', () => {
    const run = createRun();
    run.metadata.productEntryRuntime = {
      source: 'ProductEntryRuntimeService',
      status: 'handoff_to_agent_runtime',
      readiness: {
        handoffToAgentRuntime: true,
      },
      workspace: {
        rollbackAvailable: true,
      },
    };
    run.metadata.productizationEvidence = {
      source: 'ProductizationEvidenceService',
      status: 'ready',
      summary: {
        releasePreviewReady: true,
        stableReleaseAllowed: false,
      },
      releaseReadiness: {
        status: 'preview-ready',
        channel: 'preview',
        version: 'v0.1-preview',
        rollbackAvailable: true,
      },
    };
    run.metadata.publicReleaseBundle = releaseBundle('ready');
    const snapshot = new ReleaseInstallerRollbackPathService({
      now: () => new Date('2026-05-04T02:48:00.000Z'),
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: RELEASE_INSTALLER_ROLLBACK_PATH_CONTRACT_VERSION,
      source: 'ReleaseInstallerRollbackPathService',
      status: 'preview-ready',
      release: expect.objectContaining({
        channel: 'preview',
        releaseBundleLinked: true,
        releaseBundleStatus: 'ready',
      }),
      installer: expect.objectContaining({
        previewAvailable: true,
        installerExecuted: false,
        checksumRequired: true,
      }),
      rollback: expect.objectContaining({
        rollbackAvailable: true,
        rollbackExecuted: false,
      }),
      readiness: expect.objectContaining({
        productEntryRuntimeLinked: true,
        productizationEvidenceLinked: true,
        releaseBundleReady: true,
        canPublishStable: false,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noReleasePublished: true,
        noInstallerExecuted: true,
        noRollbackExecuted: true,
        noCanaryStarted: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        rollbackRequiresExplicitCommand: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'public-release-bundle', status: 'ready' }),
      expect.objectContaining({ id: 'canary-dormant', status: 'ready' }),
    ]));
  });

  it('blocks stable claims when stable publication evidence is not complete', () => {
    const run = createRun();
    run.metadata.productEntryRuntime = {
      source: 'ProductEntryRuntimeService',
      readiness: { handoffToAgentRuntime: true },
      workspace: { rollbackAvailable: false },
    };
    run.metadata.productizationEvidence = {
      source: 'ProductizationEvidenceService',
      status: 'partial',
      summary: {
        releasePreviewReady: true,
        stableReleaseAllowed: false,
      },
      releaseReadiness: {
        status: 'blocked',
        channel: 'stable',
        version: 'v1.0.0',
        rollbackAvailable: false,
      },
    };
    run.metadata.publicReleaseBundle = releaseBundle('ready');
    run.metadata.releaseStatus = {
      channel: 'stable',
      version: 'v1.0.0',
      rollbackAvailable: false,
    };

    const snapshot = new ReleaseInstallerRollbackPathService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.readiness.canPublishStable).toBe(false);
    expect(snapshot.readiness.canStartCanary).toBe(false);
    expect(snapshot.policy.noStableTagMoved).toBe(true);
    expect(snapshot.nextSafeAction).toContain('Rebaixar para preview');
  });
});
