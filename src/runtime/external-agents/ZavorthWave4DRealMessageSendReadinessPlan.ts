export const ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_READINESS_PLAN_NOW = '2026-05-01T06:00:00.000Z' as const;
export const ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_READINESS_PLAN_RUNTIME_ID = 'zavorth-wave4d-real-message-send-readiness-plan' as const;

export type ZavorthWave4DRealMessageSendReadinessDecision =
  | 'blocked'
  | 'wave4d-real-message-send-readiness-plan-ready';

export type ZavorthWave4DRealMessageSendRequirementId =
  | 'approval-grant-real'
  | 'audit-receipt'
  | 'channel-transport-configured'
  | 'content-redacted-approved'
  | 'dry-run-before-live'
  | 'execution-dependency-classification'
  | 'idempotency-key'
  | 'no-raw-content-leakage'
  | 'policy-preflight'
  | 'rate-limit'
  | 'rollback-compensation-recall'
  | 'secretref-secure-resolver'
  | 'target-safe-test';

export type ZavorthWave4DRealMessageSendBlockerId =
  | 'channel-transport-not-configured'
  | 'missing-approval-grant'
  | 'missing-rollback-compensation'
  | 'missing-secretref'
  | 'policy-rejected'
  | 'raw-content-required'
  | 'target-not-safe';

export type ZavorthWave4DRealMessageSendRequirement = {
  nativeContract: 'ZavorthWave4DRealMessageSendRequirement/v1';
  requirementId: ZavorthWave4DRealMessageSendRequirementId;
  label: string;
  requiredForFutureSend: true;
  currentDisposition:
    | 'available-by-metadata'
    | 'blocked-until-future-approval'
    | 'blocked-until-safe-target'
    | 'blocked-until-secretref-present'
    | 'blocked-until-transport-configured'
    | 'planned-required-before-live'
    | 'ready';
  evidenceGates: string[];
  blocksFutureSendIfMissing: true;
  rawSecretSerialized: false;
  rawContentUsageAllowed: false;
};

export type ZavorthWave4DRealMessageSendGoNoGoCriterion = {
  nativeContract: 'ZavorthWave4DRealMessageSendGoNoGoCriterion/v1';
  criterionId:
    | 'content-redacted-approved'
    | 'dry-run-passed'
    | 'operator-approval'
    | 'policy-accepted'
    | 'rate-limit-ready'
    | 'rollback-compensation-ready'
    | 'secretref-present-redacted'
    | 'target-verified'
    | 'transport-configured';
  required: true;
  satisfiedNow: boolean;
  decision: 'go-ready-for-future-live-gate' | 'no-go-blocked';
  blockerId?: ZavorthWave4DRealMessageSendBlockerId;
  notes: string;
};

export type ZavorthWave4DRealMessageSendCandidate = {
  nativeContract: 'ZavorthWave4DRealMessageSendCandidate/v1';
  candidateId: 'wave4d-first-controlled-safe-test-message-candidate';
  candidateStatus: 'prepared-not-executed';
  targetClass: 'safe-test-target';
  targetVerified: boolean;
  channelTransportConfigured: boolean;
  secretRefsAvailableAsResolver: boolean;
  secretRefResolutionRequired: true;
  rawSecretSerialized: false;
  contentPolicy: 'redacted-approved-only';
  contentRedactedApproved: boolean;
  rawContentUsageAllowed: false;
  approvalStatus: 'future-real-approval-required';
  dryRunRequiredBeforeFutureSend: true;
  dryRunEvidenceGates: ['231', '232'];
  idempotencyKey: string;
  rollbackCompensationPlanRequired: true;
  rollbackCompensationPlanAvailable: boolean;
  recallIfAvailableRequired: true;
  auditReceiptRequired: true;
  rateLimitRequired: true;
  externalTransportExecutionDependency: 'explicit-execution-dependency-not-default-runtime';
  externalExecutorDefaultRuntimeRequired: false;
  executionActuallyPerformed: false;
  messageActuallySent: false;
  transportActuallyOpened: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  externalExecutorMutationAllowed: false;
};

