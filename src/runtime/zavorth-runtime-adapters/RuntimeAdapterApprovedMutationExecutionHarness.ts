import {
  GOVERNED_EXECUTOR_BOUNDARY,
} from '../agent/executors/GovernedExecutorAdapter.js';
import {
  normalizeApprovalGrantContractFixture,
} from './RuntimeAdapterApprovalGrantContract.js';
import type {
  GovernedExecutorBoundary,
} from '../agent/executors/GovernedExecutorAdapter.js';
import type {
  ZavorthMutableExternalActionKind,
} from './RuntimeAdapterApprovalRequiredMutationRehearsal.js';
import type {
  ZavorthApprovalGrantContractNormalization,
  ZavorthApprovalGrantFixtureCase,
} from './RuntimeAdapterApprovalGrantContract.js';

export const RUNTIME_ADAPTER_APPROVED_MUTATION_EXECUTION_HARNESS_NOW = '2026-04-29T00:00:00.000Z' as const;
export const RUNTIME_ADAPTER_APPROVED_MUTATION_EXECUTION_HARNESS_RUNTIME_ID = 'runtime-adapter-approved-mutation-execution-harness' as const;

export type ZavorthApprovedMutationExecutionHarnessDecision =
  | 'approved-mutation-execution-harness-ready'
  | 'blocked';

export type ZavorthApprovedMutationExecutionMode =
  | 'dry-run-approved'
  | 'live';

export type ZavorthApprovedMutationExecutionFixtureCase =
  | 'approval-expired-before-execution'
  | 'approval-revoked-before-execution'
  | 'degraded-failure-receipt'
  | 'dry-run-approved-success'
  | 'live-execution-blocked'
  | 'policy-invalidated-before-execution'
  | 'unsupported-executor';

export type ZavorthApprovedMutationExecutionReceiptStatus =
  | 'approval-expired'
  | 'approval-revoked'
  | 'degraded-failure'
  | 'dry-run-approved-success'
  | 'live-blocked'
  | 'policy-invalidated'
  | 'unsupported-executor';

export type ZavorthApprovedMutationExecutionSourceRecord = {
  fixtureCase: ZavorthApprovedMutationExecutionFixtureCase;
  sourceApprovalFixtureCase: ZavorthApprovalGrantFixtureCase;
  mode: ZavorthApprovedMutationExecutionMode;
  policyRecheckPasses: boolean;
  approvalTtlValid: boolean;
  approvalRevoked: boolean;
  executorSupported: boolean;
  idempotencyKey: string;
  idempotencyFresh: boolean;
  simulateDegradedFailure: boolean;
};

