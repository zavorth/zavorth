import { createHash } from 'node:crypto';

import {
  buildZavorthTransactionSandboxAdapterCertificationContractSnapshot,
  ZAVORTH_TRANSACTION_SANDBOX_ADAPTER_CERTIFICATION_CONTRACT_VERSION,
  type ZavorthTransactionSandboxAdapterCertificationContractSnapshot,
  type ZavorthTransactionSandboxAdapterCertificationGate,
  type ZavorthTransactionSandboxAdapterCertificationInput,
  type ZavorthTransactionSandboxAdapterCertificationPacket,
  type ZavorthTransactionSandboxAdapterCertificationResult,
  type ZavorthTransactionSandboxAdapterCertificationSafety,
  type ZavorthTransactionSandboxAdapterCertificationStatus,
  type ZavorthTransactionSandboxAdapterEnvironment,
  type ZavorthTransactionSandboxAdapterManifest,
} from '../contracts/ZavorthTransactionSandboxAdapterCertificationContract.js';
import type {
  ZavorthTransactionConnectorKind,
} from '../contracts/ZavorthTransactionPreviewContract.js';
import type {
  ZavorthTransactionLiveActivationReviewResult,
} from '../contracts/ZavorthTransactionLiveActivationReviewContract.js';
import { ZavorthTransactionLiveActivationReviewService } from './ZavorthTransactionLiveActivationReviewService.js';
import { logger } from '../logger.js';

