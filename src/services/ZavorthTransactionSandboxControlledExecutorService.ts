import { createHash } from 'node:crypto';
import { ZavorthTransactionSandboxAdapterCertificationService } from './ZavorthTransactionSandboxAdapterCertificationService.js';

import {
  buildZavorthTransactionSandboxControlledExecutorContractSnapshot,
  ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
  type ZavorthTransactionSandboxControlledExecutorContractSnapshot,
  type ZavorthTransactionSandboxControlledExecutorGate,
  type ZavorthTransactionSandboxControlledExecutorInput,
  type ZavorthTransactionSandboxControlledExecutorOperatorGate,
  type ZavorthTransactionSandboxControlledExecutorResult,
  type ZavorthTransactionSandboxControlledExecutorSafety,
  type ZavorthTransactionSandboxControlledExecutorStatus,
  type ZavorthTransactionSandboxExecutionReceipt,
} from '../contracts/ZavorthTransactionSandboxControlledExecutorContract.js';
import type {
  ZavorthTransactionSandboxAdapterCertificationPacket,
  ZavorthTransactionSandboxAdapterCertificationResult,
} from '../contracts/ZavorthTransactionSandboxAdapterCertificationContract.js';

type SandboxControlledExecutorDeps = {
  now?: () => Date;
  certification?: Pick<ZavorthTransactionSandboxAdapterCertificationService, 'certify' | 'buildSnapshot'>;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const SAFETY: ZavorthTransactionSandboxControlledExecutorSafety = {
  controlledSandboxOnly: true,
  localSandboxDryRunOnly: true,
  noExternalNetworkCall: true,
  noLiveExecution: true,
  noHiddenLiveAction: true,
  noRawSecretSerialized: true,
  externalSideEffects: false,
  sandboxExternalIoPerformed: false,
  liveExecutionAuthorized: false,
  executableNow: false,
  liveActionApplied: false,
  separateLiveExecutorRequired: true,
};

export class ZavorthTransactionSandboxControlledExecutorService {
  private readonly now: () => Date;
  private readonly certification: Pick<ZavorthTransactionSandboxAdapterCertificationService, 'certify' | 'buildSnapshot'>;

  public constructor(deps: SandboxControlledExecutorDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.certification = deps.certification ?? new ZavorthTransactionSandboxAdapterCertificationService({
      now: this.now,
      ledgerFile: deps.ledgerFile,
      credentialStoreFile: deps.credentialStoreFile,
    });
  }

  public buildSnapshot(): ZavorthTransactionSandboxControlledExecutorContractSnapshot {
    return buildZavorthTransactionSandboxControlledExecutorContractSnapshot();
  }

  public execute(input: ZavorthTransactionSandboxControlledExecutorInput): ZavorthTransactionSandboxControlledExecutorResult {
    const createdAt = this.now();
    const sourceCertification = this.certification.certify(input);
    const operatorGate = buildOperatorGate(input, createdAt);
    const gates = buildGates({
      input,
      sourceCertification,
      operatorGate,
    });
    const status = resolveStatus(gates);
    const blockers = gates
      .filter((gate) => !gate.passed)
      .map((gate) => gate.kind);
    const executionReceipt = status === 'sandbox-executed' && sourceCertification.certificationPacket
      ? buildExecutionReceipt({
        sourceCertification,
        packet: sourceCertification.certificationPacket,
        operatorGate,
        now: createdAt,
      })
      : undefined;

    return {
      version: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_CONTRACT_VERSION,
      id: buildResultId(input.text, createdAt),
      createdAt: createdAt.toISOString(),
      status,
      summary: summaryForStatus(status),
      operatorGate,
      sourceCertification,
      gates,
      ...(executionReceipt ? { executionReceipt } : {}),
      blockers,
      nextSteps: nextStepsForStatus(status, blockers),
      safety: SAFETY,
    };
  }

  public renderReport(result: ZavorthTransactionSandboxControlledExecutorResult): string {
    return [
      '[transaction-sandbox-controlled-executor] Intent model3 controlled sandbox executor',
      `[transaction-sandbox-controlled-executor] status: ${result.status}`,
      `[transaction-sandbox-controlled-executor] certification: ${result.sourceCertification.status}`,
      `[transaction-sandbox-controlled-executor] operator: ${result.operatorGate.ownerId}`,
      `[transaction-sandbox-controlled-executor] sandbox-run: ${result.operatorGate.sandboxRunId}`,
      `[transaction-sandbox-controlled-executor] operator-confirmed: ${result.operatorGate.confirmed}`,
      `[transaction-sandbox-controlled-executor] operator-phrase-accepted: ${result.operatorGate.phraseAccepted}`,
      `[transaction-sandbox-controlled-executor] receipt: ${result.executionReceipt?.id ?? 'none'}`,
      `[transaction-sandbox-controlled-executor] local-sandbox-dryRun: ${result.executionReceipt?.localSandboxDryRunPerformed ?? false}`,
      `[transaction-sandbox-controlled-executor] sandbox-external-io: ${result.safety.sandboxExternalIoPerformed}`,
      `[transaction-sandbox-controlled-executor] no-external-network-call: ${result.safety.noExternalNetworkCall}`,
      `[transaction-sandbox-controlled-executor] live-execution-authorized: ${result.safety.liveExecutionAuthorized}`,
      `[transaction-sandbox-controlled-executor] executable-now: ${result.safety.executableNow}`,
      `[transaction-sandbox-controlled-executor] live-action-applied: ${result.safety.liveActionApplied}`,
      ...result.gates.map((gate) => `[transaction-sandbox-controlled-executor] gate: ${gate.kind} passed=${gate.passed} summary=${gate.summary}`),
      ...result.nextSteps.map((step) => `[transaction-sandbox-controlled-executor] next: ${step}`),
    ].join('\n');
  }
}

function buildOperatorGate(
  input: ZavorthTransactionSandboxControlledExecutorInput,
  now: Date,
): ZavorthTransactionSandboxControlledExecutorOperatorGate {
  const ownerId = sanitizeId(input.ownerId ?? 'owner');
  const sandboxRunId = sanitizeId(input.sandboxRunId ?? `ztx-sandbox-run-${ownerId}`);
  const intent = input.sandboxExecutionIntent ?? '';
  const confirmed = input.sandboxExecutionConfirmed === true;
  const phraseAccepted = intent.trim() === ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE;
  return {
    ownerId,
    sandboxRunId,
    confirmed,
    requiredPhrase: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
    phraseAccepted,
    ...(confirmed && phraseAccepted ? { confirmationRecordedAt: now.toISOString() } : {}),
    operatorDigest: digestPayload({
      ownerId,
      sandboxRunId,
      intent,
      confirmed,
      phraseAccepted,
    }),
  };
}

function buildGates(input: {
  input: ZavorthTransactionSandboxControlledExecutorInput;
  sourceCertification: ZavorthTransactionSandboxAdapterCertificationResult;
  operatorGate: ZavorthTransactionSandboxControlledExecutorOperatorGate;
}): ZavorthTransactionSandboxControlledExecutorGate[] {
  const certification = input.sourceCertification;
  const packet = certification.certificationPacket;
  const reviewPacket = certification.sourceActivationReview.reviewPacket;
  const envelope = certification.sourceActivationReview.sourceCandidate.envelope;
  const amount = envelope?.amount;
  const maxSingle = reviewPacket?.limits.maxSingleAmount;
  const amountWithinCertifiedLimits = amount == null
    || (maxSingle != null && amount <= maxSingle);
  const credentialBound = Boolean(
    packet?.credentialRef
      && reviewPacket?.credentialRef
      && packet.credentialRef === reviewPacket.credentialRef,
  );
  const idempotencyReady = Boolean(packet?.idempotencyKey && packet.idempotencyHeader);
  const killSwitchReady = Boolean(
    packet?.killSwitchId
      && certification.sourceActivationReview.killSwitch.id === packet.killSwitchId
      && certification.sourceActivationReview.killSwitch.tested,
  );
  const rollbackReady = Boolean(
    packet?.rollbackDrillId
      && certification.sourceActivationReview.rollbackDrill.drillId === packet.rollbackDrillId
      && certification.sourceActivationReview.rollbackDrill.successful,
  );
  const serialized = JSON.stringify({
    sourceCertification: certification,
    operatorGate: input.operatorGate,
  });
  const rawSecret = rawSecretValue(input.input.text);
  const rawSecretSerialized = rawSecret.length > 0 && serialized.includes(rawSecret);
  const canBuildReceipt = Boolean(
    packet
      && envelope
      && input.operatorGate.confirmed
      && input.operatorGate.phraseAccepted
      && !input.input.forceKillSwitch
      && !input.input.dryRunSandboxFailure,
  );

  return [
    gate(
      'intent-model2-certification-ready',
      certification.status === 'sandbox-certification-ready',
      'Intent model2 must produce a sandbox-certification-ready packet first.',
      [`status=${certification.status}`],
    ),
    gate(
      'certification-packet-present',
      Boolean(packet?.certificationOnly && packet.sandboxExecutionAuthorized === false),
      'A certification-only Intent model2 packet must be present.',
      [`packet=${packet?.id ?? 'none'}`],
    ),
    gate(
      'sandbox-operator-confirmation',
      input.operatorGate.confirmed && input.operatorGate.phraseAccepted,
      'Owner must confirm the controlled sandbox execution phrase.',
      [`owner=${input.operatorGate.ownerId}`, `phraseAccepted=${input.operatorGate.phraseAccepted}`],
    ),
    gate(
      'local-sandbox-only',
      certification.safety.noSandboxNetworkCall === true && certification.safety.separateSandboxExecutorRequired === true,
      'Intent model3 executes a local sandbox dry-run only, not a network adapter call.',
      ['localSandboxDryRunOnly=true', `intent-model2NoNetwork=${certification.safety.noSandboxNetworkCall}`],
    ),
    gate(
      'endpoint-not-called',
      SAFETY.noExternalNetworkCall === true && SAFETY.sandboxExternalIoPerformed === false,
      'The certified endpoint host is used as metadata only and is not called.',
      [`endpointHost=${packet?.endpointHost ?? 'none'}`, 'sandboxExternalIoPerformed=false'],
    ),
    gate(
      'amount-within-certified-limits',
      amountWithinCertifiedLimits,
      'Sandbox amount must remain within the Intent model1 certified limits.',
      [`amount=${amount ?? 'none'}`, `maxSingle=${maxSingle ?? 'missing'}`, `within=${amountWithinCertifiedLimits}`],
    ),
    gate(
      'credential-ref-bound',
      credentialBound,
      'Sandbox execution must use the same metadata-only SecretRef certified in Intent model2.',
      [`packetRef=${packet?.credentialRef ? 'present' : 'missing'}`, `reviewRef=${reviewPacket?.credentialRef ? 'present' : 'missing'}`, `bound=${credentialBound}`],
    ),
    gate(
      'idempotency-ready',
      idempotencyReady,
      'Sandbox execution must reuse the certified idempotency key and header.',
      [`header=${packet?.idempotencyHeader ?? 'missing'}`, `key=${packet?.idempotencyKey ? 'present' : 'missing'}`],
    ),
    gate(
      'kill-switch-ready',
      killSwitchReady,
      'The tested kill switch from Intent model1 must remain linked.',
      [`packetKillSwitch=${packet?.killSwitchId ?? 'none'}`, `tested=${certification.sourceActivationReview.killSwitch.tested}`],
    ),
    gate(
      'rollback-ready',
      rollbackReady,
      'The successful rollback drill from Intent model1 must remain linked.',
      [`packetRollback=${packet?.rollbackDrillId ?? 'none'}`, `successful=${certification.sourceActivationReview.rollbackDrill.successful}`],
    ),
    gate(
      'sandbox-not-aborted',
      input.input.forceKillSwitch !== true,
      'Sandbox execution is blocked if the kill switch is forced.',
      [`forceKillSwitch=${input.input.forceKillSwitch === true}`],
    ),
    gate(
      'sandbox-dry-run-succeeds',
      input.input.dryRunSandboxFailure !== true,
      'Sandbox execution is blocked if the local sandbox dryRun fails.',
      [`dryRunSandboxFailure=${input.input.dryRunSandboxFailure === true}`],
    ),
    gate(
      'execution-receipt-ready',
      canBuildReceipt,
      'All inputs needed for a local sandbox execution receipt must be present.',
      [`receiptReady=${canBuildReceipt}`],
    ),
    gate(
      'live-still-disabled',
      packet?.liveExecutionAuthorized === false
        && packet.liveActionApplied === false
        && SAFETY.liveExecutionAuthorized === false
        && SAFETY.liveActionApplied === false,
      'Intent model3 must keep live execution disabled even when sandbox execution is recorded.',
      [
        `packetLiveExecutionAuthorized=${packet?.liveExecutionAuthorized ?? 'none'}`,
        `packetLiveActionApplied=${packet?.liveActionApplied ?? 'none'}`,
        'liveExecutionAuthorized=false',
        'liveActionApplied=false',
      ],
    ),
    gate(
      'raw-secret-redaction',
      !rawSecretSerialized && certification.safety.noRawSecretSerialized === true,
      'Sandbox controlled executor output must not serialize raw transaction secrets.',
      [`rawSecretSerialized=${rawSecretSerialized}`],
    ),
  ];
}

function buildExecutionReceipt(input: {
  sourceCertification: ZavorthTransactionSandboxAdapterCertificationResult;
  packet: ZavorthTransactionSandboxAdapterCertificationPacket;
  operatorGate: ZavorthTransactionSandboxControlledExecutorOperatorGate;
  now: Date;
}): ZavorthTransactionSandboxExecutionReceipt {
  const review = input.sourceCertification.sourceActivationReview;
  const envelope = review.sourceCandidate.envelope;
  if (!envelope) {
    throw new Error('Cannot build Intent model3 sandbox execution receipt without Intent model0 envelope.');
  }
  const receiptCore = {
    sourceCertificationResultId: input.sourceCertification.id,
    sourceCertificationPacketId: input.packet.id,
    sandboxRunId: input.operatorGate.sandboxRunId,
    adapterId: input.packet.adapterId,
    idempotencyKey: input.packet.idempotencyKey,
    method: `LOCAL_SANDBOX_SIMULATE_${envelope.actionKind.toUpperCase().replace(/-/g, '_')}`,
  };

  return {
    id: buildReceiptId(input.packet.id, input.operatorGate.sandboxRunId, input.now),
    createdAt: input.now.toISOString(),
    sandboxRunId: input.operatorGate.sandboxRunId,
    sourceCertificationResultId: input.sourceCertification.id,
    sourceCertificationPacketId: input.packet.id,
    sourceReviewPacketId: input.packet.sourceReviewPacketId,
    sourceCandidateEnvelopeId: input.packet.sourceCandidateEnvelopeId,
    adapterId: input.packet.adapterId,
    connectorId: input.packet.connectorId,
    connectorKind: input.packet.connectorKind,
    actionKind: envelope.actionKind,
    targetLabel: envelope.target.label,
    ...(envelope.amount != null ? { amount: envelope.amount } : {}),
    ...(envelope.currency ? { currency: envelope.currency } : {}),
    endpointHost: input.packet.endpointHost,
    method: `LOCAL_SANDBOX_SIMULATE_${envelope.actionKind.toUpperCase().replace(/-/g, '_')}`,
    credentialRef: input.packet.credentialRef,
    idempotencyHeader: input.packet.idempotencyHeader,
    idempotencyKey: input.packet.idempotencyKey,
    killSwitchId: input.packet.killSwitchId,
    rollbackDrillId: input.packet.rollbackDrillId,
    resultStatus: 'accepted',
    localSandboxLedgerRecorded: true,
    localSandboxDryRunPerformed: true,
    sandboxExecutionAuthorized: true,
    sandboxExternalIoPerformed: false,
    liveExecutionAuthorized: false,
    executableNow: false,
    liveActionApplied: false,
    externalSideEffects: false,
    rollbackAvailable: true,
    redacted: true,
    rawSecretPresent: false,
    receiptDigest: digestPayload(receiptCore),
    conditions: [
      'This receipt records a local deterministic sandbox dry-run only.',
      'No certified endpoint host was called.',
      'No live transaction, payment, purchase, trade or withdrawal was executed.',
      'Future live execution still requires a separate live executor phase.',
    ],
  };
}

function gate(
  kind: ZavorthTransactionSandboxControlledExecutorGate['kind'],
  passed: boolean,
  summary: string,
  evidence: string[],
): ZavorthTransactionSandboxControlledExecutorGate {
  return {
    kind,
    passed,
    summary,
    evidence,
  };
}

function resolveStatus(
  gates: ZavorthTransactionSandboxControlledExecutorGate[],
): ZavorthTransactionSandboxControlledExecutorStatus {
  if (!isGatePassed(gates, 'intent-model2-certification-ready') || !isGatePassed(gates, 'certification-packet-present')) {
    return 'certification-required';
  }
  if (!isGatePassed(gates, 'sandbox-operator-confirmation')) {
    return 'sandbox-operator-approval-required';
  }
  const executionGates = [
    'local-sandbox-only',
    'endpoint-not-called',
    'amount-within-certified-limits',
    'credential-ref-bound',
    'idempotency-ready',
    'kill-switch-ready',
    'rollback-ready',
    'sandbox-not-aborted',
    'sandbox-dry-run-succeeds',
    'execution-receipt-ready',
    'live-still-disabled',
    'raw-secret-redaction',
  ];
  if (!executionGates.every((kind) => isGatePassed(gates, kind))) {
    return 'sandbox-execution-blocked';
  }
  return 'sandbox-executed';
}

function isGatePassed(gates: ZavorthTransactionSandboxControlledExecutorGate[], kind: string): boolean {
  return gates.some((gate) => gate.kind === kind && gate.passed);
}

function summaryForStatus(status: ZavorthTransactionSandboxControlledExecutorStatus): string {
  if (status === 'sandbox-executed') {
    return 'Controlled local sandbox execution receipt was emitted; no external or live execution occurred.';
  }
  if (status === 'certification-required') {
    return 'Intent model2 sandbox certification is required before controlled sandbox execution.';
  }
  if (status === 'sandbox-operator-approval-required') {
    return 'Intent model2 is ready, but the dedicated sandbox execution owner phrase is still required.';
  }
  return 'Controlled sandbox execution gates blocked receipt emission.';
}

function nextStepsForStatus(
  status: ZavorthTransactionSandboxControlledExecutorStatus,
  blockers: string[],
): string[] {
  if (status === 'sandbox-executed') {
    return [
      'Review the local sandbox execution receipt and rollback availability.',
      'Do not treat Intent model3 as live authorization; live execution remains a separate future phase.',
    ];
  }
  if (status === 'certification-required') {
    return ['Produce a Intent model2 sandbox-certification-ready packet first.'];
  }
  if (status === 'sandbox-operator-approval-required') {
    return [`Re-run with sandbox execution phrase: ${ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE}`];
  }
  return blockers.map((blocker) => `Resolve gate: ${blocker}`);
}

function buildResultId(text: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:intent-model3:${text}`).digest('hex').slice(0, 16);
  return `ztx-sandbox-controlled-executor-${hash}`;
}

function buildReceiptId(packetId: string, sandboxRunId: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:${packetId}:${sandboxRunId}`).digest('hex').slice(0, 16);
  return `ztx-sandbox-execution-receipt-${hash}`;
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