export type ZavorthWave4DRealMessageSendReadinessEvidence = {
  nativeContract: 'ZavorthWave4DRealMessageSendReadinessEvidence/v1';
  messageSendTransportBlockedRehearsalBy182: true;
  transportCapabilityDiscoveryBy183: true;
  wave4b3DryRunExecutablesBy230To233: true;
  sessionHistoryMetadataAndRedactedContentBy218To229: true;
  wave4b2ValidationReadinessBy222To225: true;
  actionGovernancePipelineBy174To180: true;
  nativeIntegrationRegistryBy187: true;
  nativeSessionHistoryRegistryBy188: true;
  dryRunMandatoryBeforeLive: true;
  approvalRequiredForFutureSend: true;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  externalTransportIfNeededClassifiedAsExecutionDependency: true;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4DRealMessageSendReadinessGate = {
  wave4dRealMessageSendReadinessPlanCreated: true;
  realMessageSendActuallyPerformed: false;
  transportActuallyOpened: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawContentUsageAllowed: false;
  approvalRequiredForFutureSend: true;
  dryRunRequiredBeforeFutureSend: true;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4DRealMessageSendReadinessSource = {
  messageSendTransportBlockedRehearsalReady: true;
  transportCapabilityDiscoveryReady: true;
  wave4b3DryRunExecutablesReady: true;
  sessionHistoryMetadataAndRedactedContentReady: true;
  wave4b2ValidationReadinessReady: true;
  actionGovernancePipelineReady: true;
  nativeIntegrationRegistryReady: true;
  nativeSessionHistoryRegistryReady: true;
  targetSafeForTest: boolean;
  channelTransportConfigured: boolean;
  secretRefsAvailableAsResolver: boolean;
  policyPreflightAccepted: boolean;
  operatorApprovalGrantedNow: boolean;
  rollbackCompensationPlanAvailable: boolean;
  contentRedactedApproved: boolean;
  rateLimitPlanAvailable: boolean;
  dryRunEvidencePresent: boolean;
  rawContentRequired: boolean;
  externalExecutorLiveRequiredForNativeReadyPaths: false;
  newCapabilityExecutionAttempted: false;
  realMessageSendAttempted: false;
  transportOpenAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  newStateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4DRealMessageSendReadinessPlanNormalization = {
  nativeContract: 'ZavorthWave4DRealMessageSendReadinessPlan/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_READINESS_PLAN_RUNTIME_ID;
  decision: ZavorthWave4DRealMessageSendReadinessDecision;
  status: 'blocked' | 'wave4d-real-message-send-readiness-plan-ready';
  sourceReadiness: ZavorthWave4DRealMessageSendReadinessSource;
  requirements: ZavorthWave4DRealMessageSendRequirement[];
  goNoGoCriteria: ZavorthWave4DRealMessageSendGoNoGoCriterion[];
  blockers: ZavorthWave4DRealMessageSendBlockerId[];
  firstSendCandidate: ZavorthWave4DRealMessageSendCandidate;
  evidence: ZavorthWave4DRealMessageSendReadinessEvidence;
  executionGate: ZavorthWave4DRealMessageSendReadinessGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-wave-4d-first-controlled-real-message-send-by-explicit-gate-only';
};

export type ZavorthWave4DRealMessageSendReadinessPlanOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_READINESS_PLAN_RUNTIME_ID;
  source: ZavorthWave4DRealMessageSendReadinessSource;
};

function requirements(source: ZavorthWave4DRealMessageSendReadinessSource): ZavorthWave4DRealMessageSendRequirement[] {
  const rows: Array<Pick<ZavorthWave4DRealMessageSendRequirement, 'requirementId' | 'label' | 'currentDisposition' | 'evidenceGates'>> = [
    {
      requirementId: 'target-safe-test',
      label: 'Safe/test target is required before any live send.',
      currentDisposition: source.targetSafeForTest ? 'available-by-metadata' : 'blocked-until-safe-target',
      evidenceGates: ['222', '223', '230', '231', '232'],
    },
    {
      requirementId: 'channel-transport-configured',
      label: 'Channel/transport must be configured and verified before any live send.',
      currentDisposition: source.channelTransportConfigured ? 'available-by-metadata' : 'blocked-until-transport-configured',
      evidenceGates: ['183', '187', '222', '224', '232'],
    },
    {
      requirementId: 'secretref-secure-resolver',
      label: 'SecretRefs must be present through a safe resolver without raw serialization.',
      currentDisposition: source.secretRefsAvailableAsResolver ? 'available-by-metadata' : 'blocked-until-secretref-present',
      evidenceGates: ['157', '164', '183', '187', '232'],
    },
    {
      requirementId: 'policy-preflight',
      label: 'Zavorth policy preflight and immediate recheck are required.',
      currentDisposition: source.policyPreflightAccepted ? 'ready' : 'planned-required-before-live',
      evidenceGates: ['174', '175', '178', '179', '180', '231', '232'],
    },
    {
      requirementId: 'approval-grant-real',
      label: 'A real operator/user approval grant is required before live send.',
      currentDisposition: source.operatorApprovalGrantedNow ? 'ready' : 'blocked-until-future-approval',
      evidenceGates: ['178', '179', '180', '231', '233'],
    },
    {
      requirementId: 'idempotency-key',
      label: 'A deterministic idempotency key is required.',
      currentDisposition: 'ready',
      evidenceGates: ['175', '179', '180', '231', '232', '233'],
    },
    {
      requirementId: 'rollback-compensation-recall',
      label: 'Rollback/compensation/recall plan is required when available for the transport.',
      currentDisposition: source.rollbackCompensationPlanAvailable ? 'ready' : 'planned-required-before-live',
      evidenceGates: ['165', '166', '180', '231', '232'],
    },
    {
      requirementId: 'audit-receipt',
      label: 'A redacted audit receipt is required.',
      currentDisposition: 'ready',
      evidenceGates: ['174', '175', '180', '231', '232', '233'],
    },
    {
      requirementId: 'rate-limit',
      label: 'Rate-limit and retry guardrails are required before live send.',
      currentDisposition: source.rateLimitPlanAvailable ? 'ready' : 'planned-required-before-live',
      evidenceGates: ['183', '187', '224', '232'],
    },
    {
      requirementId: 'dry-run-before-live',
      label: 'The dry-run path must pass before any live send.',
      currentDisposition: source.dryRunEvidencePresent ? 'ready' : 'planned-required-before-live',
      evidenceGates: ['230', '231', '232', '233'],
    },
    {
      requirementId: 'content-redacted-approved',
      label: 'Content must be redacted/approved and never raw.',
      currentDisposition: source.contentRedactedApproved && !source.rawContentRequired ? 'available-by-metadata' : 'planned-required-before-live',
      evidenceGates: ['226', '227', '228', '229', '231', '233'],
    },
    {
      requirementId: 'no-raw-content-leakage',
      label: 'No raw content leakage is allowed in plan, receipt, docs, or logs.',
      currentDisposition: source.rawContentRequired ? 'planned-required-before-live' : 'ready',
      evidenceGates: ['226', '227', '228', '229', '231', '233'],
    },
    {
      requirementId: 'execution-dependency-classification',
      label: 'Any external adapter/transport needed for send is an explicit execution dependency, not default runtime.',
      currentDisposition: 'ready',
      evidenceGates: ['191', '203', '208', '233'],
    },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4DRealMessageSendRequirement/v1',
    ...row,
    requiredForFutureSend: true,
    blocksFutureSendIfMissing: true,
    rawSecretSerialized: false,
    rawContentUsageAllowed: false,
  }));
}

