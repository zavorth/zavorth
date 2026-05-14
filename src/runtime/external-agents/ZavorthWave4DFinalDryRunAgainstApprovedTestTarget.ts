import {
  createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture,
} from './ZavorthWave4DRealMessageSendTestTargetProvisioningPlan.js';
import type {
  ZavorthWave4DRealMessageSendTestTargetProvisioningPlanNormalization,
} from './ZavorthWave4DRealMessageSendTestTargetProvisioningPlan.js';

export const ZAVORTH_WAVE4D_FINAL_TEST_TARGET_DRY_RUN_EXECUTE_FLAG = 'ZAVORTH_WAVE4D_FINAL_TEST_TARGET_DRY_RUN_EXECUTE' as const;
export const ZAVORTH_WAVE4D_FINAL_DRY_RUN_AGAINST_APPROVED_TEST_TARGET_NOW = '2026-05-01T09:00:00.000Z' as const;
export const ZAVORTH_WAVE4D_FINAL_DRY_RUN_AGAINST_APPROVED_TEST_TARGET_RUNTIME_ID = 'zavorth-wave4d-final-dry-run-against-approved-test-target' as const;

export type ZavorthWave4DFinalTestTargetDryRunDecision =
  | 'approval-missing'
  | 'dry-run-blocked'
  | 'dry-run-ready-for-live-approval'
  | 'execution-blocked'
  | 'missing-secretref'
  | 'policy-rejected'
  | 'target-not-approved'
  | 'transport-unconfigured';

export type ZavorthWave4DFinalTestTargetDryRunStatus =
  | 'approval-modeled'
  | 'approval-missing'
  | 'dry-run-before-live-validated'
  | 'feature-flag-disabled'
  | 'high-impact-execution-attempted'
  | 'idempotency-valid'
  | 'external-executor-touch-attempted'
  | 'policy-eligible'
  | 'policy-rejected'
  | 'raw-content-blocked'
  | 'secretref-metadata-only'
  | 'secretref-missing'
  | 'target-approved'
  | 'target-not-approved'
  | 'target-session-channel-transport-validated'
  | 'transport-open-blocked'
  | 'transport-unconfigured'
  | 'valid';

export type ZavorthWave4DFinalTestTargetDryRunFeatureFlagGate = {
  nativeContract: 'ZavorthWave4DFinalTestTargetDryRunFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4D_FINAL_TEST_TARGET_DRY_RUN_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-test';
  operatorAcknowledgedNoRealSend: boolean;
  finalTestTargetDryRunFeatureFlagRequired: true;
};

export type ZavorthWave4DFinalTestTargetDryRunSource = {
  testTargetProvisioningPlan: ZavorthWave4DRealMessageSendTestTargetProvisioningPlanNormalization;
  realMessageSendReadinessPlanReady: true;
  messageSendDryRunActionReady: true;
  transportTargetResolutionDryRunReady: true;
  targetSessionChannelValidationReady: true;
  transportReadinessCheckReady: true;
  actionGovernancePipelineReady: true;
  nativeIntegrationRegistryReady: true;
  nativeSessionHistoryRegistryReady: true;
  approvedTestTargetMarkedSandbox: boolean;
  targetSessionThreadChannelTransportValidated: boolean;
  secretRefsAvailableAsResolver: boolean;
  policyPreflightAccepted: boolean;
  approvalGrantModeledForTestTarget: boolean;
  idempotencyKeyAvailable: boolean;
  dryRunBeforeLiveEvidencePresent: boolean;
  transportConfiguredForFutureSend: boolean;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  realMessageSendAttempted: false;
  transportOpenAttempted: false;
  providerRealExecutionAttempted: false;
  toolCommandRealExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  rawContentUsageAttempted: false;
  newStateMigrationAttempted: false;
  rawSecretSerialized: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
};