export type ZavorthApprovedMutationPreExecutionCheck = {
  nativeContract: 'ZavorthApprovedMutationPreExecutionCheck/v1';
  id: string;
  sourceGrantId: string;
  sourceTransitionId: string;
  sourceDispatchPlanId: string;
  actionKind: ZavorthMutableExternalActionKind;
  mode: ZavorthApprovedMutationExecutionMode;
  acceptedSourcePlanState: 'approved-executable';
  policyRevalidated: true;
  policyRecheckPassed: boolean;
  approvalTtlRevalidated: true;
  approvalTtlValid: boolean;
  approvalRevocationRevalidated: true;
  approvalNotRevoked: boolean;
  idempotencyRevalidated: true;
  idempotencyKey: string;
  idempotencyFresh: boolean;
  executorSupported: boolean;
  governedExecutorBoundary: GovernedExecutorBoundary;
  liveExecutionBlockedByGate: boolean;
  dryRunApprovedExecutionAllowed: boolean;
  liveMutationExecutionAllowed: false;
  sourceCapabilityEvidenceOnly: true;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthApprovedMutationExecutionPlan = {
  nativeContract: 'ZavorthApprovedMutationExecutionHarnessPlan/v1';
  id: string;
  sourceGrantId: string;
  sourceTransitionId: string;
  sourceDispatchPlanId: string;
  preExecutionCheckId: string;
  actionKind: ZavorthMutableExternalActionKind;
  mode: ZavorthApprovedMutationExecutionMode;
  sourcePlanAccepted: true;
  sourcePlanState: 'approved-executable';
  dryRunApprovedExecutionAllowed: boolean;
  liveMutationExecutionAllowed: false;
  governedExecutorBoundary: GovernedExecutorBoundary;
  executorEntrypoint: GovernedExecutorBoundary['entrypoint'];
  externalAdapterInvokedForMutation: false;
  sourceCapabilityEvidenceOnly: true;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthApprovedMutationExecutionReceipt = {
  nativeContract: 'ZavorthApprovedMutationExecutionReceipt/v1';
  id: string;
  executionPlanId: string;
  preExecutionCheckId: string;
  sourceGrantId: string;
  sourceTransitionId: string;
  sourceDispatchPlanId: string;
  actionKind: ZavorthMutableExternalActionKind;
  status: ZavorthApprovedMutationExecutionReceiptStatus;
  auditAuthority: 'zavorth-audit-receipt';
  simulated: true;
  redacted: true;
  sideEffectFree: true;
  approvedMutationHarnessCreated: true;
  dryRunApprovedExecutionAllowed: boolean;
  liveMutationExecutionAllowed: false;
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

export type ZavorthApprovedMutationExecutionHarnessRow = {
  nativeContract: 'ZavorthApprovedMutationExecutionHarnessRow/v1';
  id: string;
  fixtureCase: ZavorthApprovedMutationExecutionFixtureCase;
  sourceApprovalFixtureCase: ZavorthApprovalGrantFixtureCase;
  actionKind: ZavorthMutableExternalActionKind;
  mode: ZavorthApprovedMutationExecutionMode;
  sourcePlanState: 'approved-executable';
  receiptStatus: ZavorthApprovedMutationExecutionReceiptStatus;
  executionPlanId: string;
  preExecutionCheckId: string;
  receiptId: string;
  zeroMutationSideEffects: true;
};

export type ZavorthApprovedMutationExecutionHarnessGate = {
  approvedMutationHarnessCreated: true;
  dryRunApprovedExecutionAllowed: true;
  liveMutationExecutionAllowed: false;
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

export type ZavorthApprovedMutationExecutionHarnessNormalization = {
  nativeContract: 'ZavorthApprovedMutationExecutionHarness/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthApprovedMutationExecutionHarnessDecision;
  sourceApprovalDecision: ZavorthApprovalGrantContractNormalization['decision'];
  preExecutionChecks: ZavorthApprovedMutationPreExecutionCheck[];
  executionPlans: ZavorthApprovedMutationExecutionPlan[];
  receipts: ZavorthApprovedMutationExecutionReceipt[];
  rows: ZavorthApprovedMutationExecutionHarnessRow[];
  executionGate: ZavorthApprovedMutationExecutionHarnessGate;
  redaction: {
    rawSecretSerialized: false;
    receiptsRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-controlled-live-mutation-execution-gate';
};

export type ZavorthApprovedMutationExecutionHarnessOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  sourceApproval: ZavorthApprovalGrantContractNormalization;
  records: ZavorthApprovedMutationExecutionSourceRecord[];
  executionGate: ZavorthApprovedMutationExecutionHarnessGate;
};

function resolveStatus(record: ZavorthApprovedMutationExecutionSourceRecord): ZavorthApprovedMutationExecutionReceiptStatus {
  if (record.mode === 'live') {
    return 'live-blocked';
  }

  if (!record.policyRecheckPasses) {
    return 'policy-invalidated';
  }

  if (!record.approvalTtlValid) {
    return 'approval-expired';
  }

  if (record.approvalRevoked) {
    return 'approval-revoked';
  }

  if (!record.executorSupported) {
    return 'unsupported-executor';
  }

  if (record.simulateDegradedFailure) {
    return 'degraded-failure';
  }

  return 'dry-run-approved-success';
}

function findApprovedSource(
  sourceApproval: ZavorthApprovalGrantContractNormalization,
  record: ZavorthApprovedMutationExecutionSourceRecord,
): {
  grantId: string;
  transitionId: string;
  dispatchPlanId: string;
  actionKind: ZavorthMutableExternalActionKind;
} {
  const row = sourceApproval.rows.find((candidate) => candidate.fixtureCase === record.sourceApprovalFixtureCase);
  if (!row) {
    throw new Error(`Missing approval grant row for ${record.sourceApprovalFixtureCase}`);
  }

  const transition = sourceApproval.transitions.find((candidate) => candidate.id === row.transitionId);
  if (!transition) {
    throw new Error(`Missing approval transition for ${record.sourceApprovalFixtureCase}`);
  }

  if (transition.toPlanState !== 'approved-executable') {
    throw new Error(`Approved mutation harness only accepts approved-executable plans: ${record.sourceApprovalFixtureCase}`);
  }

  return {
    grantId: row.grantId,
    transitionId: row.transitionId,
    dispatchPlanId: transition.dispatchPlanId,
    actionKind: row.actionKind,
  };
}

function buildPreExecutionCheck(
  idPrefix: string,
  source: ReturnType<typeof findApprovedSource>,
  record: ZavorthApprovedMutationExecutionSourceRecord,
  index: number,
): ZavorthApprovedMutationPreExecutionCheck {
  const status = resolveStatus(record);

  return {
    nativeContract: 'ZavorthApprovedMutationPreExecutionCheck/v1',
    id: `${idPrefix}:pre-execution-check-${index + 1}`,
    sourceGrantId: source.grantId,
    sourceTransitionId: source.transitionId,
    sourceDispatchPlanId: source.dispatchPlanId,
    actionKind: source.actionKind,
    mode: record.mode,
    acceptedSourcePlanState: 'approved-executable',
    policyRevalidated: true,
    policyRecheckPassed: record.policyRecheckPasses,
    approvalTtlRevalidated: true,
    approvalTtlValid: record.approvalTtlValid,
    approvalRevocationRevalidated: true,
    approvalNotRevoked: !record.approvalRevoked,
    idempotencyRevalidated: true,
    idempotencyKey: record.idempotencyKey,
    idempotencyFresh: record.idempotencyFresh,
    executorSupported: record.executorSupported,
    governedExecutorBoundary: GOVERNED_EXECUTOR_BOUNDARY,
    liveExecutionBlockedByGate: record.mode === 'live',
    dryRunApprovedExecutionAllowed: status === 'dry-run-approved-success',
    liveMutationExecutionAllowed: false,
    sourceCapabilityEvidenceOnly: true,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

function buildExecutionPlan(
  idPrefix: string,
  source: ReturnType<typeof findApprovedSource>,
  check: ZavorthApprovedMutationPreExecutionCheck,
  index: number,
): ZavorthApprovedMutationExecutionPlan {
  return {
    nativeContract: 'ZavorthApprovedMutationExecutionHarnessPlan/v1',
    id: `${idPrefix}:execution-plan-${index + 1}`,
    sourceGrantId: source.grantId,
    sourceTransitionId: source.transitionId,
    sourceDispatchPlanId: source.dispatchPlanId,
    preExecutionCheckId: check.id,
    actionKind: source.actionKind,
    mode: check.mode,
    sourcePlanAccepted: true,
    sourcePlanState: 'approved-executable',
    dryRunApprovedExecutionAllowed: check.dryRunApprovedExecutionAllowed,
    liveMutationExecutionAllowed: false,
    governedExecutorBoundary: GOVERNED_EXECUTOR_BOUNDARY,
    executorEntrypoint: GOVERNED_EXECUTOR_BOUNDARY.entrypoint,
    externalAdapterInvokedForMutation: false,
    sourceCapabilityEvidenceOnly: true,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

function buildReceipt(
  idPrefix: string,
  source: ReturnType<typeof findApprovedSource>,
  check: ZavorthApprovedMutationPreExecutionCheck,
  plan: ZavorthApprovedMutationExecutionPlan,
  record: ZavorthApprovedMutationExecutionSourceRecord,
  index: number,
): ZavorthApprovedMutationExecutionReceipt {
  const status = resolveStatus(record);

  return {
    nativeContract: 'ZavorthApprovedMutationExecutionReceipt/v1',
    id: `${idPrefix}:receipt-${index + 1}`,
    executionPlanId: plan.id,
    preExecutionCheckId: check.id,
    sourceGrantId: source.grantId,
    sourceTransitionId: source.transitionId,
    sourceDispatchPlanId: source.dispatchPlanId,
    actionKind: source.actionKind,
    status,
    auditAuthority: 'zavorth-audit-receipt',
    simulated: true,
    redacted: true,
    sideEffectFree: true,
    approvedMutationHarnessCreated: true,
    dryRunApprovedExecutionAllowed: status === 'dry-run-approved-success',
    liveMutationExecutionAllowed: false,
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

export function createApprovedMutationExecutionHarnessGate(): ZavorthApprovedMutationExecutionHarnessGate {
  return {
    approvedMutationHarnessCreated: true,
    dryRunApprovedExecutionAllowed: true,
    liveMutationExecutionAllowed: false,
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

export function createApprovedMutationExecutionHarnessFixtureRecords(): ZavorthApprovedMutationExecutionSourceRecord[] {
  return [
    {
      fixtureCase: 'dry-run-approved-success',
      sourceApprovalFixtureCase: 'message-send-valid-grant',
      mode: 'dry-run-approved',
      policyRecheckPasses: true,
      approvalTtlValid: true,
      approvalRevoked: false,
      executorSupported: true,
      idempotencyKey: 'approved-mutation-harness:dry-run-success:1',
      idempotencyFresh: true,
      simulateDegradedFailure: false,
    },
    {
      fixtureCase: 'live-execution-blocked',
      sourceApprovalFixtureCase: 'message-send-valid-grant',
      mode: 'live',
      policyRecheckPasses: true,
      approvalTtlValid: true,
      approvalRevoked: false,
      executorSupported: true,
      idempotencyKey: 'approved-mutation-harness:live-blocked:1',
      idempotencyFresh: true,
      simulateDegradedFailure: false,
    },
    {
      fixtureCase: 'policy-invalidated-before-execution',
      sourceApprovalFixtureCase: 'message-send-valid-grant',
      mode: 'dry-run-approved',
      policyRecheckPasses: false,
      approvalTtlValid: true,
      approvalRevoked: false,
      executorSupported: true,
      idempotencyKey: 'approved-mutation-harness:policy-invalidated:1',
      idempotencyFresh: true,
      simulateDegradedFailure: false,
    },
    {
      fixtureCase: 'approval-expired-before-execution',
      sourceApprovalFixtureCase: 'message-send-valid-grant',
      mode: 'dry-run-approved',
      policyRecheckPasses: true,
      approvalTtlValid: false,
      approvalRevoked: false,
      executorSupported: true,
      idempotencyKey: 'approved-mutation-harness:approval-expired:1',
      idempotencyFresh: true,
      simulateDegradedFailure: false,
    },
    {
      fixtureCase: 'approval-revoked-before-execution',
      sourceApprovalFixtureCase: 'message-send-valid-grant',
      mode: 'dry-run-approved',
      policyRecheckPasses: true,
      approvalTtlValid: true,
      approvalRevoked: true,
      executorSupported: true,
      idempotencyKey: 'approved-mutation-harness:approval-revoked:1',
      idempotencyFresh: true,
      simulateDegradedFailure: false,
    },
    {
      fixtureCase: 'unsupported-executor',
      sourceApprovalFixtureCase: 'message-send-valid-grant',
      mode: 'dry-run-approved',
      policyRecheckPasses: true,
      approvalTtlValid: true,
      approvalRevoked: false,
      executorSupported: false,
      idempotencyKey: 'approved-mutation-harness:unsupported-executor:1',
      idempotencyFresh: true,
      simulateDegradedFailure: false,
    },
    {
      fixtureCase: 'degraded-failure-receipt',
      sourceApprovalFixtureCase: 'message-send-valid-grant',
      mode: 'dry-run-approved',
      policyRecheckPasses: true,
      approvalTtlValid: true,
      approvalRevoked: false,
      executorSupported: true,
      idempotencyKey: 'approved-mutation-harness:degraded-failure:1',
      idempotencyFresh: true,
      simulateDegradedFailure: true,
    },
  ];
}

export function normalizeApprovedMutationExecutionHarness<TRuntimeId extends string>(
  options: ZavorthApprovedMutationExecutionHarnessOptions<TRuntimeId>,
): ZavorthApprovedMutationExecutionHarnessNormalization {
  const preExecutionChecks: ZavorthApprovedMutationPreExecutionCheck[] = [];
  const executionPlans: ZavorthApprovedMutationExecutionPlan[] = [];
  const receipts: ZavorthApprovedMutationExecutionReceipt[] = [];
  const rows: ZavorthApprovedMutationExecutionHarnessRow[] = [];

  options.records.forEach((record, index) => {
    const source = findApprovedSource(options.sourceApproval, record);
    const check = buildPreExecutionCheck(options.idPrefix, source, record, index);
    const plan = buildExecutionPlan(options.idPrefix, source, check, index);
    const receipt = buildReceipt(options.idPrefix, source, check, plan, record, index);

    preExecutionChecks.push(check);
    executionPlans.push(plan);
    receipts.push(receipt);
    rows.push({
      nativeContract: 'ZavorthApprovedMutationExecutionHarnessRow/v1',
      id: `${options.idPrefix}:row-${index + 1}`,
      fixtureCase: record.fixtureCase,
      sourceApprovalFixtureCase: record.sourceApprovalFixtureCase,
      actionKind: source.actionKind,
      mode: record.mode,
      sourcePlanState: 'approved-executable',
      receiptStatus: receipt.status,
      executionPlanId: plan.id,
      preExecutionCheckId: check.id,
      receiptId: receipt.id,
      zeroMutationSideEffects: true,
    });
  });

  return {
    nativeContract: 'ZavorthApprovedMutationExecutionHarness/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'approved-mutation-execution-harness-ready',
    sourceApprovalDecision: options.sourceApproval.decision,
    preExecutionChecks,
    executionPlans,
    receipts,
    rows,
    executionGate: options.executionGate,
    redaction: {
      rawSecretSerialized: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-controlled-live-mutation-execution-gate',
  };
}

export function normalizeApprovedMutationExecutionHarnessFixture(): ZavorthApprovedMutationExecutionHarnessNormalization {
  return normalizeApprovedMutationExecutionHarness({
    generatedAt: RUNTIME_ADAPTER_APPROVED_MUTATION_EXECUTION_HARNESS_NOW,
    runtimeId: RUNTIME_ADAPTER_APPROVED_MUTATION_EXECUTION_HARNESS_RUNTIME_ID,
    idPrefix: 'runtime-adapter-approved-mutation-execution-harness',
    sourceApproval: normalizeApprovalGrantContractFixture(),
    records: createApprovedMutationExecutionHarnessFixtureRecords(),
    executionGate: createApprovedMutationExecutionHarnessGate(),
  });
}
