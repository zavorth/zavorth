import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type RuntimeAdapterPluginToolExposurePolicyDisposition =
  | 'approval-required'
  | 'block';

export type RuntimeAdapterPluginToolExposurePolicyFixtureCase =
  | 'tool-exposure-dangerous-command'
  | 'tool-exposure-source-approval-advisory';

export type RuntimeAdapterPluginToolExposurePolicyExecutionGate = {
  sourceCommandsExecuted: false;
  sourceCliProcessesSpawned: false;
  sourceHttpRoutesRegistered: false;
  sourceGatewayMethodsDispatched: false;
  sourceServicesLaunched: false;
  sourceSetupCommandsExecuted: false;
  sourceQaRunnersExecuted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  sourceCredentialsMigrated: false;
  liveSourceRuntimeConnected: false;
  realAdapterCreated: false;
};

export type RuntimeAdapterPluginToolExposurePolicySourceRecord = {
  fixtureCase: RuntimeAdapterPluginToolExposurePolicyFixtureCase;
  publicPolicyIdSeed: string;
  disposition: RuntimeAdapterPluginToolExposurePolicyDisposition;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type RuntimeAdapterZavorthToolExposurePolicySurface = {
  id: string;
  label: string;
  disposition: RuntimeAdapterPluginToolExposurePolicyDisposition;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  authScopeHints: Array<{
    id: string;
    sourceAuthScopeStoredAsEvidenceOnly: true;
  }>;
  policy: {
    authority: 'zavorth-tool-exposure-policy';
    sourceApprovalHintAuthority: false;
    sourceRiskLabelAuthority: false;
    sourceAuthScopeAuthority: false;
    sourceToolExecutionAllowed: false;
  };
  sourceToolNameStoredAsEvidenceOnly: true;
  sourceApprovalHintStoredAsEvidenceOnly: true;
  sourceRiskLabelStoredAsEvidenceOnly: true;
  sourceAuthScopeHintStoredAsEvidenceOnly: true;
  sourceApprovalHintGrantsAuthority: false;
  sourceToolExecutionAllowed: false;
  sourcePolicyAppliedDirectly: false;
  nativeContract: 'ZavorthToolExposurePolicySurface/v1';
};

export type RuntimeAdapterToolExposureCapabilityRow = {
  id: string;
  policyId: string;
  label: string;
  status: 'requires-approval' | 'blocked';
  policy: 'approval-required' | 'blocked';
};

export type RuntimeAdapterPluginToolExposurePolicyBoundaryOptions<TRuntimeId extends string = string> = {
  records: RuntimeAdapterPluginToolExposurePolicySourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: RuntimeAdapterPluginToolExposurePolicyExecutionGate;
};

export type RuntimeAdapterPluginToolExposurePolicyBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthPluginToolExposurePolicyConsistency/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  policies: RuntimeAdapterZavorthToolExposurePolicySurface[];
  dashboard: {
    capabilityRows: RuntimeAdapterToolExposureCapabilityRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceToolNamesStoredAsEvidenceOnly: true;
  sourceApprovalHintsStoredAsEvidenceOnly: true;
  sourceRiskLabelsStoredAsEvidenceOnly: true;
  sourceAuthScopeHintsStoredAsEvidenceOnly: true;
  sourceApprovalHintsGrantAuthority: false;
  sourceToolPolicyAuthority: false;
  sourceToolsExecuted: false;
  toolExposureRuntimeIntroduced: false;
  executionGate: RuntimeAdapterPluginToolExposurePolicyExecutionGate;
};

function publicToolExposurePolicyId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function toolExposurePolicyLabel(index: number, fixtureCase: RuntimeAdapterPluginToolExposurePolicyFixtureCase): string {
  if (fixtureCase === 'tool-exposure-dangerous-command') {
    return `Tool exposure policy ${index + 1} blocked`;
  }
  return `Tool exposure policy ${index + 1} approval gated`;
}

export function normalizeRuntimeAdapterPluginToolExposurePolicy<TRuntimeId extends string>(
  options: RuntimeAdapterPluginToolExposurePolicyBoundaryOptions<TRuntimeId>,
): RuntimeAdapterPluginToolExposurePolicyBoundaryNormalization<TRuntimeId> {
  const policies = options.records.map((record, index): RuntimeAdapterZavorthToolExposurePolicySurface => ({
    id: publicToolExposurePolicyId(options.idPrefix, record.publicPolicyIdSeed, index),
    label: toolExposurePolicyLabel(index, record.fixtureCase),
    disposition: record.disposition,
    risk: record.risk,
    requestedTools: record.requestedTools,
    authScopeHints: [
      {
        id: `auth-scope-hint-${index + 1}`,
        sourceAuthScopeStoredAsEvidenceOnly: true,
      },
    ],
    policy: {
      authority: 'zavorth-tool-exposure-policy',
      sourceApprovalHintAuthority: false,
      sourceRiskLabelAuthority: false,
      sourceAuthScopeAuthority: false,
      sourceToolExecutionAllowed: false,
    },
    sourceToolNameStoredAsEvidenceOnly: true,
    sourceApprovalHintStoredAsEvidenceOnly: true,
    sourceRiskLabelStoredAsEvidenceOnly: true,
    sourceAuthScopeHintStoredAsEvidenceOnly: true,
    sourceApprovalHintGrantsAuthority: false,
    sourceToolExecutionAllowed: false,
    sourcePolicyAppliedDirectly: false,
    nativeContract: 'ZavorthToolExposurePolicySurface/v1',
  }));
  const blockedTools = policies
    .filter((policy) => policy.disposition === 'block')
    .flatMap((policy) => policy.requestedTools);
  const approvalRequiredTools = policies
    .filter((policy) => policy.disposition === 'approval-required')
    .flatMap((policy) => policy.requestedTools);

  return {
    nativeContract: 'ZavorthPluginToolExposurePolicyConsistency/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    policies,
    dashboard: {
      capabilityRows: policies.map((policy) => ({
        id: `${policy.id}:capability-row`,
        policyId: policy.id,
        label: policy.label,
        status: policy.disposition === 'block' ? 'blocked' : 'requires-approval',
        policy: policy.disposition === 'block' ? 'blocked' : 'approval-required',
      })),
    },
    toolExposurePolicyInput: {
      requestedTools: Array.from(new Set(policies.flatMap((policy) => policy.requestedTools))),
      allowedTools: [],
      requireApprovalFor: Array.from(new Set(approvalRequiredTools)),
      blockedTools: Array.from(new Set(blockedTools)),
      blockedToolReason: 'source-policy-hints-advisory-not-authority',
      toolHintProfile: {
        intentCategory: 'external-command-http-tool-exposure',
        groups: ['external-command-http'],
        recommendedToolNames: Array.from(new Set(approvalRequiredTools)),
        reason: 'Source approval hints are advisory; Zavorth policy remains authoritative.',
      },
    },
    sourceToolNamesStoredAsEvidenceOnly: true,
    sourceApprovalHintsStoredAsEvidenceOnly: true,
    sourceRiskLabelsStoredAsEvidenceOnly: true,
    sourceAuthScopeHintsStoredAsEvidenceOnly: true,
    sourceApprovalHintsGrantAuthority: false,
    sourceToolPolicyAuthority: false,
    sourceToolsExecuted: false,
    toolExposureRuntimeIntroduced: false,
    executionGate: options.executionGate,
  };
}
