import {
  createZavorthWave4DFirstControlledRealMessageSendFixture,
} from './ZavorthWave4DFirstControlledRealMessageSend.js';
import type {
  ZavorthWave4DFirstControlledRealMessageSendReceipt,
} from './ZavorthWave4DFirstControlledRealMessageSend.js';

export const ZAVORTH_WAVE4D_MESSAGE_SEND_EXPANSION_AND_AUDIT_PACK_NOW = '2026-05-01T11:00:00.000Z' as const;
export const ZAVORTH_WAVE4D_MESSAGE_SEND_EXPANSION_AND_AUDIT_PACK_RUNTIME_ID = 'zavorth-wave4d-message-send-expansion-and-audit-pack' as const;

export type ZavorthWave4DMessageSendExpansionPackDecision =
  | 'blocked'
  | 'wave4d-message-send-expansion-and-audit-pack-ready';

export type ZavorthWave4DMessageSendTargetClass =
  | 'limited-approved'
  | 'production-blocked'
  | 'sandbox-test'
  | 'unknown-blocked';

export type ZavorthWave4DMessageSendExpansionCriterionId =
  | 'approval-grant-real'
  | 'dry-run-ready-for-live-approval'
  | 'idempotency-unused'
  | 'limited-approved-target-mark'
  | 'policy-recheck'
  | 'rate-limit'
  | 'rollback-compensation'
  | 'secretref-secure-resolver';

export type ZavorthWave4DMessageSendAuditHardeningId =
  | 'ack-status-recording'
  | 'degraded-failure-receipt'
  | 'duplicate-prevention'
  | 'redacted-receipts'
  | 'test-harness-provenance'
  | 'transport-cleanup';

export type ZavorthWave4DMessageSendFirstSendMilestone = {
  nativeContract: 'ZavorthWave4DMessageSendFirstControlledSendMilestone/v1';
  sourceGate: '238';
  receiptDecision: ZavorthWave4DFirstControlledRealMessageSendReceipt['decision'];
  messageCount: 0 | 1;
  ackStatus: ZavorthWave4DFirstControlledRealMessageSendReceipt['transportReceipt']['ackStatus'];
  idempotencyKey: string;
  policyRecheckAccepted: true;
  approvalGrantRealPresent: true;
  cleanupConfirmed: boolean;
  testHarnessSandboxEvidence: boolean;
  receiptRedacted: boolean;
  firstControlledSendMilestoneRecorded: true;
  newMessageActuallySentInThisPack: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4DMessageSendTargetPolicy = {
  nativeContract: 'ZavorthWave4DMessageSendTargetPolicy/v1';
  targetClass: ZavorthWave4DMessageSendTargetClass;
  policyDisposition:
    | 'allowed-only-with-existing-sandbox-gates'
    | 'blocked-unknown'
    | 'blocked-unrestricted-production'
    | 'prepared-requires-future-explicit-gate';
  futureSendAllowedByThisPack: false;
  approvalRequiredForFutureSend: true;
  dryRunRequiredForFutureSend: true;
  idempotencyRequired: true;
  rateLimitRequired: boolean;
  rollbackCompensationRequired: boolean;
  unrestrictedProductionSendAllowed: false;
};

export type ZavorthWave4DMessageSendExpansionCriterion = {
  nativeContract: 'ZavorthWave4DMessageSendExpansionCriterion/v1';
  criterionId: ZavorthWave4DMessageSendExpansionCriterionId;
  requiredForLimitedApprovedTarget: true;
  currentDisposition: 'ready-from-238' | 'prepared-for-future-gate' | 'required-future-explicit';
  evidenceGates: string[];
  goNoGo: 'go-for-future-pack-only' | 'no-go-without-future-gate';
  rawSecretSerialized: false;
};

export type ZavorthWave4DMessageSendAuditHardening = {
  nativeContract: 'ZavorthWave4DMessageSendAuditHardening/v1';
  hardeningId: ZavorthWave4DMessageSendAuditHardeningId;
  status: 'implemented-for-238' | 'prepared-for-expansion';
  evidence: string[];
  userFacingSecretSerialized: false;
  rawContentSerialized: false;
};

export type ZavorthWave4DMessageSendExpansionRecommendation = {
  nativeContract: 'ZavorthWave4DMessageSendExpansionRecommendation/v1';
  nextDomain: 'provider-execution-absorption-pack';
  rationale: string;
  messageSendProductionExpansionStillBlocked: true;
  providerRealExecutionAllowedByThisPack: false;
  toolCommandRealExecutionAllowedByThisPack: false;
};

export type ZavorthWave4DMessageSendExpansionGate = {
  messageSendExpansionPackCreated: true;
  firstControlledSendMilestoneRecorded: true;
  limitedApprovedTargetPolicyPrepared: true;
  unrestrictedProductionSendAllowed: false;
  approvalRequiredForFutureSend: true;
  dryRunRequiredForFutureSend: true;
  idempotencyRequired: true;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  rawContentUsageAllowed: false;
  rawSecretSerialized: false;
  adapterRemovalGlobalAllowed: false;
  newMessageActuallySentInThisPack: false;
};

export type ZavorthWave4DMessageSendExpansionSource = {
  realMessageSendReadinessReady: true;
  testTargetProvisioningReady: true;
  finalDryRunReady: true;
  firstControlledSendReady: true;
  messageDryRunExecutablesReady: true;
  actionGovernancePipelineReady: true;
  firstControlledSendReceipt: ZavorthWave4DFirstControlledRealMessageSendReceipt;
  limitedApprovedTargetCandidatePrepared: boolean;
  unrestrictedProductionSendRequested: boolean;
  newMessageSendAttemptedInThisPack: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  rawContentUsageAttempted: false;
  externalExecutorMutationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  rawSecretSerialized: false;
  publicExternalExecutorIdentityExposed: false;
};

export type ZavorthWave4DMessageSendExpansionAndAuditPackNormalization = {
  nativeContract: 'ZavorthWave4DMessageSendExpansionAndAuditPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4D_MESSAGE_SEND_EXPANSION_AND_AUDIT_PACK_RUNTIME_ID;
  decision: ZavorthWave4DMessageSendExpansionPackDecision;
  status: 'blocked' | 'wave4d-message-send-expansion-and-audit-pack-ready';
  sourceReadiness: ZavorthWave4DMessageSendExpansionSource;
  firstControlledSendMilestone: ZavorthWave4DMessageSendFirstSendMilestone;
  targetPolicies: ZavorthWave4DMessageSendTargetPolicy[];
  expansionCriteria: ZavorthWave4DMessageSendExpansionCriterion[];
  auditHardening: ZavorthWave4DMessageSendAuditHardening[];
  recommendation: ZavorthWave4DMessageSendExpansionRecommendation;
  executionGate: ZavorthWave4DMessageSendExpansionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    sourceIdentityPublic: false;
    receiptsRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'provider-execution-absorption-pack';
};

export type ZavorthWave4DMessageSendExpansionAndAuditPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4D_MESSAGE_SEND_EXPANSION_AND_AUDIT_PACK_RUNTIME_ID;
  source: ZavorthWave4DMessageSendExpansionSource;
};