export type ZavorthWave4DFinalTestTargetDryRunPlan = {
  nativeContract: 'ZavorthWave4DFinalTestTargetDryRunPlan/v1';
  planId: string;
  mode: 'final-dry-run-only';
  action: 'final-test-target-message-send-dry-run';
  planState: 'blocked' | 'ready-for-live-approval';
  testTargetCandidateId: string;
  testTargetType: string;
  targetExplicitlyMarkedTestSandbox: boolean;
  targetSessionThreadChannelTransportValidated: boolean;
  secretRefsMetadataResolverReady: boolean;
  policyPreflightAccepted: boolean;
  approvalGrantModeledForTestTarget: boolean;
  idempotencyKey: string;
  dryRunBeforeLiveEvidencePresent: boolean;
  realTransportOpenBlocked: true;
  externalTransportInvoked: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  externalExecutorTouched: false;
  rawContentUsed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4DFinalTestTargetDryRunPolicyPreflight = {
  nativeContract: 'ZavorthWave4DFinalTestTargetDryRunPolicyPreflight/v1';
  policyPreflightRequired: true;
  policyRecheckedImmediatelyBeforeExecution: true;
  approvalGrantModeledForDryRun: boolean;
  approvalRequiredBeforeFutureLiveSend: true;
  messageSendBlockedInThisGate: true;
  providerExecutionBlocked: true;
  toolCommandExecutionBlocked: true;
  externalTransportBlocked: true;
  rawContentBlocked: true;
};

export type ZavorthWave4DFinalTestTargetDryRunReceipt = {
  nativeContract: 'ZavorthWave4DFinalDryRunAgainstApprovedTestTargetReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4D_FINAL_DRY_RUN_AGAINST_APPROVED_TEST_TARGET_RUNTIME_ID;
  generatedAt: string;
  selectedCapability: 'final-dry-run-against-approved-test-target';
  decision: ZavorthWave4DFinalTestTargetDryRunDecision;
  classification: ZavorthWave4DFinalTestTargetDryRunDecision;
  validations: ZavorthWave4DFinalTestTargetDryRunStatus[];
  featureFlag: ZavorthWave4DFinalTestTargetDryRunFeatureFlagGate;
  finalSendPlan: ZavorthWave4DFinalTestTargetDryRunPlan;
  policyPreflight: ZavorthWave4DFinalTestTargetDryRunPolicyPreflight;
  sourceMetadata: {
    testTargetProvisioningPlanReady: true;
    messageSendDryRunActionReady: true;
    transportTargetResolutionDryRunReady: true;
    targetSessionChannelValidationReady: true;
    transportReadinessCheckReady: true;
    actionGovernancePipelineReady: true;
    nativeRegistriesUsed: true;
    sourceProvenanceInternalRedacted: true;
  };
  wave4dFinalDryRunAgainstApprovedTestTargetCreated: true;
  finalDryRunActuallyExecuted: boolean;
  finalDryRunActuallyExecutedOnlyWhenFlagEnabled: true;
  readyForLiveApprovalMayBeProduced: true;
  realMessageSendActuallyPerformed: false;
  transportActuallyOpened: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawContentUsageAllowed: false;
  runtimeExternalExecutorRequiredForExecution: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4DFinalDryRunOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4D_FINAL_DRY_RUN_AGAINST_APPROVED_TEST_TARGET_RUNTIME_ID;
  source: ZavorthWave4DFinalTestTargetDryRunSource;
  featureFlag: ZavorthWave4DFinalTestTargetDryRunFeatureFlagGate;
};

function sourceStatuses(source: ZavorthWave4DFinalTestTargetDryRunSource): ZavorthWave4DFinalTestTargetDryRunStatus[] {
  const statuses: ZavorthWave4DFinalTestTargetDryRunStatus[] = [];

  if (source.externalExecutorTouched || source.externalExecutorMutationAttempted) {
    statuses.push('external-executor-touch-attempted');
  }
  if (
    source.realMessageSendAttempted ||
    source.transportOpenAttempted ||
    source.providerRealExecutionAttempted ||
    source.toolCommandRealExecutionAttempted
  ) {
    statuses.push('high-impact-execution-attempted');
  }
  if (source.rawContentUsageAttempted) {
    statuses.push('raw-content-blocked');
  }
  if (!source.policyPreflightAccepted) {
    statuses.push('policy-rejected');
  } else {
    statuses.push('policy-eligible');
  }
  if (!source.approvedTestTargetMarkedSandbox) {
    statuses.push('target-not-approved');
  } else {
    statuses.push('target-approved');
  }
  if (!source.targetSessionThreadChannelTransportValidated || !source.transportConfiguredForFutureSend) {
    statuses.push('transport-unconfigured');
  } else {
    statuses.push('target-session-channel-transport-validated');
  }
  if (!source.secretRefsAvailableAsResolver) {
    statuses.push('secretref-missing');
  } else {
    statuses.push('secretref-metadata-only');
  }
  if (!source.approvalGrantModeledForTestTarget) {
    statuses.push('approval-missing');
  } else {
    statuses.push('approval-modeled');
  }
  if (source.idempotencyKeyAvailable) {
    statuses.push('idempotency-valid');
  }
  if (source.dryRunBeforeLiveEvidencePresent) {
    statuses.push('dry-run-before-live-validated');
  }

  statuses.push('transport-open-blocked');

  return Array.from(new Set(statuses));
}

function statuses(input: {
  featureFlag: ZavorthWave4DFinalTestTargetDryRunFeatureFlagGate;
  source: ZavorthWave4DFinalTestTargetDryRunSource;
}): ZavorthWave4DFinalTestTargetDryRunStatus[] {
  const result = sourceStatuses(input.source);
  if (!input.featureFlag.enabled) {
    result.push('feature-flag-disabled');
  }
  if (
    result.includes('target-approved') &&
    result.includes('target-session-channel-transport-validated') &&
    result.includes('secretref-metadata-only') &&
    result.includes('policy-eligible') &&
    result.includes('approval-modeled') &&
    result.includes('idempotency-valid') &&
    result.includes('dry-run-before-live-validated') &&
    !result.includes('feature-flag-disabled') &&
    !result.includes('high-impact-execution-attempted') &&
    !result.includes('external-executor-touch-attempted') &&
    !result.includes('raw-content-blocked')
  ) {
    result.push('valid');
  }
  return Array.from(new Set(result));
}

function decision(statuses: ZavorthWave4DFinalTestTargetDryRunStatus[]): ZavorthWave4DFinalTestTargetDryRunDecision {
  if (statuses.includes('feature-flag-disabled')) {
    return 'execution-blocked';
  }
  if (statuses.includes('external-executor-touch-attempted') || statuses.includes('high-impact-execution-attempted') || statuses.includes('raw-content-blocked')) {
    return 'dry-run-blocked';
  }
  if (statuses.includes('target-not-approved')) {
    return 'target-not-approved';
  }
  if (statuses.includes('transport-unconfigured')) {
    return 'transport-unconfigured';
  }
  if (statuses.includes('secretref-missing')) {
    return 'missing-secretref';
  }
  if (statuses.includes('policy-rejected')) {
    return 'policy-rejected';
  }
  if (statuses.includes('approval-missing')) {
    return 'approval-missing';
  }
  return statuses.includes('valid') ? 'dry-run-ready-for-live-approval' : 'dry-run-blocked';
}

function finalSendPlan(
  source: ZavorthWave4DFinalTestTargetDryRunSource,
  statusList: ZavorthWave4DFinalTestTargetDryRunStatus[],
  decisionValue: ZavorthWave4DFinalTestTargetDryRunDecision,
): ZavorthWave4DFinalTestTargetDryRunPlan {
  const candidate = source.testTargetProvisioningPlan.testTargetCandidate;
  return {
    nativeContract: 'ZavorthWave4DFinalTestTargetDryRunPlan/v1',
    planId: [
      'wave4d-final-test-target-dry-run',
      candidate.candidateId,
      source.approvedTestTargetMarkedSandbox ? 'approved-test-target' : 'target-blocked',
      source.secretRefsAvailableAsResolver ? 'secretref-ready' : 'secretref-missing',
    ].join(':'),
    mode: 'final-dry-run-only',
    action: 'final-test-target-message-send-dry-run',
    planState: decisionValue === 'dry-run-ready-for-live-approval' && statusList.includes('valid')
      ? 'ready-for-live-approval'
      : 'blocked',
    testTargetCandidateId: candidate.candidateId,
    testTargetType: candidate.targetType,
    targetExplicitlyMarkedTestSandbox: source.approvedTestTargetMarkedSandbox,
    targetSessionThreadChannelTransportValidated: source.targetSessionThreadChannelTransportValidated,
    secretRefsMetadataResolverReady: source.secretRefsAvailableAsResolver,
    policyPreflightAccepted: source.policyPreflightAccepted,
    approvalGrantModeledForTestTarget: source.approvalGrantModeledForTestTarget,
    idempotencyKey: candidate.idempotencyKey,
    dryRunBeforeLiveEvidencePresent: source.dryRunBeforeLiveEvidencePresent,
    realTransportOpenBlocked: true,
    externalTransportInvoked: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    externalExecutorTouched: false,
    rawContentUsed: false,
    rawSecretSerialized: false,
  };
}

function policyPreflight(source: ZavorthWave4DFinalTestTargetDryRunSource): ZavorthWave4DFinalTestTargetDryRunPolicyPreflight {
  return {
    nativeContract: 'ZavorthWave4DFinalTestTargetDryRunPolicyPreflight/v1',
    policyPreflightRequired: true,
    policyRecheckedImmediatelyBeforeExecution: true,
    approvalGrantModeledForDryRun: source.approvalGrantModeledForTestTarget,
    approvalRequiredBeforeFutureLiveSend: true,
    messageSendBlockedInThisGate: true,
    providerExecutionBlocked: true,
    toolCommandExecutionBlocked: true,
    externalTransportBlocked: true,
    rawContentBlocked: true,
  };
}

export class ZavorthWave4DFinalDryRunAgainstApprovedTestTarget {
  public constructor(public readonly receipt: ZavorthWave4DFinalTestTargetDryRunReceipt) {}

  public dryRunReadyForLiveApproval(): boolean {
    return this.receipt.decision === 'dry-run-ready-for-live-approval' &&
      this.receipt.finalSendPlan.planState === 'ready-for-live-approval' &&
      !this.receipt.realMessageSendActuallyPerformed &&
      !this.receipt.transportActuallyOpened;
  }

  public messageSendStillBlocked(): boolean {
    return !this.receipt.realMessageSendActuallyPerformed &&
      !this.receipt.transportActuallyOpened &&
      this.receipt.finalSendPlan.externalTransportInvoked === false;
  }
}

export function createZavorthWave4DFinalTestTargetDryRunFeatureFlagGate(
  enabled: boolean,
): ZavorthWave4DFinalTestTargetDryRunFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4DFinalTestTargetDryRunFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4D_FINAL_TEST_TARGET_DRY_RUN_EXECUTE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedNoRealSend: true,
    finalTestTargetDryRunFeatureFlagRequired: true,
  };
}

