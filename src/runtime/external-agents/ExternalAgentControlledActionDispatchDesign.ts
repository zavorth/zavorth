import {
  GOVERNED_EXECUTOR_BOUNDARY,
} from '../agent/executors/GovernedExecutorAdapter.js';
import {
  normalizeExternalAgentZavorthControlLiveAssimilationFixture,
} from './ExternalAgentZavorthControlLiveAssimilation.js';
import type {
  GovernedExecutorBoundary,
} from '../agent/executors/GovernedExecutorAdapter.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ExternalAgentLiveReadinessCapabilityRowKind,
} from './ExternalAgentLiveReadinessAssimilationPack.js';
import type {
  ZavorthControlCapabilityView,
  ExternalAgentZavorthControlLiveAssimilationNormalization,
} from './ExternalAgentZavorthControlLiveAssimilation.js';

export const EXTERNAL_AGENT_CONTROLLED_ACTION_DISPATCH_DESIGN_NOW = '2026-04-28T22:00:00.000Z' as const;
export const EXTERNAL_AGENT_CONTROLLED_ACTION_DISPATCH_DESIGN_RUNTIME_ID = 'external-agent-controlled-action-dispatch-design' as const;

export type ZavorthExternalActionDispatchDesignDecision =
  | 'blocked'
  | 'controlled-action-dispatch-design-ready';

export type ZavorthExternalActionKind =
  | 'command-tool-execution'
  | 'gateway-method-call'
  | 'message-send'
  | 'provider-execution'
  | 'session-history-mutation';

export type ZavorthExternalActionControlLevel =
  | 'approval-required'
  | 'blocked'
  | 'dry-run'
  | 'executable-future'
  | 'read-only';

export type ZavorthExternalActionPreflightDecision =
  | 'allowed-dry-run'
  | 'approval-required'
  | 'blocked';

export type ZavorthExternalActionReceiptStatus =
  | 'approval-requested'
  | 'blocked-by-policy'
  | 'simulated-dry-run';

export type ZavorthExternalActionSourceCapabilityInput = {
  capabilityCategory: ExternalAgentLiveReadinessCapabilityRowKind;
  sourceCapabilityEvidenceAlias: string;
  sourceCapabilityAuthority: false;
  sourceIdentityPublic: false;
  sourceStructuresPublic: false;
};

export type ZavorthExternalActionIntentFixtureCase =
  | 'dangerous-command-tool-blocked'
  | 'mutable-message-send-approval-required'
  | 'mutable-provider-execution-approval-required'
  | 'read-only-gateway-method-dry-run'
  | 'session-history-mutation-blocked';

export type ZavorthExternalActionIntentSourceRecord = {
  fixtureCase: ZavorthExternalActionIntentFixtureCase;
  publicIntentIdSeed: string;
  actionKind: ZavorthExternalActionKind;
  capabilityCategory: ExternalAgentLiveReadinessCapabilityRowKind;
  requestedControlLevel: ZavorthExternalActionControlLevel;
  requestedMutation: boolean;
  risk: UniversalToolRiskLevel;
  requiresRollbackOrCompensation: boolean;
  requestedTools: string[];
  sourceApprovalHints: string[];
  sourceEvidenceHints: string[];
};