function milestone(receipt: ZavorthWave4DFirstControlledRealMessageSendReceipt): ZavorthWave4DMessageSendFirstSendMilestone {
  return {
    nativeContract: 'ZavorthWave4DMessageSendFirstControlledSendMilestone/v1',
    sourceGate: '238',
    receiptDecision: receipt.decision,
    messageCount: receipt.transportReceipt.messageCount,
    ackStatus: receipt.transportReceipt.ackStatus,
    idempotencyKey: receipt.liveSendPlan.idempotencyKey,
    policyRecheckAccepted: true,
    approvalGrantRealPresent: true,
    cleanupConfirmed: receipt.cleanupReceipt.cleanupConfirmed,
    testHarnessSandboxEvidence: receipt.transportReceipt.openedOnlyForApprovedTestTarget,
    receiptRedacted: !receipt.rawSecretSerialized && !receipt.rawContentUsageAllowed,
    firstControlledSendMilestoneRecorded: true,
    newMessageActuallySentInThisPack: false,
    rawSecretSerialized: false,
  };
}

function targetPolicies(): ZavorthWave4DMessageSendTargetPolicy[] {
  return [
    {
      nativeContract: 'ZavorthWave4DMessageSendTargetPolicy/v1',
      targetClass: 'sandbox-test',
      policyDisposition: 'allowed-only-with-existing-sandbox-gates',
      futureSendAllowedByThisPack: false,
      approvalRequiredForFutureSend: true,
      dryRunRequiredForFutureSend: true,
      idempotencyRequired: true,
      rateLimitRequired: true,
      rollbackCompensationRequired: true,
      unrestrictedProductionSendAllowed: false,
    },
    {
      nativeContract: 'ZavorthWave4DMessageSendTargetPolicy/v1',
      targetClass: 'limited-approved',
      policyDisposition: 'prepared-requires-future-explicit-gate',
      futureSendAllowedByThisPack: false,
      approvalRequiredForFutureSend: true,
      dryRunRequiredForFutureSend: true,
      idempotencyRequired: true,
      rateLimitRequired: true,
      rollbackCompensationRequired: true,
      unrestrictedProductionSendAllowed: false,
    },
    {
      nativeContract: 'ZavorthWave4DMessageSendTargetPolicy/v1',
      targetClass: 'production-blocked',
      policyDisposition: 'blocked-unrestricted-production',
      futureSendAllowedByThisPack: false,
      approvalRequiredForFutureSend: true,
      dryRunRequiredForFutureSend: true,
      idempotencyRequired: true,
      rateLimitRequired: true,
      rollbackCompensationRequired: true,
      unrestrictedProductionSendAllowed: false,
    },
    {
      nativeContract: 'ZavorthWave4DMessageSendTargetPolicy/v1',
      targetClass: 'unknown-blocked',
      policyDisposition: 'blocked-unknown',
      futureSendAllowedByThisPack: false,
      approvalRequiredForFutureSend: true,
      dryRunRequiredForFutureSend: true,
      idempotencyRequired: true,
      rateLimitRequired: true,
      rollbackCompensationRequired: true,
      unrestrictedProductionSendAllowed: false,
    },
  ];
}