function criterion(
  criterionId: ZavorthWave4DRealMessageSendGoNoGoCriterion['criterionId'],
  satisfiedNow: boolean,
  blockerId: ZavorthWave4DRealMessageSendBlockerId | undefined,
  notes: string,
): ZavorthWave4DRealMessageSendGoNoGoCriterion {
  return {
    nativeContract: 'ZavorthWave4DRealMessageSendGoNoGoCriterion/v1',
    criterionId,
    required: true,
    satisfiedNow,
    decision: satisfiedNow ? 'go-ready-for-future-live-gate' : 'no-go-blocked',
    ...(blockerId && !satisfiedNow ? { blockerId } : {}),
    notes,
  };
}

function goNoGoCriteria(source: ZavorthWave4DRealMessageSendReadinessSource): ZavorthWave4DRealMessageSendGoNoGoCriterion[] {
  return [
    criterion('transport-configured', source.channelTransportConfigured, 'channel-transport-not-configured', 'Transport must be configured by metadata and verified before a future live gate.'),
    criterion('target-verified', source.targetSafeForTest, 'target-not-safe', 'The first live send target must be safe/test-only and verified.'),
    criterion('content-redacted-approved', source.contentRedactedApproved && !source.rawContentRequired, 'raw-content-required', 'Only redacted/approved content may be used.'),
    criterion('secretref-present-redacted', source.secretRefsAvailableAsResolver, 'missing-secretref', 'SecretRef must be present via secure resolver without raw serialization.'),
    criterion('policy-accepted', source.policyPreflightAccepted, 'policy-rejected', 'Policy preflight must pass before a future live send.'),
    criterion('operator-approval', source.operatorApprovalGrantedNow, 'missing-approval-grant', 'A real approval grant is required by a future gate and is not granted in this plan.'),
    criterion('dry-run-passed', source.dryRunEvidencePresent, undefined, 'Dry-run evidence from 231 and 232 must exist before a future live send.'),
    criterion('rollback-compensation-ready', source.rollbackCompensationPlanAvailable, 'missing-rollback-compensation', 'Rollback/compensation or recall must be planned when the transport supports it.'),
    criterion('rate-limit-ready', source.rateLimitPlanAvailable, undefined, 'Rate-limit and retry guardrails must be planned before future live send.'),
  ];
}

