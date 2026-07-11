import type {
  ZavorthDelegatedWorkerBridgeStatus,
} from '../ZavorthDelegatedWorkerBridgeContract.js';

export const ZAVORTH_NATIVE_REPLACEMENT_DECOMMISSION_CONTRACT_VERSION =
  'zavorth-native-replacement-decommission/8' as const;

export type ZavorthNativeReplacementDecommissionStatus =
  | 'native-replacement-decommission-ready'
  | 'attention'
  | 'blocked';

export type ZavorthNativeReplacementDecision =
  | 'promote-native'
  | 'keep-optional-adapter'
  | 'defer'
  | 'reject';

export type ZavorthNativeReplacementRisk =
  | 'low'
  | 'medium'
  | 'high';

export type ZavorthNativeReplacementInput = {
  capabilityId: string;
  capabilityName: string;
  sourcePatternRef: string;
  zavorthNativeOwner: string;
  replacementDecision: ZavorthNativeReplacementDecision;
  consistencyCoveragePercent: number;
  adapterRequiredAfterReplacement: boolean;
  sourceAssumptions: string[];
  acceptanceGate: string;
  risk: ZavorthNativeReplacementRisk;
};

export type ZavorthNativeReplacementRegistryEntry = {
  registryEntryId: string;
  capabilityId: string;
  capabilityName: string;
  sourcePatternRef: string;
  sourcePatternDiagnosticsOnly: true;
  publicName: 'Zavorth';
  zavorthNativeOwner: string;
  replacementDecision: ZavorthNativeReplacementDecision;
  consistencyCoveragePercent: number;
  adapterRequiredAfterReplacement: boolean;
  canRunWithoutSourceRuntime: boolean;
  sourceAssumptions: string[];
  sourceAssumptionCount: number;
  acceptanceGate: string;
  risk: ZavorthNativeReplacementRisk;
  safety: {
    zavorthOwnsImplementation: true;
    sourcePatternNotCanonical: true;
    noSourceRuntimeDependencyWhenPromoted: boolean;
    noAdapterHardDependencyWhenPromoted: boolean;
    publicIdentityChanged: false;
  };
};

export type ZavorthConsistencyScenario = {
  scenarioId: string;
  expectedBehavior: string;
  nativeBehavior: string;
  passed: boolean;
};

export type ZavorthConsistencyTestHarnessReceipt = {
  harnessId: string;
  registryEntryId: string;
  capabilityId: string;
  status: 'passed' | 'attention' | 'failed';
  consistencyCoveragePercent: number;
  canRunNativeWithoutSourceRuntime: boolean;
  sourceRuntimeRequired: false;
  scenarios: ZavorthConsistencyScenario[];
  safety: {
    consistencyFixtureOnly: true;
    noSourceRuntimeCall: true;
    noProviderCall: true;
    noToolExecution: true;
    noFileMutation: true;
  };
};

export type ZavorthAdapterDependencyReductionReceipt = {
  adapterId: string;
  registryEntryId: string;
  capabilityId: string;
  status: 'optionalized' | 'kept-optional' | 'blocked';
  previousDependencyMode: 'required' | 'optional' | 'none';
  nextDependencyMode: 'optional' | 'none';
  adapterRequiredAfter: boolean;
  compatibilityBoundary: 'optional-compatibility-boundary';
  safety: {
    adapterNoLongerKernelDependency: true;
    sourceRuntimeNotRequiredForNativePath: true;
    noSourceRuntimeCodeExecuted: true;
    noPublicIdentityLeak: true;
  };
};

export type ZavorthSourceAssumptionDecommissionReceipt = {
  assumptionId: string;
  registryEntryId: string;
  capabilityId: string;
  sourceAssumption: string;
  status: 'decommissioned' | 'kept-for-compatibility' | 'blocked';
  replacementRef: string;
  compatibilityBoundary: 'zavorth-owned-contract';
  safety: {
    sourceAssumptionNotPublicContract: true;
    zavorthContractOwnsBehavior: true;
    noSourceRuntimeDependency: boolean;
  };
};

export type ZavorthCompatibilityBoundaryReceipt = {
  boundaryId: string;
  status: 'optional-compatibility-ready' | 'blocked';
  publicSurface: 'ZavorthOnly';
  adapterVisibleAsDiagnosticsOnly: true;
  fallbackMode: 'honest-unavailable';
  safety: {
    adaptersRemainOptional: true;
    noAdapterBypass: true;
    noPublicIdentityChange: true;
    noSourceRuntimeLaunch: true;
  };
};

export type ZavorthNativeReplacementZavorthControlProjection = {
  title: 'Native Replacement And Decommission';
  status: ZavorthNativeReplacementDecommissionStatus;
  tone: 'ready' | 'attention' | 'blocked';
  cards: Array<{
    id: string;
    label: string;
    value: string;
    detail: string;
  }>;
  policyPills: string[];
  nextSafeAction: string;
};

export type ZavorthNativeReplacementDecommissionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_NATIVE_REPLACEMENT_DECOMMISSION_CONTRACT_VERSION;
  status: ZavorthNativeReplacementDecommissionStatus;
  planId: 'Zavorth External Runtime Integration';
  gate: 'native-replacement-decommission';
  previousDelegatedWorkerStatus: ZavorthDelegatedWorkerBridgeStatus;
  registryEntries: ZavorthNativeReplacementRegistryEntry[];
  consistencyHarnessReceipts: ZavorthConsistencyTestHarnessReceipt[];
  adapterDependencyReductionReceipts: ZavorthAdapterDependencyReductionReceipt[];
  sourceAssumptionDecommissionReceipts: ZavorthSourceAssumptionDecommissionReceipt[];
  compatibilityBoundaryReceipt: ZavorthCompatibilityBoundaryReceipt;
  zavorthControlProjection: ZavorthNativeReplacementZavorthControlProjection;
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    nativeReplacementRegistryEntries: number;
    promotedNativeCapabilities: number;
    optionalCompatibilityAdapters: number;
    consistencyHarnessesPassed: number;
    adapterDependenciesReduced: number;
    sourceAssumptionsDecommissioned: number;
    compatibilityBoundariesReady: number;
    sourceRuntimeRequiredForPromotedCapabilities: false;
    hardAdapterDependenciesForPromotedCapabilities: 0;
    sourceRuntimeCodeExecuted: false;
    providerCallPerformed: false;
    toolExecutionPerformed: false;
    fileMutationPerformed: false;
  };
  safety: {
    nativeReplacementOnly: true;
    zavorthNativeWithoutSourceRuntime: true;
    adaptersOptionalCompatibilityOnly: true;
    noSourceRuntimeCodeExecuted: true;
    noSourceRuntimeLaunch: true;
    noProviderCallPerformed: true;
    noToolExecutionPerformed: true;
    noFileMutationPerformed: true;
    approvalBypassAllowed: false;
    publicIdentityChanged: false;
  };
  commands: {
    inspect: 'npm run zavorth:native-replacement-decommission';
    inspectJson: 'npm run zavorth:native-replacement-decommission:json';
    check: 'npm run zavorth:native-replacement-decommission:check --silent';
    planStatus: '291 plan complete';
  };
};
