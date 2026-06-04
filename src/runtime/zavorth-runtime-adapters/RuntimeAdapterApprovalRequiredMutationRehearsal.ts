import {
  GOVERNED_EXECUTOR_BOUNDARY,
} from '../agent/executors/GovernedExecutorAdapter.js';
import {
  normalizeFirstGovernedReadOnlyGatewayActionFixture,
} from './RuntimeAdapterFirstGovernedReadOnlyGatewayAction.js';
import {
  normalizeGovernedReadOnlyCapabilityRefreshFixture,
} from './RuntimeAdapterGovernedReadOnlyCapabilityRefresh.js';
import type {
  GovernedExecutorBoundary,
} from '../agent/executors/GovernedExecutorAdapter.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  RuntimeAdapterLiveReadinessCapabilityRowKind,
} from './RuntimeAdapterLiveReadinessAssimilationPack.js';
import type {
  ZavorthFirstGovernedReadOnlyGatewayActionDecision,
} from './RuntimeAdapterFirstGovernedReadOnlyGatewayAction.js';
import type {
  ZavorthGovernedReadOnlyCapabilityRefreshDecision,
} from './RuntimeAdapterGovernedReadOnlyCapabilityRefresh.js';

export const RUNTIME_ADAPTER_APPROVAL_REQUIRED_MUTATION_REHEARSAL_NOW = '2026-04-29T00:00:00.000Z' as const;
export const RUNTIME_ADAPTER_APPROVAL_REQUIRED_MUTATION_REHEARSAL_RUNTIME_ID = 'runtime-adapter-approval-required-mutation-rehearsal' as const;

export type ZavorthApprovalRequiredMutationRehearsalDecision =
  | 'approval-required-mutation-rehearsal-ready'
  | 'blocked';

export type ZavorthMutableExternalActionKind =
  | 'command-tool-execution'
  | 'gateway-mutation-method'
  | 'message-send'
  | 'provider-execution'
  | 'session-history-mutation';

export type ZavorthMutableActionPolicyDecision =
  | 'approval-required'
  | 'blocked';

export type ZavorthMutationRehearsalFixtureCase =
  | 'dangerous-command-tool-blocked'
  | 'gateway-mutation-approval-required'
  | 'message-send-approval-required'
  | 'provider-execution-approval-required'
  | 'provider-execution-policy-blocked'
  | 'session-history-mutation-approval-required';

export type ZavorthMutationRehearsalSourceRecord = {
  fixtureCase: ZavorthMutationRehearsalFixtureCase;
  actionKind: ZavorthMutableExternalActionKind;
  publicIntentIdSeed: string;
  capabilityCategory: RuntimeAdapterLiveReadinessCapabilityRowKind;
  policyDecision: ZavorthMutableActionPolicyDecision;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  rollbackOrCompensationRequired: boolean;
  sourceApprovalHints: string[];
};

