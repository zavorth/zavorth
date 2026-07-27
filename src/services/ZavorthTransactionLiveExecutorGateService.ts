import { createHash } from 'node:crypto';

import {
  buildZavorthTransactionLiveExecutorGateContractSnapshot,
  ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
  type ZavorthTransactionLiveExecutorAdapterManifest,
  type ZavorthTransactionLiveExecutorAdapterManifestInput,
  type ZavorthTransactionLiveExecutorGate,
  type ZavorthTransactionLiveExecutorGateContractSnapshot,
  type ZavorthTransactionLiveExecutorGateInput,
  type ZavorthTransactionLiveExecutorGateResult,
  type ZavorthTransactionLiveExecutorGateSafety,
  type ZavorthTransactionLiveExecutorGateStatus,
  type ZavorthTransactionLiveExecutorOperatorGate,
  type ZavorthTransactionLiveExecutorReadinessPacket,
} from '../contracts/ZavorthTransactionLiveExecutorGateContract.js';
import type {
  ZavorthTransactionLiveMicroRolloutCertificationPacket,
  ZavorthTransactionLiveMicroRolloutCertificationResult,
} from '../contracts/ZavorthTransactionLiveMicroRolloutCertificationContract.js';
import type {
  ZavorthTransactionSandboxExecutionReceipt,
} from '../contracts/ZavorthTransactionSandboxControlledExecutorContract.js';
import type { ZavorthTransactionActionKind } from '../contracts/ZavorthTransactionPlaneContract.js';
import type { ZavorthTransactionConnectorKind } from '../contracts/ZavorthTransactionPreviewContract.js';
import { ZavorthTransactionLiveMicroRolloutCertificationService } from './ZavorthTransactionLiveMicroRolloutCertificationService.js';
import { logger } from '../logger.js';

