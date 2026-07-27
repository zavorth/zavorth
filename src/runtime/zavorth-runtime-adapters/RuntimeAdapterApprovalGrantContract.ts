import {
  normalizeApprovalRequiredMutationRehearsalFixture,
} from './RuntimeAdapterApprovalRequiredMutationRehearsal.js';
import type {
  ZavorthApprovalRequiredMutationRehearsalNormalization,
  ZavorthMutableActionApprovalRequest,
  ZavorthMutableActionDispatchPlan,
  ZavorthMutableExternalActionKind,
  ZavorthMutationRehearsalFixtureCase,
  ZavorthMutationRehearsalRow,
} from './RuntimeAdapterApprovalRequiredMutationRehearsal.js';

export const RUNTIME_ADAPTER_APPROVAL_GRANT_CONTRACT_NOW = '2026-04-29T00:00:00.000Z' as const;
export const RUNTIME_ADAPTER_APPROVAL_GRANT_CONTRACT_RUNTIME_ID = 'runtime-adapter-approval-grant-contract' as const;

export type ZavorthApprovalGrantContractDecision =
  | 'approval-grant-contract-ready'
  | 'blocked';

export type ZavorthApprovalGrantOperation =
  | 'expire'
  | 'grant'
  | 'reject'
  | 'revoke';

export type ZavorthApprovalGrantPlanState =
  | 'approved-executable'
  | 'awaiting-approval'
  | 'expired'
  | 'policy-invalidated'
  | 'rejected'
  | 'revoked';

export type ZavorthApprovalGrantFixtureCase =
  | 'duplicate-idempotency-replay'
  | 'gateway-mutation-revoked'
  | 'message-send-valid-grant'
  | 'provider-execution-policy-invalidated'
  | 'provider-execution-rejected'
  | 'scope-mismatch-blocked'
  | 'session-history-expired'
  | 'insufficient-approver-blocked';

export type ZavorthApprovalGrantApproverRole =
  | 'observer'
  | 'operator'
  | 'runtime-admin';

export type ZavorthApprovalGrantIdempotencyState =
  | 'duplicate-replay'
  | 'unique';

export type ZavorthApprovalGrantBlockedReason =
  | 'insufficient-approver'
  | 'policy-recheck-failed'
  | 'scope-mismatch';

export type ZavorthApprovalGrantSourceRecord = {
  fixtureCase: ZavorthApprovalGrantFixtureCase;
  sourceRehearsalFixtureCase: ZavorthMutationRehearsalFixtureCase;
  operation: ZavorthApprovalGrantOperation;
  approverIdentityRef: string;
  approverRole: ZavorthApprovalGrantApproverRole;
  exactScopeMatchesRequest: boolean;
  policyRecheckPasses: boolean;
  ttlSeconds: number;
  idempotencyKey: string;
  requestedScopeOverride?: string;
};

