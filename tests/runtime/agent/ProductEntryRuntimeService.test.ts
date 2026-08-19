import {
  AgentRunService,
  PRODUCT_ENTRY_RUNTIME_CONTRACT_VERSION,
  ProductEntryRuntimeService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-product-entry-${++index}`;
}

function createRun(metadata: Record<string, unknown> = {}) {
  return new AgentRunService({
    now: () => new Date('2026-05-04T02:47:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-product-entry',
    text: 'prepare product entry',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata,
  });
}

function profileSnapshot(configured: boolean) {
  return {
    nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
    configured,
    profilePath: 'data/runtime/first-run/profile.json',
    userDisplayName: configured ? 'Ermys' : null,
    agentDisplayName: configured ? 'Zavorth' : null,
    tonePreference: configured ? 'balanced' : null,
    workspaceRoot: configured ? '<workspace>' : null,
    memoryMode: configured ? 'local-metadata' : null,
    safetyPosture: configured ? 'preview-first' : null,
    providerStatus: configured ? 'deferred' : null,
  } as any;
}

function bootstrapPlan(status = 'ready') {
  return {
    nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
    generatedAt: '2026-05-04T02:47:00.000Z',
    mode: 'dry-run',
    status,
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
  } as any;
}

function personalization(pending: boolean) {
  return {
    pending,
    reasons: pending ? ['USER.md tem campos pendentes'] : [],
    files: {
      identity: 'IDENTITY.md',
      soul: 'SOUL.md',
      user: 'USER.md',
      bootstrap: 'BOOTSTRAP.md',
    },
    bootstrapExists: pending,
    missingUserFields: pending ? ['Name'] : [],
    identityName: pending ? null : 'Zavorth',
  };
}

describe('ProductEntryRuntimeService Channel mesh7', () => {
  it('routes new users to the shared first-run state without side effects', () => {
    const run = createRun();
    run.metadata.productizationEvidence = {
      source: 'ProductizationEvidenceService',
      status: 'partial',
      summary: {
        releasePreviewReady: true,
        stableReleaseAllowed: false,
      },
      releaseReadiness: { status: 'preview-ready' },
    };
    const snapshot = new ProductEntryRuntimeService({
      now: () => new Date('2026-05-04T02:47:00.000Z'),
      firstRunProfileService: {
        buildPlan: () => bootstrapPlan('ready'),
        buildWorkspaceIdentitySnapshot: () => profileSnapshot(false),
        resolvePaths: () => ({ profilePath: 'data/runtime/first-run/profile.json' } as any),
      },
      personalizationService: {
        getStatus: () => personalization(true),
      },
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: PRODUCT_ENTRY_RUNTIME_CONTRACT_VERSION,
      source: 'ProductEntryRuntimeService',
      status: 'needs_first_run',
      firstRun: expect.objectContaining({
        profileConfigured: false,
        personalizationPending: true,
      }),
      readiness: expect.objectContaining({
        productizationEvidenceLinked: true,
        releasePreviewReady: true,
        firstRunRequired: true,
        handoffToAgentRuntime: false,
      }),
      policy: expect.objectContaining({
        noProfileWritePerformed: true,
        noRuntimePersistentStart: true,
        noProviderExecutionPerformed: true,
        noToolExecutionPerformed: true,
        noMessageSendPerformed: true,
        firstRunStateSharedAcrossSurfaces: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'first-run-profile', status: 'needs-action' }),
      expect.objectContaining({ id: 'productization-evidence', status: 'ready' }),
    ]));
  });

  it('allows handoff to the AgentGateway when first-run and productization are ready', () => {
    const run = createRun({
      firstRunOnboarding: {
        status: 'ready',
        route: '/start',
        summary: { passed: 3 },
        checks: [],
        fixturePath: 'data/first-run.ts',
      },
    });
    run.metadata.productizationEvidence = {
      source: 'ProductizationEvidenceService',
      status: 'ready',
      summary: {
        releasePreviewReady: true,
        stableReleaseAllowed: false,
      },
      releaseReadiness: { status: 'preview-ready' },
    };
    const snapshot = new ProductEntryRuntimeService({
      now: () => new Date('2026-05-04T02:47:00.000Z'),
      firstRunProfileService: {
        buildPlan: () => bootstrapPlan('ready'),
        buildWorkspaceIdentitySnapshot: () => profileSnapshot(true),
        resolvePaths: () => ({ profilePath: 'data/runtime/first-run/profile.json' } as any),
      },
      personalizationService: {
        getStatus: () => personalization(false),
      },
    }).buildSnapshot({ run, generatedAt: run.updatedAt });

    expect(snapshot.status).toBe('handoff_to_agent_runtime');
    expect(snapshot.entry).toEqual(expect.objectContaining({
      handoffTarget: 'ZavorthAgentGateway',
      handoffAllowed: true,
    }));
    expect(snapshot.readiness.canStartAgentRuntime).toBe(true);
    expect(snapshot.nextSafeAction).toContain('ZavorthAgentGateway');
  });
});