type SandboxCertificationDeps = {
  now?: () => Date;
  activationReview?: Pick<ZavorthTransactionLiveActivationReviewService, 'review' | 'buildSnapshot'>;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const MAX_SANDBOX_REQUESTS_PER_MINUTE = 60;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;

const SAFETY: ZavorthTransactionSandboxAdapterCertificationSafety = {
  certificationOnly: true,
  noSandboxNetworkCall: true,
  noLiveExecution: true,
  noHiddenLiveAction: true,
  noRawSecretSerialized: true,
  externalSideEffects: false,
  sandboxExecutionAuthorized: false,
  sandboxExternalIoPerformed: false,
  liveExecutionAuthorized: false,
  executableNow: false,
  liveActionApplied: false,
  separateSandboxExecutorRequired: true,
  separateLiveExecutorRequired: true,
};

export class ZavorthTransactionSandboxAdapterCertificationService {
  private readonly now: () => Date;
  private readonly activationReview: Pick<ZavorthTransactionLiveActivationReviewService, 'review' | 'buildSnapshot'>;

  public constructor(deps: SandboxCertificationDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.activationReview = deps.activationReview ?? new ZavorthTransactionLiveActivationReviewService({
      now: this.now,
      ledgerFile: deps.ledgerFile,
      credentialStoreFile: deps.credentialStoreFile,
    });
  }

  public buildSnapshot(): ZavorthTransactionSandboxAdapterCertificationContractSnapshot {
    return buildZavorthTransactionSandboxAdapterCertificationContractSnapshot();
  }

  public certify(input: ZavorthTransactionSandboxAdapterCertificationInput): ZavorthTransactionSandboxAdapterCertificationResult {
    const createdAt = this.now();
    const sourceActivationReview = this.activationReview.review(input);
    const adapterManifest = normalizeAdapterManifest(input, sourceActivationReview);
    const gates = buildGates({
      input,
      sourceActivationReview,
      adapterManifest,
    });
    const status = resolveStatus(gates);
    const blockers = gates
      .filter((gate) => !gate.passed)
      .map((gate) => gate.kind);
    const certificationPacket = status === 'sandbox-certification-ready' && adapterManifest && sourceActivationReview.reviewPacket
      ? buildCertificationPacket({
        sourceActivationReview,
        adapterManifest,
        now: createdAt,
      })
      : undefined;

    return {
      version: ZAVORTH_TRANSACTION_SANDBOX_ADAPTER_CERTIFICATION_CONTRACT_VERSION,
      id: buildResultId(input.text, createdAt),
      createdAt: createdAt.toISOString(),
      status,
      summary: summaryForStatus(status),
      sourceActivationReview,
      adapterManifest,
      gates,
      ...(certificationPacket ? { certificationPacket } : {}),
      blockers,
      nextSteps: nextStepsForStatus(status, blockers),
      safety: SAFETY,
    };
  }

  public renderReport(result: ZavorthTransactionSandboxAdapterCertificationResult): string {
    return [
      '[transaction-sandbox-adapter-certification] Intent model2 sandbox adapter certification',
      `[transaction-sandbox-adapter-certification] status: ${result.status}`,
      `[transaction-sandbox-adapter-certification] activation-review: ${result.sourceActivationReview.status}`,
      `[transaction-sandbox-adapter-certification] adapter: ${result.adapterManifest?.id ?? 'none'}`,
      `[transaction-sandbox-adapter-certification] environment: ${result.adapterManifest?.environment ?? 'none'}`,
      `[transaction-sandbox-adapter-certification] endpoint: ${safeHost(result.adapterManifest?.endpointBaseUrl) ?? 'none'}`,
      `[transaction-sandbox-adapter-certification] packet: ${result.certificationPacket?.id ?? 'none'}`,
      `[transaction-sandbox-adapter-certification] no-sandbox-network-call: ${result.safety.noSandboxNetworkCall}`,
      `[transaction-sandbox-adapter-certification] sandbox-execution-authorized: ${result.safety.sandboxExecutionAuthorized}`,
      `[transaction-sandbox-adapter-certification] live-execution-authorized: ${result.safety.liveExecutionAuthorized}`,
      `[transaction-sandbox-adapter-certification] executable-now: ${result.safety.executableNow}`,
      `[transaction-sandbox-adapter-certification] live-action-applied: ${result.safety.liveActionApplied}`,
      ...result.gates.map((gate) => `[transaction-sandbox-adapter-certification] gate: ${gate.kind} passed=${gate.passed} summary=${gate.summary}`),
      ...result.nextSteps.map((step) => `[transaction-sandbox-adapter-certification] next: ${step}`),
    ].join('\n');
  }
}

function normalizeAdapterManifest(
  input: ZavorthTransactionSandboxAdapterCertificationInput,
  sourceActivationReview: ZavorthTransactionLiveActivationReviewResult,
): ZavorthTransactionSandboxAdapterManifest | null {
  const reviewPacket = sourceActivationReview.reviewPacket;
  const envelope = sourceActivationReview.sourceCandidate.envelope;
  if (input.useSafeSandboxAdapter && reviewPacket && envelope) {
    const connectorKind = envelope.connectorKind;
    const host = sandboxHostForConnector(connectorKind);
    return {
      id: `zavorth.sandbox-adapter.${safeId(reviewPacket.connectorId)}`,
      connectorId: reviewPacket.connectorId,
      connectorKind,
      displayName: `Zavorth ${connectorKind} sandbox adapter`,
      environment: connectorKind === 'exchange' ? 'paper' : 'sandbox',
      endpointBaseUrl: `https://${host}`,
      allowedHosts: [host],
      credentialRef: reviewPacket.credentialRef,
      idempotencyHeader: 'Idempotency-Key',
      maxRequestsPerMinute: 10,
      timeoutMs: 5000,
      circuitBreaker: true,
      dryRunCommand: 'npm run zavorth:transaction-live-activation-review:json -- --safe-default-controls',
      sandboxSmokeCommand: 'npm run zavorth:transaction-sandbox-adapter-certification:json -- --safe-sandbox-adapter',
      supportsLive: false,
      rawSecretsAccepted: false,
      redacted: true,
    };
  }

  const manifest = input.adapterManifest;
  if (!manifest) {
    return null;
  }

  const connectorKind = normalizeConnectorKind(manifest.connectorKind ?? envelope?.connectorKind ?? 'exchange');
  return {
    id: clean(manifest.id) ?? `zavorth.sandbox-adapter.${safeId(sourceActivationReview.reviewPacket?.connectorId ?? 'missing')}`,
    connectorId: clean(manifest.connectorId) ?? sourceActivationReview.reviewPacket?.connectorId ?? 'missing',
    connectorKind,
    displayName: clean(manifest.displayName) ?? `Zavorth ${connectorKind} sandbox adapter`,
    environment: normalizeEnvironment(manifest.environment),
    endpointBaseUrl: redactSecrets(clean(manifest.endpointBaseUrl) ?? ''),
    allowedHosts: normalizeList(manifest.allowedHosts).map(redactSecrets),
    credentialRef: redactSecrets(clean(manifest.credentialRef) ?? sourceActivationReview.reviewPacket?.credentialRef ?? ''),
    idempotencyHeader: clean(manifest.idempotencyHeader) ?? '',
    maxRequestsPerMinute: safeInteger(manifest.maxRequestsPerMinute),
    timeoutMs: safeInteger(manifest.timeoutMs),
    circuitBreaker: manifest.circuitBreaker === true,
    dryRunCommand: redactSecrets(clean(manifest.dryRunCommand) ?? ''),
    sandboxSmokeCommand: redactSecrets(clean(manifest.sandboxSmokeCommand) ?? ''),
    supportsLive: manifest.supportsLive === true,
    rawSecretsAccepted: manifest.rawSecretsAccepted === true,
    redacted: true,
  };
}

function buildGates(input: {
  input: ZavorthTransactionSandboxAdapterCertificationInput;
  sourceActivationReview: ZavorthTransactionLiveActivationReviewResult;
  adapterManifest: ZavorthTransactionSandboxAdapterManifest | null;
}): ZavorthTransactionSandboxAdapterCertificationGate[] {
  const review = input.sourceActivationReview;
  const packet = review.reviewPacket;
  const manifest = input.adapterManifest;
  const endpoint = evaluateEndpoint(manifest);
  const credentialBound = Boolean(
    manifest
      && packet
      && manifest.credentialRef === packet.credentialRef
      && isCredentialRef(manifest.credentialRef),
  );
  const idempotencyReady = Boolean(
    manifest?.idempotencyHeader
      && review.sourceCandidate.envelope?.idempotencyKey,
  );
  const rateLimitReady = manifest?.maxRequestsPerMinute != null
    && manifest.maxRequestsPerMinute > 0
    && manifest.maxRequestsPerMinute <= MAX_SANDBOX_REQUESTS_PER_MINUTE;
  const timeoutReady = manifest?.timeoutMs != null
    && manifest.timeoutMs >= MIN_TIMEOUT_MS
    && manifest.timeoutMs <= MAX_TIMEOUT_MS;
  const killSwitchLinked = Boolean(packet?.killSwitchId && packet.killSwitchId === review.killSwitch.id && review.killSwitch.tested);
  const rollbackLinked = Boolean(packet?.rollbackDrillId && packet.rollbackDrillId === review.rollbackDrill.drillId && review.rollbackDrill.successful);
  const serialized = JSON.stringify({
    sourceActivationReview: review,
    adapterManifest: manifest,
  });
  const rawSecret = rawSecretValue(input.input.text);
  const rawSecretSerialized = rawSecret.length > 0 && serialized.includes(rawSecret);

  return [
    gate(
      'intent-model1-review-ready',
      review.status === 'ready-for-live-activation-review',
      'Intent model1 must produce a ready activation review packet first.',
      [`status=${review.status}`],
    ),
    gate(
      'review-packet-present',
      Boolean(packet?.reviewOnly && packet.activationAuthorized === false),
      'A review-only Intent model1 packet must be present.',
      [`packet=${packet?.id ?? 'none'}`],
    ),
    gate(
      'adapter-manifest-present',
      Boolean(manifest?.id && manifest.endpointBaseUrl && manifest.connectorId),
      'A typed sandbox adapter manifest is required.',
      [`adapter=${manifest?.id ?? 'none'}`, `endpoint=${manifest?.endpointBaseUrl ? 'present' : 'missing'}`],
    ),
    gate(
      'sandbox-environment-only',
      manifest?.environment === 'sandbox' || manifest?.environment === 'paper',
      'Only sandbox or paper environments may be certified in Intent model2.',
      [`environment=${manifest?.environment ?? 'none'}`],
    ),
    gate(
      'endpoint-allowlist-ready',
      endpoint.allowlisted,
      'Endpoint host must be HTTPS, sandbox-like and present in the adapter allowlist.',
      endpoint.evidence,
    ),
    gate(
      'credential-ref-bound',
      credentialBound,
      'Adapter credential must be the same metadata-only SecretRef from Intent model1.',
      [`manifestRef=${manifest?.credentialRef ? 'present' : 'missing'}`, `reviewRef=${packet?.credentialRef ? 'present' : 'missing'}`, `bound=${credentialBound}`],
    ),
    gate(
      'idempotency-ready',
      idempotencyReady,
      'Adapter must declare an idempotency header and inherit a candidate idempotency key.',
      [`header=${manifest?.idempotencyHeader || 'missing'}`, `candidateKey=${review.sourceCandidate.envelope?.idempotencyKey ? 'present' : 'missing'}`],
    ),
    gate(
      'rate-limit-ready',
      rateLimitReady,
      `Adapter rate limit must be between 1 and ${MAX_SANDBOX_REQUESTS_PER_MINUTE} requests per minute.`,
      [`maxRequestsPerMinute=${manifest?.maxRequestsPerMinute ?? 'missing'}`],
    ),
    gate(
      'timeout-ready',
      timeoutReady,
      `Adapter timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`,
      [`timeoutMs=${manifest?.timeoutMs ?? 'missing'}`],
    ),
    gate(
      'circuit-breaker-ready',
      manifest?.circuitBreaker === true,
      'Adapter circuit breaker must be enabled.',
      [`circuitBreaker=${manifest?.circuitBreaker ?? false}`],
    ),
    gate(
      'kill-switch-linked',
      killSwitchLinked,
      'Intent model2 must inherit the tested Intent model1 kill switch.',
      [`packetKillSwitch=${packet?.killSwitchId ?? 'none'}`, `reviewKillSwitch=${review.killSwitch.id ?? 'none'}`, `tested=${review.killSwitch.tested}`],
    ),
    gate(
      'rollback-linked',
      rollbackLinked,
      'Intent model2 must inherit the successful Intent model1 rollback drill.',
      [`packetRollback=${packet?.rollbackDrillId ?? 'none'}`, `reviewRollback=${review.rollbackDrill.drillId ?? 'none'}`, `successful=${review.rollbackDrill.successful}`],
    ),
    gate(
      'live-endpoint-blocked',
      !endpoint.liveEndpoint && manifest?.supportsLive === false && manifest?.rawSecretsAccepted === false,
      'Live endpoints, live-capable manifests and raw-secret adapters are blocked.',
      [`liveEndpoint=${endpoint.liveEndpoint}`, `supportsLive=${manifest?.supportsLive ?? 'none'}`, `rawSecretsAccepted=${manifest?.rawSecretsAccepted ?? 'none'}`],
    ),
    gate(
      'separate-sandbox-executor-required',
      SAFETY.separateSandboxExecutorRequired === true && SAFETY.sandboxExecutionAuthorized === false,
      'Intent model2 can certify adapter readiness only; a separate future sandbox executor is required.',
      ['separateSandboxExecutorRequired=true', 'sandboxExecutionAuthorized=false'],
    ),
    gate(
      'no-external-io',
      SAFETY.noSandboxNetworkCall === true && SAFETY.sandboxExternalIoPerformed === false && SAFETY.externalSideEffects === false,
      'Intent model2 must not perform sandbox network calls or external side effects.',
      ['noSandboxNetworkCall=true', 'sandboxExternalIoPerformed=false', 'externalSideEffects=false'],
    ),
    gate(
      'raw-secret-redaction',
      !rawSecretSerialized && review.safety.noRawSecretSerialized === true,
      'Sandbox adapter certification output must not serialize raw transaction secrets.',
      [`rawSecretSerialized=${rawSecretSerialized}`],
    ),
  ];
}

function buildCertificationPacket(input: {
  sourceActivationReview: ZavorthTransactionLiveActivationReviewResult;
  adapterManifest: ZavorthTransactionSandboxAdapterManifest;
  now: Date;
}): ZavorthTransactionSandboxAdapterCertificationPacket {
  const reviewPacket = input.sourceActivationReview.reviewPacket;
  const envelope = input.sourceActivationReview.sourceCandidate.envelope;
  if (!reviewPacket || !envelope) {
    throw new Error('Cannot build Intent model2 packet without Intent model1 review packet and Intent model0 envelope.');
  }
  const endpointHost = safeHost(input.adapterManifest.endpointBaseUrl) ?? 'unknown';
  const packetCore = {
    sourceActivationReviewResultId: input.sourceActivationReview.id,
    sourceReviewPacketId: reviewPacket.id,
    sourceCandidateEnvelopeId: envelope.id,
    adapterId: input.adapterManifest.id,
    adapterManifest: input.adapterManifest,
  };
  return {
    id: buildPacketId(reviewPacket.id, input.adapterManifest.id, input.now),
    createdAt: input.now.toISOString(),
    sourceActivationReviewResultId: input.sourceActivationReview.id,
    sourceReviewPacketId: reviewPacket.id,
    sourceCandidateEnvelopeId: envelope.id,
    adapterManifestDigest: digestPayload(packetCore),
    adapterId: input.adapterManifest.id,
    connectorId: input.adapterManifest.connectorId,
    connectorKind: input.adapterManifest.connectorKind,
    environment: input.adapterManifest.environment === 'paper' ? 'paper' : 'sandbox',
    endpointHost,
    credentialRef: input.adapterManifest.credentialRef,
    idempotencyKey: envelope.idempotencyKey,
    idempotencyHeader: input.adapterManifest.idempotencyHeader,
    rateLimitPerMinute: input.adapterManifest.maxRequestsPerMinute ?? 1,
    timeoutMs: input.adapterManifest.timeoutMs ?? MIN_TIMEOUT_MS,
    killSwitchId: reviewPacket.killSwitchId,
    rollbackDrillId: reviewPacket.rollbackDrillId,
    certificationOnly: true,
    sandboxExecutionAuthorized: false,
    sandboxExternalIoPerformed: false,
    liveExecutionAuthorized: false,
    executableNow: false,
    liveActionApplied: false,
    externalSideEffects: false,
    separateSandboxExecutorRequired: true,
    separateLiveExecutorRequired: true,
    conditions: [
      'This packet certifies sandbox adapter readiness only.',
      'No network call, sandbox order, payment, purchase or live transaction was executed.',
      'A future sandbox executor must re-check Intent model1 review, adapter certification, SecretRef, kill switch and rollback.',
      'Live execution remains out of scope for Intent model2.',
    ],
  };
}

function gate(
  kind: ZavorthTransactionSandboxAdapterCertificationGate['kind'],
  passed: boolean,
  summary: string,
  evidence: string[],
): ZavorthTransactionSandboxAdapterCertificationGate {
  return {
    kind,
    passed,
    summary,
    evidence,
  };
}

function resolveStatus(
  gates: ZavorthTransactionSandboxAdapterCertificationGate[],
): ZavorthTransactionSandboxAdapterCertificationStatus {
  if (!isGatePassed(gates, 'intent-model1-review-ready') || !isGatePassed(gates, 'review-packet-present')) {
    return 'activation-review-required';
  }
  if (!isGatePassed(gates, 'adapter-manifest-present')) {
    return 'adapter-manifest-required';
  }
  const policyGates = [
    'sandbox-environment-only',
    'endpoint-allowlist-ready',
    'credential-ref-bound',
    'idempotency-ready',
    'rate-limit-ready',
    'timeout-ready',
    'circuit-breaker-ready',
    'kill-switch-linked',
    'rollback-linked',
    'live-endpoint-blocked',
    'separate-sandbox-executor-required',
    'no-external-io',
    'raw-secret-redaction',
  ];
  if (!policyGates.every((kind) => isGatePassed(gates, kind))) {
    return 'sandbox-policy-blocked';
  }
  return 'sandbox-certification-ready';
}

function isGatePassed(gates: ZavorthTransactionSandboxAdapterCertificationGate[], kind: string): boolean {
  return gates.some((gate) => gate.kind === kind && gate.passed);
}

function summaryForStatus(status: ZavorthTransactionSandboxAdapterCertificationStatus): string {
  if (status === 'sandbox-certification-ready') {
    return 'Sandbox adapter certification packet is ready for a future separate sandbox executor; no external call occurred.';
  }
  if (status === 'activation-review-required') {
    return 'Intent model1 activation review readiness is required before sandbox adapter certification.';
  }
  if (status === 'adapter-manifest-required') {
    return 'A sandbox/paper adapter manifest is required before certification.';
  }
  return 'Sandbox adapter policy gates blocked certification.';
}

function nextStepsForStatus(
  status: ZavorthTransactionSandboxAdapterCertificationStatus,
  blockers: string[],
): string[] {
  if (status === 'sandbox-certification-ready') {
    return [
      'Use this certification packet in a future separate sandbox executor phase; do not execute from Intent model2.',
      'Keep endpoint allowlist, idempotency, SecretRef, kill switch and rollback receipts attached.',
    ];
  }
  if (status === 'activation-review-required') {
    return ['Produce a Intent model1 ready-for-live-activation-review packet first.'];
  }
  if (status === 'adapter-manifest-required') {
    return ['Provide a typed sandbox/paper adapter manifest or run with safe sandbox adapter defaults.'];
  }
  return blockers.map((blocker) => `Resolve gate: ${blocker}`);
}

function evaluateEndpoint(manifest: ZavorthTransactionSandboxAdapterManifest | null): {
  allowlisted: boolean;
  liveEndpoint: boolean;
  evidence: string[];
} {
  const host = safeHost(manifest?.endpointBaseUrl);
  const allowedHosts = manifest?.allowedHosts ?? [];
  const https = safeProtocol(manifest?.endpointBaseUrl) === 'https:';
  const hostAllowlisted = Boolean(host && allowedHosts.includes(host));
  const sandboxLike = Boolean(host && isSandboxLikeHost(host));
  const liveEndpoint = Boolean(host && isLiveEndpoint(host));
  return {
    allowlisted: Boolean(host && https && hostAllowlisted && sandboxLike && !liveEndpoint),
    liveEndpoint,
    evidence: [
      `host=${host ?? 'invalid'}`,
      `https=${https}`,
      `hostAllowlisted=${hostAllowlisted}`,
      `sandboxLike=${sandboxLike}`,
      `liveEndpoint=${liveEndpoint}`,
    ],
  };
}

function safeHost(value: string | undefined): string | null {
  try {
    return value ? new URL(value).hostname.toLowerCase() : null;
  } catch (error) { logger.warn('[Zavorth Transaction Sandbox Adapter Certification] network request failed', error); return null; }
}

function safeProtocol(value: string | undefined): string | null {
  try {
    return value ? new URL(value).protocol.toLowerCase() : null;
  } catch (error) { logger.warn('[Zavorth Transaction Sandbox Adapter Certification] operation failed', error); return null; }
}

function isSandboxLikeHost(host: string): boolean {
  return host.endsWith('.zavorth.local')
    || host.includes('sandbox')
    || host.includes('paper')
    || host.includes('testnet')
    || host.includes('mock');
}

function isLiveEndpoint(host: string): boolean {
  const normalized = host.toLowerCase();
  return [
    'api.binance.com',
    'api.coinbase.com',
    'api.stripe.com',
    'checkout.stripe.com',
    'api.mercadopago.com',
    'api.paypal.com',
  ].includes(normalized)
    || normalized.includes('production')
    || normalized.includes('live.');
}

function sandboxHostForConnector(kind: ZavorthTransactionConnectorKind): string {
  if (kind === 'exchange') {
    return 'paper.exchange.zavorth.local';
  }
  if (kind === 'payment') {
    return 'sandbox.payment.zavorth.local';
  }
  if (kind === 'commerce') {
    return 'sandbox.commerce.zavorth.local';
  }
  if (kind === 'currency-exchange') {
    return 'sandbox.fx.zavorth.local';
  }
  return 'sandbox.transaction.zavorth.local';
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

function normalizeEnvironment(value: unknown): ZavorthTransactionSandboxAdapterEnvironment {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'sandbox' || normalized === 'paper' || normalized === 'live' || normalized === 'production') {
    return normalized;
  }
  return 'sandbox';
}

function isCredentialRef(value: string): boolean {
  return /^vault:\/\/zavorth\/transaction\/[a-z0-9._~:/?#\[\]@!$&'()*+,;=-]+$/i.test(value);
}

function buildResultId(text: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:intent-model2:${text}`).digest('hex').slice(0, 16);
  return `ztx-sandbox-adapter-cert-${hash}`;
}

function buildPacketId(reviewPacketId: string, adapterId: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:${reviewPacketId}:${adapterId}`).digest('hex').slice(0, 16);
  return `ztx-sandbox-cert-packet-${hash}`;
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

function safeInteger(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
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

function safeId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .slice(0, 100) || 'adapter';
}

function redactSecrets(value: string): string {
  let output = value;
  for (const secret of rawSecretValues(value)) {
    output = output.split(secret).join('[REDACTED]');
  }
  return output;
}

function rawSecretValue(text: string): string {
  return rawSecretValues(text)[0] ?? '';
}

function rawSecretValues(text: string): string[] {
  const values: string[] = [];
  const assignment = /\b(?:api[_-]?key|token|secret|private[_-]?key|senha|password)\b\s*[:=]\s*([^\s,;]+)/ig;
  for (let match = assignment.exec(text); match; match = assignment.exec(text)) {
    values.push(match[1]);
  }
  const key = /\b(sk-[A-Za-z0-9_-]{12,}|pk_live_[A-Za-z0-9_-]{12,}|rk_live_[A-Za-z0-9_-]{12,})\b/g;
  for (let match = key.exec(text); match; match = key.exec(text)) {
    values.push(match[1]);
  }
  return [...new Set(values)];
}
