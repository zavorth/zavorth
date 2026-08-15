import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/ZavorthControlAdapter.js'
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ProductEntryRuntimeService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-release-path-${++index}`;
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

function releaseMetadata() {
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
    publicReleaseBundle: {
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
    },
  };
}

describe('ZavorthControl Release Installer Rollback Path Channel mesh8', () => {
  it('projects releaseInstallerRollbackPath metadata into the zavorthControl view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T02:48:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-release-path',
      text: 'abrir release path',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: releaseMetadata(),
    });

    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
      releaseInstallerRollbackPath: run.metadata.releaseInstallerRollbackPath as any,
    });

    expect(viewModel.releaseInstallerRollbackPath).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.release-rollback',
      status: 'preview-ready',
      release: expect.objectContaining({
        releaseBundleStatus: 'ready',
      }),
      installer: expect.objectContaining({
        previewAvailable: true,
        installerExecuted: false,
      }),
      readiness: expect.objectContaining({
        productEntryRuntimeLinked: true,
        productizationEvidenceLinked: true,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noReleasePublished: true,
        noInstallerExecuted: true,
        noStableTagMoved: true,
      }),
    }));
    expect(viewModel.releaseInstallerRollbackPath?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with Release Installer Rollback Path into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T02:48:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com release path',
        replyText: 'ok',
      }),
    } as any);

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-release-path-live',
      text: 'abrir release path',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: releaseMetadata(),
    });

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.releaseInstallerRollbackPath).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.release-rollback',
      status: 'preview-ready',
      readiness: expect.objectContaining({
        productEntryRuntimeLinked: true,
        productizationEvidenceLinked: true,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noReleasePublished: true,
        noInstallerExecuted: true,
        noCanaryStarted: true,
      }),
    }));
    expect(projection.releaseInstallerRollbackPath?.gates.length).toBeGreaterThan(0);
  });
});
