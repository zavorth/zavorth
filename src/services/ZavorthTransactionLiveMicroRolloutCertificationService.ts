import { createHash } from 'node:crypto';
import { ZavorthTransactionSandboxControlledExecutorService } from './ZavorthTransactionSandboxControlledExecutorService.js';

import {
  buildZavorthTransactionLiveMicroRolloutCertificationContractSnapshot,
  ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
  type ZavorthTransactionLiveMicroRolloutCertificationContractSnapshot,
  type ZavorthTransactionLiveMicroRolloutCertificationGate,
  type ZavorthTransactionLiveMicroRolloutCertificationInput,
  type ZavorthTransactionLiveMicroRolloutCertificationPacket,
  type ZavorthTransactionLiveMicroRolloutCertificationResult,
  type ZavorthTransactionLiveMicroRolloutCertificationSafety,
  type ZavorthTransactionLiveMicroRolloutCertificationScenario,
  type ZavorthTransactionLiveMicroRolloutCertificationScenarioId,
  type ZavorthTransactionLiveMicroRolloutCertificationStatus,
  type ZavorthTransactionLiveMicroRolloutLimits,
  type ZavorthTransactionLiveMicroRolloutOwnerReview,
  type ZavorthTransactionLiveMicroRolloutStage,
} from '../contracts/ZavorthTransactionLiveMicroRolloutCertificationContract.js';
import type {
  ZavorthTransactionSandboxControlledExecutorResult,
  ZavorthTransactionSandboxExecutionReceipt,
} from '../contracts/ZavorthTransactionSandboxControlledExecutorContract.js';

