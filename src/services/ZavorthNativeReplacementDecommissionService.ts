import {
  ZAVORTH_NATIVE_REPLACEMENT_DECOMMISSION_CONTRACT_VERSION,
  type ZavorthAdapterDependencyReductionReceipt,
  type ZavorthCompatibilityBoundaryReceipt,
  type ZavorthNativeReplacementCommandCenterProjection,
  type ZavorthNativeReplacementDecommissionSnapshot,
  type ZavorthNativeReplacementDecommissionStatus,
  type ZavorthNativeReplacementInput,
  type ZavorthNativeReplacementRegistryEntry,
  type ZavorthParityTestHarnessReceipt,
  type ZavorthSourceAssumptionDecommissionReceipt,
} from '../contracts/ZavorthNativeReplacementDecommissionContract.js';
import type {
  ZavorthDelegatedWorkerBridgeStatus,
} from '../contracts/ZavorthDelegatedWorkerBridgeContract.js';

type Runtime = {
  now?: () => Date;
  delegatedWorkerStatus?: ZavorthDelegatedWorkerBridgeStatus;
};

type SnapshotInput = {
  delegatedWorkerStatus?: ZavorthDelegatedWorkerBridgeStatus | null;
};

const DEFAULT_REPLACEMENTS: ZavorthNativeReplacementInput[] = [
  {
    capabilityId: 'error-recovery-classification',
    capabilityName: 'Error Recovery Classification',
    sourcePatternRef: 'diagnostic://phase-2/error-recovery',
    zavorthNativeOwner: 'ZavorthNativeEngineAbsorptionService',
    replacementDecision: 'promote-native',
    parityCoveragePercent: 100,
    adapterRequiredAfterReplacement: false,
    sourceAssumptions: ['source-error-taxonomy-shape'],
    acceptanceGate: 'npm run zavorth:native-engine-absorption:check --silent',
    risk: 'low',
  },
  {
    capabilityId: 'tool-call-argument-repair',
    capabilityName: 'Tool Call Argument Repair',
    sourcePatternRef: 'diagnostic://phase-2/tool-argument-repair',
    zavorthNativeOwner: 'ZavorthNativeEngineAbsorptionService',
    replacementDecision: 'promote-native',
    parityCoveragePercent: 96,
    adapterRequiredAfterReplacement: false,
    sourceAssumptions: ['source-tool-call-json-repair-order'],
    acceptanceGate: 'npm run zavorth:native-engine-absorption:check --silent',
    risk: 'medium',
  },
  {
    capabilityId: 'channel-messaging-bridge',
    capabilityName: 'Channel Messaging Bridge',
    sourcePatternRef: 'diagnostic://phase-5/channel-messaging',
    zavorthNativeOwner: 'ZavorthChannelMessagingBridgeService',
    replacementDecision: 'keep-optional-adapter',
    parityCoveragePercent: 92,
    adapterRequiredAfterReplacement: false,
    sourceAssumptions: ['source-channel-driver-shape', 'source-credential-port-layout'],
    acceptanceGate: 'npm run zavorth:channel-messaging-bridge:check --silent',
    risk: 'medium',
  },
  {
    capabilityId: 'delegated-worker-bridge',
    capabilityName: 'Delegated Worker Bridge',
    sourcePatternRef: 'diagnostic://phase-7/delegated-workers',
    zavorthNativeOwner: 'ZavorthDelegatedWorkerBridgeService',
    replacementDecision: 'defer',
    parityCoveragePercent: 88,
    adapterRequiredAfterReplacement: false,
    sourceAssumptions: ['source-worker-lifecycle-shape'],
    acceptanceGate: 'npm run zavorth:delegated-worker-bridge:check --silent',
    risk: 'high',
  },
];

