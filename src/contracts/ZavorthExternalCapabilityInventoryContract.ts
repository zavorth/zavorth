import type {
  ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION,
  ZavorthExternalRuntimeBridgePhase,
  ZavorthExternalRuntimeCapabilityId,
  ZavorthExternalRuntimeDecision,
  ZavorthExternalRuntimeNaturalFirstRoute,
  ZavorthExternalRuntimeSourceRuntimeId,
} from './ZavorthExternalRuntimeBridgeContract.js';

export type ZavorthExternalCapabilityInventoryProbeRuntimeId =
  | ZavorthExternalRuntimeSourceRuntimeId
  | 'acp-compatibility-fixture';

export const ZAVORTH_EXTERNAL_CAPABILITY_INVENTORY_CONTRACT_VERSION =
  'zavorth-external-capability-inventory/0' as const;

export type ZavorthExternalCapabilityInventoryStatus =
  | 'inventory-ready'
  | 'attention'
  | 'blocked';

export type ZavorthExternalCapabilityInventoryRisk =
  | 'low'
  | 'medium'
  | 'high'
  | 'blocked';

export type ZavorthExternalCapabilityInventorySourceProbe = {
  runtimeId: ZavorthExternalCapabilityInventoryProbeRuntimeId;
  label: string;
  rootPath: string;
  required: boolean;
  present: boolean;
  availability: 'source-present' | 'docs-only' | 'missing';
  expectedPaths: Array<{
    path: string;
    present: boolean;
    purpose: string;
  }>;
  evidenceDocs: string[];
  observedTopLevel: {
    files: number;
    dirs: number;
    names: string[];
  };
  safety: {
    readOnlyProbe: true;
    noSourceRuntimeCodeExecuted: true;
    noDependencyInstall: true;
    noSidecarStarted: true;
    noToolExposed: true;
  };
};

export type ZavorthExternalCapabilityInventoryItem = {
  id: string;
  title: string;
  sourceRuntimeIds: ZavorthExternalRuntimeSourceRuntimeId[];
  bridgeCandidateId: ZavorthExternalRuntimeCapabilityId | null;
  decision: ZavorthExternalRuntimeDecision;
  targetPhase: ZavorthExternalRuntimeBridgePhase;
  priority: number;
  risk: ZavorthExternalCapabilityInventoryRisk;
  naturalFirstRoute: ZavorthExternalRuntimeNaturalFirstRoute;
  sourcePaths: Array<{
    runtimeId: ZavorthExternalRuntimeSourceRuntimeId;
    path: string;
    present: boolean;
    role: string;
  }>;
  evidenceDocs: string[];
  observedBehavior: string;
  stateConfigDependencies: string[];
  securityBoundary: {
    readOnlyInventoryOnly: true;
    noImplementationCopied: true;
    noSourceRuntimeCodeExecution: true;
    noDirectToolExposure: true;
    noExternalReplyBypass: true;
    approvalRequiredForLive: boolean;
    provenanceRequired: boolean;
  };
  zavorthEquivalent: {
    contract: string;
    service: string;
    commandCenterProjection: string;
    publicName: string;
  };
  acceptanceGate: string;
  notes: string[];
};

export type ZavorthExternalCapabilityInventorySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_CAPABILITY_INVENTORY_CONTRACT_VERSION;
  status: ZavorthExternalCapabilityInventoryStatus;
  planId: '291 - Plano Zavorth External Runtime Absorption';
  phase: 'phase-0-freeze-and-inventory';
  bridgeContractVersion: typeof ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION;
  bridgeStatus: 'bridge-ready' | 'attention' | 'blocked';
  sourceProbes: ZavorthExternalCapabilityInventorySourceProbe[];
  items: ZavorthExternalCapabilityInventoryItem[];
  decisionSummary: {
    total: number;
    absorb: number;
    adapt: number;
    externalize: number;
    replace: number;
    reject: number;
    approvalRequiredForLive: number;
    sourcePathMissing: number;
    docsEvidenceCount: number;
  };
  freezePolicy: {
    noRuntimeMixing: true;
    noSourceRuntimeNamingAsPublicIdentity: true;
    noImplementationBeyondReadOnlyInventory: true;
    sourceNamesAllowedOnlyInDiagnostics: true;
    importedCapabilitiesAdvisoryOnly: true;
    nextPhaseRequiresContractLayer: true;
  };
  safety: {
    executionPerformed: false;
    sourceRuntimeCodeExecuted: false;
    dependencyInstallPerformed: false;
    sidecarsStarted: false;
    toolsExposed: false;
    filesMutatedOutsideZavorthInventory: false;
    publicIdentityLeak: false;
  };
  commands: {
    inspect: 'npm run zavorth:external-capability-inventory';
    inspectJson: 'npm run zavorth:external-capability-inventory:json';
    check: 'npm run zavorth:external-capability-inventory:check --silent';
    nextPhase: '291 Phase 1 - Zavorth Contract Layer';
  };
};