function blockers(criteria: ZavorthWave4DRealMessageSendGoNoGoCriterion[]): ZavorthWave4DRealMessageSendBlockerId[] {
  return Array.from(new Set(criteria.flatMap((item) => item.blockerId ? [item.blockerId] : [])));
}

function candidate(source: ZavorthWave4DRealMessageSendReadinessSource): ZavorthWave4DRealMessageSendCandidate {
  return {
    nativeContract: 'ZavorthWave4DRealMessageSendCandidate/v1',
    candidateId: 'wave4d-first-controlled-safe-test-message-candidate',
    candidateStatus: 'prepared-not-executed',
    targetClass: 'safe-test-target',
    targetVerified: source.targetSafeForTest,
    channelTransportConfigured: source.channelTransportConfigured,
    secretRefsAvailableAsResolver: source.secretRefsAvailableAsResolver,
    secretRefResolutionRequired: true,
    rawSecretSerialized: false,
    contentPolicy: 'redacted-approved-only',
    contentRedactedApproved: source.contentRedactedApproved && !source.rawContentRequired,
    rawContentUsageAllowed: false,
    approvalStatus: 'future-real-approval-required',
    dryRunRequiredBeforeFutureSend: true,
    dryRunEvidenceGates: ['231', '232'],
    idempotencyKey: [
      'zavorth-wave4d-real-message-send-readiness',
      'safe-test-target',
      source.targetSafeForTest ? 'target-ready' : 'target-blocked',
      source.channelTransportConfigured ? 'transport-ready' : 'transport-blocked',
      source.secretRefsAvailableAsResolver ? 'secretref-ready' : 'secretref-blocked',
    ].join(':'),
    rollbackCompensationPlanRequired: true,
    rollbackCompensationPlanAvailable: source.rollbackCompensationPlanAvailable,
    recallIfAvailableRequired: true,
    auditReceiptRequired: true,
    rateLimitRequired: true,
    externalTransportExecutionDependency: 'explicit-execution-dependency-not-default-runtime',
    externalExecutorDefaultRuntimeRequired: false,
    executionActuallyPerformed: false,
    messageActuallySent: false,
    transportActuallyOpened: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    externalExecutorMutationAllowed: false,
  };
}

