import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  RuntimeAdapterCommandHttpInvocationIntentKind,
} from './RuntimeAdapterCommandHttpInvocationEnvelopeBoundary.js';

export type RuntimeAdapterCommandHttpPolicyPreflightDecision =
  | 'allowed'
  | 'approval_required'
  | 'blocked';

export type RuntimeAdapterCommandHttpPolicyPreflightFixtureCase =
  | 'policy-preflight-approval-required'
  | 'policy-preflight-blocked-invocation'
  | 'policy-preflight-safe-metadata';

export type RuntimeAdapterCommandHttpPolicyPreflightExecutionGate = {
  sourceCommandsExecuted: false;
  sourceCliProcessesSpawned: false;
  sourceHttpRoutesRegistered: false;
  sourceGatewayMethodsDispatched: false;
  sourceServicesLaunched: false;
  sourceToolsExecuted: false;
  sourceSetupCommandsExecuted: false;
  sourceQaRunnersExecuted: false;
  sourceHandlerLoaded: false;
  sourceRuntimeConnected: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  sourceCredentialsMigrated: false;
  executionAuthority: false;
  realAdapterCreated: false;
};

export type RuntimeAdapterCommandHttpPolicyPreflightSourceRecord = {
  fixtureCase: RuntimeAdapterCommandHttpPolicyPreflightFixtureCase;
  publicPreflightIdSeed: string;
  invocationEnvelopeId: string;
  intentKind: RuntimeAdapterCommandHttpInvocationIntentKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  policyInput: ToolExposurePolicyInput;
  sourceApprovalHints: string[];
  sourceRiskLabels: string[];
  sourceAuthScopeHints: string[];
};

export type RuntimeAdapterCommandHttpPolicyPreflightResult = {
  id: string;
  label: string;
  invocationEnvelopeId: string;
  intentKind: RuntimeAdapterCommandHttpInvocationIntentKind;
  decision: RuntimeAdapterCommandHttpPolicyPreflightDecision;
  requestedTools: string[];
  approvalRequired: boolean;
  blocked: boolean;
  blockedReasonId?: string;
  policyEvaluation: {
    authority: 'zavorth-policy-preflight';
    executionAuthority: false;
    sourceApprovalHintAuthority: false;
    sourceRiskLabelAuthority: false;
    sourceAuthScopeAuthority: false;
    sourcePolicyAppliedDirectly: false;
  };
  sourceApprovalHintsStoredAsEvidenceOnly: true;
  sourceRiskLabelsStoredAsEvidenceOnly: true;
  sourceAuthScopeHintsStoredAsEvidenceOnly: true;
  sourceApprovalHintsGrantAuthority: false;
  sourceRiskLabelsGrantAuthority: false;
  sourcePolicyAuthority: false;
  sourceToolExecutionAllowed: false;
  sourceHandlerLoaded: false;
  sourceRuntimeConnected: false;
  sourceCommandExecuted: false;
  sourceCliProcessSpawned: false;
  sourceHttpRouteRegistered: false;
  sourceGatewayMethodDispatched: false;
  sourceServiceLaunched: false;
  sourceToolExecuted: false;
  executionAuthority: false;
  sideEffectsBlocked: true;
  nativeContract: 'ZavorthCommandHttpPolicyPreflight/v1';
};

export type RuntimeAdapterCommandHttpPolicyPreflightBoundaryOptions<TRuntimeId extends string = string> = {
  records: RuntimeAdapterCommandHttpPolicyPreflightSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: RuntimeAdapterCommandHttpPolicyPreflightExecutionGate;
};

export type RuntimeAdapterCommandHttpPolicyPreflightBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthCommandHttpPolicyPreflightBoundary/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  preflights: RuntimeAdapterCommandHttpPolicyPreflightResult[];
  allowedInvocations: string[];
  approvalRequiredInvocations: string[];
  blockedInvocations: string[];
  sourceApprovalHintsStoredAsEvidenceOnly: true;
  sourceRiskLabelsStoredAsEvidenceOnly: true;
  sourceAuthScopeHintsStoredAsEvidenceOnly: true;
  sourceApprovalHintsGrantAuthority: false;
  sourcePolicyAuthority: false;
  sourceHandlersLoaded: false;
  sourceRuntimeConnected: false;
  sourceCommandsExecuted: false;
  sourceCliProcessesSpawned: false;
  sourceHttpRoutesRegistered: false;
  sourceGatewayMethodsDispatched: false;
  sourceServicesLaunched: false;
  sourceToolsExecuted: false;
  executionAuthority: false;
  sideEffectsBlocked: true;
  executionGate: RuntimeAdapterCommandHttpPolicyPreflightExecutionGate;
};

