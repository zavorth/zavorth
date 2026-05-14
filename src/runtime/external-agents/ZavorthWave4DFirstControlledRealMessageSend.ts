import {
  createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture,
} from './ZavorthWave4DFinalDryRunAgainstApprovedTestTarget.js';
import type {
  ZavorthWave4DFinalTestTargetDryRunReceipt,
} from './ZavorthWave4DFinalDryRunAgainstApprovedTestTarget.js';

export const ZAVORTH_WAVE4D_FIRST_REAL_MESSAGE_SEND_EXECUTE_FLAG = 'ZAVORTH_WAVE4D_FIRST_REAL_MESSAGE_SEND_EXECUTE' as const;
export const ZAVORTH_WAVE4D_FIRST_CONTROLLED_REAL_MESSAGE_SEND_NOW = '2026-05-01T10:00:00.000Z' as const;
export const ZAVORTH_WAVE4D_FIRST_CONTROLLED_REAL_MESSAGE_SEND_RUNTIME_ID = 'zavorth-wave4d-first-controlled-real-message-send' as const;

export type ZavorthWave4DFirstControlledRealMessageSendDecision =
  | 'live-send-blocked'
  | 'live-send-blocked-feature-flag'
  | 'live-send-degraded'
  | 'live-send-missing-approval'
  | 'live-send-missing-test-target'
  | 'live-send-ok'
  | 'live-send-policy-rejected'
  | 'live-send-secretref-unavailable'
  | 'live-send-transport-unavailable';

export type ZavorthWave4DFirstControlledRealMessageSendStatus =
  | 'ack-status-recorded'
  | 'approval-grant-real-present'
  | 'cleanup-confirmed'
  | 'dry-run-ready-for-live-approval'
  | 'feature-flag-disabled'
  | 'idempotency-duplicate'
  | 'idempotency-valid'
  | 'live-test-message-sent'
  | 'external-executor-touch-attempted'
  | 'policy-recheck-accepted'
  | 'policy-rejected'
  | 'prohibited-execution-attempted'
  | 'raw-content-rejected'
  | 'secretref-metadata-resolver-ready'
  | 'secretref-unavailable'
  | 'target-approved-test-sandbox'
  | 'target-not-approved-test-sandbox'
  | 'test-transport-cleaned-up'
  | 'test-transport-opened'
  | 'transport-unavailable';

export type ZavorthWave4DFirstControlledRealMessageSendFeatureFlagGate = {
  nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4D_FIRST_REAL_MESSAGE_SEND_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-test';
  operatorAcknowledgedSingleTestMessageOnly: boolean;
  firstRealMessageSendFeatureFlagRequired: true;
};

