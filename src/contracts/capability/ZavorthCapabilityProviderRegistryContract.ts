import type {
  ZavorthExternalSidecarAdapterStatus,
  ZavorthExternalSidecarRisk,
} from '../ZavorthExternalSidecarAdapterContract.js';

export const ZAVORTH_CAPABILITY_PROVIDER_REGISTRY_CONTRACT_VERSION =
  'zavorth-capability-provider-registry/4' as const;

export type ZavorthCapabilityProviderRegistryStatus =
  | 'capability-provider-registry-ready'
  | 'attention'
  | 'blocked';

export type ZavorthCapabilityProviderKind =
  | 'skill'
  | 'tool'
  | 'plugin';

export type ZavorthCapabilityProviderAvailability =
  | 'available'
  | 'degraded'
  | 'unavailable'
  | 'quarantined';

export type ZavorthCapabilityProviderPolicyDecision =
  | 'allow'
  | 'preview-only'
  | 'approval-required'
  | 'quarantine'
  | 'unavailable';

export type ZavorthCapabilityProviderSourceCapability = {
  sourceCapabilityId: string;
  sourceRuntimeId: string;
  name: string;
  description: string;
  kind: ZavorthCapabilityProviderKind;
  tags: string[];
  availability: Exclude<ZavorthCapabilityProviderAvailability, 'quarantined'>;
  riskHint?: ZavorthExternalSidecarRisk;
  quarantined?: boolean;
  toolNames?: string[];
};

export type ZavorthCapabilityProviderSkillManifestInput = {
  manifestId: string;
  sourceRuntimeId: string;
  name: string;
  description: string;
  entrypoint: string;
  tools: string[];
  tags: string[];
};

export type ZavorthCapabilityProviderToolRiskReceipt = {
  toolName: string;
  risk: ZavorthExternalSidecarRisk;
  requiredDecision: ZavorthCapabilityProviderPolicyDecision;
  approvalRequired: boolean;
  quarantineRequired: boolean;
  reason: string;
  signals: string[];
  safety: {
    noToolExecution: true;
    noDirectExposure: true;
    noApprovalBypass: true;
  };
};

export type ZavorthCapabilityProviderToolBinding = {
  toolId: string;
  toolName: string;
  risk: ZavorthExternalSidecarRisk;
  directExposureAllowed: false;
  previewAllowed: boolean;
  approvalRequired: boolean;
  requiredDecision: ZavorthCapabilityProviderPolicyDecision;
};

export type ZavorthCapabilityProviderPolicyEnvelope = {
  requiredDecision: ZavorthCapabilityProviderPolicyDecision;
  approvalRequired: boolean;
  canExposeTool: boolean;
  canRunWithoutApproval: boolean;
  failureMode: 'none' | 'honest-unavailable' | 'quarantine-review' | 'approval-required';
  reason: string;
};

export type ZavorthCapabilityProviderNormalizedCapability = {
  capabilityId: string;
  sourceCapabilityId: string;
  sourceRuntimeId: string;
  sourceRuntimeDiagnosticsOnly: true;
  publicName: 'Zavorth';
  kind: ZavorthCapabilityProviderKind;
  name: string;
  description: string;
  tags: string[];
  availability: ZavorthCapabilityProviderAvailability;
  risk: ZavorthExternalSidecarRisk;
  manifestRef: string | null;
  toolBindings: ZavorthCapabilityProviderToolBinding[];
  policy: ZavorthCapabilityProviderPolicyEnvelope;
};

export type ZavorthCapabilityProviderManifestImportReceipt = {
  status: 'import-ready' | 'blocked';
  manifestId: string;
  capabilityId: string | null;
  importedName: string;
  warnings: string[];
  errors: string[];
  toolRiskReceipts: ZavorthCapabilityProviderToolRiskReceipt[];
  safety: {
    noSkillMutationPerformed: true;
    noToolExposurePerformed: true;
    noSourceRuntimeCodeExecuted: true;
    approvalRequiredBeforeActivation: true;
  };
};

export type ZavorthCapabilityProviderUnavailableReceipt = {
  capabilityId: string;
  status: 'honest-unavailable';
  userVisibleMessage: string;
  retryHint: string;
  fallbackAllowed: boolean;
  safety: {
    noSilentFallback: true;
    noToolExecution: true;
    noProviderCall: true;
  };
};

export type ZavorthCapabilityProviderZavorthControlProjection = {
  title: 'Capability Provider Registry';
  status: ZavorthCapabilityProviderRegistryStatus;
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

export type ZavorthCapabilityProviderRegistrySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CAPABILITY_PROVIDER_REGISTRY_CONTRACT_VERSION;
  status: ZavorthCapabilityProviderRegistryStatus;
  planId: 'Zavorth External Runtime Integration';
  gate: 'capability-providers';
  previousSidecarAdapterStatus: ZavorthExternalSidecarAdapterStatus;
  normalizedCapabilities: ZavorthCapabilityProviderNormalizedCapability[];
  manifestImportReceipts: ZavorthCapabilityProviderManifestImportReceipt[];
  toolRiskReceipts: ZavorthCapabilityProviderToolRiskReceipt[];
  unavailableReceipts: ZavorthCapabilityProviderUnavailableReceipt[];
  zavorthControlProjection: ZavorthCapabilityProviderZavorthControlProjection;
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    providers: number;
    normalizedCapabilities: number;
    importedSkillManifests: number;
    classifiedTools: number;
    approvalRequiredCapabilities: number;
    quarantinedCapabilities: number;
    unavailableCapabilities: number;
    directToolExposureAllowed: 0;
    dangerousCapabilitiesApprovalGated: number;
    unavailableCapabilitiesFailHonestly: number;
    sourceRuntimeCodeExecuted: false;
    toolExecutionPerformed: false;
    skillMutationPerformed: false;
  };
  safety: {
    registryOnly: true;
    noSourceRuntimeCodeExecuted: true;
    noToolExposurePerformed: true;
    noToolExecutionPerformed: true;
    noSkillMutationPerformed: true;
    noProviderCallPerformed: true;
    approvalBypassAllowed: false;
    publicIdentityChanged: false;
  };
  commands: {
    inspect: 'npm run zavorth:capability-provider-registry';
    inspectJson: 'npm run zavorth:capability-provider-registry:json';
    check: 'npm run zavorth:capability-provider-registry:check --silent';
    nextAction: 'Credential vault - Channels And Messaging';
  };
};