type LiveExecutorGateDeps = {
  now?: () => Date;
  microRolloutCertification?: Pick<ZavorthTransactionLiveMicroRolloutCertificationService, 'certify' | 'buildSnapshot'>;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const SAFETY: ZavorthTransactionLiveExecutorGateSafety = {
  liveExecutorGateReady: false,
  noBundledFinancialAdapter: true,
  noLiveExecution: true,
  noHiddenLiveAction: true,
  noRawSecretSerialized: true,
  externalSideEffects: false,
  liveExecutionAuthorized: false,
  executableNow: false,
  liveActionApplied: false,
  externalAdapterBindingRequired: true,
  ownerPhraseRequired: true,
  killSwitchRequired: true,
  rollbackRequired: true,
};

export class ZavorthTransactionLiveExecutorGateService {
  private readonly now: () => Date;
  private readonly microRolloutCertification: Pick<ZavorthTransactionLiveMicroRolloutCertificationService, 'certify' | 'buildSnapshot'>;

  public constructor(deps: LiveExecutorGateDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.microRolloutCertification = deps.microRolloutCertification ?? new ZavorthTransactionLiveMicroRolloutCertificationService({
      now: this.now,
      ledgerFile: deps.ledgerFile,
      credentialStoreFile: deps.credentialStoreFile,
    });
  }

  public buildSnapshot(): ZavorthTransactionLiveExecutorGateContractSnapshot {
    return buildZavorthTransactionLiveExecutorGateContractSnapshot();
  }

  public prepare(input: ZavorthTransactionLiveExecutorGateInput): ZavorthTransactionLiveExecutorGateResult {
    const createdAt = this.now();
    const sourceMicroRolloutCertification = this.microRolloutCertification.certify(input);
    const operatorGate = buildOperatorGate(input, createdAt);
    const liveAdapterManifest = normalizeLiveAdapterManifest(input, sourceMicroRolloutCertification);
    const gates = buildGates({
      input,
      sourceMicroRolloutCertification,
      operatorGate,
      liveAdapterManifest,
    });
    const status = resolveStatus(gates);
    const blockers = gates
      .filter((gate) => !gate.passed)
      .map((gate) => gate.kind);
    const readinessPacket = status === 'live-ready-held'
      && sourceMicroRolloutCertification.certificationPacket
      && sourceMicroRolloutCertification.sourceSandboxExecution.executionReceipt
      && liveAdapterManifest
      ? buildReadinessPacket({
        sourceMicroRolloutCertification,
        certificationPacket: sourceMicroRolloutCertification.certificationPacket,
        sandboxReceipt: sourceMicroRolloutCertification.sourceSandboxExecution.executionReceipt,
        operatorGate,
        liveAdapterManifest,
        now: createdAt,
      })
      : undefined;
    const safety: ZavorthTransactionLiveExecutorGateSafety = {
      ...SAFETY,
      liveExecutorGateReady: status === 'live-ready-held',
    };

    return {
      version: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_CONTRACT_VERSION,
      id: buildResultId(input.text, createdAt),
      createdAt: createdAt.toISOString(),
      status,
      summary: summaryForStatus(status),
      operatorGate,
      sourceMicroRolloutCertification,
      liveAdapterManifest,
      gates,
      ...(readinessPacket ? { readinessPacket } : {}),
      blockers,
      nextSteps: nextStepsForStatus(status, blockers),
      safety,
    };
  }

  public renderReport(result: ZavorthTransactionLiveExecutorGateResult): string {
    return [
      '[transaction-live-executor-gate] Intent model6 live executor readiness gate',
      `[transaction-live-executor-gate] status: ${result.status}`,
      `[transaction-live-executor-gate] source-micro-rollout: ${result.sourceMicroRolloutCertification.status}`,
      `[transaction-live-executor-gate] owner: ${result.operatorGate.ownerId}`,
      `[transaction-live-executor-gate] live-operator-confirmed: ${result.operatorGate.confirmed}`,
      `[transaction-live-executor-gate] live-operator-phrase-accepted: ${result.operatorGate.phraseAccepted}`,
      `[transaction-live-executor-gate] adapter: ${result.liveAdapterManifest?.id ?? 'none'}`,
      `[transaction-live-executor-gate] packet: ${result.readinessPacket?.id ?? 'none'}`,
      `[transaction-live-executor-gate] live-executor-ready: ${result.safety.liveExecutorGateReady}`,
      `[transaction-live-executor-gate] no-bundled-financial-adapter: ${result.safety.noBundledFinancialAdapter}`,
      `[transaction-live-executor-gate] live-execution-authorized: ${result.safety.liveExecutionAuthorized}`,
      `[transaction-live-executor-gate] executable-now: ${result.safety.executableNow}`,
      `[transaction-live-executor-gate] live-action-applied: ${result.safety.liveActionApplied}`,
      ...result.gates.map((gate) => `[transaction-live-executor-gate] gate: ${gate.kind} passed=${gate.passed} summary=${gate.summary}`),
      ...result.nextSteps.map((step) => `[transaction-live-executor-gate] next: ${step}`),
    ].join('\n');
  }
}

function buildOperatorGate(input: ZavorthTransactionLiveExecutorGateInput, now: Date): ZavorthTransactionLiveExecutorOperatorGate {
  const ownerId = sanitizeId(input.ownerId ?? 'owner');
  const liveRunId = sanitizeId(input.liveRunId ?? `ztx-live-run-${ownerId}`);
  const intent = input.liveOperatorIntent ?? '';
  const confirmed = input.liveOperatorConfirmed === true;
  const phraseAccepted = intent.trim() === ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE;
  return {
    ownerId,
    liveRunId,
    confirmed,
    requiredPhrase: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
    phraseAccepted,
    ...(confirmed && phraseAccepted ? { confirmationRecordedAt: now.toISOString() } : {}),
    operatorDigest: digestPayload({
      ownerId,
      liveRunId,
      intent,
      confirmed,
      phraseAccepted,
    }),
  };
}

function normalizeLiveAdapterManifest(
  input: ZavorthTransactionLiveExecutorGateInput,
  source: ZavorthTransactionLiveMicroRolloutCertificationResult,
): ZavorthTransactionLiveExecutorAdapterManifest | null {
  const packet = source.certificationPacket;
  const receipt = source.sourceSandboxExecution.executionReceipt;
  if (!packet || !receipt) {
    return normalizeManifestFromInput(input.liveAdapterManifest ?? null);
  }

  if (input.useSafeLiveAdapterControls) {
    const safeManifest: ZavorthTransactionLiveExecutorAdapterManifestInput = {
      id: `live-adapter-${packet.connectorId}`,
      connectorId: packet.connectorId,
      connectorKind: receipt.connectorKind,
      actionKind: receipt.actionKind,
      displayName: `Live adapter binding for ${packet.targetLabel}`,
      environment: 'live',
      endpointBaseUrl: 'https://api.live-zavorth.invalid/transactions',
      allowedHosts: ['api.live-zavorth.invalid'],
      credentialRef: receipt.credentialRef,
      idempotencyHeader: receipt.idempotencyHeader,
      maximumLiveAmount: packet.limits.maxMicroAmount,
      maxRequestsPerMinute: 1,
      timeoutMs: 5000,
      circuitBreaker: true,
      supportsIdempotency: true,
      supportsBalanceCheck: true,
      supportsPriceRecheck: true,
      supportsReceiptFetch: true,
      killSwitchId: receipt.killSwitchId,
      rollbackDrillId: receipt.rollbackDrillId,
      rollbackCommand: 'npm run zavorth:transaction-live-executor-gate -- --rollback-held-live-run',
      healthCheckCommand: 'npm run zavorth:transaction-live-executor-gate:json -- --health-check-only',
      liveSmokeCommand: 'npm run zavorth:transaction-live-executor-gate:json -- --live-readiness-only',
      rawSecretsAccepted: false,
    };
    return normalizeManifestFromInput({
      ...safeManifest,
      ...(input.liveAdapterManifest ?? {}),
    });
  }

  return normalizeManifestFromInput(input.liveAdapterManifest ?? null);
}

function normalizeManifestFromInput(
  input: ZavorthTransactionLiveExecutorAdapterManifestInput | null,
): ZavorthTransactionLiveExecutorAdapterManifest | null {
  if (!input || Object.keys(input).length === 0) {
    return null;
  }
  return {
    id: clean(input.id) ?? 'live-adapter',
    connectorId: clean(input.connectorId) ?? '',
    connectorKind: normalizeConnectorKind(input.connectorKind),
    actionKind: normalizeActionKind(input.actionKind),
    displayName: clean(input.displayName) ?? 'Live executor adapter',
    environment: 'live',
    endpointBaseUrl: clean(input.endpointBaseUrl) ?? '',
    allowedHosts: normalizeList(input.allowedHosts),
    credentialRef: clean(input.credentialRef) ?? '',
    idempotencyHeader: clean(input.idempotencyHeader) ?? '',
    maximumLiveAmount: safeNumber(input.maximumLiveAmount),
    maxRequestsPerMinute: safeInteger(input.maxRequestsPerMinute),
    timeoutMs: safeInteger(input.timeoutMs),
    circuitBreaker: input.circuitBreaker === true,
    supportsIdempotency: input.supportsIdempotency === true,
    supportsBalanceCheck: input.supportsBalanceCheck === true,
    supportsPriceRecheck: input.supportsPriceRecheck === true,
    supportsReceiptFetch: input.supportsReceiptFetch === true,
    killSwitchId: clean(input.killSwitchId) ?? '',
    rollbackDrillId: clean(input.rollbackDrillId) ?? '',
    rollbackCommand: clean(input.rollbackCommand) ?? '',
    healthCheckCommand: clean(input.healthCheckCommand) ?? '',
    liveSmokeCommand: clean(input.liveSmokeCommand) ?? '',
    rawSecretsAccepted: false,
    redacted: true,
  };
}

function buildGates(input: {
  input: ZavorthTransactionLiveExecutorGateInput;
  sourceMicroRolloutCertification: ZavorthTransactionLiveMicroRolloutCertificationResult;
  operatorGate: ZavorthTransactionLiveExecutorOperatorGate;
  liveAdapterManifest: ZavorthTransactionLiveExecutorAdapterManifest | null;
}): ZavorthTransactionLiveExecutorGate[] {
  const source = input.sourceMicroRolloutCertification;
  const packet = source.certificationPacket;
  const receipt = source.sourceSandboxExecution.executionReceipt;
  const manifest = input.liveAdapterManifest;
  const endpointHost = endpointHostFromManifest(manifest);
  const serialized = JSON.stringify({
    source,
    manifest,
    operatorGate: input.operatorGate,
  });
  const rawSecret = rawSecretValue(input.input.text);
  const rawSecretSerialized = rawSecret.length > 0 && serialized.includes(rawSecret);
  const maxMicroAmount = packet?.limits.maxMicroAmount ?? null;
  const maximumLiveAmount = manifest?.maximumLiveAmount ?? null;

  return [
    gate(
      'intent-model4-15-micro-rollout-certified',
      source.status === 'micro-rollout-certified',
      'Intent model6 requires a certified Intent model4-15 micro-rollout packet.',
      [`status=${source.status}`],
    ),
    gate(
      'micro-rollout-packet-present',
      Boolean(packet?.certifiedForFutureLiveMicroRollout),
      'The source micro-rollout certification packet must be present.',
      [`packet=${packet?.id ?? 'none'}`],
    ),
    gate(
      'live-operator-confirmation',
      input.operatorGate.confirmed && input.operatorGate.phraseAccepted,
      'Operator must confirm the dedicated live executor readiness phrase.',
      [`owner=${input.operatorGate.ownerId}`, `phraseAccepted=${input.operatorGate.phraseAccepted}`],
    ),
    gate(
      'live-adapter-manifest-present',
      Boolean(manifest),
      'A live adapter manifest is required before the live executor can be marked ready.',
      [`adapter=${manifest?.id ?? 'none'}`],
    ),
    gate(
      'live-environment-declared',
      manifest?.environment === 'live',
      'The adapter manifest must explicitly declare environment=live.',
      [`environment=${manifest?.environment ?? 'none'}`],
    ),
    gate(
      'adapter-connector-matches-certification',
      Boolean(manifest?.connectorId && packet?.connectorId && manifest.connectorId === packet.connectorId),
      'Live adapter connector must match the certified micro-rollout connector.',
      [`adapterConnector=${manifest?.connectorId ?? 'none'}`, `packetConnector=${packet?.connectorId ?? 'none'}`],
    ),
    gate(
      'credential-ref-bound',
      Boolean(manifest?.credentialRef && receipt?.credentialRef && manifest.credentialRef === receipt.credentialRef && manifest.rawSecretsAccepted === false),
      'Live adapter must use the already chained SecretRef metadata and reject raw secrets.',
      [`adapterCredentialRef=${manifest?.credentialRef ?? 'none'}`, `receiptCredentialRef=${receipt?.credentialRef ?? 'none'}`],
    ),
    gate(
      'endpoint-allowlist-ready',
      Boolean(endpointHost && manifest?.endpointBaseUrl.startsWith('https://') && manifest.allowedHosts.includes(endpointHost)),
      'Live adapter endpoint must be HTTPS and host-allowlisted.',
      [`host=${endpointHost ?? 'none'}`, `allowed=${manifest?.allowedHosts.join(',') ?? 'none'}`],
    ),
    gate(
      'idempotency-ready',
      Boolean(manifest?.idempotencyHeader && manifest.supportsIdempotency && receipt?.idempotencyKey),
      'Live adapter must support idempotency and carry the receipt chain idempotency key.',
      [`idempotencyHeader=${manifest?.idempotencyHeader ?? 'none'}`, `supportsIdempotency=${manifest?.supportsIdempotency ?? false}`],
    ),
    gate(
      'amount-within-micro-limit',
      maximumLiveAmount != null
        && maximumLiveAmount > 0
        && maxMicroAmount != null
        && maximumLiveAmount <= maxMicroAmount,
      'Maximum live amount must stay inside the certified micro amount limit.',
      [`maximumLiveAmount=${maximumLiveAmount ?? 'missing'}`, `maxMicroAmount=${maxMicroAmount ?? 'missing'}`],
    ),
    gate(
      'daily-limit-preserved',
      Boolean(packet?.limits.maxDailyAmount && maxMicroAmount && packet.limits.maxDailyAmount >= maxMicroAmount),
      'Daily rollout limit from the certification packet must still contain the micro amount.',
      [`dailyLimit=${packet?.limits.maxDailyAmount ?? 'missing'}`, `maxMicroAmount=${maxMicroAmount ?? 'missing'}`],
    ),
    gate(
      'kill-switch-linked',
      Boolean(manifest?.killSwitchId && receipt?.killSwitchId && manifest.killSwitchId === receipt.killSwitchId),
      'Live adapter must preserve the certified kill switch id.',
      [`adapterKillSwitch=${manifest?.killSwitchId ?? 'none'}`, `receiptKillSwitch=${receipt?.killSwitchId ?? 'none'}`],
    ),
    gate(
      'rollback-linked',
      Boolean(manifest?.rollbackDrillId && receipt?.rollbackDrillId && manifest.rollbackDrillId === receipt.rollbackDrillId && manifest.rollbackCommand),
      'Live adapter must preserve rollback drill id and command.',
      [`adapterRollback=${manifest?.rollbackDrillId ?? 'none'}`, `receiptRollback=${receipt?.rollbackDrillId ?? 'none'}`],
    ),
    gate(
      'price-recheck-required',
      manifest?.supportsPriceRecheck === true,
      'Live adapter must re-check price before any future external action.',
      [`supportsPriceRecheck=${manifest?.supportsPriceRecheck ?? false}`],
    ),
    gate(
      'balance-check-required',
      manifest?.supportsBalanceCheck === true,
      'Live adapter must check balance or spend availability before any future external action.',
      [`supportsBalanceCheck=${manifest?.supportsBalanceCheck ?? false}`],
    ),
    gate(
      'receipt-fetch-required',
      manifest?.supportsReceiptFetch === true,
      'Live adapter must fetch a provider receipt after any future external action.',
      [`supportsReceiptFetch=${manifest?.supportsReceiptFetch ?? false}`],
    ),
    gate(
      'circuit-breaker-ready',
      Boolean(manifest?.circuitBreaker && manifest.maxRequestsPerMinute === 1 && manifest.timeoutMs != null && manifest.timeoutMs > 0 && manifest.timeoutMs <= 10000),
      'Live adapter must include circuit breaker, rate limit and bounded timeout.',
      [
        `circuitBreaker=${manifest?.circuitBreaker ?? false}`,
        `maxRequestsPerMinute=${manifest?.maxRequestsPerMinute ?? 'missing'}`,
        `timeoutMs=${manifest?.timeoutMs ?? 'missing'}`,
      ],
    ),
    gate(
      'live-execution-held',
      input.input.executeLive !== true
        && SAFETY.liveExecutionAuthorized === false
        && SAFETY.executableNow === false
        && SAFETY.liveActionApplied === false,
      'This gate prepares live adapter binding but deliberately holds execution.',
      [`executeLive=${input.input.executeLive === true}`, 'liveExecutionAuthorized=false'],
    ),
    gate(
      'raw-secret-redaction',
      !rawSecretSerialized && source.safety.noRawSecretSerialized === true,
      'Live executor readiness output must not serialize raw transaction secrets.',
      [`rawSecretSerialized=${rawSecretSerialized}`],
    ),
  ];
}

function buildReadinessPacket(input: {
  sourceMicroRolloutCertification: ZavorthTransactionLiveMicroRolloutCertificationResult;
  certificationPacket: ZavorthTransactionLiveMicroRolloutCertificationPacket;
  sandboxReceipt: ZavorthTransactionSandboxExecutionReceipt;
  operatorGate: ZavorthTransactionLiveExecutorOperatorGate;
  liveAdapterManifest: ZavorthTransactionLiveExecutorAdapterManifest;
  now: Date;
}): ZavorthTransactionLiveExecutorReadinessPacket {
  const endpointHost = endpointHostFromManifest(input.liveAdapterManifest) ?? '';
  const packetCore = {
    sourceMicroRolloutResultId: input.sourceMicroRolloutCertification.id,
    sourceMicroRolloutPacketId: input.certificationPacket.id,
    liveRunId: input.operatorGate.liveRunId,
    adapterId: input.liveAdapterManifest.id,
    connectorId: input.liveAdapterManifest.connectorId,
    maximumLiveAmount: input.liveAdapterManifest.maximumLiveAmount,
  };
  return {
    id: buildPacketId(input.certificationPacket.id, input.operatorGate.liveRunId, input.now),
    createdAt: input.now.toISOString(),
    sourceMicroRolloutResultId: input.sourceMicroRolloutCertification.id,
    sourceMicroRolloutPacketId: input.certificationPacket.id,
    sourceSandboxExecutionReceiptId: input.certificationPacket.sourceSandboxExecutionReceiptId,
    sourceCertificationPacketId: input.certificationPacket.sourceCertificationPacketId,
    sourceReviewPacketId: input.certificationPacket.sourceReviewPacketId,
    sourceCandidateEnvelopeId: input.certificationPacket.sourceCandidateEnvelopeId,
    liveRunId: input.operatorGate.liveRunId,
    operatorOwnerId: input.operatorGate.ownerId,
    adapterManifestDigest: digestPayload(input.liveAdapterManifest),
    connectorId: input.liveAdapterManifest.connectorId,
    connectorKind: input.liveAdapterManifest.connectorKind,
    actionKind: input.liveAdapterManifest.actionKind,
    adapterId: input.liveAdapterManifest.id,
    endpointHost,
    targetLabel: input.certificationPacket.targetLabel,
    maximumLiveAmount: input.liveAdapterManifest.maximumLiveAmount,
    ...(input.certificationPacket.currency ? { currency: input.certificationPacket.currency } : {}),
    idempotencyHeader: input.liveAdapterManifest.idempotencyHeader,
    idempotencyKey: input.sandboxReceipt.idempotencyKey,
    credentialRef: input.liveAdapterManifest.credentialRef,
    killSwitchId: input.liveAdapterManifest.killSwitchId,
    rollbackDrillId: input.liveAdapterManifest.rollbackDrillId,
    liveExecutorReady: true,
    readyForExternalAdapterBinding: true,
    executionHeld: true,
    liveExecutionAuthorized: false,
    executableNow: false,
    liveActionApplied: false,
    externalSideEffects: false,
    rawSecretPresent: false,
    receiptDigest: digestPayload(packetCore),
    conditions: [
      'This packet makes the Zavorth live executor gate ready for a separately implemented external adapter.',
      'No bundled financial adapter is included in Intent model6.',
      'No live external request was made by Intent model6.',
      'A future external adapter must re-check price, balance, idempotency, kill switch, rollback and provider receipt before any real action.',
      'executeLive=true is policy-blocked by this readiness gate.',
    ],
  };
}

function resolveStatus(gates: ZavorthTransactionLiveExecutorGate[]): ZavorthTransactionLiveExecutorGateStatus {
  if (!isGatePassed(gates, 'intent-model4-15-micro-rollout-certified') || !isGatePassed(gates, 'micro-rollout-packet-present')) {
    return 'micro-rollout-certification-required';
  }
  if (!isGatePassed(gates, 'live-operator-confirmation')) {
    return 'live-operator-confirmation-required';
  }
  if (!isGatePassed(gates, 'live-adapter-manifest-present')) {
    return 'live-adapter-required';
  }
  if (!gates.every((gateItem) => gateItem.passed)) {
    return 'live-policy-blocked';
  }
  return 'live-ready-held';
}

function isGatePassed(gates: ZavorthTransactionLiveExecutorGate[], kind: string): boolean {
  return gates.some((gateItem) => gateItem.kind === kind && gateItem.passed);
}

function summaryForStatus(status: ZavorthTransactionLiveExecutorGateStatus): string {
  if (status === 'live-ready-held') {
    return 'Live executor readiness is prepared and held for a separately bound external adapter.';
  }
  if (status === 'micro-rollout-certification-required') {
    return 'Intent model4-15 micro-rollout certification is required before live executor readiness.';
  }
  if (status === 'live-operator-confirmation-required') {
    return 'Dedicated live executor owner confirmation is required.';
  }
  if (status === 'live-adapter-required') {
    return 'A live adapter manifest is required before readiness can be completed.';
  }
  return 'Live executor policy gates blocked readiness.';
}

function nextStepsForStatus(status: ZavorthTransactionLiveExecutorGateStatus, blockers: string[]): string[] {
  if (status === 'live-ready-held') {
    return [
      'Bind a real external adapter only after separate provider-specific certification.',
      'Keep executeLive disabled until the external adapter performs its own price, balance, idempotency, receipt and rollback checks.',
    ];
  }
  if (status === 'micro-rollout-certification-required') {
    return ['Produce a Intent model4-15 micro-rollout-certified packet first.'];
  }
  if (status === 'live-operator-confirmation-required') {
    return [`Re-run with live executor phrase: ${ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE}`];
  }
  if (status === 'live-adapter-required') {
    return ['Provide a live adapter manifest or use safe live adapter controls for readiness certification.'];
  }
  return blockers.map((blocker) => `Resolve gate: ${blocker}`);
}

function gate(
  kind: ZavorthTransactionLiveExecutorGate['kind'],
  passed: boolean,
  summary: string,
  evidence: string[],
): ZavorthTransactionLiveExecutorGate {
  return {
    kind,
    passed,
    summary,
    evidence,
  };
}

function endpointHostFromManifest(manifest: ZavorthTransactionLiveExecutorAdapterManifest | null): string | null {
  const url = clean(manifest?.endpointBaseUrl);
  if (!url) {
    return null;
  }
  try {
    return new URL(url).host;
  } catch (error: unknown) {logger.warn('[Zavorth Transaction Live Executor] process execution failed', error); return null; }
}

function buildResultId(text: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:intent-model6:${text}`).digest('hex').slice(0, 16);
  return `ztx-live-executor-gate-${hash}`;
}

function buildPacketId(sourcePacketId: string, liveRunId: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:${sourcePacketId}:${liveRunId}`).digest('hex').slice(0, 16);
  return `ztx-live-executor-ready-${hash}`;
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

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeConnectorKind(value: unknown): ZavorthTransactionConnectorKind {
  const normalized = String(value ?? '').trim();
  const allowed: ZavorthTransactionConnectorKind[] = [
    'market-data',
    'commerce',
    'payment',
    'exchange',
    'currency-exchange',
    'subscription',
    'wallet',
    'unknown',
  ];
  return allowed.includes(normalized as ZavorthTransactionConnectorKind)
    ? normalized as ZavorthTransactionConnectorKind
    : 'unknown';
}

function normalizeActionKind(value: unknown): ZavorthTransactionActionKind {
  const normalized = String(value ?? '').trim();
  const allowed: ZavorthTransactionActionKind[] = [
    'market-data-read',
    'price-monitor',
    'cart-preview',
    'purchase-submit',
    'payment-submit',
    'trade-order',
    'trade-cancel',
    'asset-transfer',
    'asset-withdrawal',
    'currency-conversion',
    'subscription-create',
    'subscription-cancel',
    'api-credit-purchase',
    'refund-request',
    'mandate-create',
    'mandate-revoke',
  ];
  return allowed.includes(normalized as ZavorthTransactionActionKind)
    ? normalized as ZavorthTransactionActionKind
    : 'trade-order';
}

function sanitizeId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .slice(0, 100) || 'owner';
}

function rawSecretValue(text: string): string {
  const assignment = /\b(?:api[_-]...key|token|secret|private[_-]...key|senha|password)\b\s*[:=]\s*([^\s,;]+)/i.exec(text)?.[1];
  if (assignment) {
    return assignment;
  }
  return /\b(sk-[A-Za-z0-9_-]{12,}|pk_live_[A-Za-z0-9_-]{12,}|rk_live_[A-Za-z0-9_-]{12,})\b/.exec(text)?.[1] ?? '';
}