export type ZavorthMutableActionIntent = {
  nativeContract: 'ZavorthExternalActionIntent/v1';
  id: string;
  actionKind: ZavorthMutableExternalActionKind;
  capabilityCategory: RuntimeAdapterLiveReadinessCapabilityRowKind;
  mutationIntent: true;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  sourceCapabilityEvidenceOnly: true;
  sourceCapabilityAuthority: false;
  sourceApprovalHintsEvidenceOnly: true;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthMutableActionPreflight = {
  nativeContract: 'ZavorthExternalActionPreflight/v1';
  id: string;
  intentId: string;
  actionKind: ZavorthMutableExternalActionKind;
  decision: ZavorthMutableActionPolicyDecision;
  policyAuthority: 'zavorth-policy-preflight';
  approvalRequired: boolean;
  blocked: boolean;
  sourcePolicyAuthority: false;
  sourceApprovalHintAuthority: false;
  approvalActuallyGranted: false;
  mutationActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthMutableActionApprovalRequest = {
  nativeContract: 'ZavorthExternalActionApprovalRequest/v1';
  id: string;
  intentId: string;
  preflightId: string;
  actionKind: ZavorthMutableExternalActionKind;
  approvalState: 'not-requested-for-blocked' | 'pending-human-approval';
  redacted: true;
  auditReady: true;
  sourceApprovalHintAuthority: false;
  approvalActuallyGranted: false;
  mutationActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthMutableActionDispatchPlan = {
  nativeContract: 'ZavorthExternalActionDispatchPlan/v1';
  id: string;
  intentId: string;
  preflightId: string;
  approvalRequestId: string;
  actionKind: ZavorthMutableExternalActionKind;
  planState: 'awaiting-approval' | 'blocked';
  executableNow: false;
  governedExecutorBoundary: GovernedExecutorBoundary;
  executorEntrypoint: GovernedExecutorBoundary['entrypoint'];
  directExternalInvocationAllowed: false;
  rollbackOrCompensationRequired: boolean;
  rollbackOrCompensationMetadataOnly: true;
  sourceCapabilityEvidenceOnly: true;
  sourceAuthorityGranted: false;
  externalAdapterInvokedForMutation: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthMutableActionSimulatedReceipt = {
  nativeContract: 'ZavorthExternalActionReceipt/v1';
  id: string;
  intentId: string;
  preflightId: string;
  dispatchPlanId: string;
  actionKind: ZavorthMutableExternalActionKind;
  status: 'simulated-awaiting-approval' | 'simulated-blocked';
  auditAuthority: 'zavorth-audit-receipt';
  simulated: true;
  sideEffectFree: true;
  redacted: true;
  mutationActuallyPerformed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  approvalActuallyGranted: false;
  externalAdapterInvokedForMutation: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthMutationRehearsalRow = {
  nativeContract: 'ZavorthApprovalRequiredMutationRehearsalRow/v1';
  id: string;
  fixtureCase: ZavorthMutationRehearsalFixtureCase;
  intentId: string;
  preflightId: string;
  approvalRequestId: string;
  dispatchPlanId: string;
  receiptId: string;
  actionKind: ZavorthMutableExternalActionKind;
  decision: ZavorthMutableActionPolicyDecision;
  planState: ZavorthMutableActionDispatchPlan['planState'];
  sourceCapabilityEvidenceOnly: true;
  zeroSideEffects: true;
};

export type ZavorthApprovalRequiredMutationRehearsalExecutionGate = {
  mutationActuallyPerformed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  approvalActuallyGranted: false;
  externalAdapterInvokedForMutation: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthReadOnlyRegressionState = {
  nativeContract: 'ZavorthReadOnlyRegressionState/v1';
  firstGovernedGatewayActionDecision: ZavorthFirstGovernedReadOnlyGatewayActionDecision;
  governedCapabilityRefreshDecision: ZavorthGovernedReadOnlyCapabilityRefreshDecision;
  readOnlyGatewayPathStillAvailable: true;
  readOnlyRefreshPathStillAvailable: true;
  mutationAuthorityIntroducedIntoReadOnlyPath: false;
};

export type ZavorthApprovalRequiredMutationRehearsalNormalization = {
  nativeContract: 'ZavorthApprovalRequiredMutationRehearsal/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthApprovalRequiredMutationRehearsalDecision;
  intents: ZavorthMutableActionIntent[];
  preflights: ZavorthMutableActionPreflight[];
  approvalRequests: ZavorthMutableActionApprovalRequest[];
  dispatchPlans: ZavorthMutableActionDispatchPlan[];
  receipts: ZavorthMutableActionSimulatedReceipt[];
  rows: ZavorthMutationRehearsalRow[];
  readOnlyRegression: ZavorthReadOnlyRegressionState;
  executionGate: ZavorthApprovalRequiredMutationRehearsalExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    approvalRequestRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-approval-grant-design-only';
};

export type ZavorthApprovalRequiredMutationRehearsalOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  records: ZavorthMutationRehearsalSourceRecord[];
  executionGate: ZavorthApprovalRequiredMutationRehearsalExecutionGate;
};

function buildIntent(
  idPrefix: string,
  record: ZavorthMutationRehearsalSourceRecord,
  index: number,
): ZavorthMutableActionIntent {
  return {
    nativeContract: 'ZavorthExternalActionIntent/v1',
    id: `${idPrefix}:intent-${index + 1}-${record.publicIntentIdSeed}`,
    actionKind: record.actionKind,
    capabilityCategory: record.capabilityCategory,
    mutationIntent: true,
    risk: record.risk,
    requestedTools: record.requestedTools,
    sourceCapabilityEvidenceOnly: true,
    sourceCapabilityAuthority: false,
    sourceApprovalHintsEvidenceOnly: true,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

function buildPreflight(
  idPrefix: string,
  intent: ZavorthMutableActionIntent,
  record: ZavorthMutationRehearsalSourceRecord,
  index: number,
): ZavorthMutableActionPreflight {
  return {
    nativeContract: 'ZavorthExternalActionPreflight/v1',
    id: `${idPrefix}:preflight-${index + 1}`,
    intentId: intent.id,
    actionKind: intent.actionKind,
    decision: record.policyDecision,
    policyAuthority: 'zavorth-policy-preflight',
    approvalRequired: record.policyDecision === 'approval-required',
    blocked: record.policyDecision === 'blocked',
    sourcePolicyAuthority: false,
    sourceApprovalHintAuthority: false,
    approvalActuallyGranted: false,
    mutationActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function buildApprovalRequest(
  idPrefix: string,
  preflight: ZavorthMutableActionPreflight,
  index: number,
): ZavorthMutableActionApprovalRequest {
  return {
    nativeContract: 'ZavorthExternalActionApprovalRequest/v1',
    id: `${idPrefix}:approval-${index + 1}`,
    intentId: preflight.intentId,
    preflightId: preflight.id,
    actionKind: preflight.actionKind,
    approvalState: preflight.decision === 'approval-required'
      ? 'pending-human-approval'
      : 'not-requested-for-blocked',
    redacted: true,
    auditReady: true,
    sourceApprovalHintAuthority: false,
    approvalActuallyGranted: false,
    mutationActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function buildDispatchPlan(
  idPrefix: string,
  preflight: ZavorthMutableActionPreflight,
  approval: ZavorthMutableActionApprovalRequest,
  record: ZavorthMutationRehearsalSourceRecord,
  index: number,
): ZavorthMutableActionDispatchPlan {
  return {
    nativeContract: 'ZavorthExternalActionDispatchPlan/v1',
    id: `${idPrefix}:dispatch-plan-${index + 1}`,
    intentId: preflight.intentId,
    preflightId: preflight.id,
    approvalRequestId: approval.id,
    actionKind: preflight.actionKind,
    planState: preflight.decision === 'approval-required' ? 'awaiting-approval' : 'blocked',
    executableNow: false,
    governedExecutorBoundary: GOVERNED_EXECUTOR_BOUNDARY,
    executorEntrypoint: GOVERNED_EXECUTOR_BOUNDARY.entrypoint,
    directExternalInvocationAllowed: false,
    rollbackOrCompensationRequired: record.rollbackOrCompensationRequired,
    rollbackOrCompensationMetadataOnly: true,
    sourceCapabilityEvidenceOnly: true,
    sourceAuthorityGranted: false,
    externalAdapterInvokedForMutation: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function buildReceipt(
  idPrefix: string,
  preflight: ZavorthMutableActionPreflight,
  dispatchPlan: ZavorthMutableActionDispatchPlan,
  index: number,
): ZavorthMutableActionSimulatedReceipt {
  return {
    nativeContract: 'ZavorthExternalActionReceipt/v1',
    id: `${idPrefix}:receipt-${index + 1}`,
    intentId: preflight.intentId,
    preflightId: preflight.id,
    dispatchPlanId: dispatchPlan.id,
    actionKind: preflight.actionKind,
    status: preflight.decision === 'approval-required' ? 'simulated-awaiting-approval' : 'simulated-blocked',
    auditAuthority: 'zavorth-audit-receipt',
    simulated: true,
    sideEffectFree: true,
    redacted: true,
    mutationActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    approvalActuallyGranted: false,
    externalAdapterInvokedForMutation: false,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function buildReadOnlyRegression(): ZavorthReadOnlyRegressionState {
  const gateway = normalizeFirstGovernedReadOnlyGatewayActionFixture();
  const refresh = normalizeGovernedReadOnlyCapabilityRefreshFixture();

  return {
    nativeContract: 'ZavorthReadOnlyRegressionState/v1',
    firstGovernedGatewayActionDecision: gateway.decision,
    governedCapabilityRefreshDecision: refresh.decision,
    readOnlyGatewayPathStillAvailable: true,
    readOnlyRefreshPathStillAvailable: true,
    mutationAuthorityIntroducedIntoReadOnlyPath: false,
  };
}

export function createApprovalRequiredMutationRehearsalExecutionGate(): ZavorthApprovalRequiredMutationRehearsalExecutionGate {
  return {
    mutationActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    approvalActuallyGranted: false,
    externalAdapterInvokedForMutation: false,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

export function createApprovalRequiredMutationRehearsalFixtureRecords(): ZavorthMutationRehearsalSourceRecord[] {
  return [
    {
      fixtureCase: 'message-send-approval-required',
      actionKind: 'message-send',
      publicIntentIdSeed: 'message-send',
      capabilityCategory: 'channel-capabilities',
      policyDecision: 'approval-required',
      risk: 'attention',
      requestedTools: ['external.channel.message.send'],
      rollbackOrCompensationRequired: true,
      sourceApprovalHints: ['source send affordance is evidence only'],
    },
    {
      fixtureCase: 'provider-execution-approval-required',
      actionKind: 'provider-execution',
      publicIntentIdSeed: 'provider-execution',
      capabilityCategory: 'provider-capabilities',
      policyDecision: 'approval-required',
      risk: 'attention',
      requestedTools: ['external.provider.invoke'],
      rollbackOrCompensationRequired: false,
      sourceApprovalHints: ['provider execution requires SecretRef and approval'],
    },
    {
      fixtureCase: 'provider-execution-policy-blocked',
      actionKind: 'provider-execution',
      publicIntentIdSeed: 'provider-execution-blocked',
      capabilityCategory: 'provider-capabilities',
      policyDecision: 'blocked',
      risk: 'danger',
      requestedTools: ['external.provider.invoke.dangerous'],
      rollbackOrCompensationRequired: false,
      sourceApprovalHints: ['source provider policy ignored as authority'],
    },
    {
      fixtureCase: 'dangerous-command-tool-blocked',
      actionKind: 'command-tool-execution',
      publicIntentIdSeed: 'command-tool-danger',
      capabilityCategory: 'command-http-capabilities',
      policyDecision: 'blocked',
      risk: 'danger',
      requestedTools: ['external.command.execute'],
      rollbackOrCompensationRequired: true,
      sourceApprovalHints: ['source command approval hint blocked'],
    },
    {
      fixtureCase: 'session-history-mutation-approval-required',
      actionKind: 'session-history-mutation',
      publicIntentIdSeed: 'session-history-mutation',
      capabilityCategory: 'session-history-capabilities',
      policyDecision: 'approval-required',
      risk: 'attention',
      requestedTools: ['external.session.history.write'],
      rollbackOrCompensationRequired: true,
      sourceApprovalHints: ['future history mutation requires backup/rollback'],
    },
    {
      fixtureCase: 'gateway-mutation-approval-required',
      actionKind: 'gateway-mutation-method',
      publicIntentIdSeed: 'gateway-mutation-method',
      capabilityCategory: 'gateway-method-capabilities',
      policyDecision: 'approval-required',
      risk: 'attention',
      requestedTools: ['external.gateway.method.mutate'],
      rollbackOrCompensationRequired: true,
      sourceApprovalHints: ['gateway mutation must be explicitly approved later'],
    },
  ];
}

export function normalizeApprovalRequiredMutationRehearsal<TRuntimeId extends string>(
  options: ZavorthApprovalRequiredMutationRehearsalOptions<TRuntimeId>,
): ZavorthApprovalRequiredMutationRehearsalNormalization {
  const intents = options.records.map((record, index) => buildIntent(options.idPrefix, record, index));
  const preflights = intents.map((intent, index) => buildPreflight(options.idPrefix, intent, options.records[index], index));
  const approvalRequests = preflights.map((preflight, index) => buildApprovalRequest(options.idPrefix, preflight, index));
  const dispatchPlans = preflights.map((preflight, index) => (
    buildDispatchPlan(options.idPrefix, preflight, approvalRequests[index], options.records[index], index)
  ));
  const receipts = preflights.map((preflight, index) => buildReceipt(options.idPrefix, preflight, dispatchPlans[index], index));
  const rows = options.records.map((record, index): ZavorthMutationRehearsalRow => ({
    nativeContract: 'ZavorthApprovalRequiredMutationRehearsalRow/v1',
    id: `${options.idPrefix}:row-${index + 1}`,
    fixtureCase: record.fixtureCase,
    intentId: intents[index].id,
    preflightId: preflights[index].id,
    approvalRequestId: approvalRequests[index].id,
    dispatchPlanId: dispatchPlans[index].id,
    receiptId: receipts[index].id,
    actionKind: record.actionKind,
    decision: record.policyDecision,
    planState: dispatchPlans[index].planState,
    sourceCapabilityEvidenceOnly: true,
    zeroSideEffects: true,
  }));

  return {
    nativeContract: 'ZavorthApprovalRequiredMutationRehearsal/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'approval-required-mutation-rehearsal-ready',
    intents,
    preflights,
    approvalRequests,
    dispatchPlans,
    receipts,
    rows,
    readOnlyRegression: buildReadOnlyRegression(),
    executionGate: options.executionGate,
    redaction: {
      rawSecretSerialized: false,
      approvalRequestRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-approval-grant-design-only',
  };
}

export function normalizeApprovalRequiredMutationRehearsalFixture(): ZavorthApprovalRequiredMutationRehearsalNormalization {
  return normalizeApprovalRequiredMutationRehearsal({
    records: createApprovalRequiredMutationRehearsalFixtureRecords(),
    executionGate: createApprovalRequiredMutationRehearsalExecutionGate(),
    generatedAt: RUNTIME_ADAPTER_APPROVAL_REQUIRED_MUTATION_REHEARSAL_NOW,
    runtimeId: RUNTIME_ADAPTER_APPROVAL_REQUIRED_MUTATION_REHEARSAL_RUNTIME_ID,
    idPrefix: 'runtime-adapter-approval-required-mutation-rehearsal',
  });
}