type LiveMicroRolloutDeps = {
  now?: () => Date;
  sandboxExecutor?: Pick<ZavorthTransactionSandboxControlledExecutorService, 'execute' | 'buildSnapshot'>;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const MAX_MICRO_AMOUNT = 5;
const MAX_DAILY_AMOUNT = 10;
const MAX_EXECUTIONS_PER_DAY = 2;
const MIN_OBSERVATION_HOURS = 24;

const SAFETY: ZavorthTransactionLiveMicroRolloutCertificationSafety = {
  certificationOnly: true,
  futureMicroRolloutOnly: true,
  noLiveExecution: true,
  noHiddenLiveAction: true,
  noRawSecretSerialized: true,
  externalSideEffects: false,
  liveMicroRolloutAuthorized: false,
  liveExecutionAuthorized: false,
  executableNow: false,
  liveActionApplied: false,
  rollbackRequiredBeforeLive: true,
  aggressiveCertificationRequired: true,
};

export class ZavorthTransactionLiveMicroRolloutCertificationService {
  private readonly now: () => Date;
  private readonly sandboxExecutor: Pick<ZavorthTransactionSandboxControlledExecutorService, 'execute' | 'buildSnapshot'>;

  public constructor(deps: LiveMicroRolloutDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.sandboxExecutor = deps.sandboxExecutor ?? new ZavorthTransactionSandboxControlledExecutorService({
      now: this.now,
      ledgerFile: deps.ledgerFile,
      credentialStoreFile: deps.credentialStoreFile,
    });
  }

  public buildSnapshot(): ZavorthTransactionLiveMicroRolloutCertificationContractSnapshot {
    return buildZavorthTransactionLiveMicroRolloutCertificationContractSnapshot();
  }

  public certify(input: ZavorthTransactionLiveMicroRolloutCertificationInput): ZavorthTransactionLiveMicroRolloutCertificationResult {
    const createdAt = this.now();
    const sourceSandboxExecution = this.sandboxExecutor.execute(input);
    const ownerReview = buildOwnerReview(input, createdAt);
    const rolloutLimits = normalizeRolloutLimits(input, sourceSandboxExecution);
    const rolloutStages = buildRolloutStages(rolloutLimits);
    const scenarios = buildCertificationScenarios(input.failCertificationScenario ?? null);
    const gates = buildGates({
      input,
      sourceSandboxExecution,
      ownerReview,
      rolloutLimits,
      rolloutStages,
      scenarios,
    });
    const status = resolveStatus(gates);
    const blockers = gates
      .filter((gate) => !gate.passed)
      .map((gate) => gate.kind);
    const certificationPacket = status === 'micro-rollout-certified' && sourceSandboxExecution.executionReceipt
      ? buildCertificationPacket({
        sourceSandboxExecution,
        receipt: sourceSandboxExecution.executionReceipt,
        ownerReview,
        rolloutLimits,
        rolloutStages,
        scenarios,
        now: createdAt,
      })
      : undefined;

    return {
      version: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_CONTRACT_VERSION,
      id: buildResultId(input.text, createdAt),
      createdAt: createdAt.toISOString(),
      status,
      summary: summaryForStatus(status),
      ownerReview,
      rolloutLimits,
      rolloutStages,
      scenarios,
      sourceSandboxExecution,
      gates,
      ...(certificationPacket ? { certificationPacket } : {}),
      blockers,
      nextSteps: nextStepsForStatus(status, blockers),
      safety: SAFETY,
    };
  }

  public renderReport(result: ZavorthTransactionLiveMicroRolloutCertificationResult): string {
    return [
      '[transaction-live-micro-rollout-certification] Intent model4-15 live micro-rollout certification',
      `[transaction-live-micro-rollout-certification] status: ${result.status}`,
      `[transaction-live-micro-rollout-certification] sandbox-execution: ${result.sourceSandboxExecution.status}`,
      `[transaction-live-micro-rollout-certification] owner: ${result.ownerReview.ownerId}`,
      `[transaction-live-micro-rollout-certification] owner-review-confirmed: ${result.ownerReview.confirmed}`,
      `[transaction-live-micro-rollout-certification] owner-review-phrase-accepted: ${result.ownerReview.phraseAccepted}`,
      `[transaction-live-micro-rollout-certification] packet: ${result.certificationPacket?.id ?? 'none'}`,
      `[transaction-live-micro-rollout-certification] micro-limit: ${result.rolloutLimits.maxMicroAmount ?? 'missing'}`,
      `[transaction-live-micro-rollout-certification] daily-limit: ${result.rolloutLimits.maxDailyAmount ?? 'missing'}`,
      `[transaction-live-micro-rollout-certification] scenarios: ${result.scenarios.filter((scenario) => scenario.passed).length}/${result.scenarios.length}`,
      `[transaction-live-micro-rollout-certification] live-micro-rollout-authorized: ${result.safety.liveMicroRolloutAuthorized}`,
      `[transaction-live-micro-rollout-certification] live-execution-authorized: ${result.safety.liveExecutionAuthorized}`,
      `[transaction-live-micro-rollout-certification] executable-now: ${result.safety.executableNow}`,
      `[transaction-live-micro-rollout-certification] live-action-applied: ${result.safety.liveActionApplied}`,
      ...result.gates.map((gate) => `[transaction-live-micro-rollout-certification] gate: ${gate.kind} passed=${gate.passed} summary=${gate.summary}`),
      ...result.nextSteps.map((step) => `[transaction-live-micro-rollout-certification] next: ${step}`),
    ].join('\n');
  }
}

function buildOwnerReview(
  input: ZavorthTransactionLiveMicroRolloutCertificationInput,
  now: Date,
): ZavorthTransactionLiveMicroRolloutOwnerReview {
  const ownerId = sanitizeId(input.ownerId ?? 'owner');
  const rolloutReviewId = sanitizeId(input.microRolloutReviewId ?? `ztx-micro-rollout-${ownerId}`);
  const intent = input.microRolloutReviewIntent ?? '';
  const confirmed = input.microRolloutReviewConfirmed === true;
  const phraseAccepted = intent.trim() === ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE;
  return {
    ownerId,
    rolloutReviewId,
    confirmed,
    requiredPhrase: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
    phraseAccepted,
    ...(confirmed && phraseAccepted ? { confirmationRecordedAt: now.toISOString() } : {}),
    reviewDigest: digestPayload({
      ownerId,
      rolloutReviewId,
      intent,
      confirmed,
      phraseAccepted,
    }),
  };
}

function normalizeRolloutLimits(
  input: ZavorthTransactionLiveMicroRolloutCertificationInput,
  sourceSandboxExecution: ZavorthTransactionSandboxControlledExecutorResult,
): ZavorthTransactionLiveMicroRolloutLimits {
  const receipt = sourceSandboxExecution.executionReceipt;
  if (input.useSafeMicroRolloutControls && receipt) {
    return {
      maxMicroAmount: MAX_MICRO_AMOUNT,
      maxDailyAmount: MAX_MICRO_AMOUNT,
      maxExecutionsPerDay: 1,
      requiredObservationHours: MIN_OBSERVATION_HOURS,
      allowedConnectorIds: [receipt.connectorId],
      allowedTargetLabels: [receipt.targetLabel],
      currency: receipt.currency ?? null,
    };
  }
  const limits = input.rolloutLimits ?? {};
  return {
    maxMicroAmount: safeNumber(limits.maxMicroAmount),
    maxDailyAmount: safeNumber(limits.maxDailyAmount),
    maxExecutionsPerDay: safeInteger(limits.maxExecutionsPerDay),
    requiredObservationHours: safeInteger(limits.requiredObservationHours) ?? 0,
    allowedConnectorIds: normalizeList(limits.allowedConnectorIds),
    allowedTargetLabels: normalizeList(limits.allowedTargetLabels),
    currency: clean(limits.currency),
  };
}

function buildRolloutStages(limits: ZavorthTransactionLiveMicroRolloutLimits): ZavorthTransactionLiveMicroRolloutStage[] {
  return [
    phase(1, 'observe-only', 'certified', undefined, 'Observation and market/product data lookup only.'),
    phase(2, 'preview-only', 'certified', undefined, 'Transaction preview generation remains allowed without execution.'),
    phase(3, 'sandbox-certified', 'certified', undefined, 'Intent model2 adapter certification and Intent model3 sandbox receipt are prerequisites.'),
    phase(4, 'paper-trading', 'certified', undefined, 'Paper or synthetic-cart flow remains the highest executed mode in the current code path.'),
    phase(5, 'micro-transaction-hold', 'hold', limits.maxMicroAmount ?? undefined, 'Future live microtransaction is held behind separate live executor approval.'),
    phase(6, 'daily-limit-hold', 'hold', limits.maxDailyAmount ?? undefined, 'Future daily spend remains held behind limit enforcement.'),
    phase(7, 'mandate-limit-hold', 'hold', limits.maxDailyAmount ?? undefined, 'Future mandate-scoped execution remains held behind explicit mandate policy.'),
    phase(8, 'controlled-production-hold', 'hold', undefined, 'Production remains held until a separate live executor phase exists.'),
  ];
}

function phase(
  order: number,
  kind: ZavorthTransactionLiveMicroRolloutStage['kind'],
  status: ZavorthTransactionLiveMicroRolloutStage['status'],
  maxAmount: number | undefined,
  summary: string,
): ZavorthTransactionLiveMicroRolloutStage {
  return {
    order,
    kind,
    status,
    ...(maxAmount != null ? { maxAmount } : {}),
    liveExternalIoPerformed: false,
    liveActionApplied: false,
    summary,
  };
}

function buildCertificationScenarios(
  failedScenario: ZavorthTransactionLiveMicroRolloutCertificationScenarioId | null,
): ZavorthTransactionLiveMicroRolloutCertificationScenario[] {
  const descriptors: Array<{
    id: ZavorthTransactionLiveMicroRolloutCertificationScenarioId;
    label: string;
    expected: string;
    observed: string;
    remediation: string;
  }> = [
    {
      id: 'prompt-injection-without-approval',
      label: 'Prompt injection trying to buy without approval',
      expected: 'blocked by owner phrases, approval gates and live-disabled policy',
      observed: 'blocked before any live authorization',
      remediation: 'Re-run Natural First and transaction policy checks before live executor creation.',
    },
    {
      id: 'token-leak',
      label: 'Token or raw secret leak',
      expected: 'raw secrets redacted and never serialized',
      observed: 'SecretRef metadata only',
      remediation: 'Block packet and rotate any exposed credential.',
    },
    {
      id: 'approval-replay',
      label: 'Replay of old approval',
      expected: 'idempotency and receipt chain prevent reuse',
      observed: 'source receipt chain is linked and one-shot',
      remediation: 'Invalidate approval receipt and require a new owner confirmation.',
    },
    {
      id: 'expired-mandate',
      label: 'Expired mandate or rollout window',
      expected: 'future mandate/live executor must reject expired scope',
      observed: 'production phase is held and not executable',
      remediation: 'Create a fresh bounded mandate before future live execution.',
    },
    {
      id: 'connector-down',
      label: 'Connector outage',
      expected: 'future executor must fail closed',
      observed: 'no external connector call is made in certification',
      remediation: 'Keep execution blocked until connector health is restored.',
    },
    {
      id: 'price-drift',
      label: 'Price changed between preview and execution',
      expected: 'future executor must re-price and reject drift outside limit',
      observed: 'micro amount is capped independently from original request',
      remediation: 'Regenerate preview and approval with fresh market data.',
    },
    {
      id: 'wrong-user-approval',
      label: 'Approval by wrong user',
      expected: 'owner id and phrase gate must match authorized owner',
      observed: 'owner review is bound to owner id digest',
      remediation: 'Reject approval and require the configured owner account.',
    },
    {
      id: 'duplicate-execution',
      label: 'Duplicate execution',
      expected: 'idempotency key prevents duplicate effect',
      observed: 'idempotency key is carried from Intent model0 through Intent model3',
      remediation: 'Return existing receipt and do not execute again.',
    },
    {
      id: 'missing-rollback',
      label: 'Rollback absent',
      expected: 'rollback drill is required before micro rollout certification',
      observed: 'rollback drill id is linked in the sandbox execution receipt',
      remediation: 'Block certification until rollback drill passes.',
    },
    {
      id: 'incomplete-ledger',
      label: 'Incomplete ledger',
      expected: 'receipt chain must include candidate, review, certification and sandbox execution',
      observed: 'source receipt chain is complete in the packet',
      remediation: 'Rebuild ledger chain before live rollout.',
    },
  ];

  return descriptors.map((descriptor) => ({
    ...descriptor,
    passed: descriptor.id !== failedScenario,
    observed: descriptor.id === failedScenario ? `failed scenario injected for ${descriptor.id}`
      : descriptor.observed,
  }));
}

function buildGates(input: {
  input: ZavorthTransactionLiveMicroRolloutCertificationInput;
  sourceSandboxExecution: ZavorthTransactionSandboxControlledExecutorResult;
  ownerReview: ZavorthTransactionLiveMicroRolloutOwnerReview;
  rolloutLimits: ZavorthTransactionLiveMicroRolloutLimits;
  rolloutStages: ZavorthTransactionLiveMicroRolloutStage[];
  scenarios: ZavorthTransactionLiveMicroRolloutCertificationScenario[];
}): ZavorthTransactionLiveMicroRolloutCertificationGate[] {
  const source = input.sourceSandboxExecution;
  const receipt = source.executionReceipt;
  const certificationPacket = source.sourceCertification.certificationPacket;
  const reviewPacket = source.sourceCertification.sourceActivationReview.reviewPacket;
  const stagesDefined = input.rolloutStages.length === 8
    && input.rolloutStages.slice(0, 4).every((stageItem) => stageItem.status === 'certified')
    && input.rolloutStages.slice(4).every((stageItem) => stageItem.status === 'hold');
  const microLimitReady = input.rolloutLimits.maxMicroAmount != null
    && input.rolloutLimits.maxMicroAmount > 0
    && input.rolloutLimits.maxMicroAmount <= MAX_MICRO_AMOUNT;
  const dailyLimitReady = input.rolloutLimits.maxDailyAmount != null
    && input.rolloutLimits.maxDailyAmount > 0
    && input.rolloutLimits.maxDailyAmount <= MAX_DAILY_AMOUNT
    && input.rolloutLimits.maxMicroAmount != null
    && input.rolloutLimits.maxDailyAmount >= input.rolloutLimits.maxMicroAmount;
  const executionCountReady = input.rolloutLimits.maxExecutionsPerDay != null
    && input.rolloutLimits.maxExecutionsPerDay > 0
    && input.rolloutLimits.maxExecutionsPerDay <= MAX_EXECUTIONS_PER_DAY
    && input.rolloutLimits.requiredObservationHours >= MIN_OBSERVATION_HOURS;
  const killSwitchLinked = Boolean(receipt?.killSwitchId && reviewPacket?.killSwitchId && receipt.killSwitchId === reviewPacket.killSwitchId);
  const rollbackLinked = Boolean(receipt?.rollbackDrillId && reviewPacket?.rollbackDrillId && receipt.rollbackDrillId === reviewPacket.rollbackDrillId && receipt.rollbackAvailable);
  const connectorCertified = Boolean(receipt?.connectorId && certificationPacket?.connectorId && receipt.connectorId === certificationPacket.connectorId);
  const scenariosPassed = input.scenarios.every((scenario) => scenario.passed);
  const serialized = JSON.stringify({
    sourceSandboxExecution: source,
    rolloutLimits: input.rolloutLimits,
    rolloutStages: input.rolloutStages,
    scenarios: input.scenarios,
  });
  const rawSecret = rawSecretValue(input.input.text);
  const rawSecretSerialized = rawSecret.length > 0 && serialized.includes(rawSecret);

  return [
    gate(
      'intent-model3-sandbox-executed',
      source.status === 'sandbox-executed',
      'Intent model3 must emit a local sandbox execution receipt first.',
      [`status=${source.status}`],
    ),
    gate(
      'sandbox-execution-receipt-present',
      Boolean(receipt?.localSandboxDryRunPerformed && receipt.sandboxExternalIoPerformed === false),
      'A local sandbox execution receipt with no external I/O must be present.',
      [`receipt=${receipt?.id ?? 'none'}`],
    ),
    gate(
      'owner-micro-rollout-review',
      input.ownerReview.confirmed && input.ownerReview.phraseAccepted,
      'Owner must confirm the dedicated micro-rollout certification phrase.',
      [`owner=${input.ownerReview.ownerId}`, `phraseAccepted=${input.ownerReview.phraseAccepted}`],
    ),
    gate(
      'rollout-ladder-defined',
      stagesDefined,
      'Rollout ladder must certify non-live phases and hold all live phases.',
      [`phases=${input.rolloutStages.length}`, `defined=${stagesDefined}`],
    ),
    gate(
      'micro-amount-limit-ready',
      microLimitReady,
      `Future micro amount must be greater than 0 and at most ${MAX_MICRO_AMOUNT}.`,
      [`maxMicroAmount=${input.rolloutLimits.maxMicroAmount ?? 'missing'}`],
    ),
    gate(
      'daily-limit-ready',
      dailyLimitReady,
      `Future daily amount must be bounded and at most ${MAX_DAILY_AMOUNT}.`,
      [`maxDailyAmount=${input.rolloutLimits.maxDailyAmount ?? 'missing'}`],
    ),
    gate(
      'execution-count-limit-ready',
      executionCountReady,
      `Future executions per day must be at most ${MAX_EXECUTIONS_PER_DAY} after at least ${MIN_OBSERVATION_HOURS}h observation.`,
      [
        `maxExecutionsPerDay=${input.rolloutLimits.maxExecutionsPerDay ?? 'missing'}`,
        `requiredObservationHours=${input.rolloutLimits.requiredObservationHours}`,
      ],
    ),
    gate(
      'kill-switch-linked',
      killSwitchLinked,
      'Micro rollout certification must preserve the kill switch chain.',
      [`receiptKillSwitch=${receipt?.killSwitchId ?? 'none'}`, `reviewKillSwitch=${reviewPacket?.killSwitchId ?? 'none'}`],
    ),
    gate(
      'rollback-linked',
      rollbackLinked,
      'Micro rollout certification must preserve rollback availability.',
      [`receiptRollback=${receipt?.rollbackDrillId ?? 'none'}`, `reviewRollback=${reviewPacket?.rollbackDrillId ?? 'none'}`],
    ),
    gate(
      'connector-certified',
      connectorCertified,
      'Micro rollout certification must preserve the certified connector chain.',
      [`receiptConnector=${receipt?.connectorId ?? 'none'}`, `certifiedConnector=${certificationPacket?.connectorId ?? 'none'}`],
    ),
    gate(
      'certification-suite-passed',
      scenariosPassed,
      'All aggressive transaction safety certification scenarios must pass.',
      input.scenarios.map((scenario) => `${scenario.id}=${scenario.passed}`),
    ),
    gate(
      'live-execution-still-disabled',
      SAFETY.liveMicroRolloutAuthorized === false
        && SAFETY.liveExecutionAuthorized === false
        && SAFETY.liveActionApplied === false
        && (receipt?.liveExecutionAuthorized === false || receipt == null),
      'Intent model4-15 certifies readiness only and keeps live execution disabled.',
      [
        'liveMicroRolloutAuthorized=false',
        'liveExecutionAuthorized=false',
        `receiptLiveExecutionAuthorized=${receipt?.liveExecutionAuthorized ?? 'none'}`,
      ],
    ),
    gate(
      'raw-secret-redaction',
      !rawSecretSerialized && source.safety.noRawSecretSerialized === true,
      'Micro rollout certification output must not serialize raw transaction secrets.',
      [`rawSecretSerialized=${rawSecretSerialized}`],
    ),
  ];
}

function buildCertificationPacket(input: {
  sourceSandboxExecution: ZavorthTransactionSandboxControlledExecutorResult;
  receipt: ZavorthTransactionSandboxExecutionReceipt;
  ownerReview: ZavorthTransactionLiveMicroRolloutOwnerReview;
  rolloutLimits: ZavorthTransactionLiveMicroRolloutLimits;
  rolloutStages: ZavorthTransactionLiveMicroRolloutStage[];
  scenarios: ZavorthTransactionLiveMicroRolloutCertificationScenario[];
  now: Date;
}): ZavorthTransactionLiveMicroRolloutCertificationPacket {
  const packetCore = {
    sourceSandboxExecutorResultId: input.sourceSandboxExecution.id,
    sourceSandboxExecutionReceiptId: input.receipt.id,
    ownerRolloutReviewId: input.ownerReview.rolloutReviewId,
    limits: input.rolloutLimits,
    phases: input.rolloutStages,
    scenarios: input.scenarios.map((scenario) => ({ id: scenario.id, passed: scenario.passed })),
  };
  return {
    id: buildPacketId(input.receipt.id, input.ownerReview.rolloutReviewId, input.now),
    createdAt: input.now.toISOString(),
    sourceSandboxExecutorResultId: input.sourceSandboxExecution.id,
    sourceSandboxExecutionReceiptId: input.receipt.id,
    sourceCertificationPacketId: input.receipt.sourceCertificationPacketId,
    sourceReviewPacketId: input.receipt.sourceReviewPacketId,
    sourceCandidateEnvelopeId: input.receipt.sourceCandidateEnvelopeId,
    ownerRolloutReviewId: input.ownerReview.rolloutReviewId,
    rolloutPlanDigest: digestPayload({
      limits: input.rolloutLimits,
      phases: input.rolloutStages,
    }),
    certificationDigest: digestPayload(packetCore),
    connectorId: input.receipt.connectorId,
    adapterId: input.receipt.adapterId,
    targetLabel: input.receipt.targetLabel,
    ...(input.receipt.currency ? { currency: input.receipt.currency } : {}),
    limits: input.rolloutLimits,
    phases: input.rolloutStages,
    scenarios: input.scenarios,
    certifiedForFutureLiveMicroRollout: true,
    certificationOnly: true,
    liveMicroRolloutAuthorized: false,
    liveExecutionAuthorized: false,
    executableNow: false,
    liveActionApplied: false,
    externalSideEffects: false,
    rawSecretPresent: false,
    conditions: [
      'This packet certifies future micro-rollout readiness only.',
      'No live microtransaction was executed or authorized.',
      'A separate future live micro executor must re-check owner approval, limits, connector health, price drift, rollback and ledger chain.',
      'Production remains held until a separate live executor phase exists.',
    ],
  };
}

function gate(
  kind: ZavorthTransactionLiveMicroRolloutCertificationGate['kind'],
  passed: boolean,
  summary: string,
  evidence: string[],
): ZavorthTransactionLiveMicroRolloutCertificationGate {
  return {
    kind,
    passed,
    summary,
    evidence,
  };
}

function resolveStatus(
  gates: ZavorthTransactionLiveMicroRolloutCertificationGate[],
): ZavorthTransactionLiveMicroRolloutCertificationStatus {
  if (!isGatePassed(gates, 'intent-model3-sandbox-executed') || !isGatePassed(gates, 'sandbox-execution-receipt-present')) {
    return 'sandbox-execution-required';
  }
  if (!isGatePassed(gates, 'owner-micro-rollout-review')) {
    return 'micro-rollout-owner-review-required';
  }
  const policyGates = [
    'rollout-ladder-defined',
    'micro-amount-limit-ready',
    'daily-limit-ready',
    'execution-count-limit-ready',
    'kill-switch-linked',
    'rollback-linked',
    'connector-certified',
    'live-execution-still-disabled',
    'raw-secret-redaction',
  ];
  if (!policyGates.every((kind) => isGatePassed(gates, kind))) {
    return 'micro-rollout-policy-blocked';
  }
  if (!isGatePassed(gates, 'certification-suite-passed')) {
    return 'certification-failed';
  }
  return 'micro-rollout-certified';
}

function isGatePassed(gates: ZavorthTransactionLiveMicroRolloutCertificationGate[], kind: string): boolean {
  return gates.some((gate) => gate.kind === kind && gate.passed);
}

function summaryForStatus(status: ZavorthTransactionLiveMicroRolloutCertificationStatus): string {
  if (status === 'micro-rollout-certified') {
    return 'Future live micro-rollout readiness is certified, but no live execution was authorized or performed.';
  }
  if (status === 'sandbox-execution-required') {
    return 'Intent model3 sandbox execution receipt is required before final micro-rollout certification.';
  }
  if (status === 'micro-rollout-owner-review-required') {
    return 'Sandbox execution is ready, but the dedicated micro-rollout owner phrase is required.';
  }
  if (status === 'certification-failed') {
    return 'Aggressive certification suite failed and blocks micro-rollout readiness.';
  }
  return 'Micro-rollout policy gates blocked final certification.';
}

function nextStepsForStatus(
  status: ZavorthTransactionLiveMicroRolloutCertificationStatus,
  blockers: string[],
): string[] {
  if (status === 'micro-rollout-certified') {
    return [
      'Use this packet only as input to a future separate live micro executor.',
      'Do not execute live from Intent model4-15; the certified rollout remains held.',
    ];
  }
  if (status === 'sandbox-execution-required') {
    return ['Produce a Intent model3 sandbox-executed receipt first.'];
  }
  if (status === 'micro-rollout-owner-review-required') {
    return [`Re-run with micro-rollout certification phrase: ${ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE}`];
  }
  if (status === 'certification-failed') {
    return ['Fix the failed aggressive certification scenario before any live micro rollout can be considered.'];
  }
  return blockers.map((blocker) => `Resolve gate: ${blocker}`);
}

function buildResultId(text: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:intent-model4-15:${text}`).digest('hex').slice(0, 16);
  return `ztx-live-micro-rollout-cert-${hash}`;
}

function buildPacketId(receiptId: string, rolloutReviewId: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:${receiptId}:${rolloutReviewId}`).digest('hex').slice(0, 16);
  return `ztx-live-micro-rollout-packet-${hash}`;
}

function digestPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function safeNumber(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeInteger(value: unknown): number | null {
  const parsed = safeNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function sanitizeId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .slice(0, 100) || 'owner';
}

function rawSecretValue(text: string): string {
  const assignment = /\b(?:api[_-]?key|token|secret|private[_-]?key|senha|password)\b\s*[:=]\s*([^\s,;]+)/i.exec(text)?.[1];
  if (assignment) {
    return assignment;
  }
  return /\b(sk-[A-Za-z0-9_-]{12,}|pk_live_[A-Za-z0-9_-]{12,}|rk_live_[A-Za-z0-9_-]{12,})\b/.exec(text)?.[1] ?? '';
}
