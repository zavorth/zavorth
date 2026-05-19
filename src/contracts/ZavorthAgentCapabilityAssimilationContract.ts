export const ZAVORTH_AGENT_CAPABILITY_ASSIMILATION_CONTRACT_VERSION =
  '2026-05-11.agent-capability-assimilation-checkpoint-1' as const;

export type ZavorthAgentCapabilityAssimilationCategory =
  | 'planning'
  | 'tool_orchestration'
  | 'subagents'
  | 'skills'
  | 'browser_device_computer'
  | 'memory_context'
  | 'error_recovery'
  | 'cross_surface_ux'
  | 'security_governance';

export type ZavorthAgentCapabilityAssimilationReferenceProfileId =
  | 'cautious-code-review-agent'
  | 'multi-surface-tool-agent'
  | 'pragmatic-coding-harness'
  | 'channel-agent-runtime';

export type ZavorthAgentCapabilityAssimilationStatus =
  | 'assimilated'
  | 'partial'
  | 'planned'
  | 'rejected';

export type ZavorthAgentCapabilityAssimilationRiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'forbidden';

export type ZavorthAgentCapabilityAssimilationPolicyRequirement =
  | 'policy-broker'
  | 'approval'
  | 'receipt'
  | 'redaction'
  | 'egress-guard'
  | 'workspace-boundary'
  | 'untrusted-content'
  | 'no-raw-chain-of-thought'
  | 'no-upstream-code-copy';

export type ZavorthAgentCapabilityAssimilationMatrixItem = {
  id: string;
  category: ZavorthAgentCapabilityAssimilationCategory;
  referenceProfiles: ZavorthAgentCapabilityAssimilationReferenceProfileId[];
  observedPattern: string;
  userBenefit: string;
  risk: {
    level: ZavorthAgentCapabilityAssimilationRiskLevel;
    summary: string;
  };
  zavorthNativeEquivalent: string;
  status: ZavorthAgentCapabilityAssimilationStatus;
  policyRequirements: ZavorthAgentCapabilityAssimilationPolicyRequirement[];
  testsRequired: string[];
  acceptanceCriteria: string[];
  publicNaming: {
    usesExternalProductName: false;
    zavorthNativeName: string;
  };
  implementationBoundary: {
    copyExternalCode: false;
    copyExternalPrompts: false;
    absorbPatternOnly: true;
    requiresOwnerApprovalForVisualChange: boolean;
  };
};

export type ZavorthAgentCapabilityAssimilationReferenceProfile = {
  id: ZavorthAgentCapabilityAssimilationReferenceProfileId;
  label: string;
  publicDescription: string;
  strengthsToStudy: string[];
  neverCopy: string[];
};

export type ZavorthAgentCapabilityAssimilationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_AGENT_CAPABILITY_ASSIMILATION_CONTRACT_VERSION;
  source: 'ZavorthAgentCapabilityAssimilationService';
  phase: 'checkpoint-1-capability-assimilation-matrix';
  status: 'passed' | 'attention' | 'blocked';
  referenceProfiles: ZavorthAgentCapabilityAssimilationReferenceProfile[];
  matrix: ZavorthAgentCapabilityAssimilationMatrixItem[];
  summary: {
    items: number;
    assimilated: number;
    partial: number;
    planned: number;
    rejected: number;
    categoriesCovered: number;
    highRiskItems: number;
    forbiddenItems: number;
    visualApprovalItems: number;
    externalProductNamesInPublicCore: 0;
  };
  guarantees: {
    zavorthNativeIdentity: true;
    noExternalProductNamesInPublicCore: true;
    noExternalSourceCodeCopied: true;
    noExternalPromptsCopied: true;
    noRawChainOfThoughtPolicy: true;
    policyBrokerRequiredForRisk: true;
    dashboardVisualChangesRequireOwnerApproval: true;
    importedCapabilitiesRemainGoverned: true;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-agent-capability-assimilation.ts';
    json: 'npx tsx scripts/zavorth-agent-capability-assimilation.ts --json';
    check: 'node scripts/zavorth-agent-capability-assimilation-check.mjs';
    nextStage: 'Preview engine - Reasoning And Action Patterns';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextStep: string;
  };
};
