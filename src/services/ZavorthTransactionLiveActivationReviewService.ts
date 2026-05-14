import { createHash } from 'node:crypto';

import {
  buildZavorthTransactionLiveActivationReviewContractSnapshot,
  ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
  type ZavorthTransactionLiveActivationKillSwitch,
  type ZavorthTransactionLiveActivationLimits,
  type ZavorthTransactionLiveActivationReviewContractSnapshot,
  type ZavorthTransactionLiveActivationReviewGate,
  type ZavorthTransactionLiveActivationReviewInput,
  type ZavorthTransactionLiveActivationReviewPacket,
  type ZavorthTransactionLiveActivationReviewResult,
  type ZavorthTransactionLiveActivationReviewSafety,
  type ZavorthTransactionLiveActivationReviewStatus,
  type ZavorthTransactionLiveActivationRollbackDrill,
  type ZavorthTransactionLiveActivationOwnerReview,
} from '../contracts/ZavorthTransactionLiveActivationReviewContract.js';
import type {
  ZavorthTransactionLiveCandidateEnvelope,
} from '../contracts/ZavorthTransactionLiveCandidateContract.js';
import {
  ZavorthTransactionLiveCandidateEnvelopeService,
} from './ZavorthTransactionLiveCandidateEnvelopeService.js';