function criterion(
  criterionId: ZavorthWave4DMessageSendExpansionCriterionId,
  currentDisposition: ZavorthWave4DMessageSendExpansionCriterion['currentDisposition'],
  evidenceGates: string[],
): ZavorthWave4DMessageSendExpansionCriterion {
  return {
    nativeContract: 'ZavorthWave4DMessageSendExpansionCriterion/v1',
    criterionId,
    requiredForLimitedApprovedTarget: true,
    currentDisposition,
    evidenceGates,
    goNoGo: currentDisposition === 'ready-from-238' ? 'go-for-future-pack-only' : 'no-go-without-future-gate',
    rawSecretSerialized: false,
  };
}

function expansionCriteria(): ZavorthWave4DMessageSendExpansionCriterion[] {
  return [
    criterion('limited-approved-target-mark', 'required-future-explicit', ['236', '237', '238']),
    criterion('approval-grant-real', 'ready-from-238', ['179', '180', '238']),
    criterion('dry-run-ready-for-live-approval', 'ready-from-238', ['237', '238']),
    criterion('idempotency-unused', 'ready-from-238', ['231', '232', '237', '238']),
    criterion('policy-recheck', 'ready-from-238', ['174', '175', '180', '238']),
    criterion('rate-limit', 'prepared-for-future-gate', ['224', '236', '238']),
    criterion('rollback-compensation', 'prepared-for-future-gate', ['180', '236', '238']),
    criterion('secretref-secure-resolver', 'ready-from-238', ['157', '187', '236', '238']),
  ];
}

function auditHardening(): ZavorthWave4DMessageSendAuditHardening[] {
  const rows: Array<Pick<ZavorthWave4DMessageSendAuditHardening, 'hardeningId' | 'status' | 'evidence'>> = [
    { hardeningId: 'redacted-receipts', status: 'implemented-for-238', evidence: ['238 receipt redaction'] },
    { hardeningId: 'ack-status-recording', status: 'implemented-for-238', evidence: ['238 transport receipt ack/status'] },
    { hardeningId: 'duplicate-prevention', status: 'implemented-for-238', evidence: ['238 idempotency duplicate block'] },
    { hardeningId: 'degraded-failure-receipt', status: 'implemented-for-238', evidence: ['238 degraded ack-unavailable receipt'] },
    { hardeningId: 'transport-cleanup', status: 'implemented-for-238', evidence: ['238 cleanup receipt'] },
    { hardeningId: 'test-harness-provenance', status: 'prepared-for-expansion', evidence: ['236 target provisioning', '238 sandbox evidence'] },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4DMessageSendAuditHardening/v1',
    ...row,
    userFacingSecretSerialized: false,
    rawContentSerialized: false,
  }));
}

function recommendation(): ZavorthWave4DMessageSendExpansionRecommendation {
  return {
    nativeContract: 'ZavorthWave4DMessageSendExpansionRecommendation/v1',
    nextDomain: 'provider-execution-absorption-pack',
    rationale: 'Message send now has a sandbox/test milestone and expansion policy; the next absorption domain should prepare provider execution with comparable governance before broadening message send targets.',
    messageSendProductionExpansionStillBlocked: true,
    providerRealExecutionAllowedByThisPack: false,
    toolCommandRealExecutionAllowedByThisPack: false,
  };
}

function executionGate(): ZavorthWave4DMessageSendExpansionGate {
  return {
    messageSendExpansionPackCreated: true,
    firstControlledSendMilestoneRecorded: true,
    limitedApprovedTargetPolicyPrepared: true,
    unrestrictedProductionSendAllowed: false,
    approvalRequiredForFutureSend: true,
    dryRunRequiredForFutureSend: true,
    idempotencyRequired: true,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    rawContentUsageAllowed: false,
    rawSecretSerialized: false,
    adapterRemovalGlobalAllowed: false,
    newMessageActuallySentInThisPack: false,
  };
}