export type ZavorthExternalActionApprovalScope = {
  nativeContract: 'ZavorthExternalActionApprovalScope/v1';
  actionKind: ZavorthMutableExternalActionKind;
  intentId: string;
  preflightId: string;
  approvalRequestId: string;
  dispatchPlanId: string;
  scopeHash: string;
  requestedScopeHash: string;
  exactScopeMatched: boolean;
  sourceCapabilityEvidenceOnly: true;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionApproverMetadata = {
  nativeContract: 'ZavorthExternalActionApproverMetadata/v1';
  identityRef: string;
  role: ZavorthApprovalGrantApproverRole;
  sufficientForScope: boolean;
  identityRedacted: true;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionApprovalPolicyRecheck = {
  nativeContract: 'ZavorthExternalActionApprovalPolicyRecheck/v1';
  required: true;
  performed: true;
  passed: boolean;
  policyAuthority: 'zavorth-policy-preflight';
  invalidationReason?: ZavorthApprovalGrantBlockedReason;
  sourcePolicyAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionApprovalGrant = {
  nativeContract: 'ZavorthExternalActionApprovalGrant/v1';
  id: string;
  fixtureCase: ZavorthApprovalGrantFixtureCase;
  intentId: string;
  preflightId: string;
  approvalRequestId: string;
  dispatchPlanId: string;
  actionKind: ZavorthMutableExternalActionKind;
  operation: ZavorthApprovalGrantOperation;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
  idempotencyKey: string;
  idempotencyState: ZavorthApprovalGrantIdempotencyState;
  approver: ZavorthExternalActionApproverMetadata;
  scope: ZavorthExternalActionApprovalScope;
  policyRecheck: ZavorthExternalActionApprovalPolicyRecheck;
  redacted: true;
  approvalGrantModeled: true;
  approvalActuallyGrantedInModel: boolean;
  executionActuallyPerformed: false;
  mutationActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionApprovalDispatchPlanTransition = {
  nativeContract: 'ZavorthExternalActionDispatchPlanTransition/v1';
  id: string;
  grantId: string;
  approvalRequestId: string;
  dispatchPlanId: string;
  actionKind: ZavorthMutableExternalActionKind;
  fromPlanState: 'awaiting-approval';
  toPlanState: ZavorthApprovalGrantPlanState;
  stateTransitionApplied: boolean;
  executableFuture: boolean;
  executableNowInThisGate: false;
  realExecutionBlockedThisGate: true;
  policyRecheckRequired: true;
  idempotencyKey: string;
  idempotencyState: ZavorthApprovalGrantIdempotencyState;
  blockedReason?: ZavorthApprovalGrantBlockedReason;
  reusedTransitionId?: string;
  mutationActuallyPerformed: false;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalActionApprovalAuditReceiptStatus =
  | 'approval-expired'
  | 'approval-modeled'
  | 'approval-policy-invalidated'
  | 'approval-rejected'
  | 'approval-revoked'
  | 'idempotent-replay';

export type ZavorthExternalActionApprovalAuditReceipt = {
  nativeContract: 'ZavorthExternalActionApprovalAuditReceipt/v1';
  id: string;
  grantId: string;
  transitionId: string;
  approvalRequestId: string;
  dispatchPlanId: string;
  actionKind: ZavorthMutableExternalActionKind;
  status: ZavorthExternalActionApprovalAuditReceiptStatus;
  auditAuthority: 'zavorth-audit-receipt';
  dryRun: true;
  redacted: true;
  sideEffectFree: true;
  approvalGrantModeled: true;
  approvalActuallyGrantedInModel: boolean;
  mutationActuallyPerformed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  externalAdapterInvokedForMutation: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthApprovalGrantContractRow = {
  nativeContract: 'ZavorthApprovalGrantContractRow/v1';
  id: string;
  fixtureCase: ZavorthApprovalGrantFixtureCase;
  sourceRehearsalFixtureCase: ZavorthMutationRehearsalFixtureCase;
  actionKind: ZavorthMutableExternalActionKind;
  operation: ZavorthApprovalGrantOperation;
  grantId: string;
  transitionId: string;
  receiptId: string;
  finalPlanState: ZavorthApprovalGrantPlanState;
  idempotencyState: ZavorthApprovalGrantIdempotencyState;
  blockedReason?: ZavorthApprovalGrantBlockedReason;
  zeroMutationSideEffects: true;
};

export type ZavorthApprovalGrantContractExecutionGate = {
  approvalGrantModeled: true;
  approvalActuallyGrantedInModel: true;
  mutationActuallyPerformed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  externalAdapterInvokedForMutation: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthApprovalGrantContractNormalization = {
  nativeContract: 'ZavorthApprovalGrantContract/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthApprovalGrantContractDecision;
  sourceRehearsalDecision: ZavorthApprovalRequiredMutationRehearsalNormalization['decision'];
  sourceRehearsalRows: ZavorthMutationRehearsalRow[];
  approvalGrants: ZavorthExternalActionApprovalGrant[];
  transitions: ZavorthExternalActionApprovalDispatchPlanTransition[];
  receipts: ZavorthExternalActionApprovalAuditReceipt[];
  rows: ZavorthApprovalGrantContractRow[];
  executionGate: ZavorthApprovalGrantContractExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    approverIdentityRedacted: true;
    receiptRedacted: true;
  };
  nextGateRecommended: 'future-controlled-mutation-dispatch-gate';
};

export type ZavorthApprovalGrantContractOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  sourceRehearsal: ZavorthApprovalRequiredMutationRehearsalNormalization;
  records: ZavorthApprovalGrantSourceRecord[];
  executionGate: ZavorthApprovalGrantContractExecutionGate;
};

function isApproverSufficient(role: ZavorthApprovalGrantApproverRole): boolean {
  return role === 'operator' || role === 'runtime-admin';
}

function buildScopeHash(plan: ZavorthMutableActionDispatchPlan): string {
  return `zavorth-scope:${plan.actionKind}:${plan.intentId}:${plan.approvalRequestId}`;
}

function addSeconds(issuedAt: string, ttlSeconds: number): string {
  return new Date(Date.parse(issuedAt) + ttlSeconds * 1000).toISOString();
}

function findApprovalContext(
  sourceRehearsal: ZavorthApprovalRequiredMutationRehearsalNormalization,
  record: ZavorthApprovalGrantSourceRecord,
): {
  row: ZavorthMutationRehearsalRow;
  approvalRequest: ZavorthMutableActionApprovalRequest;
  dispatchPlan: ZavorthMutableActionDispatchPlan;
} {
  const row = sourceRehearsal.rows.find((candidate) => candidate.fixtureCase === record.sourceRehearsalFixtureCase);
  if (!row) {
    throw new Error(`Missing source rehearsal row for ${record.sourceRehearsalFixtureCase}`);
  }

  const approvalRequest = sourceRehearsal.approvalRequests.find((candidate) => candidate.id === row.approvalRequestId);
  const dispatchPlan = sourceRehearsal.dispatchPlans.find((candidate) => candidate.id === row.dispatchPlanId);
  if (!approvalRequest || !dispatchPlan) {
    throw new Error(`Missing approval context for ${record.sourceRehearsalFixtureCase}`);
  }

  if (dispatchPlan.planState !== 'awaiting-approval') {
    throw new Error(`Approval grant contract can only consume awaiting-approval rows: ${record.sourceRehearsalFixtureCase}`);
  }

  return { row, approvalRequest, dispatchPlan };
}

function buildPolicyRecheck(
  record: ZavorthApprovalGrantSourceRecord,
  approverSufficient: boolean,
): ZavorthExternalActionApprovalPolicyRecheck {
  let invalidationReason: ZavorthApprovalGrantBlockedReason | undefined;
  if (!record.exactScopeMatchesRequest) {
    invalidationReason = 'scope-mismatch';
  } else if (!approverSufficient) {
    invalidationReason = 'insufficient-approver';
  } else if (!record.policyRecheckPasses) {
    invalidationReason = 'policy-recheck-failed';
  }

  return {
    nativeContract: 'ZavorthExternalActionApprovalPolicyRecheck/v1',
    required: true,
    performed: true,
    passed: invalidationReason === undefined,
    policyAuthority: 'zavorth-policy-preflight',
    ...(invalidationReason ? { invalidationReason } : {}),
    sourcePolicyAuthority: false,
    rawSecretSerialized: false,
  };
}

function resolveTargetState(
  record: ZavorthApprovalGrantSourceRecord,
  policyRecheck: ZavorthExternalActionApprovalPolicyRecheck,
): ZavorthApprovalGrantPlanState {
  if (!policyRecheck.passed) {
    return 'policy-invalidated';
  }

  switch (record.operation) {
    case 'expire':
      return 'expired';
    case 'grant':
      return 'approved-executable';
    case 'reject':
      return 'rejected';
    case 'revoke':
      return 'revoked';
  }
}

function resolveReceiptStatus(
  transition: ZavorthExternalActionApprovalDispatchPlanTransition,
): ZavorthExternalActionApprovalAuditReceiptStatus {
  if (transition.idempotencyState === 'duplicate-replay') {
    return 'idempotent-replay';
  }

  switch (transition.toPlanState) {
    case 'approved-executable':
      return 'approval-modeled';
    case 'expired':
      return 'approval-expired';
    case 'policy-invalidated':
      return 'approval-policy-invalidated';
    case 'rejected':
      return 'approval-rejected';
    case 'revoked':
      return 'approval-revoked';
    case 'awaiting-approval':
      return 'approval-policy-invalidated';
  }
}

function buildGrant(
  idPrefix: string,
  generatedAt: string,
  record: ZavorthApprovalGrantSourceRecord,
  row: ZavorthMutationRehearsalRow,
  approvalRequest: ZavorthMutableActionApprovalRequest,
  dispatchPlan: ZavorthMutableActionDispatchPlan,
  idempotencyState: ZavorthApprovalGrantIdempotencyState,
  index: number,
): ZavorthExternalActionApprovalGrant {
  const scopeHash = buildScopeHash(dispatchPlan);
  const requestedScopeHash = record.requestedScopeOverride ?? scopeHash;
  const approverSufficient = isApproverSufficient(record.approverRole);
  const policyRecheck = buildPolicyRecheck(record, approverSufficient);
  const finalState = resolveTargetState(record, policyRecheck);

  return {
    nativeContract: 'ZavorthExternalActionApprovalGrant/v1',
    id: `${idPrefix}:grant-${index + 1}`,
    fixtureCase: record.fixtureCase,
    intentId: row.intentId,
    preflightId: row.preflightId,
    approvalRequestId: approvalRequest.id,
    dispatchPlanId: dispatchPlan.id,
    actionKind: row.actionKind,
    operation: record.operation,
    issuedAt: generatedAt,
    expiresAt: addSeconds(generatedAt, record.ttlSeconds),
    ttlSeconds: record.ttlSeconds,
    idempotencyKey: record.idempotencyKey,
    idempotencyState,
    approver: {
      nativeContract: 'ZavorthExternalActionApproverMetadata/v1',
      identityRef: record.approverIdentityRef,
      role: record.approverRole,
      sufficientForScope: approverSufficient,
      identityRedacted: true,
      rawSecretSerialized: false,
    },
    scope: {
      nativeContract: 'ZavorthExternalActionApprovalScope/v1',
      actionKind: row.actionKind,
      intentId: row.intentId,
      preflightId: row.preflightId,
      approvalRequestId: approvalRequest.id,
      dispatchPlanId: dispatchPlan.id,
      scopeHash,
      requestedScopeHash,
      exactScopeMatched: record.exactScopeMatchesRequest && requestedScopeHash === scopeHash,
      sourceCapabilityEvidenceOnly: true,
      sourceAuthorityGranted: false,
      rawSecretSerialized: false,
    },
    policyRecheck,
    redacted: true,
    approvalGrantModeled: true,
    approvalActuallyGrantedInModel: finalState === 'approved-executable',
    executionActuallyPerformed: false,
    mutationActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function buildTransition(
  idPrefix: string,
  grant: ZavorthExternalActionApprovalGrant,
  index: number,
  reusedTransitionId?: string,
): ZavorthExternalActionApprovalDispatchPlanTransition {
  const toPlanState = resolveTargetState({
    fixtureCase: grant.fixtureCase,
    sourceRehearsalFixtureCase: 'message-send-approval-required',
    operation: grant.operation,
    approverIdentityRef: grant.approver.identityRef,
    approverRole: grant.approver.role,
    exactScopeMatchesRequest: grant.scope.exactScopeMatched,
    policyRecheckPasses: grant.policyRecheck.passed,
    ttlSeconds: grant.ttlSeconds,
    idempotencyKey: grant.idempotencyKey,
  }, grant.policyRecheck);
  const isDuplicate = grant.idempotencyState === 'duplicate-replay';

  return {
    nativeContract: 'ZavorthExternalActionDispatchPlanTransition/v1',
    id: `${idPrefix}:transition-${index + 1}`,
    grantId: grant.id,
    approvalRequestId: grant.approvalRequestId,
    dispatchPlanId: grant.dispatchPlanId,
    actionKind: grant.actionKind,
    fromPlanState: 'awaiting-approval',
    toPlanState,
    stateTransitionApplied: !isDuplicate,
    executableFuture: toPlanState === 'approved-executable' && !isDuplicate,
    executableNowInThisGate: false,
    realExecutionBlockedThisGate: true,
    policyRecheckRequired: true,
    idempotencyKey: grant.idempotencyKey,
    idempotencyState: grant.idempotencyState,
    ...(grant.policyRecheck.invalidationReason ? { blockedReason: grant.policyRecheck.invalidationReason } : {}),
    ...(reusedTransitionId ? { reusedTransitionId } : {}),
    mutationActuallyPerformed: false,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

function buildReceipt(
  idPrefix: string,
  grant: ZavorthExternalActionApprovalGrant,
  transition: ZavorthExternalActionApprovalDispatchPlanTransition,
  index: number,
): ZavorthExternalActionApprovalAuditReceipt {
  return {
    nativeContract: 'ZavorthExternalActionApprovalAuditReceipt/v1',
    id: `${idPrefix}:approval-receipt-${index + 1}`,
    grantId: grant.id,
    transitionId: transition.id,
    approvalRequestId: grant.approvalRequestId,
    dispatchPlanId: grant.dispatchPlanId,
    actionKind: grant.actionKind,
    status: resolveReceiptStatus(transition),
    auditAuthority: 'zavorth-audit-receipt',
    dryRun: true,
    redacted: true,
    sideEffectFree: true,
    approvalGrantModeled: true,
    approvalActuallyGrantedInModel: transition.toPlanState === 'approved-executable',
    mutationActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    externalAdapterInvokedForMutation: false,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

export function createApprovalGrantContractExecutionGate(): ZavorthApprovalGrantContractExecutionGate {
  return {
    approvalGrantModeled: true,
    approvalActuallyGrantedInModel: true,
    mutationActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    externalAdapterInvokedForMutation: false,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

export function createApprovalGrantContractFixtureRecords(): ZavorthApprovalGrantSourceRecord[] {
  return [
    {
      fixtureCase: 'message-send-valid-grant',
      sourceRehearsalFixtureCase: 'message-send-approval-required',
      operation: 'grant',
      approverIdentityRef: 'zavorth-approver:runtime-admin-redacted',
      approverRole: 'runtime-admin',
      exactScopeMatchesRequest: true,
      policyRecheckPasses: true,
      ttlSeconds: 300,
      idempotencyKey: 'approval-grant:message-send:stable-1',
    },
    {
      fixtureCase: 'duplicate-idempotency-replay',
      sourceRehearsalFixtureCase: 'message-send-approval-required',
      operation: 'grant',
      approverIdentityRef: 'zavorth-approver:runtime-admin-redacted',
      approverRole: 'runtime-admin',
      exactScopeMatchesRequest: true,
      policyRecheckPasses: true,
      ttlSeconds: 300,
      idempotencyKey: 'approval-grant:message-send:stable-1',
    },
    {
      fixtureCase: 'provider-execution-rejected',
      sourceRehearsalFixtureCase: 'provider-execution-approval-required',
      operation: 'reject',
      approverIdentityRef: 'zavorth-approver:operator-redacted',
      approverRole: 'operator',
      exactScopeMatchesRequest: true,
      policyRecheckPasses: true,
      ttlSeconds: 300,
      idempotencyKey: 'approval-grant:provider-execution:reject-1',
    },
    {
      fixtureCase: 'gateway-mutation-revoked',
      sourceRehearsalFixtureCase: 'gateway-mutation-approval-required',
      operation: 'revoke',
      approverIdentityRef: 'zavorth-approver:runtime-admin-redacted',
      approverRole: 'runtime-admin',
      exactScopeMatchesRequest: true,
      policyRecheckPasses: true,
      ttlSeconds: 120,
      idempotencyKey: 'approval-grant:gateway-mutation:revoke-1',
    },
    {
      fixtureCase: 'session-history-expired',
      sourceRehearsalFixtureCase: 'session-history-mutation-approval-required',
      operation: 'expire',
      approverIdentityRef: 'zavorth-approver:operator-redacted',
      approverRole: 'operator',
      exactScopeMatchesRequest: true,
      policyRecheckPasses: true,
      ttlSeconds: 1,
      idempotencyKey: 'approval-grant:session-history:expired-1',
    },
    {
      fixtureCase: 'provider-execution-policy-invalidated',
      sourceRehearsalFixtureCase: 'provider-execution-approval-required',
      operation: 'grant',
      approverIdentityRef: 'zavorth-approver:runtime-admin-redacted',
      approverRole: 'runtime-admin',
      exactScopeMatchesRequest: true,
      policyRecheckPasses: false,
      ttlSeconds: 300,
      idempotencyKey: 'approval-grant:provider-execution:invalidated-1',
    },
    {
      fixtureCase: 'scope-mismatch-blocked',
      sourceRehearsalFixtureCase: 'gateway-mutation-approval-required',
      operation: 'grant',
      approverIdentityRef: 'zavorth-approver:runtime-admin-redacted',
      approverRole: 'runtime-admin',
      exactScopeMatchesRequest: false,
      policyRecheckPasses: true,
      ttlSeconds: 300,
      idempotencyKey: 'approval-grant:gateway-mutation:scope-mismatch-1',
      requestedScopeOverride: 'zavorth-scope:wrong-target',
    },
    {
      fixtureCase: 'insufficient-approver-blocked',
      sourceRehearsalFixtureCase: 'session-history-mutation-approval-required',
      operation: 'grant',
      approverIdentityRef: 'zavorth-approver:observer-redacted',
      approverRole: 'observer',
      exactScopeMatchesRequest: true,
      policyRecheckPasses: true,
      ttlSeconds: 300,
      idempotencyKey: 'approval-grant:session-history:insufficient-approver-1',
    },
  ];
}

export function normalizeApprovalGrantContract<TRuntimeId extends string>(
  options: ZavorthApprovalGrantContractOptions<TRuntimeId>,
): ZavorthApprovalGrantContractNormalization {
  const seenIdempotency = new Map<string, string>();
  const approvalGrants: ZavorthExternalActionApprovalGrant[] = [];
  const transitions: ZavorthExternalActionApprovalDispatchPlanTransition[] = [];
  const receipts: ZavorthExternalActionApprovalAuditReceipt[] = [];
  const rows: ZavorthApprovalGrantContractRow[] = [];

  options.records.forEach((record, index) => {
    const { row, approvalRequest, dispatchPlan } = findApprovalContext(options.sourceRehearsal, record);
    const reusedTransitionId = seenIdempotency.get(record.idempotencyKey);
    const idempotencyState: ZavorthApprovalGrantIdempotencyState = reusedTransitionId ? 'duplicate-replay' : 'unique';
    const grant = buildGrant(
      options.idPrefix,
      options.generatedAt,
      record,
      row,
      approvalRequest,
      dispatchPlan,
      idempotencyState,
      index,
    );
    const transition = buildTransition(options.idPrefix, grant, index, reusedTransitionId);
    const receipt = buildReceipt(options.idPrefix, grant, transition, index);

    if (!reusedTransitionId) {
      seenIdempotency.set(record.idempotencyKey, transition.id);
    }

    approvalGrants.push(grant);
    transitions.push(transition);
    receipts.push(receipt);
    rows.push({
      nativeContract: 'ZavorthApprovalGrantContractRow/v1',
      id: `${options.idPrefix}:row-${index + 1}`,
      fixtureCase: record.fixtureCase,
      sourceRehearsalFixtureCase: record.sourceRehearsalFixtureCase,
      actionKind: row.actionKind,
      operation: record.operation,
      grantId: grant.id,
      transitionId: transition.id,
      receiptId: receipt.id,
      finalPlanState: transition.toPlanState,
      idempotencyState,
      ...(transition.blockedReason ? { blockedReason: transition.blockedReason } : {}),
      zeroMutationSideEffects: true,
    });
  });

  return {
    nativeContract: 'ZavorthApprovalGrantContract/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'approval-grant-contract-ready',
    sourceRehearsalDecision: options.sourceRehearsal.decision,
    sourceRehearsalRows: options.sourceRehearsal.rows,
    approvalGrants,
    transitions,
    receipts,
    rows,
    executionGate: options.executionGate,
    redaction: {
      rawSecretSerialized: false,
      approverIdentityRedacted: true,
      receiptRedacted: true,
    },
    nextGateRecommended: 'future-controlled-mutation-dispatch-gate',
  };
}

export function normalizeApprovalGrantContractFixture(): ZavorthApprovalGrantContractNormalization {
  return normalizeApprovalGrantContract({
    generatedAt: RUNTIME_ADAPTER_APPROVAL_GRANT_CONTRACT_NOW,
    runtimeId: RUNTIME_ADAPTER_APPROVAL_GRANT_CONTRACT_RUNTIME_ID,
    idPrefix: 'runtime-adapter-approval-grant-contract',
    sourceRehearsal: normalizeApprovalRequiredMutationRehearsalFixture(),
    records: createApprovalGrantContractFixtureRecords(),
    executionGate: createApprovalGrantContractExecutionGate(),
  });
}