type LiveActivationReviewDeps = {
  now?: () => Date;
  liveCandidate?: Pick<ZavorthTransactionLiveCandidateEnvelopeService, 'propose' | 'buildSnapshot'>;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const REVIEW_PACKET_TTL_MS = 10 * 60 * 1000;
const MAX_CANARY_SINGLE_AMOUNT = 500;
const MAX_CANARY_DAILY_AMOUNT = 1000;
const MAX_CANARY_EXECUTIONS_PER_DAY = 3;

const SAFETY: ZavorthTransactionLiveActivationReviewSafety = {
  activationReviewOnly: true,
  doesNotAuthorizeLiveExecution: true,
  noLiveExecution: true,
  noHiddenLiveAction: true,
  noRawSecretSerialized: true,
  externalSideEffects: false,
  liveExecutionAuthorized: false,
  executableNow: false,
  liveActionApplied: false,
  separateLiveExecutorRequired: true,
  killSwitchRequiredBeforeLive: true,
  rollbackDrillRequiredBeforeLive: true,
};

export class ZavorthTransactionLiveActivationReviewService {
  private readonly now: () => Date;
  private readonly liveCandidate: Pick<ZavorthTransactionLiveCandidateEnvelopeService, 'propose' | 'buildSnapshot'>;

  public constructor(deps: LiveActivationReviewDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.liveCandidate = deps.liveCandidate ?? new ZavorthTransactionLiveCandidateEnvelopeService({
      now: this.now,
      ledgerFile: deps.ledgerFile,
      credentialStoreFile: deps.credentialStoreFile,
    });
  }

  public buildSnapshot(): ZavorthTransactionLiveActivationReviewContractSnapshot {
    return buildZavorthTransactionLiveActivationReviewContractSnapshot();
  }

  public review(input: ZavorthTransactionLiveActivationReviewInput): ZavorthTransactionLiveActivationReviewResult {
    const createdAt = this.now();
    const sourceCandidate = this.liveCandidate.propose(input);
    const ownerReview = buildOwnerReview(input, createdAt);
    const envelope = sourceCandidate.envelope;
    const limits = normalizeLimits(input, envelope);
    const killSwitch = normalizeKillSwitch(input, createdAt);
    const rollbackDrill = normalizeRollbackDrill(input);
    const gates = buildGates({
      input,
      sourceCandidate,
      envelope,
      ownerReview,
      limits,
      killSwitch,
      rollbackDrill,
    });
    const status = resolveStatus(gates);
    const blockers = gates
      .filter((gate) => !gate.passed)
      .map((gate) => gate.kind);
    const reviewPacket = status === 'ready-for-live-activation-review' && envelope
      ? buildReviewPacket({
        sourceCandidateId: sourceCandidate.id,
        envelope,
        ownerReview,
        limits,
        killSwitch,
        rollbackDrill,
        now: createdAt,
      })
      : undefined;

    return {
      version: ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_CONTRACT_VERSION,
      id: buildResultId(input.text, createdAt),
      createdAt: createdAt.toISOString(),
      status,
      summary: summaryForStatus(status),
      ownerReview,
      limits,
      killSwitch,
      rollbackDrill,
      gates,
      sourceCandidate,
      ...(reviewPacket ? { reviewPacket } : {}),
      blockers,
      nextSteps: nextStepsForStatus(status, blockers),
      safety: SAFETY,
    };
  }

  public renderReport(result: ZavorthTransactionLiveActivationReviewResult): string {
    return [
      '[transaction-live-activation-review] Phase 11 live activation review gate',
      `[transaction-live-activation-review] status: ${result.status}`,
      `[transaction-live-activation-review] candidate: ${result.sourceCandidate.status}`,
      `[transaction-live-activation-review] owner: ${result.ownerReview.ownerId}`,
      `[transaction-live-activation-review] owner-review-confirmed: ${result.ownerReview.confirmed}`,
      `[transaction-live-activation-review] owner-review-phrase-accepted: ${result.ownerReview.phraseAccepted}`,
      `[transaction-live-activation-review] packet: ${result.reviewPacket?.id ?? 'none'}`,
      `[transaction-live-activation-review] kill-switch: ${result.killSwitch.id ?? 'missing'} enabled=${result.killSwitch.enabled} tested=${result.killSwitch.tested}`,
      `[transaction-live-activation-review] rollback-drill: ${result.rollbackDrill.drillId ?? 'missing'} performed=${result.rollbackDrill.performed} successful=${result.rollbackDrill.successful}`,
      `[transaction-live-activation-review] limits: single=${result.limits.maxSingleAmount ?? 'missing'} daily=${result.limits.maxDailyAmount ?? 'missing'} executions=${result.limits.maxExecutionsPerDay ?? 'missing'}`,
      `[transaction-live-activation-review] no-live-execution: ${result.safety.noLiveExecution}`,
      `[transaction-live-activation-review] live-execution-authorized: ${result.safety.liveExecutionAuthorized}`,
      `[transaction-live-activation-review] executable-now: ${result.safety.executableNow}`,
      `[transaction-live-activation-review] live-action-applied: ${result.safety.liveActionApplied}`,
      ...result.gates.map((gate) => `[transaction-live-activation-review] gate: ${gate.kind} passed=${gate.passed} summary=${gate.summary}`),
      ...result.nextSteps.map((step) => `[transaction-live-activation-review] next: ${step}`),
    ].join('\n');
  }
}

function buildOwnerReview(
  input: ZavorthTransactionLiveActivationReviewInput,
  now: Date,
): ZavorthTransactionLiveActivationOwnerReview {
  const activationIntent = input.activationReviewIntent ?? '';
  const confirmed = input.activationReviewConfirmed === true;
  const phraseAccepted = activationIntent.trim() === ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE;
  const ownerId = sanitizeId(input.ownerId ?? 'owner');
  const reviewId = sanitizeId(input.activationReviewId ?? `ztx-live-review-${ownerId}`);
  return {
    ownerId,
    reviewId,
    confirmed,
    requiredPhrase: ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
    phraseAccepted,
    ...(confirmed && phraseAccepted ? { confirmationRecordedAt: now.toISOString() } : {}),
    reviewDigest: digestPayload({
      ownerId,
      reviewId,
      activationIntent,
      confirmed,
      phraseAccepted,
    }),
  };
}

function normalizeLimits(
  input: ZavorthTransactionLiveActivationReviewInput,
  envelope: ZavorthTransactionLiveCandidateEnvelope | undefined,
): ZavorthTransactionLiveActivationLimits {
  if (input.useSafeDefaultControls && envelope) {
    const amount = safeNumber(envelope.amount) ?? 100;
    return {
      maxSingleAmount: amount,
      maxDailyAmount: amount,
      maxExecutionsPerDay: 1,
      allowedConnectorIds: [envelope.connectorId],
      allowedTargetLabels: [envelope.target.label],
      currency: envelope.currency ?? null,
    };
  }
  const limits = input.limits ?? {};
  return {
    maxSingleAmount: safeNumber(limits.maxSingleAmount),
    maxDailyAmount: safeNumber(limits.maxDailyAmount),
    maxExecutionsPerDay: safeInteger(limits.maxExecutionsPerDay),
    allowedConnectorIds: normalizeList(limits.allowedConnectorIds),
    allowedTargetLabels: normalizeList(limits.allowedTargetLabels),
    currency: clean(limits.currency),
  };
}

function normalizeKillSwitch(
  input: ZavorthTransactionLiveActivationReviewInput,
  now: Date,
): ZavorthTransactionLiveActivationKillSwitch {
  const killSwitch = input.killSwitch ?? {};
  const id = clean(killSwitch.id);
  const tested = killSwitch.tested === true;
  return {
    id,
    enabled: killSwitch.enabled === true,
    tested,
    command: clean(killSwitch.command),
    ownerId: clean(killSwitch.ownerId ?? input.ownerId ?? null),
    ...(tested ? { lastTestedAt: now.toISOString() } : {}),
  };
}

function normalizeRollbackDrill(
  input: ZavorthTransactionLiveActivationReviewInput,
): ZavorthTransactionLiveActivationRollbackDrill {
  const drill = input.rollbackDrill ?? {};
  return {
    drillId: clean(drill.drillId),
    performed: drill.performed === true,
    successful: drill.successful === true,
    summary: clean(drill.summary) ?? '',
    replayCommand: clean(drill.replayCommand) ?? '',
    rollbackCommand: clean(drill.rollbackCommand) ?? '',
    artifacts: normalizeList(drill.artifacts).slice(0, 12),
  };
}

function buildGates(input: {
  input: ZavorthTransactionLiveActivationReviewInput;
  sourceCandidate: ReturnType<ZavorthTransactionLiveCandidateEnvelopeService['propose']>;
  envelope: ZavorthTransactionLiveCandidateEnvelope | undefined;
  ownerReview: ZavorthTransactionLiveActivationOwnerReview;
  limits: ZavorthTransactionLiveActivationLimits;
  killSwitch: ZavorthTransactionLiveActivationKillSwitch;
  rollbackDrill: ZavorthTransactionLiveActivationRollbackDrill;
}): ZavorthTransactionLiveActivationReviewGate[] {
  const envelope = input.envelope;
  const runtimeConnector = input.sourceCandidate.commandCenterProjection.surfaceProjection.runtime.connectorRun?.connector;
  const limitsEvaluation = evaluateLimits(input.limits, envelope);
  const canaryEvaluation = evaluateCanaryLimits(input.limits);
  const serialized = JSON.stringify({
    sourceCandidate: input.sourceCandidate,
    limits: input.limits,
    killSwitch: input.killSwitch,
    rollbackDrill: input.rollbackDrill,
  });
  const rawSecret = rawSecretValue(input.input.text);
  const rawSecretSerialized = rawSecret.length > 0 && serialized.includes(rawSecret);

  return [
    gate(
      'phase10-candidate-ready',
      input.sourceCandidate.status === 'candidate-ready',
      'Phase 10 must produce a candidate-ready result first.',
      [`status=${input.sourceCandidate.status}`],
    ),
    gate(
      'candidate-envelope-present',
      Boolean(envelope?.candidateOnly && envelope.rawSecretPresent === false),
      'A candidate-only envelope must exist before activation review.',
      [`envelope=${envelope?.id ?? 'none'}`],
    ),
    gate(
      'owner-activation-review',
      input.ownerReview.confirmed && input.ownerReview.phraseAccepted,
      'Owner must confirm a dedicated live activation review phrase.',
      [`owner=${input.ownerReview.ownerId}`, `phraseAccepted=${input.ownerReview.phraseAccepted}`],
    ),
    gate(
      'bounded-limits',
      limitsEvaluation.passed,
      'Activation review requires explicit connector, target, amount and execution bounds.',
      limitsEvaluation.evidence,
    ),
    gate(
      'canary-limit-ready',
      canaryEvaluation.passed,
      'Phase 11 only accepts small canary-sized limits.',
      canaryEvaluation.evidence,
    ),
    gate(
      'kill-switch-ready',
      Boolean(input.killSwitch.id && input.killSwitch.enabled && input.killSwitch.tested && input.killSwitch.command),
      'A tested kill switch must be recorded before activation review can be ready.',
      [
        `id=${input.killSwitch.id ?? 'none'}`,
        `enabled=${input.killSwitch.enabled}`,
        `tested=${input.killSwitch.tested}`,
        `command=${input.killSwitch.command ? 'present' : 'missing'}`,
      ],
    ),
    gate(
      'rollback-drill-ready',
      Boolean(
        input.rollbackDrill.drillId
          && input.rollbackDrill.performed
          && input.rollbackDrill.successful
          && input.rollbackDrill.summary
          && input.rollbackDrill.replayCommand
          && input.rollbackDrill.rollbackCommand,
      ),
      'A successful rollback drill with replay and rollback commands is required before live activation review.',
      [
        `drill=${input.rollbackDrill.drillId ?? 'none'}`,
        `performed=${input.rollbackDrill.performed}`,
        `successful=${input.rollbackDrill.successful}`,
        `replay=${input.rollbackDrill.replayCommand ? 'present' : 'missing'}`,
        `rollback=${input.rollbackDrill.rollbackCommand ? 'present' : 'missing'}`,
      ],
    ),
    gate(
      'connector-live-still-disabled',
      runtimeConnector?.supportsLive === false,
      'The Phase 11 source connector must still be a simulated connector, not a live executor.',
      [`connector=${runtimeConnector?.id ?? 'none'}`, `supportsLive=${String(runtimeConnector?.supportsLive ?? 'unknown')}`],
    ),
    gate(
      'separate-live-executor-required',
      SAFETY.separateLiveExecutorRequired === true && SAFETY.liveExecutionAuthorized === false,
      'Review packets require a separate future live executor and do not authorize execution themselves.',
      ['separateLiveExecutorRequired=true', 'liveExecutionAuthorized=false'],
    ),
    gate(
      'raw-secret-redaction',
      !rawSecretSerialized && input.sourceCandidate.safety.noRawSecretSerialized === true,
      'Activation review output must not serialize raw transaction secrets.',
      [`rawSecretSerialized=${rawSecretSerialized}`],
    ),
  ];
}

function evaluateLimits(
  limits: ZavorthTransactionLiveActivationLimits,
  envelope: ZavorthTransactionLiveCandidateEnvelope | undefined,
): { passed: boolean; evidence: string[] } {
  const amount = safeNumber(envelope?.amount);
  const maxSingle = safeNumber(limits.maxSingleAmount);
  const maxDaily = safeNumber(limits.maxDailyAmount);
  const maxExecutions = safeInteger(limits.maxExecutionsPerDay);
  const amountWithin = amount == null || (maxSingle != null && amount <= maxSingle);
  const dailyCoversSingle = maxSingle != null && maxDaily != null && maxDaily >= maxSingle;
  const connectorAllowed = Boolean(envelope?.connectorId && limits.allowedConnectorIds.includes(envelope.connectorId));
  const targetAllowed = Boolean(envelope?.target.label && limits.allowedTargetLabels.includes(envelope.target.label));
  const executionsReady = maxExecutions != null && maxExecutions >= 1;
  const passed = Boolean(
    envelope
      && maxSingle != null
      && maxSingle > 0
      && maxDaily != null
      && maxDaily > 0
      && dailyCoversSingle
      && executionsReady
      && amountWithin
      && connectorAllowed
      && targetAllowed,
  );
  return {
    passed,
    evidence: [
      `amount=${amount ?? 'none'}`,
      `maxSingle=${maxSingle ?? 'missing'}`,
      `maxDaily=${maxDaily ?? 'missing'}`,
      `maxExecutionsPerDay=${maxExecutions ?? 'missing'}`,
      `connectorAllowed=${connectorAllowed}`,
      `targetAllowed=${targetAllowed}`,
      `amountWithin=${amountWithin}`,
    ],
  };
}

function evaluateCanaryLimits(
  limits: ZavorthTransactionLiveActivationLimits,
): { passed: boolean; evidence: string[] } {
  const maxSingle = safeNumber(limits.maxSingleAmount);
  const maxDaily = safeNumber(limits.maxDailyAmount);
  const maxExecutions = safeInteger(limits.maxExecutionsPerDay);
  const passed = Boolean(
    maxSingle != null
      && maxSingle > 0
      && maxSingle <= MAX_CANARY_SINGLE_AMOUNT
      && maxDaily != null
      && maxDaily > 0
      && maxDaily <= MAX_CANARY_DAILY_AMOUNT
      && maxExecutions != null
      && maxExecutions >= 1
      && maxExecutions <= MAX_CANARY_EXECUTIONS_PER_DAY,
  );
  return {
    passed,
    evidence: [
      `maxSingle=${maxSingle ?? 'missing'} <= ${MAX_CANARY_SINGLE_AMOUNT}`,
      `maxDaily=${maxDaily ?? 'missing'} <= ${MAX_CANARY_DAILY_AMOUNT}`,
      `maxExecutionsPerDay=${maxExecutions ?? 'missing'} <= ${MAX_CANARY_EXECUTIONS_PER_DAY}`,
    ],
  };
}

function gate(
  kind: ZavorthTransactionLiveActivationReviewGate['kind'],
  passed: boolean,
  summary: string,
  evidence: string[],
): ZavorthTransactionLiveActivationReviewGate {
  return {
    kind,
    passed,
    summary,
    evidence,
  };
}

function resolveStatus(
  gates: ZavorthTransactionLiveActivationReviewGate[],
): ZavorthTransactionLiveActivationReviewStatus {
  if (!isGatePassed(gates, 'phase10-candidate-ready') || !isGatePassed(gates, 'candidate-envelope-present')) {
    return 'candidate-required';
  }
  if (!isGatePassed(gates, 'owner-activation-review')) {
    return 'owner-review-required';
  }
  const policyGates = [
    'bounded-limits',
    'canary-limit-ready',
    'kill-switch-ready',
    'connector-live-still-disabled',
    'separate-live-executor-required',
    'raw-secret-redaction',
  ];
  if (!policyGates.every((kind) => isGatePassed(gates, kind))) {
    return 'activation-policy-blocked';
  }
  if (!isGatePassed(gates, 'rollback-drill-ready')) {
    return 'rollback-drill-required';
  }
  return 'ready-for-live-activation-review';
}

function isGatePassed(gates: ZavorthTransactionLiveActivationReviewGate[], kind: string): boolean {
  return gates.some((gate) => gate.kind === kind && gate.passed);
}

function buildReviewPacket(input: {
  sourceCandidateId: string;
  envelope: ZavorthTransactionLiveCandidateEnvelope;
  ownerReview: ZavorthTransactionLiveActivationOwnerReview;
  limits: ZavorthTransactionLiveActivationLimits;
  killSwitch: ZavorthTransactionLiveActivationKillSwitch;
  rollbackDrill: ZavorthTransactionLiveActivationRollbackDrill;
  now: Date;
}): ZavorthTransactionLiveActivationReviewPacket {
  const packetCore = {
    sourceCandidateResultId: input.sourceCandidateId,
    sourceCandidateEnvelopeId: input.envelope.id,
    ownerReviewId: input.ownerReview.reviewId,
    connectorId: input.envelope.connectorId,
    credentialRef: input.envelope.credentialRef,
    approvalEntryId: input.envelope.approvalEntryId,
    rollbackDrillId: input.rollbackDrill.drillId ?? 'missing',
    killSwitchId: input.killSwitch.id ?? 'missing',
    limits: input.limits,
  };
  const packetDigest = digestPayload(packetCore);
  return {
    id: buildPacketId(input.envelope.id, input.ownerReview.reviewId, input.now),
    createdAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + REVIEW_PACKET_TTL_MS).toISOString(),
    sourceCandidateResultId: input.sourceCandidateId,
    sourceCandidateEnvelopeId: input.envelope.id,
    ownerReviewId: input.ownerReview.reviewId,
    surface: input.envelope.surface,
    connectorId: input.envelope.connectorId,
    actionKind: input.envelope.actionKind,
    targetLabel: input.envelope.target.label,
    ...(input.envelope.amount != null ? { amount: input.envelope.amount } : {}),
    ...(input.envelope.currency ? { currency: input.envelope.currency } : {}),
    credentialRef: input.envelope.credentialRef,
    approvalEntryId: input.envelope.approvalEntryId,
    rollbackDrillId: input.rollbackDrill.drillId ?? 'missing',
    killSwitchId: input.killSwitch.id ?? 'missing',
    limits: input.limits,
    packetDigest,
    reviewOnly: true,
    activationAuthorized: false,
    liveExecutionAuthorized: false,
    executableNow: false,
    liveActionApplied: false,
    externalSideEffects: false,
    separateLiveExecutorRequired: true,
    conditions: [
      'This packet is a live activation review artifact only.',
      'It expires quickly and cannot be reused as an execution authorization.',
      'A separate future live executor must verify owner approval, limits, kill switch, rollback and connector certification again.',
      'No live transaction was executed or authorized by Phase 11.',
    ],
  };
}

