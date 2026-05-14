import {
  ZAVORTH_NATIVE_REPLACEMENT_DECOMMISSION_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthNativeReplacementDecommissionContract.js';
import { ZavorthNativeReplacementDecommissionService } from '../../src/services/ZavorthNativeReplacementDecommissionService.js';

describe('ZavorthNativeReplacementDecommissionService Phase 8', () => {
  it('publishes the native replacement and decommission snapshot after Phase 7 readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T22:50:00.000Z',
      contractVersion: ZAVORTH_NATIVE_REPLACEMENT_DECOMMISSION_CONTRACT_VERSION,
      status: 'native-replacement-decommission-ready',
      planId: '291 - Plano Zavorth External Runtime Absorption',
      phase: 'phase-8-native-replacement-decommission',
      previousDelegatedWorkerStatus: 'delegated-worker-bridge-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      nativeReplacementRegistryEntries: 4,
      promotedNativeCapabilities: 2,
      optionalCompatibilityAdapters: 4,
      parityHarnessesPassed: 4,
      adapterDependenciesReduced: 2,
      sourceAssumptionsDecommissioned: 2,
      compatibilityBoundariesReady: 1,
      sourceRuntimeRequiredForPromotedCapabilities: false,
      hardAdapterDependenciesForPromotedCapabilities: 0,
      sourceRuntimeCodeExecuted: false,
      providerCallPerformed: false,
      toolExecutionPerformed: false,
      fileMutationPerformed: false,
    }));
    expect(snapshot.commands.planStatus).toBe('291 plan complete');
  });

  it('registers promoted native replacements that can run without source runtime', () => {
    const entry = createService().registerNativeReplacement({
      capabilityId: 'error-classifier',
      capabilityName: 'Error Classifier',
      sourcePatternRef: 'diagnostic://error-classifier',
      zavorthNativeOwner: 'ZavorthNativeEngineAbsorptionService',
      replacementDecision: 'promote-native',
      parityCoveragePercent: 97,
      adapterRequiredAfterReplacement: false,
      sourceAssumptions: ['source-error-format'],
      acceptanceGate: 'npm run gate',
      risk: 'low',
    });

    expect(entry).toEqual(expect.objectContaining({
      registryEntryId: 'zavorth.native-replacement.error-classifier',
      capabilityId: 'zavorth.capability.error-classifier',
      sourcePatternDiagnosticsOnly: true,
      publicName: 'Zavorth',
      replacementDecision: 'promote-native',
      parityCoveragePercent: 97,
      adapterRequiredAfterReplacement: false,
      canRunWithoutSourceRuntime: true,
      sourceAssumptionCount: 1,
    }));
    expect(entry.safety).toEqual(expect.objectContaining({
      zavorthOwnsImplementation: true,
      sourcePatternNotCanonical: true,
      noSourceRuntimeDependencyWhenPromoted: true,
      noAdapterHardDependencyWhenPromoted: true,
      publicIdentityChanged: false,
    }));
  });

  it('keeps adapters as optional compatibility boundaries without making them canonical', () => {
    const entry = createService().registerNativeReplacement({
      capabilityId: 'channel-bridge',
      capabilityName: 'Channel Bridge',
      sourcePatternRef: 'diagnostic://channel-bridge',
      zavorthNativeOwner: 'ZavorthChannelMessagingBridgeService',
      replacementDecision: 'keep-optional-adapter',
      parityCoveragePercent: 90,
      adapterRequiredAfterReplacement: false,
      sourceAssumptions: ['source-channel-driver-shape'],
      acceptanceGate: 'npm run channel-gate',
      risk: 'medium',
    });
    const receipt = createService().reduceAdapterDependency(entry);

    expect(entry).toEqual(expect.objectContaining({
      replacementDecision: 'keep-optional-adapter',
      canRunWithoutSourceRuntime: false,
      adapterRequiredAfterReplacement: false,
      publicName: 'Zavorth',
    }));
    expect(receipt).toEqual(expect.objectContaining({
      status: 'kept-optional',
      previousDependencyMode: 'optional',
      nextDependencyMode: 'optional',
      adapterRequiredAfter: false,
      compatibilityBoundary: 'optional-compatibility-boundary',
    }));
    expect(receipt.safety).toEqual(expect.objectContaining({
      adapterNoLongerKernelDependency: true,
      sourceRuntimeNotRequiredForNativePath: true,
      noSourceRuntimeCodeExecuted: true,
      noPublicIdentityLeak: true,
    }));
  });

  it('builds parity harness receipts without calling source runtimes', () => {
    const service = createService();
    const entry = service.buildSnapshot().registryEntries[0];
    const receipt = service.buildParityHarness(entry);

    expect(receipt).toEqual(expect.objectContaining({
      registryEntryId: entry.registryEntryId,
      capabilityId: entry.capabilityId,
      status: 'passed',
      canRunNativeWithoutSourceRuntime: true,
      sourceRuntimeRequired: false,
    }));
    expect(receipt.scenarios).toHaveLength(3);
    expect(receipt.scenarios.every((scenario) => scenario.passed)).toBe(true);
    expect(receipt.safety).toEqual(expect.objectContaining({
      parityFixtureOnly: true,
      noSourceRuntimeCall: true,
      noProviderCall: true,
      noToolExecution: true,
      noFileMutation: true,
    }));
  });

  it('reduces promoted adapter dependencies to none', () => {
    const service = createService();
    const promoted = service.buildSnapshot().registryEntries.find((entry) => entry.replacementDecision === 'promote-native');

    expect(promoted).toBeDefined();
    const receipt = service.reduceAdapterDependency(promoted!);

    expect(receipt).toEqual(expect.objectContaining({
      status: 'optionalized',
      previousDependencyMode: 'required',
      nextDependencyMode: 'none',
      adapterRequiredAfter: false,
      compatibilityBoundary: 'optional-compatibility-boundary',
    }));
  });

  it('decommissions promoted source assumptions and quarantines optional ones', () => {
    const service = createService();
    const snapshot = service.buildSnapshot();
    const promoted = snapshot.registryEntries.find((entry) => entry.replacementDecision === 'promote-native')!;
    const optional = snapshot.registryEntries.find((entry) => entry.replacementDecision === 'keep-optional-adapter')!;

    const promotedReceipt = service.decommissionSourceAssumption(promoted, promoted.sourceAssumptions[0]);
    const optionalReceipt = service.decommissionSourceAssumption(optional, optional.sourceAssumptions[0]);

    expect(promotedReceipt).toEqual(expect.objectContaining({
      status: 'decommissioned',
      compatibilityBoundary: 'zavorth-owned-contract',
    }));
    expect(promotedReceipt.safety).toEqual(expect.objectContaining({
      sourceAssumptionNotPublicContract: true,
      zavorthContractOwnsBehavior: true,
      noSourceRuntimeDependency: true,
    }));
    expect(optionalReceipt).toEqual(expect.objectContaining({
      status: 'kept-for-compatibility',
      compatibilityBoundary: 'zavorth-owned-contract',
    }));
  });

  it('builds an optional compatibility boundary for adapters', () => {
    const service = createService();
    const snapshot = service.buildSnapshot();
    const boundary = service.buildCompatibilityBoundary(snapshot.adapterDependencyReductionReceipts);

    expect(boundary).toEqual(expect.objectContaining({
      boundaryId: 'zavorth.compatibility.optional-source-adapters',
      status: 'optional-compatibility-ready',
      publicSurface: 'ZavorthOnly',
      adapterVisibleAsDiagnosticsOnly: true,
      fallbackMode: 'honest-unavailable',
    }));
    expect(boundary.safety).toEqual(expect.objectContaining({
      adaptersRemainOptional: true,
      noAdapterBypass: true,
      noPublicIdentityChange: true,
      noSourceRuntimeLaunch: true,
    }));
  });

  it('projects native replacement closure for Command Center', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.commandCenterProjection).toEqual(expect.objectContaining({
      title: 'Native Replacement And Decommission',
      status: 'native-replacement-decommission-ready',
      tone: 'ready',
      policyPills: expect.arrayContaining([
        'native replacement registry',
        'parity tests',
        'adapter dependency reduction',
        'decommission gates',
        'optional compatibility boundaries',
        'Zavorth-only public surface',
      ]),
      nextSafeAction: 'Plan 291 is complete; proceed only with a new live activation or hardening plan.',
    }));
    expect(snapshot.commandCenterProjection.cards.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'registry',
      'promoted',
      'parity',
      'adapters',
      'assumptions',
      'boundary',
      'plan',
    ]));
  });

  it('blocks Phase 8 if Phase 7 delegated workers are not ready', () => {
    const snapshot = createService().buildSnapshot({ delegatedWorkerStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousDelegatedWorkerStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'phase-7-delegated-workers-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for plan closure', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Native Replacement Decommission - Phase 8');
    expect(text).toContain('Status: native-replacement-decommission-ready');
    expect(text).toContain('Promoted native capabilities: 2');
    expect(text).toContain('Source runtime required for promoted capabilities: false');
    expect(text).toContain('Hard adapter dependencies for promoted capabilities: 0');
    expect(text).toContain('Plan: 291 plan complete');
  });
});

function createService(): ZavorthNativeReplacementDecommissionService {
  return new ZavorthNativeReplacementDecommissionService({
    now: () => new Date('2026-05-11T22:50:00.000Z'),
    delegatedWorkerStatus: 'delegated-worker-bridge-ready',
  });
}