function publicPreflightId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function preflightLabel(index: number, decision: RuntimeAdapterCommandHttpPolicyPreflightDecision): string {
  return `Policy preflight ${index + 1} ${decision}`;
}

function lowerSet(values?: string[]): Set<string> {
  return new Set((values || []).map((value) => value.toLowerCase()));
}

function hasAnyTool(sourceTools: string[], policyTools?: string[]): boolean {
  const policyToolSet = lowerSet(policyTools);
  return sourceTools.some((tool) => policyToolSet.has(tool.toLowerCase()));
}

function decidePreflight(record: RuntimeAdapterCommandHttpPolicyPreflightSourceRecord): RuntimeAdapterCommandHttpPolicyPreflightDecision {
  if (
    record.fixtureCase === 'policy-preflight-blocked-invocation'
    || record.risk === 'danger'
    || hasAnyTool(record.requestedTools, record.policyInput.blockedTools)
  ) {
    return 'blocked';
  }

  if (
    record.fixtureCase === 'policy-preflight-approval-required'
    || record.risk === 'attention'
    || record.risk === 'unknown'
    || hasAnyTool(record.requestedTools, record.policyInput.requireApprovalFor)
  ) {
    return 'approval_required';
  }

  return 'allowed';
}

export function normalizeRuntimeAdapterCommandHttpPolicyPreflight<TRuntimeId extends string>(
  options: RuntimeAdapterCommandHttpPolicyPreflightBoundaryOptions<TRuntimeId>,
): RuntimeAdapterCommandHttpPolicyPreflightBoundaryNormalization<TRuntimeId> {
  const preflights = options.records.map((record, index): RuntimeAdapterCommandHttpPolicyPreflightResult => {
    const decision = decidePreflight(record);

    return {
      id: publicPreflightId(options.idPrefix, record.publicPreflightIdSeed, index),
      label: preflightLabel(index, decision),
      invocationEnvelopeId: record.invocationEnvelopeId,
      intentKind: record.intentKind,
      decision,
      requestedTools: record.requestedTools,
      approvalRequired: decision === 'approval_required',
      blocked: decision === 'blocked',
      ...(decision === 'blocked' ? {
        blockedReasonId: record.policyInput.blockedToolReason || 'blocked-by-zavorth-policy-preflight',
      } : {}),
      policyEvaluation: {
        authority: 'zavorth-policy-preflight',
        executionAuthority: false,
        sourceApprovalHintAuthority: false,
        sourceRiskLabelAuthority: false,
        sourceAuthScopeAuthority: false,
        sourcePolicyAppliedDirectly: false,
      },
      sourceApprovalHintsStoredAsEvidenceOnly: true,
      sourceRiskLabelsStoredAsEvidenceOnly: true,
      sourceAuthScopeHintsStoredAsEvidenceOnly: true,
      sourceApprovalHintsGrantAuthority: false,
      sourceRiskLabelsGrantAuthority: false,
      sourcePolicyAuthority: false,
      sourceToolExecutionAllowed: false,
      sourceHandlerLoaded: false,
      sourceRuntimeConnected: false,
      sourceCommandExecuted: false,
      sourceCliProcessSpawned: false,
      sourceHttpRouteRegistered: false,
      sourceGatewayMethodDispatched: false,
      sourceServiceLaunched: false,
      sourceToolExecuted: false,
      executionAuthority: false,
      sideEffectsBlocked: true,
      nativeContract: 'ZavorthCommandHttpPolicyPreflight/v1',
    };
  });

  return {
    nativeContract: 'ZavorthCommandHttpPolicyPreflightBoundary/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    preflights,
    allowedInvocations: preflights
      .filter((preflight) => preflight.decision === 'allowed')
      .map((preflight) => preflight.invocationEnvelopeId),
    approvalRequiredInvocations: preflights
      .filter((preflight) => preflight.decision === 'approval_required')
      .map((preflight) => preflight.invocationEnvelopeId),
    blockedInvocations: preflights
      .filter((preflight) => preflight.decision === 'blocked')
      .map((preflight) => preflight.invocationEnvelopeId),
    sourceApprovalHintsStoredAsEvidenceOnly: true,
    sourceRiskLabelsStoredAsEvidenceOnly: true,
    sourceAuthScopeHintsStoredAsEvidenceOnly: true,
    sourceApprovalHintsGrantAuthority: false,
    sourcePolicyAuthority: false,
    sourceHandlersLoaded: false,
    sourceRuntimeConnected: false,
    sourceCommandsExecuted: false,
    sourceCliProcessesSpawned: false,
    sourceHttpRoutesRegistered: false,
    sourceGatewayMethodsDispatched: false,
    sourceServicesLaunched: false,
    sourceToolsExecuted: false,
    executionAuthority: false,
    sideEffectsBlocked: true,
    executionGate: options.executionGate,
  };
}
