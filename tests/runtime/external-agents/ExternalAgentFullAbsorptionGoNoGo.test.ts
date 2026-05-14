import {
  type ExternalAgentAbsorptionImplementationItem,
  type ExternalAgentAbsorptionWave,
  type ExternalAgentPublicProductHardeningReport,
  evaluateExternalAgentFullAbsorptionGoNoGo,
} from '../../../src/runtime/external-agents/index.js';

function createPassingHardeningReport(): ExternalAgentPublicProductHardeningReport {
  return {
    version: 'external-agent-public-product-hardening-report/v1',
    status: 'pass',
    generatedAt: '2026-04-28T03:00:00.000Z',
    surfaceScan: {
      checked: 12,
      canonicalLeaks: [],
      compatibilityMentions: [],
    },
    capabilityMatrix: {
      total: 8,
      complete: true,
      findings: [],
    },
    checklist: {
      total: 6,
      passed: 6,
      blocked: 0,
      missingCategories: [],
    },
    commandCenter: {
      primarySurface: true,
      workflowCoveragePassed: true,
      identityLeakScanPassed: true,
      cloneIndicators: [],
    },
    guarantee: {
      publicCanonicalSurfacesZavorthNative: true,
      everyAdoptedCapabilityHasCoverage: true,
      releaseChecklistComplete: true,
      securityReviewComplete: true,
      commandCenterIsPrimaryProductSurface: true,
    },
  };
}

function createItems(): ExternalAgentAbsorptionImplementationItem[] {
  return [
    {
      id: 'gateway-event-normalization',
      label: 'Gateway event normalization',
      sourceArea: 'Gateway control plane',
      sourcePaths: ['src/gateway', 'src/gateway/protocol'],
      capability: 'External events enter Zavorth as normalized messages.',
      decision: 'adapt',
      risk: 'high',
      owner: 'zavorth-runtime',
      zavorthContract: 'NormalizedInboundMessage',
      implementationPath: 'src/runtime/external-agents/ExternalAgentSidecarAdapter.ts',
      acceptanceCriteria: ['External gateway event maps to NormalizedInboundMessage.'],
      testsOrSmokes: ['tests/runtime/external-agents/ExternalAgentAdapterContract.test.ts'],
      commandCenterObservable: true,
      rollbackBoundary: 'Disable external adapter fixture and keep ZavorthAgentGateway direct surfaces.',
      status: 'ready',
    },
    {
      id: 'capability-policy',
      label: 'Capability policy',
      sourceArea: 'Plugin capability model',
      sourcePaths: ['src/plugins', 'src/plugin-sdk', 'extensions/*'],
      capability: 'Capability metadata becomes Zavorth policy input.',
      decision: 'adapt',
      risk: 'high',
      owner: 'zavorth-security',
      zavorthContract: 'ToolExposurePolicyInput',
      implementationPath: 'src/runtime/external-agents/ExternalAgentCapabilityProvider.ts',
      acceptanceCriteria: ['Imported tools remain blocked or approval-gated.'],
      testsOrSmokes: ['tests/runtime/external-agents/ExternalAgentCapabilityProviderPhase4.test.ts'],
      commandCenterObservable: true,
      rollbackBoundary: 'Capability provider can be disabled without disabling Zavorth tools.',
      status: 'ready',
    },
    {
      id: 'command-center-assimilation',
      label: 'Command Center assimilation',
      sourceArea: 'Dashboard/control UI',
      sourcePaths: ['src/gateway/control-ui', 'src/gateway/server-methods'],
      capability: 'External state appears as Zavorth Command Center view models.',
      decision: 'replace',
      risk: 'high',
      owner: 'zavorth-command-center',
      zavorthContract: 'ZavorthCommandCenterAssimilationSnapshot',
      implementationPath: 'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthCommandCenterAssimilationProjection.ts',
      acceptanceCriteria: ['Ordinary-user workflows render without source dashboard UI types.'],
      testsOrSmokes: ['tests/ai-gateway/control/CommandCenterAssimilationPhase7.test.ts'],
      commandCenterObservable: true,
      rollbackBoundary: 'Keep existing CommandCenterRuntimeProjection route and remove assimilation source input.',
      status: 'ready',
    },
    {
      id: 'remote-workers',
      label: 'Remote workers',
      sourceArea: 'Nodes and companion devices',
      sourcePaths: ['src/node-host', 'apps/{macos,ios,android}'],
      capability: 'Existing endpoints are modeled as Zavorth remote workers.',
      decision: 'externalize',
      risk: 'high',
      owner: 'zavorth-runtime',
      zavorthContract: 'ExternalAgentRemoteWorkerDescriptor',
      implementationPath: 'src/runtime/external-agents/ExternalAgentWorkerBridge.ts',
      acceptanceCriteria: ['Worker status, timeout, cancellation, and artifacts are visible.'],
      testsOrSmokes: ['tests/runtime/external-agents/ExternalAgentWorkerBridgePhase8.test.ts'],
      commandCenterObservable: true,
      rollbackBoundary: 'External worker descriptors can be withheld from Command Center projection.',
      healthAndFailureModel: 'ExternalAgentNodeDaemonHealthSnapshot plus ExternalAgentWorkerStatusSnapshot.',
      sourceRuntimeRequired: true,
      status: 'ready',
    },
    {
      id: 'source-branding',
      label: 'Source runtime branding',
      sourceArea: 'Branding/assets',
      sourcePaths: ['README.md', 'docs', 'assets'],
      capability: 'Product identity and branding assets.',
      decision: 'reject',
      risk: 'medium',
      owner: 'compatibility',
      zavorthContract: 'n/a',
      implementationPath: 'n/a',
      acceptanceCriteria: ['Source branding appears only in compatibility/evidence surfaces.'],
      testsOrSmokes: [],
      commandCenterObservable: false,
      rollbackBoundary: 'No adoption path.',
      rejectReason: 'Branding is not a capability and must not become Zavorth identity.',
      status: 'ready',
    },
  ];
}