export function createZavorthWave4DFinalTestTargetDryRunSource(
  overrides: Partial<ZavorthWave4DFinalTestTargetDryRunSource> = {},
): ZavorthWave4DFinalTestTargetDryRunSource {
  return {
    testTargetProvisioningPlan: createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture({
      approvalGrantPresentNow: true,
      rollbackCompensationPlanAvailable: true,
    }).normalization,
    realMessageSendReadinessPlanReady: true,
    messageSendDryRunActionReady: true,
    transportTargetResolutionDryRunReady: true,
    targetSessionChannelValidationReady: true,
    transportReadinessCheckReady: true,
    actionGovernancePipelineReady: true,
    nativeIntegrationRegistryReady: true,
    nativeSessionHistoryRegistryReady: true,
    approvedTestTargetMarkedSandbox: true,
    targetSessionThreadChannelTransportValidated: true,
    secretRefsAvailableAsResolver: true,
    policyPreflightAccepted: true,
    approvalGrantModeledForTestTarget: true,
    idempotencyKeyAvailable: true,
    dryRunBeforeLiveEvidencePresent: true,
    transportConfiguredForFutureSend: true,
    runtimeExternalExecutorRequiredForExecution: false,
    externalExecutorTouched: false,
    realMessageSendAttempted: false,
    transportOpenAttempted: false,
    providerRealExecutionAttempted: false,
    toolCommandRealExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    rawContentUsageAttempted: false,
    newStateMigrationAttempted: false,
    rawSecretSerialized: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4DFinalDryRunAgainstApprovedTestTarget(
  options: ZavorthWave4DFinalDryRunOptions,
): ZavorthWave4DFinalTestTargetDryRunReceipt {
  const statusList = statuses({
    featureFlag: options.featureFlag,
    source: options.source,
  });
  const decisionValue = decision(statusList);
  const plan = finalSendPlan(options.source, statusList, decisionValue);

  return {
    nativeContract: 'ZavorthWave4DFinalDryRunAgainstApprovedTestTargetReceipt/v1',
    runtimeId: options.runtimeId,
    generatedAt: options.generatedAt,
    selectedCapability: 'final-dry-run-against-approved-test-target',
    decision: decisionValue,
    classification: decisionValue,
    validations: statusList,
    featureFlag: options.featureFlag,
    finalSendPlan: plan,
    policyPreflight: policyPreflight(options.source),
    sourceMetadata: {
      testTargetProvisioningPlanReady: true,
      messageSendDryRunActionReady: true,
      transportTargetResolutionDryRunReady: true,
      targetSessionChannelValidationReady: true,
      transportReadinessCheckReady: true,
      actionGovernancePipelineReady: true,
      nativeRegistriesUsed: true,
      sourceProvenanceInternalRedacted: true,
    },
    wave4dFinalDryRunAgainstApprovedTestTargetCreated: true,
    finalDryRunActuallyExecuted: options.featureFlag.enabled && decisionValue !== 'execution-blocked',
    finalDryRunActuallyExecutedOnlyWhenFlagEnabled: true,
    readyForLiveApprovalMayBeProduced: true,
    realMessageSendActuallyPerformed: false,
    transportActuallyOpened: false,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    externalExecutorMutationAllowed: false,
    rawContentUsageAllowed: false,
    runtimeExternalExecutorRequiredForExecution: false,
    rawSecretSerialized: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
  };
}

export function createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture(
  overrides: {
    featureFlagEnabled?: boolean;
    generatedAt?: string;
    source?: Partial<ZavorthWave4DFinalTestTargetDryRunSource>;
  } = {},
): ZavorthWave4DFinalDryRunAgainstApprovedTestTarget {
  const source = createZavorthWave4DFinalTestTargetDryRunSource(overrides.source);
  return new ZavorthWave4DFinalDryRunAgainstApprovedTestTarget(
    normalizeZavorthWave4DFinalDryRunAgainstApprovedTestTarget({
      generatedAt: overrides.generatedAt ?? ZAVORTH_WAVE4D_FINAL_DRY_RUN_AGAINST_APPROVED_TEST_TARGET_NOW,
      runtimeId: ZAVORTH_WAVE4D_FINAL_DRY_RUN_AGAINST_APPROVED_TEST_TARGET_RUNTIME_ID,
      source,
      featureFlag: createZavorthWave4DFinalTestTargetDryRunFeatureFlagGate(overrides.featureFlagEnabled ?? true),
    }),
  );
}
