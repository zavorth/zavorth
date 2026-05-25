import { buildDashboardDashboardViewModel } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.js';
import { buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ProductEntryRuntimeService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-product-entry-${++index}`;
}

function productEntryRuntime() {
  return new ProductEntryRuntimeService({
    now: () => new Date('2026-05-04T02:47:00.000Z'),
    firstRunProfileService: {
      buildPlan: () => ({
        nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
        generatedAt: '2026-05-04T02:47:00.000Z',
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

describe('Dashboard Product Entry Runtime Channel mesh7', () => {
  it('projects productEntryRuntime metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T02:47:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-product-entry',
      text: 'abrir product entry',
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
        },
      },
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
      productEntryRuntime: run.metadata.productEntryRuntime as any,
    });

    expect(viewModel.productEntryRuntime).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.product-entry',
      status: 'handoff_to_agent_runtime',
      firstRun: expect.objectContaining({
        profileConfigured: true,
      }),
      readiness: expect.objectContaining({
        handoffToAgentRuntime: true,
        firstRunRequired: false,
      }),
      policy: expect.objectContaining({
        noProfileWritePerformed: true,
        noRuntimePersistentStart: true,
        secretsSerialized: false,
      }),
    }));
    expect(viewModel.productEntryRuntime?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with Product Entry Runtime into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T02:47:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com product entry',
        replyText: 'ok',
      }),
    } as any);

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-product-entry-live',
      text: 'abrir product entry',
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
        },
      },
    });

    const projection = buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.productEntryRuntime).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.product-entry',
      status: 'handoff_to_agent_runtime',
      entry: expect.objectContaining({
        handoffAllowed: true,
      }),
      readiness: expect.objectContaining({
        productizationEvidenceLinked: true,
        handoffToAgentRuntime: true,
      }),
    }));
    expect(projection.productEntryRuntime?.gates.length).toBeGreaterThan(0);
  });
});