function summaryForStatus(status: ZavorthTransactionLiveActivationReviewStatus): string {
  if (status === 'ready-for-live-activation-review') {
    return 'Live activation review packet is ready for a future separate executor; no live execution occurred.';
  }
  if (status === 'candidate-required') {
    return 'Phase 10 candidate-ready envelope is required before live activation review.';
  }
  if (status === 'owner-review-required') {
    return 'Candidate exists, but the dedicated owner activation review phrase is still required.';
  }
  if (status === 'rollback-drill-required') {
    return 'Activation policy is bounded, but a successful rollback drill is still required.';
  }
  return 'Activation policy gates blocked the review packet.';
}

function nextStepsForStatus(
  status: ZavorthTransactionLiveActivationReviewStatus,
  blockers: string[],
): string[] {
  if (status === 'ready-for-live-activation-review') {
    return [
      'Review this packet in a future separate live executor phase; do not execute from Phase 11.',
      'Keep canary limits, kill switch and rollback receipts attached to the future executor request.',
    ];
  }
  if (status === 'candidate-required') {
    return ['Create a Phase 10 candidate-ready envelope first.'];
  }
  if (status === 'owner-review-required') {
    return [`Re-run with owner activation review phrase: ${ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE}`];
  }
  if (status === 'rollback-drill-required') {
    return ['Run a successful rollback drill and provide replay plus rollback commands.'];
  }
  return blockers.map((blocker) => `Resolve gate: ${blocker}`);
}

function buildResultId(text: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:phase11:${text}`).digest('hex').slice(0, 16);
  return `ztx-live-activation-review-${hash}`;
}

function buildPacketId(envelopeId: string, reviewId: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:${envelopeId}:${reviewId}`).digest('hex').slice(0, 16);
  return `ztx-live-review-packet-${hash}`;
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