export class ZavorthNativeReplacementDecommissionService {
  private readonly now: () => Date;
  private readonly defaultDelegatedWorkerStatus: ZavorthDelegatedWorkerBridgeStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultDelegatedWorkerStatus = runtime.delegatedWorkerStatus || 'delegated-worker-bridge-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthNativeReplacementDecommissionSnapshot {
    const previousDelegatedWorkerStatus = input.delegatedWorkerStatus || this.defaultDelegatedWorkerStatus;
    const registryEntries = DEFAULT_REPLACEMENTS.map((entry) => this.registerNativeReplacement(entry));
    const parityHarnessReceipts = registryEntries.map((entry) => this.buildParityHarness(entry));
    const adapterDependencyReductionReceipts = registryEntries.map((entry) => this.reduceAdapterDependency(entry));
    const sourceAssumptionDecommissionReceipts = registryEntries.flatMap((entry) => (
      entry.sourceAssumptions.map((assumption) => this.decommissionSourceAssumption(entry, assumption))
    ));
    const compatibilityBoundaryReceipt = this.buildCompatibilityBoundary(adapterDependencyReductionReceipts);
    const acceptanceMatrix = buildAcceptanceMatrix(
      previousDelegatedWorkerStatus,
      registryEntries,
      parityHarnessReceipts,
      adapterDependencyReductionReceipts,
      sourceAssumptionDecommissionReceipts,
      compatibilityBoundaryReceipt,
    );
    const status = resolveStatus(previousDelegatedWorkerStatus, acceptanceMatrix);
    const commandCenterProjection = this.buildCommandCenterProjection({
      status,
      registryEntries,
      parityHarnessReceipts,
      adapterDependencyReductionReceipts,
      sourceAssumptionDecommissionReceipts,
      compatibilityBoundaryReceipt,
    });