export type ZavorthExternalActionIntent = {
  nativeContract: 'ZavorthExternalActionIntent/v1';
  id: string;
  actionKind: ZavorthExternalActionKind;
  requestedControlLevel: ZavorthExternalActionControlLevel;
  requestedMutation: boolean;
  capability: ZavorthExternalActionSourceCapabilityInput;
  requestedTools: string[];
  risk: UniversalToolRiskLevel;
  sourceApprovalHintsStoredAsEvidenceOnly: true;
  sourceEvidenceStoredAsEvidenceOnly: true;
  sourceCapabilityAuthority: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionPreflight = {
  nativeContract: 'ZavorthExternalActionPreflight/v1';
  id: string;
  intentId: string;
  actionKind: ZavorthExternalActionKind;
  decision: ZavorthExternalActionPreflightDecision;
  controlLevel: ZavorthExternalActionControlLevel;
  policyAuthority: 'zavorth-policy-preflight';
  approvalRequired: boolean;
  blocked: boolean;
  dryRunAllowed: boolean;
  futureExecutionRequiresNewGate: true;
  sourcePolicyAuthority: false;
  sourceApprovalHintAuthority: false;
  executionActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionApprovalRequest = {
  nativeContract: 'ZavorthExternalActionApprovalRequest/v1';
  id: string;
  intentId: string;
  preflightId: string;
  actionKind: ZavorthExternalActionKind;
  requiredBeforeFutureDispatch: true;
  approvalState: 'not-requested-for-blocked' | 'pending-human-approval' | 'unneeded-for-dry-run';
  mutationWouldBePerformed: boolean;
  sourceApprovalHintAuthority: false;
  executionActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionDispatchPlan = {
  nativeContract: 'ZavorthExternalActionDispatchPlan/v1';
  id: string;
  intentId: string;
  preflightId: string;
  approvalRequestId: string;
  actionKind: ZavorthExternalActionKind;
  planState: 'approval-pending' | 'blocked' | 'dry-run-only';
  controlLevel: ZavorthExternalActionControlLevel;
  futureExecutableLevel: 'executable-future';
  governedExecutorBoundary: GovernedExecutorBoundary;
  executorEntrypoint: GovernedExecutorBoundary['entrypoint'];
  directExternalInvocationAllowed: false;
  rollbackOrCompensationPlanRequired: boolean;
  rollbackOrCompensationPlanPresent: boolean;
  dispatchDeferredToFutureGate: true;
  executionActuallyPerformed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionReceipt = {
  nativeContract: 'ZavorthExternalActionReceipt/v1';
  id: string;
  intentId: string;
  preflightId: string;
  dispatchPlanId: string;
  status: ZavorthExternalActionReceiptStatus;
  auditAuthority: 'zavorth-audit-receipt';
  simulated: true;
  sideEffectFree: true;
  executionActuallyPerformed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionDispatchExecutionGate = {
  executionActuallyPerformed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionDispatchDesignNormalization = {
  nativeContract: 'ZavorthControlledActionDispatchDesign/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthExternalActionDispatchDesignDecision;
  readOnlyDesignOnly: true;
  zavorthControlAssimilationReady: boolean;
  governedExecutorBoundary: GovernedExecutorBoundary;
  supportedControlLevels: ZavorthExternalActionControlLevel[];
  intents: ZavorthExternalActionIntent[];
  preflights: ZavorthExternalActionPreflight[];
  approvalRequests: ZavorthExternalActionApprovalRequest[];
  dispatchPlans: ZavorthExternalActionDispatchPlan[];
  receipts: ZavorthExternalActionReceipt[];
  executionGate: ZavorthExternalActionDispatchExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-controlled-action-dispatch-fixture-or-dry-run-only-gate';
};

export type ZavorthExternalActionDispatchDesignOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  zavorthControlAssimilation: ExternalAgentZavorthControlLiveAssimilationNormalization;
  records: ZavorthExternalActionIntentSourceRecord[];
  executionGate: ZavorthExternalActionDispatchExecutionGate;
};

function findCapability(
  assimilation: ExternalAgentZavorthControlLiveAssimilationNormalization,
  category: ExternalAgentLiveReadinessCapabilityRowKind,
): ZavorthControlCapabilityView {
  const capability = assimilation.viewModel.capabilities.find((row) => row.category === category);

  if (!capability) {
    throw new Error(`Missing ZavorthControl capability category: ${category}`);
  }

  return capability;
}

function sourceEvidenceAlias(category: ExternalAgentLiveReadinessCapabilityRowKind, index: number): string {
  return `source-capability-evidence:${index + 1}:${category}`;
}

function buildIntent(
  idPrefix: string,
  assimilation: ExternalAgentZavorthControlLiveAssimilationNormalization,
  record: ZavorthExternalActionIntentSourceRecord,
  index: number,
): ZavorthExternalActionIntent {
  findCapability(assimilation, record.capabilityCategory);

  return {
    nativeContract: 'ZavorthExternalActionIntent/v1',
    id: `${idPrefix}:intent-${index + 1}-${record.publicIntentIdSeed}`,
    actionKind: record.actionKind,
    requestedControlLevel: record.requestedControlLevel,
    requestedMutation: record.requestedMutation,
    capability: {
      capabilityCategory: record.capabilityCategory,
      sourceCapabilityEvidenceAlias: sourceEvidenceAlias(record.capabilityCategory, index),
      sourceCapabilityAuthority: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
    },
    requestedTools: record.requestedTools,
    risk: record.risk,
    sourceApprovalHintsStoredAsEvidenceOnly: true,
    sourceEvidenceStoredAsEvidenceOnly: true,
    sourceCapabilityAuthority: false,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function preflightDecision(intent: ZavorthExternalActionIntent): ZavorthExternalActionPreflightDecision {
  if (intent.requestedControlLevel === 'blocked' || intent.risk === 'danger') {
    return 'blocked';
  }
  if (intent.requestedMutation || intent.requestedControlLevel === 'approval-required') {
    return 'approval-required';
  }
  return 'allowed-dry-run';
}

function preflightControlLevel(decision: ZavorthExternalActionPreflightDecision): ZavorthExternalActionControlLevel {
  if (decision === 'blocked') {
    return 'blocked';
  }
  if (decision === 'approval-required') {
    return 'approval-required';
  }
  return 'dry-run';
}

function buildPreflight(idPrefix: string, intent: ZavorthExternalActionIntent, index: number): ZavorthExternalActionPreflight {
  const decision = preflightDecision(intent);

  return {
    nativeContract: 'ZavorthExternalActionPreflight/v1',
    id: `${idPrefix}:preflight-${index + 1}`,
    intentId: intent.id,
    actionKind: intent.actionKind,
    decision,
    controlLevel: preflightControlLevel(decision),
    policyAuthority: 'zavorth-policy-preflight',
    approvalRequired: decision === 'approval-required',
    blocked: decision === 'blocked',
    dryRunAllowed: decision === 'allowed-dry-run',
    futureExecutionRequiresNewGate: true,
    sourcePolicyAuthority: false,
    sourceApprovalHintAuthority: false,
    executionActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function buildApprovalRequest(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  preflight: ZavorthExternalActionPreflight,
  index: number,
): ZavorthExternalActionApprovalRequest {
  const approvalState: ZavorthExternalActionApprovalRequest['approvalState'] =
    preflight.decision === 'approval-required'
      ? 'pending-human-approval'
      : preflight.decision === 'blocked'
        ? 'not-requested-for-blocked'
        : 'unneeded-for-dry-run';

  return {
    nativeContract: 'ZavorthExternalActionApprovalRequest/v1',
    id: `${idPrefix}:approval-${index + 1}`,
    intentId: intent.id,
    preflightId: preflight.id,
    actionKind: intent.actionKind,
    requiredBeforeFutureDispatch: true,
    approvalState,
    mutationWouldBePerformed: intent.requestedMutation,
    sourceApprovalHintAuthority: false,
    executionActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function planState(
  preflight: ZavorthExternalActionPreflight,
): ZavorthExternalActionDispatchPlan['planState'] {
  if (preflight.decision === 'blocked') {
    return 'blocked';
  }
  if (preflight.decision === 'approval-required') {
    return 'approval-pending';
  }
  return 'dry-run-only';
}

function buildDispatchPlan(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  preflight: ZavorthExternalActionPreflight,
  approval: ZavorthExternalActionApprovalRequest,
  sourceRecord: ZavorthExternalActionIntentSourceRecord,
  index: number,
): ZavorthExternalActionDispatchPlan {
  return {
    nativeContract: 'ZavorthExternalActionDispatchPlan/v1',
    id: `${idPrefix}:dispatch-plan-${index + 1}`,
    intentId: intent.id,
    preflightId: preflight.id,
    approvalRequestId: approval.id,
    actionKind: intent.actionKind,
    planState: planState(preflight),
    controlLevel: preflight.controlLevel,
    futureExecutableLevel: 'executable-future',
    governedExecutorBoundary: GOVERNED_EXECUTOR_BOUNDARY,
    executorEntrypoint: GOVERNED_EXECUTOR_BOUNDARY.entrypoint,
    directExternalInvocationAllowed: false,
    rollbackOrCompensationPlanRequired: sourceRecord.requiresRollbackOrCompensation,
    rollbackOrCompensationPlanPresent: sourceRecord.requiresRollbackOrCompensation,
    dispatchDeferredToFutureGate: true,
    executionActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function receiptStatus(preflight: ZavorthExternalActionPreflight): ZavorthExternalActionReceiptStatus {
  if (preflight.decision === 'blocked') {
    return 'blocked-by-policy';
  }
  if (preflight.decision === 'approval-required') {
    return 'approval-requested';
  }
  return 'simulated-dry-run';
}

function buildReceipt(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  preflight: ZavorthExternalActionPreflight,
  dispatchPlan: ZavorthExternalActionDispatchPlan,
  index: number,
): ZavorthExternalActionReceipt {
  return {
    nativeContract: 'ZavorthExternalActionReceipt/v1',
    id: `${idPrefix}:receipt-${index + 1}`,
    intentId: intent.id,
    preflightId: preflight.id,
    dispatchPlanId: dispatchPlan.id,
    status: receiptStatus(preflight),
    auditAuthority: 'zavorth-audit-receipt',
    simulated: true,
    sideEffectFree: true,
    executionActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

export function createZavorthExternalActionDispatchExecutionGate(): ZavorthExternalActionDispatchExecutionGate {
  return {
    executionActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

export function createZavorthExternalActionDispatchDesignFixtureRecords(): ZavorthExternalActionIntentSourceRecord[] {
  return [
    {
      fixtureCase: 'read-only-gateway-method-dry-run',
      publicIntentIdSeed: 'gateway-method-read-only-health',
      actionKind: 'gateway-method-call',
      capabilityCategory: 'gateway-method-capabilities',
      requestedControlLevel: 'read-only',
      requestedMutation: false,
      risk: 'safe',
      requiresRollbackOrCompensation: false,
      requestedTools: ['external.gateway.health.read'],
      sourceApprovalHints: ['source says safe; evidence only'],
      sourceEvidenceHints: ['authenticated health already closed by prior gate'],
    },
    {
      fixtureCase: 'mutable-message-send-approval-required',
      publicIntentIdSeed: 'message-send-future',
      actionKind: 'message-send',
      capabilityCategory: 'channel-capabilities',
      requestedControlLevel: 'approval-required',
      requestedMutation: true,
      risk: 'attention',
      requiresRollbackOrCompensation: true,
      requestedTools: ['external.channel.message.send'],
      sourceApprovalHints: ['source send shape observed; not authority'],
      sourceEvidenceHints: ['channel capability visible as read-only metadata'],
    },
    {
      fixtureCase: 'dangerous-command-tool-blocked',
      publicIntentIdSeed: 'command-tool-dangerous',
      actionKind: 'command-tool-execution',
      capabilityCategory: 'command-http-capabilities',
      requestedControlLevel: 'blocked',
      requestedMutation: true,
      risk: 'danger',
      requiresRollbackOrCompensation: true,
      requestedTools: ['external.command.execute'],
      sourceApprovalHints: ['source approval hint ignored'],
      sourceEvidenceHints: ['command/http execution remains blocked'],
    },
    {
      fixtureCase: 'mutable-provider-execution-approval-required',
      publicIntentIdSeed: 'provider-execution-future',
      actionKind: 'provider-execution',
      capabilityCategory: 'provider-capabilities',
      requestedControlLevel: 'approval-required',
      requestedMutation: true,
      risk: 'attention',
      requiresRollbackOrCompensation: false,
      requestedTools: ['external.provider.invoke'],
      sourceApprovalHints: ['provider credential must remain SecretRef'],
      sourceEvidenceHints: ['provider capability visible as inventory only'],
    },
    {
      fixtureCase: 'session-history-mutation-blocked',
      publicIntentIdSeed: 'session-history-mutation',
      actionKind: 'session-history-mutation',
      capabilityCategory: 'session-history-capabilities',
      requestedControlLevel: 'blocked',
      requestedMutation: true,
      risk: 'danger',
      requiresRollbackOrCompensation: true,
      requestedTools: ['external.session.history.write'],
      sourceApprovalHints: ['history import authority not present'],
      sourceEvidenceHints: ['session/history bridge is read-only'],
    },
  ];
}

export function normalizeZavorthExternalActionDispatchDesign<TRuntimeId extends string>(
  options: ZavorthExternalActionDispatchDesignOptions<TRuntimeId>,
): ZavorthExternalActionDispatchDesignNormalization {
  const intents = options.records.map((record, index) => (
    buildIntent(options.idPrefix, options.zavorthControlAssimilation, record, index)
  ));
  const preflights = intents.map((intent, index) => buildPreflight(options.idPrefix, intent, index));
  const approvalRequests = intents.map((intent, index) => (
    buildApprovalRequest(options.idPrefix, intent, preflights[index], index)
  ));
  const dispatchPlans = intents.map((intent, index) => (
    buildDispatchPlan(options.idPrefix, intent, preflights[index], approvalRequests[index], options.records[index], index)
  ));
  const receipts = intents.map((intent, index) => (
    buildReceipt(options.idPrefix, intent, preflights[index], dispatchPlans[index], index)
  ));
  const zavorthControlAssimilationReady =
    options.zavorthControlAssimilation.decision === 'zavorthControl-live-assimilation-ready' &&
    options.zavorthControlAssimilation.executionGate.executionAuthority === false &&
    options.zavorthControlAssimilation.viewModel.sourceRuntimeNamePublic === false &&
    options.zavorthControlAssimilation.viewModel.sourceStructuresPublic === false;
  const noExecution =
    options.executionGate.executionActuallyPerformed === false &&
    options.executionGate.messageActuallySent === false &&
    options.executionGate.providerActuallyExecuted === false &&
    options.executionGate.commandActuallyExecuted === false &&
    options.executionGate.gatewayMutationActuallyCalled === false &&
    options.executionGate.sessionMutationActuallyPerformed === false &&
    options.executionGate.sourceAuthorityGranted === false &&
    options.executionGate.sourceModuleCopied === false &&
    options.executionGate.nativeReplacementAuthorized === false &&
    options.executionGate.rawSecretSerialized === false;

  return {
    nativeContract: 'ZavorthControlledActionDispatchDesign/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: zavorthControlAssimilationReady && noExecution
      ? 'controlled-action-dispatch-design-ready'
      : 'blocked',
    readOnlyDesignOnly: true,
    zavorthControlAssimilationReady,
    governedExecutorBoundary: GOVERNED_EXECUTOR_BOUNDARY,
    supportedControlLevels: ['read-only', 'dry-run', 'approval-required', 'blocked', 'executable-future'],
    intents,
    preflights,
    approvalRequests,
    dispatchPlans,
    receipts,
    executionGate: options.executionGate,
    redaction: {
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-controlled-action-dispatch-fixture-or-dry-run-only-gate',
  };
}

export function normalizeZavorthExternalActionDispatchDesignFixture(): ZavorthExternalActionDispatchDesignNormalization {
  return normalizeZavorthExternalActionDispatchDesign({
    zavorthControlAssimilation: normalizeExternalAgentZavorthControlLiveAssimilationFixture(),
    records: createZavorthExternalActionDispatchDesignFixtureRecords(),
    executionGate: createZavorthExternalActionDispatchExecutionGate(),
    generatedAt: EXTERNAL_AGENT_CONTROLLED_ACTION_DISPATCH_DESIGN_NOW,
    runtimeId: EXTERNAL_AGENT_CONTROLLED_ACTION_DISPATCH_DESIGN_RUNTIME_ID,
    idPrefix: 'external-agent-controlled-action-dispatch',
  });
}
