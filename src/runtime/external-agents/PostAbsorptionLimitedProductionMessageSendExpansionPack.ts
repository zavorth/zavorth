import {
  createZavorthWave4DMessageSendExpansionAndAuditPackFixture,
} from './ZavorthWave4DMessageSendExpansionAndAuditPack.js';
import type {
  ZavorthWave4DMessageSendExpansionAndAuditPackNormalization,
} from './ZavorthWave4DMessageSendExpansionAndAuditPack.js';

export const ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE_FLAG = 'ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE' as const;
export const ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXPANSION_PACK_NOW = '2026-05-01T21:00:00.000Z' as const;
export const ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXPANSION_PACK_RUNTIME_ID = 'zavorth-limited-production-message-send-expansion-pack' as const;

export type ZavorthLimitedProductionMessageSendTargetClass =
  | 'limited-production-approved'
  | 'production-blocked'
  | 'sandbox-test'
  | 'unknown-blocked';

export type ZavorthLimitedProductionMessageSendExecutionMode =
  | 'live-limited-send'
  | 'policy-only';

export type ZavorthLimitedProductionMessageSendDecision =
  | 'limited-production-message-send-expansion-ready'
  | 'live-limited-send-blocked-feature-flag'
  | 'live-limited-send-blocked-prelive-check'
  | 'live-limited-send-blocked-prohibited'
  | 'live-limited-send-blocked-target'
  | 'live-limited-send-eligible-no-automatic-send';

export type ZavorthLimitedProductionPreLiveCheckId =
  | 'approval-grant'
  | 'audit-receipt'
  | 'channel-allowlist'
  | 'content-redaction-approval'
  | 'dry-run-immediate-before-live'
  | 'duplicate-prevention'
  | 'idempotency-key'
  | 'policy-recheck'
  | 'rate-limit'
  | 'rollback-compensation'
  | 'secretref-secure-resolver'
  | 'target-allowlist'
  | 'target-session-channel-transport-validation'
  | 'transport-allowlist';

export type ZavorthLimitedProductionMessageSendFeatureFlagGate = {
  nativeContract: 'ZavorthLimitedProductionMessageSendFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE_FLAG;
  enabled: boolean;
  requiredForLiveLimitedSend: true;
  missingFlagBlocksLiveSend: boolean;
};

export type ZavorthLimitedProductionTargetPolicy = {
  nativeContract: 'ZavorthLimitedProductionTargetPolicy/v1';
  targetClass: ZavorthLimitedProductionMessageSendTargetClass;
  disposition:
    | 'blocked-production'
    | 'blocked-unknown'
    | 'limited-production-requires-all-gates'
    | 'sandbox-test-existing-controlled-path';
  allowedForLimitedProductionConsideration: boolean;
  targetApprovalRequired: true;
  allowlistRequired: true;
  rateLimitRequired: true;
  idempotencyRequired: true;
  rollbackCompensationRequired: true;
  auditReceiptRequired: true;
  unrestrictedProductionSendAllowed: false;
  messageActuallySentByPolicy: false;
  rawSecretSerialized: false;
};

export type ZavorthLimitedProductionPreLiveCheck = {
  nativeContract: 'ZavorthLimitedProductionPreLiveCheck/v1';
  checkId: ZavorthLimitedProductionPreLiveCheckId;
  required: true;
  satisfied: boolean;
  blocksLiveSendWhenMissing: true;
  evidenceDocs: string[];
  rawSecretSerialized: false;
};