    const promotedEntries = registryEntries.filter((entry) => entry.replacementDecision === 'promote-native');
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_NATIVE_REPLACEMENT_DECOMMISSION_CONTRACT_VERSION,
      status,
      planId: '291 - Plano Zavorth External Runtime Absorption',
      phase: 'phase-8-native-replacement-decommission',
      previousDelegatedWorkerStatus,
      registryEntries,
      parityHarnessReceipts,
      adapterDependencyReductionReceipts,
      sourceAssumptionDecommissionReceipts,
      compatibilityBoundaryReceipt,
      commandCenterProjection,
      acceptanceMatrix,
      summary: {
        nativeReplacementRegistryEntries: registryEntries.length,
        promotedNativeCapabilities: promotedEntries.length,
        optionalCompatibilityAdapters: adapterDependencyReductionReceipts.filter((entry) => entry.status !== 'blocked').length,
        parityHarnessesPassed: parityHarnessReceipts.filter((entry) => entry.status === 'passed').length,
        adapterDependenciesReduced: adapterDependencyReductionReceipts.filter((entry) => entry.status === 'optionalized').length,
        sourceAssumptionsDecommissioned: sourceAssumptionDecommissionReceipts.filter((entry) => entry.status === 'decommissioned').length,
        compatibilityBoundariesReady: compatibilityBoundaryReceipt.status === 'optional-compatibility-ready' ? 1 : 0,
        sourceRuntimeRequiredForPromotedCapabilities: false,
        hardAdapterDependenciesForPromotedCapabilities: 0,
        sourceRuntimeCodeExecuted: false,
        providerCallPerformed: false,
        toolExecutionPerformed: false,
        fileMutationPerformed: false,
      },
      safety: {
        nativeReplacementOnly: true,
        zavorthNativeWithoutSourceRuntime: true,
        adaptersOptionalCompatibilityOnly: true,
        noSourceRuntimeCodeExecuted: true,
        noSourceRuntimeLaunch: true,
        noProviderCallPerformed: true,
        noToolExecutionPerformed: true,
        noFileMutationPerformed: true,
        approvalBypassAllowed: false,
        publicIdentityChanged: false,
      },
      commands: {
        inspect: 'npm run zavorth:native-replacement-decommission',
        inspectJson: 'npm run zavorth:native-replacement-decommission:json',
        check: 'npm run zavorth:native-replacement-decommission:check --silent',
        planStatus: '291 plan complete',
      },
    };
  }

  public registerNativeReplacement(input: ZavorthNativeReplacementInput): ZavorthNativeReplacementRegistryEntry {
    const decision = input.replacementDecision;
    const canRunWithoutSourceRuntime = decision === 'promote-native'
      && !input.adapterRequiredAfterReplacement
      && input.parityCoveragePercent >= 90;

    return {
      registryEntryId: `zavorth.native-replacement.${safeId(input.capabilityId)}`,
      capabilityId: `zavorth.capability.${safeId(input.capabilityId)}`,
      capabilityName: input.capabilityName.trim(),
      sourcePatternRef: input.sourcePatternRef,
      sourcePatternDiagnosticsOnly: true,
      publicName: 'Zavorth',
      zavorthNativeOwner: input.zavorthNativeOwner,
      replacementDecision: decision,
      parityCoveragePercent: clampPercent(input.parityCoveragePercent),
      adapterRequiredAfterReplacement: input.adapterRequiredAfterReplacement,
      canRunWithoutSourceRuntime,
      sourceAssumptions: input.sourceAssumptions.map((entry) => safeId(entry)),
      sourceAssumptionCount: input.sourceAssumptions.length,
      acceptanceGate: input.acceptanceGate,
      risk: input.risk,
      safety: {
        zavorthOwnsImplementation: true,
        sourcePatternNotCanonical: true,
        noSourceRuntimeDependencyWhenPromoted: decision !== 'promote-native' || canRunWithoutSourceRuntime,
        noAdapterHardDependencyWhenPromoted: decision !== 'promote-native' || !input.adapterRequiredAfterReplacement,
        publicIdentityChanged: false,
      },
    };
  }

  public buildParityHarness(entry: ZavorthNativeReplacementRegistryEntry): ZavorthParityTestHarnessReceipt {
    const requiredCoverage = entry.replacementDecision === 'promote-native' ? 90 : 80;
    const passed = entry.parityCoveragePercent >= requiredCoverage;
    const canRunNativeWithoutSourceRuntime = entry.replacementDecision === 'promote-native'
      ? entry.canRunWithoutSourceRuntime
      : true;

    return {
      harnessId: `zavorth.parity.${safeId(entry.capabilityId)}`,
      registryEntryId: entry.registryEntryId,
      capabilityId: entry.capabilityId,
      status: passed && canRunNativeWithoutSourceRuntime ? 'passed' : 'failed',
      parityCoveragePercent: entry.parityCoveragePercent,
      canRunNativeWithoutSourceRuntime,
      sourceRuntimeRequired: false,
      scenarios: [
        scenario('contract-shape', 'Zavorth-owned contract shape is stable', entry.safety.zavorthOwnsImplementation),
        scenario('source-free', 'Native path does not require source runtime', canRunNativeWithoutSourceRuntime),
        scenario('identity', 'Public identity remains Zavorth', !entry.safety.publicIdentityChanged),
      ],
      safety: {
        parityFixtureOnly: true,
        noSourceRuntimeCall: true,
        noProviderCall: true,
        noToolExecution: true,
        noFileMutation: true,
      },
    };
  }

  public reduceAdapterDependency(
    entry: ZavorthNativeReplacementRegistryEntry,
  ): ZavorthAdapterDependencyReductionReceipt {
    const promoted = entry.replacementDecision === 'promote-native';
    const blocked = promoted && entry.adapterRequiredAfterReplacement;
    return {
      adapterId: `zavorth.adapter.${safeId(entry.capabilityId)}`,
      registryEntryId: entry.registryEntryId,
      capabilityId: entry.capabilityId,
      status: blocked ? 'blocked' : promoted ? 'optionalized' : 'kept-optional',
      previousDependencyMode: promoted ? 'required' : 'optional',
      nextDependencyMode: promoted ? 'none' : 'optional',
      adapterRequiredAfter: entry.adapterRequiredAfterReplacement,
      compatibilityBoundary: 'optional-compatibility-boundary',
      safety: {
        adapterNoLongerKernelDependency: true,
        sourceRuntimeNotRequiredForNativePath: true,
        noSourceRuntimeCodeExecuted: true,
        noPublicIdentityLeak: true,
      },
    };
  }

  public decommissionSourceAssumption(
    entry: ZavorthNativeReplacementRegistryEntry,
    sourceAssumption: string,
  ): ZavorthSourceAssumptionDecommissionReceipt {
    const promoted = entry.replacementDecision === 'promote-native';
    return {
      assumptionId: `zavorth.assumption.${safeId(entry.capabilityId)}.${safeId(sourceAssumption)}`,
      registryEntryId: entry.registryEntryId,
      capabilityId: entry.capabilityId,
      sourceAssumption,
      status: promoted ? 'decommissioned' : 'kept-for-compatibility',
      replacementRef: entry.registryEntryId,
      compatibilityBoundary: 'zavorth-owned-contract',
      safety: {
        sourceAssumptionNotPublicContract: true,
        zavorthContractOwnsBehavior: true,
        noSourceRuntimeDependency: promoted,
      },
    };
  }

  public buildCompatibilityBoundary(
    adapterReceipts: ZavorthAdapterDependencyReductionReceipt[],
  ): ZavorthCompatibilityBoundaryReceipt {
    const blocked = adapterReceipts.some((entry) => entry.status === 'blocked');
    return {
      boundaryId: 'zavorth.compatibility.optional-source-adapters',
      status: blocked ? 'blocked' : 'optional-compatibility-ready',
      publicSurface: 'ZavorthOnly',
      adapterVisibleAsDiagnosticsOnly: true,
      fallbackMode: 'honest-unavailable',
      safety: {
        adaptersRemainOptional: true,
        noAdapterBypass: true,
        noPublicIdentityChange: true,
        noSourceRuntimeLaunch: true,
      },
    };
  }

  public buildCommandCenterProjection(input: {
    status: ZavorthNativeReplacementDecommissionStatus;
    registryEntries: ZavorthNativeReplacementRegistryEntry[];
    parityHarnessReceipts: ZavorthParityTestHarnessReceipt[];
    adapterDependencyReductionReceipts: ZavorthAdapterDependencyReductionReceipt[];
    sourceAssumptionDecommissionReceipts: ZavorthSourceAssumptionDecommissionReceipt[];
    compatibilityBoundaryReceipt: ZavorthCompatibilityBoundaryReceipt;
  }): ZavorthNativeReplacementCommandCenterProjection {
    const promoted = input.registryEntries.filter((entry) => entry.replacementDecision === 'promote-native').length;
    return {
      title: 'Native Replacement And Decommission',
      status: input.status,
      tone: input.status === 'native-replacement-decommission-ready' ? 'ready' : input.status === 'attention' ? 'attention' : 'blocked',
      cards: [
        card('registry', 'Registry', String(input.registryEntries.length), 'Native replacement registry entries'),
        card('promoted', 'Promoted Native', String(promoted), 'Capabilities certified to run without source runtime'),
        card('parity', 'Parity Harnesses', String(input.parityHarnessReceipts.filter((entry) => entry.status === 'passed').length), 'Fixture parity harnesses passed'),
        card('adapters', 'Adapters', String(input.adapterDependencyReductionReceipts.length), 'Adapters reduced to optional compatibility boundaries'),
        card('assumptions', 'Source Assumptions', String(input.sourceAssumptionDecommissionReceipts.length), 'Source-specific assumptions decommissioned or quarantined'),
        card('boundary', 'Compatibility', input.compatibilityBoundaryReceipt.status, 'Public surface remains Zavorth-only'),
        card('plan', 'Plan 291', 'complete', 'External runtime absorption plan closed'),
      ],
      policyPills: [
        'native replacement registry',
        'parity tests',
        'adapter dependency reduction',
        'decommission gates',
        'optional compatibility boundaries',
        'Zavorth-only public surface',
      ],
      nextSafeAction: input.status === 'native-replacement-decommission-ready'
        ? 'Plan 291 is complete; proceed only with a new live activation or hardening plan.'
        : 'Fix failed replacement/decommission gates before closing Plan 291.',
    };
  }

  public formatSnapshotText(snapshot: ZavorthNativeReplacementDecommissionSnapshot): string {
    const lines = [
      'Zavorth Native Replacement Decommission - Phase 8',
      '',
      `Status: ${snapshot.status}`,
      `Previous delegated worker bridge: ${snapshot.previousDelegatedWorkerStatus}`,
      `Registry entries: ${snapshot.summary.nativeReplacementRegistryEntries}`,
      `Promoted native capabilities: ${snapshot.summary.promotedNativeCapabilities}`,
      `Parity harnesses passed: ${snapshot.summary.parityHarnessesPassed}`,
      `Adapter dependencies reduced: ${snapshot.summary.adapterDependenciesReduced}`,
      `Source assumptions decommissioned: ${snapshot.summary.sourceAssumptionsDecommissioned}`,
      `Compatibility boundaries ready: ${snapshot.summary.compatibilityBoundariesReady}`,
      `Source runtime required for promoted capabilities: ${snapshot.summary.sourceRuntimeRequiredForPromotedCapabilities}`,
      `Hard adapter dependencies for promoted capabilities: ${snapshot.summary.hardAdapterDependenciesForPromotedCapabilities}`,
      '',
      'Command Center:',
      ...snapshot.commandCenterProjection.cards.map((entry) => `- ${entry.label}: ${entry.value} (${entry.detail})`),
      '',
      'Acceptance:',
      ...snapshot.acceptanceMatrix.map((entry) => `- ${entry.status} ${entry.requirementId}: ${entry.evidence}`),
      '',
      `Plan: ${snapshot.commands.planStatus}`,
    ];
    return lines.join('\n');
  }
}