function sourceReady(source: ZavorthWave4DMessageSendExpansionSource): boolean {
  return (
    source.realMessageSendReadinessReady &&
    source.testTargetProvisioningReady &&
    source.finalDryRunReady &&
    source.firstControlledSendReady &&
    source.messageDryRunExecutablesReady &&
    source.actionGovernancePipelineReady &&
    source.firstControlledSendReceipt.decision === 'live-send-ok' &&
    source.firstControlledSendReceipt.transportReceipt.messageCount === 1 &&
    source.firstControlledSendReceipt.cleanupReceipt.cleanupConfirmed &&
    !source.unrestrictedProductionSendRequested &&
    !source.newMessageSendAttemptedInThisPack &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.rawContentUsageAttempted &&
    !source.externalExecutorMutationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.rawSecretSerialized &&
    !source.publicExternalExecutorIdentityExposed
  );
}

export class ZavorthWave4DMessageSendExpansionAndAuditPack {
  public constructor(public readonly normalization: ZavorthWave4DMessageSendExpansionAndAuditPackNormalization) {}

  public targetPolicy(targetClass: ZavorthWave4DMessageSendTargetClass): ZavorthWave4DMessageSendTargetPolicy | undefined {
    return this.normalization.targetPolicies.find((policy) => policy.targetClass === targetClass);
  }

  public productionSendStillBlocked(): boolean {
    return this.targetPolicy('production-blocked')?.unrestrictedProductionSendAllowed === false &&
      this.normalization.executionGate.unrestrictedProductionSendAllowed === false;
  }

  public newMessageSentInThisPack(): boolean {
    return this.normalization.executionGate.newMessageActuallySentInThisPack;
  }
}

export function createZavorthWave4DMessageSendExpansionSource(
  overrides: Partial<ZavorthWave4DMessageSendExpansionSource> = {},
): ZavorthWave4DMessageSendExpansionSource {
  return {
    realMessageSendReadinessReady: true,
    testTargetProvisioningReady: true,
    finalDryRunReady: true,
    firstControlledSendReady: true,
    messageDryRunExecutablesReady: true,
    actionGovernancePipelineReady: true,
    firstControlledSendReceipt: createZavorthWave4DFirstControlledRealMessageSendFixture({
      featureFlagEnabled: true,
    }).receipt,
    limitedApprovedTargetCandidatePrepared: true,
    unrestrictedProductionSendRequested: false,
    newMessageSendAttemptedInThisPack: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    rawContentUsageAttempted: false,
    externalExecutorMutationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    rawSecretSerialized: false,
    publicExternalExecutorIdentityExposed: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4DMessageSendExpansionAndAuditPack(
  options: ZavorthWave4DMessageSendExpansionAndAuditPackOptions,
): ZavorthWave4DMessageSendExpansionAndAuditPackNormalization {
  const firstSendMilestone = milestone(options.source.firstControlledSendReceipt);
  const ready = sourceReady(options.source) &&
    firstSendMilestone.firstControlledSendMilestoneRecorded &&
    firstSendMilestone.newMessageActuallySentInThisPack === false;

  return {
    nativeContract: 'ZavorthWave4DMessageSendExpansionAndAuditPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4d-message-send-expansion-and-audit-pack-ready' : 'blocked',
    status: ready ? 'wave4d-message-send-expansion-and-audit-pack-ready' : 'blocked',
    sourceReadiness: options.source,
    firstControlledSendMilestone: firstSendMilestone,
    targetPolicies: targetPolicies(),
    expansionCriteria: expansionCriteria(),
    auditHardening: auditHardening(),
    recommendation: recommendation(),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      sourceIdentityPublic: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'provider-execution-absorption-pack',
  };
}

export function createZavorthWave4DMessageSendExpansionAndAuditPackFixture(
  overrides: Partial<ZavorthWave4DMessageSendExpansionSource> = {},
): ZavorthWave4DMessageSendExpansionAndAuditPack {
  return new ZavorthWave4DMessageSendExpansionAndAuditPack(
    normalizeZavorthWave4DMessageSendExpansionAndAuditPack({
      generatedAt: ZAVORTH_WAVE4D_MESSAGE_SEND_EXPANSION_AND_AUDIT_PACK_NOW,
      runtimeId: ZAVORTH_WAVE4D_MESSAGE_SEND_EXPANSION_AND_AUDIT_PACK_RUNTIME_ID,
      source: createZavorthWave4DMessageSendExpansionSource(overrides),
    }),
  );
}