function evidence(): ZavorthWave4DRealMessageSendReadinessEvidence {
  return {
    nativeContract: 'ZavorthWave4DRealMessageSendReadinessEvidence/v1',
    messageSendTransportBlockedRehearsalBy182: true,
    transportCapabilityDiscoveryBy183: true,
    wave4b3DryRunExecutablesBy230To233: true,
    sessionHistoryMetadataAndRedactedContentBy218To229: true,
    wave4b2ValidationReadinessBy222To225: true,
    actionGovernancePipelineBy174To180: true,
    nativeIntegrationRegistryBy187: true,
    nativeSessionHistoryRegistryBy188: true,
    dryRunMandatoryBeforeLive: true,
    approvalRequiredForFutureSend: true,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    externalTransportIfNeededClassifiedAsExecutionDependency: true,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4DRealMessageSendReadinessGate {
  return {
    wave4dRealMessageSendReadinessPlanCreated: true,
    realMessageSendActuallyPerformed: false,
    transportActuallyOpened: false,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    externalExecutorMutationAllowed: false,
    rawContentUsageAllowed: false,
    approvalRequiredForFutureSend: true,
    dryRunRequiredBeforeFutureSend: true,
    rawSecretSerialized: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function sourceReady(source: ZavorthWave4DRealMessageSendReadinessSource): boolean {
  return (
    source.messageSendTransportBlockedRehearsalReady &&
    source.transportCapabilityDiscoveryReady &&
    source.wave4b3DryRunExecutablesReady &&
    source.sessionHistoryMetadataAndRedactedContentReady &&
    source.wave4b2ValidationReadinessReady &&
    source.actionGovernancePipelineReady &&
    source.nativeIntegrationRegistryReady &&
    source.nativeSessionHistoryRegistryReady &&
    !source.externalExecutorLiveRequiredForNativeReadyPaths &&
    !source.newCapabilityExecutionAttempted &&
    !source.realMessageSendAttempted &&
    !source.transportOpenAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.externalExecutorMutationAttempted &&
    !source.newStateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthWave4DRealMessageSendReadinessPlan {
  public constructor(public readonly normalization: ZavorthWave4DRealMessageSendReadinessPlanNormalization) {}

  public requirementIds(): ZavorthWave4DRealMessageSendRequirementId[] {
    return this.normalization.requirements.map((requirement) => requirement.requirementId);
  }

  public goNoGoBlockerIds(): ZavorthWave4DRealMessageSendBlockerId[] {
    return this.normalization.blockers;
  }

  public candidatePreparedNotExecuted(): boolean {
    return this.normalization.firstSendCandidate.candidateStatus === 'prepared-not-executed' &&
      !this.normalization.firstSendCandidate.messageActuallySent &&
      !this.normalization.firstSendCandidate.transportActuallyOpened;
  }
}

export function createZavorthWave4DRealMessageSendReadinessPlanFixtureSource(
  overrides: Partial<ZavorthWave4DRealMessageSendReadinessSource> = {},
): ZavorthWave4DRealMessageSendReadinessSource {
  return {
    messageSendTransportBlockedRehearsalReady: true,
    transportCapabilityDiscoveryReady: true,
    wave4b3DryRunExecutablesReady: true,
    sessionHistoryMetadataAndRedactedContentReady: true,
    wave4b2ValidationReadinessReady: true,
    actionGovernancePipelineReady: true,
    nativeIntegrationRegistryReady: true,
    nativeSessionHistoryRegistryReady: true,
    targetSafeForTest: true,
    channelTransportConfigured: false,
    secretRefsAvailableAsResolver: true,
    policyPreflightAccepted: true,
    operatorApprovalGrantedNow: false,
    rollbackCompensationPlanAvailable: false,
    contentRedactedApproved: true,
    rateLimitPlanAvailable: true,
    dryRunEvidencePresent: true,
    rawContentRequired: false,
    externalExecutorLiveRequiredForNativeReadyPaths: false,
    newCapabilityExecutionAttempted: false,
    realMessageSendAttempted: false,
    transportOpenAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    newStateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4DRealMessageSendReadinessPlan(
  options: ZavorthWave4DRealMessageSendReadinessPlanOptions,
): ZavorthWave4DRealMessageSendReadinessPlanNormalization {
  const planRequirements = requirements(options.source);
  const planGoNoGoCriteria = goNoGoCriteria(options.source);
  const planBlockers = blockers(planGoNoGoCriteria);
  const firstCandidate = candidate(options.source);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    firstCandidate.candidateStatus === 'prepared-not-executed' &&
    !firstCandidate.messageActuallySent &&
    !firstCandidate.transportActuallyOpened &&
    !options.source.rawContentRequired &&
    !options.source.realMessageSendAttempted &&
    !options.source.transportOpenAttempted &&
    !options.source.providerExecutionAttempted &&
    !options.source.toolCommandExecutionAttempted &&
    !options.source.externalExecutorMutationAttempted &&
    !options.source.rawSecretSerialized;

  return {
    nativeContract: 'ZavorthWave4DRealMessageSendReadinessPlan/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4d-real-message-send-readiness-plan-ready' : 'blocked',
    status: ready ? 'wave4d-real-message-send-readiness-plan-ready' : 'blocked',
    sourceReadiness: options.source,
    requirements: planRequirements,
    goNoGoCriteria: planGoNoGoCriteria,
    blockers: planBlockers,
    firstSendCandidate: firstCandidate,
    evidence: evidence(),
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-wave-4d-first-controlled-real-message-send-by-explicit-gate-only',
  };
}

export function normalizeZavorthWave4DRealMessageSendReadinessPlanFixture(
  overrides: Partial<ZavorthWave4DRealMessageSendReadinessSource> = {},
): ZavorthWave4DRealMessageSendReadinessPlanNormalization {
  return normalizeZavorthWave4DRealMessageSendReadinessPlan({
    generatedAt: ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_READINESS_PLAN_NOW,
    runtimeId: ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_READINESS_PLAN_RUNTIME_ID,
    source: createZavorthWave4DRealMessageSendReadinessPlanFixtureSource(overrides),
  });
}

export function createZavorthWave4DRealMessageSendReadinessPlanFixture(
  overrides: Partial<ZavorthWave4DRealMessageSendReadinessSource> = {},
): ZavorthWave4DRealMessageSendReadinessPlan {
  return new ZavorthWave4DRealMessageSendReadinessPlan(
    normalizeZavorthWave4DRealMessageSendReadinessPlanFixture(overrides),
  );
}