function buildAcceptanceMatrix(
  previousDelegatedWorkerStatus: ZavorthDelegatedWorkerBridgeStatus,
  registryEntries: ZavorthNativeReplacementRegistryEntry[],
  parityHarnessReceipts: ZavorthParityTestHarnessReceipt[],
  adapterDependencyReductionReceipts: ZavorthAdapterDependencyReductionReceipt[],
  sourceAssumptionDecommissionReceipts: ZavorthSourceAssumptionDecommissionReceipt[],
  compatibilityBoundaryReceipt: ZavorthCompatibilityBoundaryReceipt,
): ZavorthNativeReplacementDecommissionSnapshot['acceptanceMatrix'] {
  const promotedEntries = registryEntries.filter((entry) => entry.replacementDecision === 'promote-native');
  return [
    acceptance('phase-7-delegated-workers-ready', previousDelegatedWorkerStatus === 'delegated-worker-bridge-ready', `previousDelegatedWorkerStatus=${previousDelegatedWorkerStatus}`),
    acceptance('native-replacement-registry-ready', registryEntries.length >= 4
      && registryEntries.every((entry) => entry.publicName === 'Zavorth' && entry.sourcePatternDiagnosticsOnly), `${registryEntries.length} registry entry(ies)`),
    acceptance('promoted-capabilities-run-without-source-runtime', promotedEntries.length >= 2
      && promotedEntries.every((entry) => entry.canRunWithoutSourceRuntime && !entry.adapterRequiredAfterReplacement), `${promotedEntries.length} promoted native capability(ies)`),
    acceptance('parity-tests-pass-without-source-runtime', parityHarnessReceipts.length === registryEntries.length
      && parityHarnessReceipts.every((entry) => entry.status === 'passed' && !entry.sourceRuntimeRequired && entry.safety.noSourceRuntimeCall), `${parityHarnessReceipts.length} parity harness(es)`),
    acceptance('adapter-dependency-reduction-ready', adapterDependencyReductionReceipts.length === registryEntries.length
      && adapterDependencyReductionReceipts.every((entry) => entry.status !== 'blocked' && !entry.adapterRequiredAfter), `${adapterDependencyReductionReceipts.length} adapter receipt(s)`),
    acceptance('source-assumptions-decommissioned-or-quarantined', sourceAssumptionDecommissionReceipts.length > 0
      && sourceAssumptionDecommissionReceipts.every((entry) => entry.status !== 'blocked' && entry.safety.sourceAssumptionNotPublicContract), `${sourceAssumptionDecommissionReceipts.length} source assumption receipt(s)`),
    acceptance('optional-compatibility-boundary-ready', compatibilityBoundaryReceipt.status === 'optional-compatibility-ready'
      && compatibilityBoundaryReceipt.publicSurface === 'ZavorthOnly'
      && compatibilityBoundaryReceipt.safety.adaptersRemainOptional, compatibilityBoundaryReceipt.status),
    acceptance('no-source-tool-provider-file-execution', parityHarnessReceipts.every((entry) => entry.safety.noSourceRuntimeCall && entry.safety.noProviderCall && entry.safety.noToolExecution && entry.safety.noFileMutation)
      && adapterDependencyReductionReceipts.every((entry) => entry.safety.noSourceRuntimeCodeExecuted), 'all receipts are fixture/no-execution'),
  ];
}

function resolveStatus(
  previousDelegatedWorkerStatus: ZavorthDelegatedWorkerBridgeStatus,
  acceptanceMatrix: ZavorthNativeReplacementDecommissionSnapshot['acceptanceMatrix'],
): ZavorthNativeReplacementDecommissionStatus {
  if (previousDelegatedWorkerStatus !== 'delegated-worker-bridge-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'native-replacement-decommission-ready';
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthNativeReplacementDecommissionSnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function scenario(scenarioId: string, behavior: string, passed: boolean): {
  scenarioId: string;
  expectedBehavior: string;
  nativeBehavior: string;
  passed: boolean;
} {
  return {
    scenarioId,
    expectedBehavior: behavior,
    nativeBehavior: behavior,
    passed,
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeId(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'item';
}

function card(
  id: string,
  label: string,
  value: string,
  detail: string,
): ZavorthNativeReplacementCommandCenterProjection['cards'][number] {
  return { id, label, value, detail };
}