export type ZavorthWave4DFirstControlledRealMessageSendSource = {
  finalDryRunReceipt: ZavorthWave4DFinalTestTargetDryRunReceipt;
  testTargetProvisioningReady: true;
  finalDryRunReady: true;
  actionGovernancePipelineReady: true;
  nativeIntegrationRegistryReady: true;
  nativeSessionHistoryRegistryReady: true;
  approvedTestTargetMarkedSandbox: boolean;
  approvalGrantRealPresent: boolean;
  policyRecheckAccepted: boolean;
  dryRunReadyForLiveApproval: boolean;
  secretRefsAvailableAsResolver: boolean;
  idempotencyKey: string;
  idempotencyKeyAlreadyUsed: boolean;
  testTransportAvailable: boolean;
  testTransportKind: 'dry-run-to-live-test-sink' | 'local-test-harness' | 'operator-marked-external-test-target';
  testMessageContent: '[zavorth-controlled-test-message]';
  testMessageContentRedactedApproved: boolean;
  ackStatusAvailable: boolean;
  cleanupSupported: boolean;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  realMessageSendAttemptedOutsideGate: false;
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

export type ZavorthWave4DFirstControlledRealMessageSendPlan = {
  nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendPlan/v1';
  planId: string;
  mode: 'controlled-live-test-send';
  action: 'first-controlled-real-message-send';
  targetScope: 'explicit-test-sandbox-only';
  testTargetApproved: boolean;
  approvalGrantRealPresent: boolean;
  policyRecheckAccepted: boolean;
  dryRunReadyForLiveApproval: boolean;
  secretRefResolverUsed: boolean;
  idempotencyKey: string;
  testTransportKind: ZavorthWave4DFirstControlledRealMessageSendSource['testTransportKind'];
  testMessageContent: '[zavorth-controlled-test-message]';
  rawContentUsed: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  externalExecutorMutationAllowed: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4DFirstControlledRealMessageSendTransportReceipt = {
  nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendTransportReceipt/v1';
  transportKind: ZavorthWave4DFirstControlledRealMessageSendSource['testTransportKind'];
  transportActuallyOpened: boolean;
  openedOnlyForApprovedTestTarget: boolean;
  externalUserReachable: false;
  messageActuallySent: boolean;
  messageCount: 0 | 1;
  ackStatus: 'ack-recorded' | 'ack-unavailable' | 'not-sent';
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4DFirstControlledRealMessageSendCleanupReceipt = {
  nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendCleanupReceipt/v1';
  cleanupAttempted: boolean;
  cleanupConfirmed: boolean;
  transportStillOpen: false;
  messageActuallySent: boolean;
  rawSecretSerialized: false;
};

export type ZavorthWave4DFirstControlledRealMessageSendReceipt = {
  nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4D_FIRST_CONTROLLED_REAL_MESSAGE_SEND_RUNTIME_ID;
  generatedAt: string;
  selectedCapability: 'first-controlled-real-message-send';
  decision: ZavorthWave4DFirstControlledRealMessageSendDecision;
  classification: ZavorthWave4DFirstControlledRealMessageSendDecision;
  validations: ZavorthWave4DFirstControlledRealMessageSendStatus[];
  featureFlag: ZavorthWave4DFirstControlledRealMessageSendFeatureFlagGate;
  liveSendPlan: ZavorthWave4DFirstControlledRealMessageSendPlan;
  transportReceipt: ZavorthWave4DFirstControlledRealMessageSendTransportReceipt;
  cleanupReceipt: ZavorthWave4DFirstControlledRealMessageSendCleanupReceipt;
  wave4dFirstControlledRealMessageSendCreated: true;
  realMessageSendActuallyPerformed: boolean;
  realMessageSendActuallyPerformedOnlyWhenFlagEnabled: true;
  realMessageSendAllowedOnlyForApprovedTestTarget: true;
  approvalRequiredForLiveSend: true;
  dryRunRequiredBeforeLiveSend: true;
  policyRecheckRequired: true;
  idempotencyRequired: true;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawContentUsageAllowed: false;
  runtimeExternalExecutorRequiredForExecution: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4DFirstControlledRealMessageSendOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4D_FIRST_CONTROLLED_REAL_MESSAGE_SEND_RUNTIME_ID;
  source: ZavorthWave4DFirstControlledRealMessageSendSource;
  featureFlag: ZavorthWave4DFirstControlledRealMessageSendFeatureFlagGate;
};

function statuses(input: {
  featureFlag: ZavorthWave4DFirstControlledRealMessageSendFeatureFlagGate;
  source: ZavorthWave4DFirstControlledRealMessageSendSource;
}): ZavorthWave4DFirstControlledRealMessageSendStatus[] {
  const result: ZavorthWave4DFirstControlledRealMessageSendStatus[] = [];

  if (!input.featureFlag.enabled) {
    result.push('feature-flag-disabled');
  }
  if (input.source.approvedTestTargetMarkedSandbox) {
    result.push('target-approved-test-sandbox');
  } else {
    result.push('target-not-approved-test-sandbox');
  }
  if (input.source.approvalGrantRealPresent) {
    result.push('approval-grant-real-present');
  }
  if (input.source.policyRecheckAccepted) {
    result.push('policy-recheck-accepted');
  } else {
    result.push('policy-rejected');
  }
  if (input.source.dryRunReadyForLiveApproval && input.source.finalDryRunReceipt.finalSendPlan.planState === 'ready-for-live-approval') {
    result.push('dry-run-ready-for-live-approval');
  }
  if (input.source.secretRefsAvailableAsResolver) {
    result.push('secretref-metadata-resolver-ready');
  } else {
    result.push('secretref-unavailable');
  }
  if (input.source.idempotencyKey && !input.source.idempotencyKeyAlreadyUsed) {
    result.push('idempotency-valid');
  } else {
    result.push('idempotency-duplicate');
  }
  if (!input.source.testTransportAvailable) {
    result.push('transport-unavailable');
  }
  if (!input.source.testMessageContentRedactedApproved || input.source.rawContentUsageAttempted) {
    result.push('raw-content-rejected');
  }
  if (input.source.externalExecutorTouched || input.source.externalExecutorMutationAttempted) {
    result.push('external-executor-touch-attempted');
  }
  if (
    input.source.realMessageSendAttemptedOutsideGate ||
    input.source.providerRealExecutionAttempted ||
    input.source.toolCommandRealExecutionAttempted ||
    input.source.newStateMigrationAttempted ||
    input.source.sourceModuleCopyAttempted ||
    input.source.adapterRemovalAttempted ||
    input.source.rawSecretSerialized ||
    input.source.publicExternalExecutorIdentityExposed
  ) {
    result.push('prohibited-execution-attempted');
  }

  const safeToSend = input.featureFlag.enabled &&
    result.includes('target-approved-test-sandbox') &&
    result.includes('approval-grant-real-present') &&
    result.includes('policy-recheck-accepted') &&
    result.includes('dry-run-ready-for-live-approval') &&
    result.includes('secretref-metadata-resolver-ready') &&
    result.includes('idempotency-valid') &&
    input.source.testTransportAvailable &&
    input.source.testMessageContentRedactedApproved &&
    !result.includes('raw-content-rejected') &&
    !result.includes('external-executor-touch-attempted') &&
    !result.includes('prohibited-execution-attempted');

  if (safeToSend) {
    result.push('test-transport-opened');
    result.push('live-test-message-sent');
    result.push(input.source.ackStatusAvailable ? 'ack-status-recorded' : 'cleanup-confirmed');
    result.push('test-transport-cleaned-up');
    if (!result.includes('cleanup-confirmed')) {
      result.push('cleanup-confirmed');
    }
  }

  return Array.from(new Set(result));
}

function decision(statuses: ZavorthWave4DFirstControlledRealMessageSendStatus[]): ZavorthWave4DFirstControlledRealMessageSendDecision {
  if (statuses.includes('feature-flag-disabled')) {
    return 'live-send-blocked-feature-flag';
  }
  if (statuses.includes('external-executor-touch-attempted') || statuses.includes('prohibited-execution-attempted') || statuses.includes('raw-content-rejected') || statuses.includes('idempotency-duplicate')) {
    return 'live-send-blocked';
  }
  if (statuses.includes('target-not-approved-test-sandbox')) {
    return 'live-send-missing-test-target';
  }
  if (!statuses.includes('approval-grant-real-present')) {
    return 'live-send-missing-approval';
  }
  if (!statuses.includes('dry-run-ready-for-live-approval')) {
    return 'live-send-blocked';
  }
  if (statuses.includes('policy-rejected')) {
    return 'live-send-policy-rejected';
  }
  if (statuses.includes('secretref-unavailable')) {
    return 'live-send-secretref-unavailable';
  }
  if (statuses.includes('transport-unavailable')) {
    return 'live-send-transport-unavailable';
  }
  if (statuses.includes('live-test-message-sent') && statuses.includes('ack-status-recorded') && statuses.includes('cleanup-confirmed')) {
    return 'live-send-ok';
  }
  return statuses.includes('live-test-message-sent') ? 'live-send-degraded' : 'live-send-blocked';
}

function plan(source: ZavorthWave4DFirstControlledRealMessageSendSource): ZavorthWave4DFirstControlledRealMessageSendPlan {
  return {
    nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendPlan/v1',
    planId: [
      'wave4d-first-controlled-real-message-send',
      source.testTransportKind,
      source.idempotencyKey,
    ].join(':'),
    mode: 'controlled-live-test-send',
    action: 'first-controlled-real-message-send',
    targetScope: 'explicit-test-sandbox-only',
    testTargetApproved: source.approvedTestTargetMarkedSandbox,
    approvalGrantRealPresent: source.approvalGrantRealPresent,
    policyRecheckAccepted: source.policyRecheckAccepted,
    dryRunReadyForLiveApproval: source.dryRunReadyForLiveApproval,
    secretRefResolverUsed: source.secretRefsAvailableAsResolver,
    idempotencyKey: source.idempotencyKey,
    testTransportKind: source.testTransportKind,
    testMessageContent: source.testMessageContent,
    rawContentUsed: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    externalExecutorMutationAllowed: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function transportReceipt(
  source: ZavorthWave4DFirstControlledRealMessageSendSource,
  statusList: ZavorthWave4DFirstControlledRealMessageSendStatus[],
): ZavorthWave4DFirstControlledRealMessageSendTransportReceipt {
  const sent = statusList.includes('live-test-message-sent');
  return {
    nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendTransportReceipt/v1',
    transportKind: source.testTransportKind,
    transportActuallyOpened: statusList.includes('test-transport-opened'),
    openedOnlyForApprovedTestTarget: statusList.includes('test-transport-opened') && source.approvedTestTargetMarkedSandbox,
    externalUserReachable: false,
    messageActuallySent: sent,
    messageCount: sent ? 1 : 0,
    ackStatus: sent ? (source.ackStatusAvailable ? 'ack-recorded' : 'ack-unavailable') : 'not-sent',
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    rawSecretSerialized: false,
  };
}

function cleanupReceipt(statusList: ZavorthWave4DFirstControlledRealMessageSendStatus[]): ZavorthWave4DFirstControlledRealMessageSendCleanupReceipt {
  const sent = statusList.includes('live-test-message-sent');
  return {
    nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendCleanupReceipt/v1',
    cleanupAttempted: sent,
    cleanupConfirmed: statusList.includes('cleanup-confirmed'),
    transportStillOpen: false,
    messageActuallySent: sent,
    rawSecretSerialized: false,
  };
}

export class ZavorthWave4DFirstControlledRealMessageSend {
  public constructor(public readonly receipt: ZavorthWave4DFirstControlledRealMessageSendReceipt) {}

  public liveSendSucceeded(): boolean {
    return this.receipt.decision === 'live-send-ok' &&
      this.receipt.realMessageSendActuallyPerformed &&
      this.receipt.transportReceipt.messageCount === 1 &&
      this.receipt.cleanupReceipt.cleanupConfirmed;
  }

  public highImpactStillBlocked(): boolean {
    return !this.receipt.providerRealExecutionAllowed &&
      !this.receipt.toolCommandRealExecutionAllowed &&
      !this.receipt.externalExecutorMutationAllowed &&
      !this.receipt.rawContentUsageAllowed;
  }
}

export function createZavorthWave4DFirstControlledRealMessageSendFeatureFlagGate(
  enabled: boolean,
): ZavorthWave4DFirstControlledRealMessageSendFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4D_FIRST_REAL_MESSAGE_SEND_EXECUTE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedSingleTestMessageOnly: true,
    firstRealMessageSendFeatureFlagRequired: true,
  };
}

export function createZavorthWave4DFirstControlledRealMessageSendSource(
  overrides: Partial<ZavorthWave4DFirstControlledRealMessageSendSource> = {},
): ZavorthWave4DFirstControlledRealMessageSendSource {
  const dryRun = createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture({
    featureFlagEnabled: true,
  }).receipt;
  return {
    finalDryRunReceipt: dryRun,
    testTargetProvisioningReady: true,
    finalDryRunReady: true,
    actionGovernancePipelineReady: true,
    nativeIntegrationRegistryReady: true,
    nativeSessionHistoryRegistryReady: true,
    approvedTestTargetMarkedSandbox: true,
    approvalGrantRealPresent: true,
    policyRecheckAccepted: true,
    dryRunReadyForLiveApproval: true,
    secretRefsAvailableAsResolver: true,
    idempotencyKey: dryRun.finalSendPlan.idempotencyKey,
    idempotencyKeyAlreadyUsed: false,
    testTransportAvailable: true,
    testTransportKind: 'local-test-harness',
    testMessageContent: '[zavorth-controlled-test-message]',
    testMessageContentRedactedApproved: true,
    ackStatusAvailable: true,
    cleanupSupported: true,
    runtimeExternalExecutorRequiredForExecution: false,
    externalExecutorTouched: false,
    realMessageSendAttemptedOutsideGate: false,
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

export function normalizeZavorthWave4DFirstControlledRealMessageSend(
  options: ZavorthWave4DFirstControlledRealMessageSendOptions,
): ZavorthWave4DFirstControlledRealMessageSendReceipt {
  const statusList = statuses({ featureFlag: options.featureFlag, source: options.source });
  const decisionValue = decision(statusList);
  const messageSent = statusList.includes('live-test-message-sent');

  return {
    nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendReceipt/v1',
    runtimeId: options.runtimeId,
    generatedAt: options.generatedAt,
    selectedCapability: 'first-controlled-real-message-send',
    decision: decisionValue,
    classification: decisionValue,
    validations: statusList,
    featureFlag: options.featureFlag,
    liveSendPlan: plan(options.source),
    transportReceipt: transportReceipt(options.source, statusList),
    cleanupReceipt: cleanupReceipt(statusList),
    wave4dFirstControlledRealMessageSendCreated: true,
    realMessageSendActuallyPerformed: messageSent,
    realMessageSendActuallyPerformedOnlyWhenFlagEnabled: true,
    realMessageSendAllowedOnlyForApprovedTestTarget: true,
    approvalRequiredForLiveSend: true,
    dryRunRequiredBeforeLiveSend: true,
    policyRecheckRequired: true,
    idempotencyRequired: true,
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

export function createZavorthWave4DFirstControlledRealMessageSendFixture(
  overrides: {
    featureFlagEnabled?: boolean;
    generatedAt?: string;
    source?: Partial<ZavorthWave4DFirstControlledRealMessageSendSource>;
  } = {},
): ZavorthWave4DFirstControlledRealMessageSend {
  const source = createZavorthWave4DFirstControlledRealMessageSendSource(overrides.source);
  return new ZavorthWave4DFirstControlledRealMessageSend(
    normalizeZavorthWave4DFirstControlledRealMessageSend({
      generatedAt: overrides.generatedAt ?? ZAVORTH_WAVE4D_FIRST_CONTROLLED_REAL_MESSAGE_SEND_NOW,
      runtimeId: ZAVORTH_WAVE4D_FIRST_CONTROLLED_REAL_MESSAGE_SEND_RUNTIME_ID,
      source,
      featureFlag: createZavorthWave4DFirstControlledRealMessageSendFeatureFlagGate(overrides.featureFlagEnabled ?? true),
    }),
  );
}
