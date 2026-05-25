import {
  normalizeApprovedMutationExecutionHarnessFixture,
} from './ExternalAgentApprovedMutationExecutionHarness.js';
import {
  normalizeApprovalGrantContractFixture,
} from './ExternalAgentApprovalGrantContract.js';
import {
  normalizeExternalAgentDashboardLiveAssimilationFixture,
} from './ExternalAgentDashboardLiveAssimilation.js';
import {
  normalizeFirstLiveMutationMicroSliceFixture,
} from './ExternalAgentFirstLiveMutationMicroSlice.js';
import {
  normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  UniversalAgentChannel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ZavorthApprovedMutationExecutionHarnessNormalization,
} from './ExternalAgentApprovedMutationExecutionHarness.js';
import type {
  ZavorthApprovalGrantContractNormalization,
} from './ExternalAgentApprovalGrantContract.js';
import type {
  ExternalAgentDashboardLiveAssimilationNormalization,
} from './ExternalAgentDashboardLiveAssimilation.js';
import type {
  ZavorthFirstLiveMutationMicroSliceNormalization,
} from './ExternalAgentFirstLiveMutationMicroSlice.js';
import type {
  ZavorthExternalSessionView,
  ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';

export const EXTERNAL_AGENT_MESSAGE_SEND_LIVE_REHEARSAL_TRANSPORT_BLOCKED_NOW = '2026-04-29T00:00:00.000Z' as const;
export const EXTERNAL_AGENT_MESSAGE_SEND_LIVE_REHEARSAL_TRANSPORT_BLOCKED_RUNTIME_ID = 'external-agent-message-send-live-rehearsal-transport-blocked' as const;

export type ZavorthMessageSendLiveRehearsalTransportBlockedDecision =
  | 'message-send-live-rehearsal-transport-blocked-ready'
  | 'blocked';

export type ZavorthMessageSendFixtureCase =
  | 'approved-message-send-transport-blocked'
  | 'duplicate-idempotency-transport-blocked'
  | 'invalid-target-degraded'
  | 'policy-blocked-message-send'
  | 'sensitive-content-redacted'
  | 'without-approval-awaiting-approval';

export type ZavorthMessageSendPolicyDecision =
  | 'approval-required'
  | 'approved'
  | 'blocked'
  | 'degraded';

export type ZavorthMessageSendPlanState =
  | 'approved-executable'
  | 'awaiting-approval'
  | 'blocked'
  | 'degraded';

export type ZavorthMessageSendReceiptStatus =
  | 'awaiting-approval'
  | 'blocked'
  | 'degraded-invalid-target'
  | 'idempotent-replay-transport-blocked'
  | 'transport-blocked';

export type ZavorthMessageSendSourceRecord = {
  fixtureCase: ZavorthMessageSendFixtureCase;
  sessionIndex: number;
  rawMessage: string;
  targetValid: boolean;
  approvalGrantValid: boolean;
  policyDecision: ZavorthMessageSendPolicyDecision;
  idempotencyKey: string;
  duplicateOf?: string;
};

export type ZavorthExternalMessageSendTarget = {
  nativeContract: 'ZavorthExternalMessageSendTarget/v1';
  sessionViewId: string;
  stableSessionId: string;
  dashboardSessionViewId: string;
  channel: UniversalAgentChannel;
  stableThreadId: string;
  targetStatus: 'degraded' | 'ready' | 'unavailable' | 'unknown';
  targetValid: boolean;
  sourceIdsEvidenceOnly: true;
  rawTargetSerialized: false;
};

export type ZavorthExternalMessageSendIntent = {
  nativeContract: 'ZavorthExternalMessageSendIntent/v1';
  id: string;
  fixtureCase: ZavorthMessageSendFixtureCase;
  target: ZavorthExternalMessageSendTarget;
  content: {
    contentPreview: '[redacted-content]';
    sensitiveContentRedacted: true;
    rawContentSerialized: false;
  };
  idempotencyKey: string;
  messageSendFlowModeled: true;
  sourceCapabilityEvidenceOnly: true;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalMessageSendPreflight = {
  nativeContract: 'ZavorthExternalMessageSendPreflight/v1';
  id: string;
  intentId: string;
  fixtureCase: ZavorthMessageSendFixtureCase;
  decision: ZavorthMessageSendPolicyDecision;
  approvalRequired: boolean;
  policyAuthority: 'zavorth-policy-preflight';
  targetValid: boolean;
  sourcePolicyAuthority: false;
  messageActuallySent: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalMessageSendApprovalGrant = {
  nativeContract: 'ZavorthExternalMessageSendApprovalGrant/v1';
  id: string;
  intentId: string;
  preflightId: string;
  fixtureCase: ZavorthMessageSendFixtureCase;
  approvalState: 'approved' | 'awaiting-approval' | 'blocked' | 'degraded';
  approvalGrantValid: boolean;
  approvedExecutable: boolean;
  approverIdentityRedacted: true;
  ttlSeconds: number | null;
  idempotencyKey: string;
  sourceApprovalAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalMessageSendDispatchPlan = {
  nativeContract: 'ZavorthExternalMessageSendDispatchPlan/v1';
  id: string;
  intentId: string;
  preflightId: string;
  approvalGrantId: string;
  fixtureCase: ZavorthMessageSendFixtureCase;
  planState: ZavorthMessageSendPlanState;
  transportMode: 'transport-blocked';
  executableFuture: boolean;
  executableNowInThisGate: false;
  idempotencyKey: string;
  idempotencyState: 'duplicate-replay' | 'unique';
  target: ZavorthExternalMessageSendTarget;
  sourceCapabilityEvidenceOnly: true;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalMessageSendTransportAdapterBoundary = {
  nativeContract: 'ZavorthExternalMessageSendTransportAdapterBoundary/v1';
  id: string;
  dispatchPlanId: string;
  adapterKind: 'external-executor-derived-channel-transport';
  futureInterfacePrepared: true;
  transportAdapterBoundaryCreated: true;
  transportLiveBlocked: true;
  externalTransportInvoked: false;
  commandArgTokenUsed: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalMessageSendReceipt = {
  nativeContract: 'ZavorthExternalMessageSendReceipt/v1';
  id: string;
  intentId: string;
  dispatchPlanId: string;
  transportBoundaryId: string;
  fixtureCase: ZavorthMessageSendFixtureCase;
  status: ZavorthMessageSendReceiptStatus;
  target: ZavorthExternalMessageSendTarget;
  contentPreview: '[redacted-content]';
  auditAuthority: 'zavorth-audit-receipt';
  redacted: true;
  messageSendFlowModeled: true;
  transportAdapterBoundaryCreated: true;
  transportLiveBlocked: true;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  externalTransportInvoked: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
  rawContentSerialized: false;
};

export type ZavorthMessageSendLiveRehearsalTransportBlockedRow = {
  nativeContract: 'ZavorthMessageSendLiveRehearsalTransportBlockedRow/v1';
  id: string;
  fixtureCase: ZavorthMessageSendFixtureCase;
  intentId: string;
  preflightId: string;
  approvalGrantId: string;
  dispatchPlanId: string;
  transportBoundaryId: string;
  receiptId: string;
  planState: ZavorthMessageSendPlanState;
  receiptStatus: ZavorthMessageSendReceiptStatus;
  messageActuallySent: false;
};

export type ZavorthMessageSendLiveRehearsalTransportBlockedGate = {
  messageSendFlowModeled: true;
  transportAdapterBoundaryCreated: true;
  transportLiveBlocked: true;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  externalTransportInvoked: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthMessageSendLiveRehearsalTransportBlockedNormalization = {
  nativeContract: 'ZavorthMessageSendLiveRehearsalTransportBlocked/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthMessageSendLiveRehearsalTransportBlockedDecision;
  sourceReadiness: {
    sessionHistoryReady: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization['decision'];
    dashboardReady: ExternalAgentDashboardLiveAssimilationNormalization['decision'];
    approvalGrantReady: ZavorthApprovalGrantContractNormalization['decision'];
    executionHarnessReady: ZavorthApprovedMutationExecutionHarnessNormalization['decision'];
    firstLiveMutationDecision: ZavorthFirstLiveMutationMicroSliceNormalization['decision'];
  };
  intents: ZavorthExternalMessageSendIntent[];
  preflights: ZavorthExternalMessageSendPreflight[];
  approvalGrants: ZavorthExternalMessageSendApprovalGrant[];
  dispatchPlans: ZavorthExternalMessageSendDispatchPlan[];
  transportBoundaries: ZavorthExternalMessageSendTransportAdapterBoundary[];
  receipts: ZavorthExternalMessageSendReceipt[];
  rows: ZavorthMessageSendLiveRehearsalTransportBlockedRow[];
  executionGate: ZavorthMessageSendLiveRehearsalTransportBlockedGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    receiptsRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-explicit-message-send-transport-gate';
};

export type ZavorthMessageSendLiveRehearsalTransportBlockedOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  sessionHistory: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization;
  dashboard: ExternalAgentDashboardLiveAssimilationNormalization;
  approvalGrant: ZavorthApprovalGrantContractNormalization;
  executionHarness: ZavorthApprovedMutationExecutionHarnessNormalization;
  firstLiveMutation: ZavorthFirstLiveMutationMicroSliceNormalization;
  records: ZavorthMessageSendSourceRecord[];
};

function fallbackSessionView(sessionHistory: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization): ZavorthExternalSessionView {
  return sessionHistory.sessionViews[0] ?? {
    nativeContract: 'ZavorthExternalSessionView/v1',
    id: 'zavorth-session-view:unavailable',
    stableSessionId: 'zavorth-session:unavailable',
    title: 'Unavailable session target',
    status: 'unavailable',
    source: {
      runtime: 'ExternalExecutor',
      sourceKind: 'session-history-read-only',
      sourceEvidenceAlias: 'source-session:unavailable',
      sourceIdsEvidenceOnly: true,
    },
    channel: 'api',
    participantMetadata: {
      participantCount: 0,
      participantKinds: ['unknown'],
      rawParticipantIdsSerialized: false,
    },
    timestamps: {
      createdAt: null,
      updatedAt: null,
      timestampPrecision: 'source-metadata',
    },
    threadLinkage: {
      stableThreadId: 'zavorth-thread:unavailable',
      sourceThreadAlias: 'source-thread:unavailable',
      rawThreadIdSerialized: false,
    },
    messages: [],
    messageCount: 0,
    readOnly: true,
    importAuthority: false,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceDbOpenedForWrite: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
  };
}

function buildTarget(
  sessionHistory: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
  dashboard: ExternalAgentDashboardLiveAssimilationNormalization,
  record: ZavorthMessageSendSourceRecord,
): ZavorthExternalMessageSendTarget {
  const session = sessionHistory.sessionViews[record.sessionIndex] ?? fallbackSessionView(sessionHistory);
  const dashboardSession = dashboard.viewModel.sessions.find((candidate) => (
    candidate.channel === session.channel && candidate.status === session.status
  )) ?? dashboard.viewModel.sessions[0];

  return {
    nativeContract: 'ZavorthExternalMessageSendTarget/v1',
    sessionViewId: session.id,
    stableSessionId: session.stableSessionId,
    dashboardSessionViewId: dashboardSession?.id ?? 'zavorth-dashboard-session:unavailable',
    channel: session.channel,
    stableThreadId: session.threadLinkage.stableThreadId,
    targetStatus: session.status,
    targetValid: record.targetValid && session.status === 'ready',
    sourceIdsEvidenceOnly: true,
    rawTargetSerialized: false,
  };
}

function planStateFor(
  record: ZavorthMessageSendSourceRecord,
  target: ZavorthExternalMessageSendTarget,
): ZavorthMessageSendPlanState {
  if (!target.targetValid) {
    return 'degraded';
  }

  if (record.policyDecision === 'blocked') {
    return 'blocked';
  }

  if (!record.approvalGrantValid) {
    return 'awaiting-approval';
  }

  return 'approved-executable';
}

function receiptStatusFor(
  record: ZavorthMessageSendSourceRecord,
  target: ZavorthExternalMessageSendTarget,
  planState: ZavorthMessageSendPlanState,
  duplicate: boolean,
): ZavorthMessageSendReceiptStatus {
  if (!target.targetValid) {
    return 'degraded-invalid-target';
  }

  if (planState === 'blocked') {
    return 'blocked';
  }

  if (planState === 'awaiting-approval') {
    return 'awaiting-approval';
  }

  if (duplicate || record.duplicateOf) {
    return 'idempotent-replay-transport-blocked';
  }

  return 'transport-blocked';
}

function buildIntent(
  idPrefix: string,
  record: ZavorthMessageSendSourceRecord,
  target: ZavorthExternalMessageSendTarget,
  index: number,
): ZavorthExternalMessageSendIntent {
  return {
    nativeContract: 'ZavorthExternalMessageSendIntent/v1',
    id: `${idPrefix}:intent-${index + 1}`,
    fixtureCase: record.fixtureCase,
    target,
    content: {
      contentPreview: '[redacted-content]',
      sensitiveContentRedacted: true,
      rawContentSerialized: false,
    },
    idempotencyKey: record.idempotencyKey,
    messageSendFlowModeled: true,
    sourceCapabilityEvidenceOnly: true,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

function buildPreflight(
  idPrefix: string,
  intent: ZavorthExternalMessageSendIntent,
  record: ZavorthMessageSendSourceRecord,
  target: ZavorthExternalMessageSendTarget,
  index: number,
): ZavorthExternalMessageSendPreflight {
  return {
    nativeContract: 'ZavorthExternalMessageSendPreflight/v1',
    id: `${idPrefix}:preflight-${index + 1}`,
    intentId: intent.id,
    fixtureCase: record.fixtureCase,
    decision: target.targetValid ? record.policyDecision : 'degraded',
    approvalRequired: target.targetValid && !record.approvalGrantValid && record.policyDecision !== 'blocked',
    policyAuthority: 'zavorth-policy-preflight',
    targetValid: target.targetValid,
    sourcePolicyAuthority: false,
    messageActuallySent: false,
    rawSecretSerialized: false,
  };
}

function buildApprovalGrant(
  idPrefix: string,
  intent: ZavorthExternalMessageSendIntent,
  preflight: ZavorthExternalMessageSendPreflight,
  record: ZavorthMessageSendSourceRecord,
  target: ZavorthExternalMessageSendTarget,
  index: number,
): ZavorthExternalMessageSendApprovalGrant {
  let approvalState: ZavorthExternalMessageSendApprovalGrant['approvalState'];
  if (!target.targetValid) {
    approvalState = 'degraded';
  } else if (record.policyDecision === 'blocked') {
    approvalState = 'blocked';
  } else if (!record.approvalGrantValid) {
    approvalState = 'awaiting-approval';
  } else {
    approvalState = 'approved';
  }

  return {
    nativeContract: 'ZavorthExternalMessageSendApprovalGrant/v1',
    id: `${idPrefix}:approval-grant-${index + 1}`,
    intentId: intent.id,
    preflightId: preflight.id,
    fixtureCase: record.fixtureCase,
    approvalState,
    approvalGrantValid: record.approvalGrantValid,
    approvedExecutable: approvalState === 'approved',
    approverIdentityRedacted: true,
    ttlSeconds: approvalState === 'approved' ? 300 : null,
    idempotencyKey: record.idempotencyKey,
    sourceApprovalAuthority: false,
    rawSecretSerialized: false,
  };
}

function buildDispatchPlan(
  idPrefix: string,
  intent: ZavorthExternalMessageSendIntent,
  preflight: ZavorthExternalMessageSendPreflight,
  approvalGrant: ZavorthExternalMessageSendApprovalGrant,
  target: ZavorthExternalMessageSendTarget,
  planState: ZavorthMessageSendPlanState,
  duplicate: boolean,
  index: number,
): ZavorthExternalMessageSendDispatchPlan {
  return {
    nativeContract: 'ZavorthExternalMessageSendDispatchPlan/v1',
    id: `${idPrefix}:dispatch-plan-${index + 1}`,
    intentId: intent.id,
    preflightId: preflight.id,
    approvalGrantId: approvalGrant.id,
    fixtureCase: intent.fixtureCase,
    planState,
    transportMode: 'transport-blocked',
    executableFuture: planState === 'approved-executable',
    executableNowInThisGate: false,
    idempotencyKey: intent.idempotencyKey,
    idempotencyState: duplicate ? 'duplicate-replay' : 'unique',
    target,
    sourceCapabilityEvidenceOnly: true,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

function buildTransportBoundary(
  idPrefix: string,
  dispatchPlan: ZavorthExternalMessageSendDispatchPlan,
  index: number,
): ZavorthExternalMessageSendTransportAdapterBoundary {
  return {
    nativeContract: 'ZavorthExternalMessageSendTransportAdapterBoundary/v1',
    id: `${idPrefix}:transport-boundary-${index + 1}`,
    dispatchPlanId: dispatchPlan.id,
    adapterKind: 'external-executor-derived-channel-transport',
    futureInterfacePrepared: true,
    transportAdapterBoundaryCreated: true,
    transportLiveBlocked: true,
    externalTransportInvoked: false,
    commandArgTokenUsed: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function buildReceipt(
  idPrefix: string,
  intent: ZavorthExternalMessageSendIntent,
  dispatchPlan: ZavorthExternalMessageSendDispatchPlan,
  transportBoundary: ZavorthExternalMessageSendTransportAdapterBoundary,
  status: ZavorthMessageSendReceiptStatus,
  index: number,
): ZavorthExternalMessageSendReceipt {
  return {
    nativeContract: 'ZavorthExternalMessageSendReceipt/v1',
    id: `${idPrefix}:receipt-${index + 1}`,
    intentId: intent.id,
    dispatchPlanId: dispatchPlan.id,
    transportBoundaryId: transportBoundary.id,
    fixtureCase: intent.fixtureCase,
    status,
    target: intent.target,
    contentPreview: '[redacted-content]',
    auditAuthority: 'zavorth-audit-receipt',
    redacted: true,
    messageSendFlowModeled: true,
    transportAdapterBoundaryCreated: true,
    transportLiveBlocked: true,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    externalTransportInvoked: false,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
    rawContentSerialized: false,
  };
}

export function createMessageSendLiveRehearsalSourceRecords(): ZavorthMessageSendSourceRecord[] {
  return [
    {
      fixtureCase: 'approved-message-send-transport-blocked',
      sessionIndex: 0,
      rawMessage: 'Hello from Zavorth rehearsal',
      targetValid: true,
      approvalGrantValid: true,
      policyDecision: 'approved',
      idempotencyKey: 'message-send-rehearsal:approved:1',
    },
    {
      fixtureCase: 'without-approval-awaiting-approval',
      sessionIndex: 0,
      rawMessage: 'Approval is missing',
      targetValid: true,
      approvalGrantValid: false,
      policyDecision: 'approval-required',
      idempotencyKey: 'message-send-rehearsal:awaiting-approval:1',
    },
    {
      fixtureCase: 'policy-blocked-message-send',
      sessionIndex: 0,
      rawMessage: 'Policy blocked message',
      targetValid: true,
      approvalGrantValid: false,
      policyDecision: 'blocked',
      idempotencyKey: 'message-send-rehearsal:policy-blocked:1',
    },
    {
      fixtureCase: 'sensitive-content-redacted',
      sessionIndex: 0,
      rawMessage: 'message with synthetic-sensitive-message-content',
      targetValid: true,
      approvalGrantValid: true,
      policyDecision: 'approved',
      idempotencyKey: 'message-send-rehearsal:sensitive-redacted:1',
    },
    {
      fixtureCase: 'duplicate-idempotency-transport-blocked',
      sessionIndex: 0,
      rawMessage: 'Duplicate message rehearsal',
      targetValid: true,
      approvalGrantValid: true,
      policyDecision: 'approved',
      idempotencyKey: 'message-send-rehearsal:approved:1',
      duplicateOf: 'approved-message-send-transport-blocked',
    },
    {
      fixtureCase: 'invalid-target-degraded',
      sessionIndex: 1,
      rawMessage: 'Invalid target rehearsal',
      targetValid: false,
      approvalGrantValid: true,
      policyDecision: 'approved',
      idempotencyKey: 'message-send-rehearsal:invalid-target:1',
    },
  ];
}

export function normalizeMessageSendLiveRehearsalTransportBlocked<TRuntimeId extends string>(
  options: ZavorthMessageSendLiveRehearsalTransportBlockedOptions<TRuntimeId>,
): ZavorthMessageSendLiveRehearsalTransportBlockedNormalization {
  const seenIdempotency = new Set<string>();
  const intents: ZavorthExternalMessageSendIntent[] = [];
  const preflights: ZavorthExternalMessageSendPreflight[] = [];
  const approvalGrants: ZavorthExternalMessageSendApprovalGrant[] = [];
  const dispatchPlans: ZavorthExternalMessageSendDispatchPlan[] = [];
  const transportBoundaries: ZavorthExternalMessageSendTransportAdapterBoundary[] = [];
  const receipts: ZavorthExternalMessageSendReceipt[] = [];
  const rows: ZavorthMessageSendLiveRehearsalTransportBlockedRow[] = [];

  options.records.forEach((record, index) => {
    const target = buildTarget(options.sessionHistory, options.dashboard, record);
    const duplicate = seenIdempotency.has(record.idempotencyKey);
    const planState = planStateFor(record, target);
    const status = receiptStatusFor(record, target, planState, duplicate);
    const intent = buildIntent(options.idPrefix, record, target, index);
    const preflight = buildPreflight(options.idPrefix, intent, record, target, index);
    const approvalGrant = buildApprovalGrant(options.idPrefix, intent, preflight, record, target, index);
    const dispatchPlan = buildDispatchPlan(options.idPrefix, intent, preflight, approvalGrant, target, planState, duplicate, index);
    const transportBoundary = buildTransportBoundary(options.idPrefix, dispatchPlan, index);
    const receipt = buildReceipt(options.idPrefix, intent, dispatchPlan, transportBoundary, status, index);

    seenIdempotency.add(record.idempotencyKey);
    intents.push(intent);
    preflights.push(preflight);
    approvalGrants.push(approvalGrant);
    dispatchPlans.push(dispatchPlan);
    transportBoundaries.push(transportBoundary);
    receipts.push(receipt);
    rows.push({
      nativeContract: 'ZavorthMessageSendLiveRehearsalTransportBlockedRow/v1',
      id: `${options.idPrefix}:row-${index + 1}`,
      fixtureCase: record.fixtureCase,
      intentId: intent.id,
      preflightId: preflight.id,
      approvalGrantId: approvalGrant.id,
      dispatchPlanId: dispatchPlan.id,
      transportBoundaryId: transportBoundary.id,
      receiptId: receipt.id,
      planState,
      receiptStatus: status,
      messageActuallySent: false,
    });
  });

  return {
    nativeContract: 'ZavorthMessageSendLiveRehearsalTransportBlocked/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'message-send-live-rehearsal-transport-blocked-ready',
    sourceReadiness: {
      sessionHistoryReady: options.sessionHistory.decision,
      dashboardReady: options.dashboard.decision,
      approvalGrantReady: options.approvalGrant.decision,
      executionHarnessReady: options.executionHarness.decision,
      firstLiveMutationDecision: options.firstLiveMutation.decision,
    },
    intents,
    preflights,
    approvalGrants,
    dispatchPlans,
    transportBoundaries,
    receipts,
    rows,
    executionGate: {
      messageSendFlowModeled: true,
      transportAdapterBoundaryCreated: true,
      transportLiveBlocked: true,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      gatewayMutationActuallyCalled: false,
      sessionMutationActuallyPerformed: false,
      externalTransportInvoked: false,
      sourceAuthorityGranted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    },
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-explicit-message-send-transport-gate',
  };
}

export function normalizeMessageSendLiveRehearsalTransportBlockedFixture(): ZavorthMessageSendLiveRehearsalTransportBlockedNormalization {
  return normalizeMessageSendLiveRehearsalTransportBlocked({
    generatedAt: EXTERNAL_AGENT_MESSAGE_SEND_LIVE_REHEARSAL_TRANSPORT_BLOCKED_NOW,
    runtimeId: EXTERNAL_AGENT_MESSAGE_SEND_LIVE_REHEARSAL_TRANSPORT_BLOCKED_RUNTIME_ID,
    idPrefix: 'external-agent-message-send-live-rehearsal-transport-blocked',
    sessionHistory: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(),
    dashboard: normalizeExternalAgentDashboardLiveAssimilationFixture(),
    approvalGrant: normalizeApprovalGrantContractFixture(),
    executionHarness: normalizeApprovedMutationExecutionHarnessFixture(),
    firstLiveMutation: normalizeFirstLiveMutationMicroSliceFixture(),
    records: createMessageSendLiveRehearsalSourceRecords(),
  });
}