export type ZavorthLimitedProductionMessageSendReceipt = {
  nativeContract: 'ZavorthLimitedProductionMessageSendReceipt/v1';
  mode: ZavorthLimitedProductionMessageSendExecutionMode;
  decision: ZavorthLimitedProductionMessageSendDecision;
  targetClass: ZavorthLimitedProductionMessageSendTargetClass;
  featureFlag: ZavorthLimitedProductionMessageSendFeatureFlagGate;
  policyOnlyReceipt: boolean;
  liveLimitedSendEligible: boolean;
  messageActuallySent: false;
  transportActuallyOpened: false;
  unrestrictedProductionSendAllowed: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  rawContentUsageAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthLimitedProductionMessageSendSafetyReport = {
  nativeContract: 'ZavorthLimitedProductionMessageSendSafetyReport/v1';
  unrestrictedProductionStillBlocked: true;
  targetEnablementCriteria: ZavorthLimitedProductionPreLiveCheckId[];
  remainingBlockers: string[];
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthLimitedProductionMessageSendExecutionGate = {
  limitedProductionMessageSendExpansionPackCreated: true;
  unrestrictedProductionSendAllowed: false;
  limitedProductionSendRequiresExplicitApproval: true;
  limitedProductionSendRequiresFeatureFlag: true;
  dryRunRequiredBeforeLimitedProductionSend: true;
  policyRecheckRequired: true;
  idempotencyRequired: true;
  rawContentUsageAllowed: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  rawSecretSerialized: false;
  adapterRemovalGlobalAllowed: false;
  messageActuallySent: false;
};

export type ZavorthLimitedProductionMessageSendSource = {
  messageSendExpansionAuditPack: Pick<
    ZavorthWave4DMessageSendExpansionAndAuditPackNormalization,
    'decision' | 'executionGate'
  >;
  requestedMode: ZavorthLimitedProductionMessageSendExecutionMode;
  targetClass: ZavorthLimitedProductionMessageSendTargetClass;
  targetAllowlisted: boolean;
  channelAllowlisted: boolean;
  transportAllowlisted: boolean;
  explicitApprovalPresent: boolean;
  rateLimitConfigured: boolean;
  idempotencyKeyPresent: boolean;
  idempotencyKeyAlreadyUsed: boolean;
  rollbackCompensationPlanned: boolean;
  auditReceiptRequested: boolean;
  dryRunImmediatelyBeforeLiveReady: boolean;
  policyRecheckAccepted: boolean;
  secretRefResolverReady: boolean;
  contentRedactedApproved: boolean;
  targetSessionChannelTransportValidated: boolean;
  unrestrictedProductionSendRequested: false;
  rawContentUsageAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthLimitedProductionMessageSendNormalization = {
  nativeContract: 'ZavorthLimitedProductionMessageSendExpansionPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXPANSION_PACK_RUNTIME_ID;
  decision: ZavorthLimitedProductionMessageSendDecision;
  status: ZavorthLimitedProductionMessageSendDecision;
  targetPolicies: ZavorthLimitedProductionTargetPolicy[];
  preLiveChecks: ZavorthLimitedProductionPreLiveCheck[];
  receipt: ZavorthLimitedProductionMessageSendReceipt;
  safetyReport: ZavorthLimitedProductionMessageSendSafetyReport;
  executionGate: ZavorthLimitedProductionMessageSendExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    sourceIdentityPublic: false;
    receiptsRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'post-absorption-release-monitoring-observability-polish-pack';
};

export type ZavorthLimitedProductionMessageSendOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXPANSION_PACK_RUNTIME_ID;
  source: ZavorthLimitedProductionMessageSendSource;
  featureFlag: ZavorthLimitedProductionMessageSendFeatureFlagGate;
};

function targetPolicies(): ZavorthLimitedProductionTargetPolicy[] {
  const rows: Array<Omit<
    ZavorthLimitedProductionTargetPolicy,
    | 'allowlistRequired'
    | 'auditReceiptRequired'
    | 'idempotencyRequired'
    | 'messageActuallySentByPolicy'
    | 'nativeContract'
    | 'rateLimitRequired'
    | 'rawSecretSerialized'
    | 'rollbackCompensationRequired'
    | 'targetApprovalRequired'
    | 'unrestrictedProductionSendAllowed'
  >> = [
    {
      targetClass: 'sandbox-test',
      disposition: 'sandbox-test-existing-controlled-path',
      allowedForLimitedProductionConsideration: false,
    },
    {
      targetClass: 'limited-production-approved',
      disposition: 'limited-production-requires-all-gates',
      allowedForLimitedProductionConsideration: true,
    },
    {
      targetClass: 'production-blocked',
      disposition: 'blocked-production',
      allowedForLimitedProductionConsideration: false,
    },
    {
      targetClass: 'unknown-blocked',
      disposition: 'blocked-unknown',
      allowedForLimitedProductionConsideration: false,
    },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthLimitedProductionTargetPolicy/v1',
    ...row,
    targetApprovalRequired: true,
    allowlistRequired: true,
    rateLimitRequired: true,
    idempotencyRequired: true,
    rollbackCompensationRequired: true,
    auditReceiptRequired: true,
    unrestrictedProductionSendAllowed: false,
    messageActuallySentByPolicy: false,
    rawSecretSerialized: false,
  }));
}