function createWaves(): ExternalAgentAbsorptionWave[] {
  return [
    {
      id: 'wave-1-contract-backed-adapters',
      label: 'Contract-backed adapters',
      itemIds: ['gateway-event-normalization', 'capability-policy'],
      gate: 'All imported input reaches Zavorth contracts and policy first.',
    },
    {
      id: 'wave-2-command-center-and-workers',
      label: 'Command Center and externalized workers',
      itemIds: ['command-center-assimilation', 'remote-workers'],
      gate: 'Command Center shows integrated capability state without source runtime UI dependency.',
    },
    {
      id: 'wave-3-rejections-and-cleanup',
      label: 'Rejected identity cleanup',
      itemIds: ['source-branding'],
      gate: 'Rejected identity remains quarantined as compatibility evidence only.',
    },
  ];
}

describe('external agent full absorption go/no-go', () => {
  it('returns go when the post-Phase-10 guarantee gate is satisfied', () => {
    const report = evaluateExternalAgentFullAbsorptionGoNoGo({
      items: createItems(),
      publicHardeningReport: createPassingHardeningReport(),
      commandCenterIntegratedCapabilityState: true,
      sourceRuntimeOptionalByDefault: true,
      sourceModulesCopied: false,
      waves: createWaves(),
    }, {
      now: () => new Date('2026-04-28T03:01:00.000Z'),
    });

    expect(report).toEqual(expect.objectContaining({
      version: 'external-agent-full-absorption-go-no-go/v1',
      status: 'go',
      summary: {
        totalItems: 5,
        readyItems: 5,
        blockedItems: 0,
        deferredItems: 0,
        waves: 3,
      },
      guaranteeGate: {
        everyInventoryItemHasDecision: true,
        adoptedItemsHaveTestsOrSmokes: true,
        externalizedItemsHaveHealthModel: true,
        rejectedItemsHaveReason: true,
        publicCanonicalSurfacesZavorthNative: true,
        commandCenterCanShowIntegratedCapabilityState: true,
        sourceRuntimeOptionalByDefault: true,
        sourceModulesCopied: false,
      },
      findings: [],
    }));
  });

  it('blocks when adopted, externalized, rejected, or wave items are incomplete', () => {
    const items = createItems();
    items[0] = {
      ...items[0],
      decision: null,
      testsOrSmokes: [],
    };
    items[3] = {
      ...items[3],
      healthAndFailureModel: '',
    };
    items[4] = {
      ...items[4],
      rejectReason: '',
    };
    const report = evaluateExternalAgentFullAbsorptionGoNoGo({
      items,
      publicHardeningReport: createPassingHardeningReport(),
      commandCenterIntegratedCapabilityState: true,
      sourceRuntimeOptionalByDefault: true,
      sourceModulesCopied: false,
      waves: [
        {
          id: 'bad-wave',
          label: 'Bad wave',
          itemIds: ['unknown-item'],
          gate: '',
        },
      ],
    });

    expect(report.status).toBe('blocked');
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: 'gateway-event-normalization',
        reason: 'Inventory item needs an absorption decision.',
      }),
      expect.objectContaining({
        itemId: 'remote-workers',
        reason: 'Externalized item requires a health and failure model.',
      }),
      expect.objectContaining({
        itemId: 'source-branding',
        reason: 'Rejected item requires a reason.',
      }),
      expect.objectContaining({
        reason: 'Wave bad-wave requires an exit gate.',
      }),
      expect.objectContaining({
        itemId: 'unknown-item',
        reason: 'Wave bad-wave references an unknown inventory item.',
      }),
    ]));
  });

  it('blocks if public hardening, Command Center, source-runtime independence, or copy rules regress', () => {
    const hardening = createPassingHardeningReport();
    const report = evaluateExternalAgentFullAbsorptionGoNoGo({
      items: createItems(),
      publicHardeningReport: {
        ...hardening,
        status: 'blocked',
        guarantee: {
          ...hardening.guarantee,
          publicCanonicalSurfacesZavorthNative: false,
        },
      },
      commandCenterIntegratedCapabilityState: false,
      sourceRuntimeOptionalByDefault: false,
      sourceModulesCopied: true,
      waves: createWaves(),
    });

    expect(report.status).toBe('blocked');
    expect(report.guaranteeGate).toEqual(expect.objectContaining({
      publicCanonicalSurfacesZavorthNative: false,
      commandCenterCanShowIntegratedCapabilityState: false,
      sourceRuntimeOptionalByDefault: false,
      sourceModulesCopied: false,
    }));
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'Public product hardening report must pass before full absorption starts.',
      }),
      expect.objectContaining({
        reason: 'Command Center must show integrated capability state before full absorption starts.',
      }),
      expect.objectContaining({
        reason: 'Zavorth must be able to operate without the source runtime by default.',
      }),
      expect.objectContaining({
        reason: 'Full absorption kickoff cannot begin from copied source modules.',
      }),
    ]));
  });
});
