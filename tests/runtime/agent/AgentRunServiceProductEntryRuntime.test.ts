import {
  AgentRunService,
  PRODUCT_ENTRY_RUNTIME_CONTRACT_VERSION,
  ProductEntryRuntimeService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-product-entry-${++index}`;
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
        writes: [],
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

describe('AgentRunService Product Entry Runtime Channel mesh7', () => {
  it('publishes run.metadata.productEntryRuntime after Productization Evidence', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T02:47:00.000Z'),
      idFactory: createIdFactory(),
      productEntryRuntime: productEntryRuntime(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Product Entry Runtime pronto.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-product-entry',
      text: 'go product entry',
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

    const entry = result.run.metadata.productEntryRuntime as any;
    expect(result.run.metadata.productizationEvidence).toBeTruthy();
    expect(entry).toEqual(expect.objectContaining({
      contractVersion: PRODUCT_ENTRY_RUNTIME_CONTRACT_VERSION,
      source: 'ProductEntryRuntimeService',
      status: 'handoff_to_agent_runtime',
      readiness: expect.objectContaining({
        productizationEvidenceLinked: true,
        firstRunRequired: false,
        handoffToAgentRuntime: true,
      }),
      policy: expect.objectContaining({
        noProfileWritePerformed: true,
        noRuntimePersistentStart: true,
        noToolExecutionPerformed: true,
        secretsSerialized: false,
      }),
    }));
  });
});