function preLiveCheck(
  checkId: ZavorthLimitedProductionPreLiveCheckId,
  satisfied: boolean,
  evidenceDocs: string[],
): ZavorthLimitedProductionPreLiveCheck {
  return {
    nativeContract: 'ZavorthLimitedProductionPreLiveCheck/v1',
    checkId,
    required: true,
    satisfied,
    blocksLiveSendWhenMissing: true,
    evidenceDocs,
    rawSecretSerialized: false,
  };
}

function preLiveChecks(source: ZavorthLimitedProductionMessageSendSource): ZavorthLimitedProductionPreLiveCheck[] {
  return [
    preLiveCheck('target-allowlist', source.targetAllowlisted, ['docs/236-wave-4d-real-message-send-test-target-provisioning-plan.md', 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md']),
    preLiveCheck('channel-allowlist', source.channelAllowlisted, ['docs/187-wave-3-provider-channel-transport-native-registry.md', 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md']),
    preLiveCheck('transport-allowlist', source.transportAllowlisted, ['docs/183-wave-2-real-message-transport-capability-discovery.md', 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md']),
    preLiveCheck('approval-grant', source.explicitApprovalPresent, ['docs/179-wave-2-approval-grant-contract.md', 'docs/238-wave-4d-first-controlled-real-message-send.md']),
    preLiveCheck('rate-limit', source.rateLimitConfigured, ['docs/224-wave-4b2-transport-readiness-check-executable.md', 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md']),
    preLiveCheck('idempotency-key', source.idempotencyKeyPresent && !source.idempotencyKeyAlreadyUsed, ['docs/231-wave-4b3-message-send-dry-run-executable.md', 'docs/238-wave-4d-first-controlled-real-message-send.md']),
    preLiveCheck('duplicate-prevention', !source.idempotencyKeyAlreadyUsed, ['docs/238-wave-4d-first-controlled-real-message-send.md', 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md']),
    preLiveCheck('rollback-compensation', source.rollbackCompensationPlanned, ['docs/180-wave-2-approved-mutation-execution-harness.md', 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md']),
    preLiveCheck('audit-receipt', source.auditReceiptRequested, ['docs/238-wave-4d-first-controlled-real-message-send.md', 'docs/251-post-absorption-parallel-hardening-pack.md']),
    preLiveCheck('dry-run-immediate-before-live', source.dryRunImmediatelyBeforeLiveReady, ['docs/237-wave-4d-final-dry-run-against-approved-test-target.md', 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md']),
    preLiveCheck('policy-recheck', source.policyRecheckAccepted, ['docs/174-wave-2-controlled-action-dispatch-design.md', 'docs/238-wave-4d-first-controlled-real-message-send.md']),
    preLiveCheck('secretref-secure-resolver', source.secretRefResolverReady, ['docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md', 'docs/238-wave-4d-first-controlled-real-message-send.md']),
    preLiveCheck('content-redaction-approval', source.contentRedactedApproved, ['docs/226-wave-4c2-raw-session-content-migration-readiness-pack.md', 'docs/238-wave-4d-first-controlled-real-message-send.md']),
    preLiveCheck('target-session-channel-transport-validation', source.targetSessionChannelTransportValidated, ['docs/223-wave-4b2-target-session-channel-validation-executable.md', 'docs/224-wave-4b2-transport-readiness-check-executable.md']),
  ];
}

export function createZavorthLimitedProductionMessageSendFeatureFlagGate(
  enabled = false,
): ZavorthLimitedProductionMessageSendFeatureFlagGate {
  return {
    nativeContract: 'ZavorthLimitedProductionMessageSendFeatureFlagGate/v1',
    flagName: ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE_FLAG,
    enabled,
    requiredForLiveLimitedSend: true,
    missingFlagBlocksLiveSend: !enabled,
  };
}

function hasProhibitedAttempt(source: ZavorthLimitedProductionMessageSendSource): boolean {
  return source.unrestrictedProductionSendRequested ||
    source.rawContentUsageAttempted ||
    source.providerExecutionAttempted ||
    source.toolCommandExecutionAttempted ||
    source.externalExecutorMutationAttempted ||
    source.sourceModuleCopyAttempted ||
    source.adapterRemovalAttempted ||
    source.publicExternalExecutorIdentityExposed ||
    source.rawSecretSerialized;
}

function targetBlocked(targetClass: ZavorthLimitedProductionMessageSendTargetClass): boolean {
  return targetClass === 'production-blocked' || targetClass === 'unknown-blocked';
}

function allPreLiveSatisfied(checks: ZavorthLimitedProductionPreLiveCheck[]): boolean {
  return checks.every((check) => check.satisfied);
}

function decision(
  source: ZavorthLimitedProductionMessageSendSource,
  featureFlag: ZavorthLimitedProductionMessageSendFeatureFlagGate,
  checks: ZavorthLimitedProductionPreLiveCheck[],
): ZavorthLimitedProductionMessageSendDecision {
  if (hasProhibitedAttempt(source)) {
    return 'live-limited-send-blocked-prohibited';
  }
  if (source.requestedMode === 'policy-only') {
    return 'limited-production-message-send-expansion-ready';
  }
  if (!featureFlag.enabled) {
    return 'live-limited-send-blocked-feature-flag';
  }
  if (targetBlocked(source.targetClass) || source.targetClass !== 'limited-production-approved') {
    return 'live-limited-send-blocked-target';
  }
  if (!allPreLiveSatisfied(checks)) {
    return 'live-limited-send-blocked-prelive-check';
  }
  return 'live-limited-send-eligible-no-automatic-send';
}

function receipt(
  source: ZavorthLimitedProductionMessageSendSource,
  featureFlag: ZavorthLimitedProductionMessageSendFeatureFlagGate,
  checks: ZavorthLimitedProductionPreLiveCheck[],
  result: ZavorthLimitedProductionMessageSendDecision,
): ZavorthLimitedProductionMessageSendReceipt {
  return {
    nativeContract: 'ZavorthLimitedProductionMessageSendReceipt/v1',
    mode: source.requestedMode,
    decision: result,
    targetClass: source.targetClass,
    featureFlag,
    policyOnlyReceipt: source.requestedMode === 'policy-only',
    liveLimitedSendEligible: result === 'live-limited-send-eligible-no-automatic-send' && allPreLiveSatisfied(checks),
    messageActuallySent: false,
    transportActuallyOpened: false,
    unrestrictedProductionSendAllowed: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    rawContentUsageAllowed: false,
    rawSecretSerialized: false,
  };
}

function safetyReport(
  checks: ZavorthLimitedProductionPreLiveCheck[],
): ZavorthLimitedProductionMessageSendSafetyReport {
  return {
    nativeContract: 'ZavorthLimitedProductionMessageSendSafetyReport/v1',
    unrestrictedProductionStillBlocked: true,
    targetEnablementCriteria: checks.map((check) => check.checkId),
    remainingBlockers: [
      'unrestricted-production-send',
      'target-not-explicitly-approved',
      'missing-feature-flag',
      'missing-pre-live-dry-run',
      'missing-policy-recheck',
      'missing-secretref-resolver',
      'missing-content-approval',
      'duplicate-idempotency-key',
      'provider-tool-command-execution',
    ],
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthLimitedProductionMessageSendExecutionGate {
  return {
    limitedProductionMessageSendExpansionPackCreated: true,
    unrestrictedProductionSendAllowed: false,
    limitedProductionSendRequiresExplicitApproval: true,
    limitedProductionSendRequiresFeatureFlag: true,
    dryRunRequiredBeforeLimitedProductionSend: true,
    policyRecheckRequired: true,
    idempotencyRequired: true,
    rawContentUsageAllowed: false,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    rawSecretSerialized: false,
    adapterRemovalGlobalAllowed: false,
    messageActuallySent: false,
  };
}

function sourceReady(source: ZavorthLimitedProductionMessageSendSource): boolean {
  return source.messageSendExpansionAuditPack.decision === 'wave4d-message-send-expansion-and-audit-pack-ready' &&
    !source.messageSendExpansionAuditPack.executionGate.unrestrictedProductionSendAllowed &&
    !source.messageSendExpansionAuditPack.executionGate.newMessageActuallySentInThisPack &&
    !hasProhibitedAttempt(source);
}

export class ZavorthLimitedProductionMessageSendExpansionPack {
  public constructor(public readonly normalization: ZavorthLimitedProductionMessageSendNormalization) {}

  public targetPolicy(targetClass: ZavorthLimitedProductionMessageSendTargetClass): ZavorthLimitedProductionTargetPolicy | undefined {
    return this.normalization.targetPolicies.find((policy) => policy.targetClass === targetClass);
  }

  public preLiveCheck(checkId: ZavorthLimitedProductionPreLiveCheckId): ZavorthLimitedProductionPreLiveCheck | undefined {
    return this.normalization.preLiveChecks.find((check) => check.checkId === checkId);
  }

  public liveSendEligible(): boolean {
    return this.normalization.receipt.liveLimitedSendEligible;
  }

  public messageActuallySent(): boolean {
    return this.normalization.receipt.messageActuallySent;
  }
}

export function createZavorthLimitedProductionMessageSendSource(
  overrides: Partial<ZavorthLimitedProductionMessageSendSource> = {},
): ZavorthLimitedProductionMessageSendSource {
  return {
    messageSendExpansionAuditPack: createZavorthWave4DMessageSendExpansionAndAuditPackFixture().normalization,
    requestedMode: 'policy-only',
    targetClass: 'limited-production-approved',
    targetAllowlisted: true,
    channelAllowlisted: true,
    transportAllowlisted: true,
    explicitApprovalPresent: true,
    rateLimitConfigured: true,
    idempotencyKeyPresent: true,
    idempotencyKeyAlreadyUsed: false,
    rollbackCompensationPlanned: true,
    auditReceiptRequested: true,
    dryRunImmediatelyBeforeLiveReady: true,
    policyRecheckAccepted: true,
    secretRefResolverReady: true,
    contentRedactedApproved: true,
    targetSessionChannelTransportValidated: true,
    unrestrictedProductionSendRequested: false,
    rawContentUsageAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeZavorthLimitedProductionMessageSendExpansionPack(
  options: ZavorthLimitedProductionMessageSendOptions,
): ZavorthLimitedProductionMessageSendNormalization {
  const checks = preLiveChecks(options.source);
  const targetPolicyRows = targetPolicies();
  const result = sourceReady(options.source)
    ? decision(options.source, options.featureFlag, checks)
    : 'live-limited-send-blocked-prohibited';

  return {
    nativeContract: 'ZavorthLimitedProductionMessageSendExpansionPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: result,
    status: result,
    targetPolicies: targetPolicyRows,
    preLiveChecks: checks,
    receipt: receipt(options.source, options.featureFlag, checks, result),
    safetyReport: safetyReport(checks),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      sourceIdentityPublic: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'post-absorption-release-monitoring-observability-polish-pack',
  };
}

export function createZavorthLimitedProductionMessageSendExpansionPackFixture(
  overrides: Partial<ZavorthLimitedProductionMessageSendSource> = {},
  featureFlagEnabled = false,
): ZavorthLimitedProductionMessageSendExpansionPack {
  return new ZavorthLimitedProductionMessageSendExpansionPack(
    normalizeZavorthLimitedProductionMessageSendExpansionPack({
      generatedAt: ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXPANSION_PACK_NOW,
      runtimeId: ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXPANSION_PACK_RUNTIME_ID,
      source: createZavorthLimitedProductionMessageSendSource(overrides),
      featureFlag: createZavorthLimitedProductionMessageSendFeatureFlagGate(featureFlagEnabled),
    }),
  );
}
