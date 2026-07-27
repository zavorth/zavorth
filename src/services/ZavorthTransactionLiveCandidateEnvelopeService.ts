import { createHash } from 'node:crypto';
import path from 'node:path';
import { ZavorthTransactionApprovalLedgerService } from './ZavorthTransactionApprovalLedgerService.js';

import {
  buildZavorthTransactionLiveCandidateContractSnapshot,
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_CONTRACT_VERSION,
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
  type ZavorthTransactionLiveCandidateContractSnapshot,
  type ZavorthTransactionLiveCandidateEnvelope,
  type ZavorthTransactionLiveCandidateGate,
  type ZavorthTransactionLiveCandidateInput,
  type ZavorthTransactionLiveCandidateOwnerGate,
  type ZavorthTransactionLiveCandidateResult,
  type ZavorthTransactionLiveCandidateSafety,
  type ZavorthTransactionLiveCandidateStatus,
} from '../contracts/ZavorthTransactionLiveCandidateContract.js';
import type { ZavorthTransactionZavorthControlProjection } from '../contracts/ZavorthTransactionZavorthControlContract.js';

import { ZavorthTransactionCertificationService } from './ZavorthTransactionCertificationService.js';
import { ZavorthTransactionZavorthControlProjectionService } from './ZavorthTransactionZavorthControlProjectionService.js';
import { ZavorthTransactionConnectorRegistryService } from './ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionCredentialRefService } from './ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionPreviewService } from './ZavorthTransactionPreviewService.js';
import { ZavorthTransactionRuntimeOrchestratorService } from './ZavorthTransactionRuntimeOrchestratorService.js';
import { ZavorthTransactionSurfaceGatewayService } from './ZavorthTransactionSurfaceGatewayService.js';

type LiveCandidateDeps = {
  now?: () => Date;
  zavorthControl?: ZavorthTransactionZavorthControlProjectionService;
  certification?: ZavorthTransactionCertificationService;
  credentialRefs?: ZavorthTransactionCredentialRefService;
  ledgerFile?: string;
  credentialStoreFile?: string;
};

const SAFETY: ZavorthTransactionLiveCandidateSafety = {
  liveCandidateOnly: true,
  candidateDoesNotAuthorizeLiveExecution: true,
  noLiveExecution: true,
  noHiddenLiveAction: true,
  noRawSecretSerialized: true,
  externalSideEffects: false,
  liveExecutionAuthorized: false,
  executableNow: false,
  liveActionApplied: false,
};

export class ZavorthTransactionLiveCandidateEnvelopeService {
  private readonly now: () => Date;
  private readonly zavorthControl: ZavorthTransactionZavorthControlProjectionService;
  private readonly certification: ZavorthTransactionCertificationService;

  public constructor(deps: LiveCandidateDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    const credentialRefs =
      deps.credentialRefs ??       new ZavorthTransactionCredentialRefService({
        storeFile: deps.credentialStoreFile,
        now: this.now,
      });
    this.zavorthControl =
      deps.zavorthControl ??       createZavorthControl({
        now: this.now,
        credentialRefs,
        ledgerFile: deps.ledgerFile,
      });
    this.certification =
      deps.certification ??       new ZavorthTransactionCertificationService({
        now: this.now,
        ledgerFile: certificationLedgerFile(deps.ledgerFile),
        credentialStoreFile: certificationCredentialStoreFile(deps.credentialStoreFile),
      });
  }

  public buildSnapshot(): ZavorthTransactionLiveCandidateContractSnapshot {
    return buildZavorthTransactionLiveCandidateContractSnapshot();
  }

  public propose(input: ZavorthTransactionLiveCandidateInput): ZavorthTransactionLiveCandidateResult {
    const createdAt = this.now();
    const zavorthControlProjection = this.zavorthControl.project({
      text: input.text,
      kind: input.kind,
      actionKind: input.actionKind,
      targetKind: input.targetKind,
      surface: input.surface ?? 'api',
      mode: input.mode ?? 'paper',
      approve: input.approve,
      reject: input.reject,
      requireCredential: input.requireCredential,
      credentialRef: input.credentialRef,
      connectorId: input.connectorId,
    });
    const certificationReport = this.certification.certify();
    const ownerGate = buildOwnerGate(input, createdAt);
    const envelope = buildEnvelope(zavorthControlProjection, createdAt);
    const gates = buildGates({
      input,
      zavorthControlProjection,
      certificationStatus: certificationReport.status,
      ownerGate,
      envelope,
    });
    const status = resolveStatus(gates);
    const blockers = gates.filter((gate) => !gate.passed).map((gate) => gate.kind);

    return {
      version: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_CONTRACT_VERSION,
      id: buildResultId(input.text, createdAt),
      createdAt: createdAt.toISOString(),
      status,
      summary: summaryForStatus(status),
      ownerGate,
      gates,
      ...(status === 'candidate-ready' && envelope ? { envelope } : {}),
      zavorthControlProjection,
      certificationReport,
      blockers,
      nextSteps: nextStepsForStatus(status, blockers),
      safety: SAFETY,
    };
  }

  public renderReport(result: ZavorthTransactionLiveCandidateResult): string {
    return [
      '[transaction-live-candidate] Intent model0 owner-gated live candidate envelope',
      `[transaction-live-candidate] status: ${result.status}`,
      `[transaction-live-candidate] owner: ${result.ownerGate.ownerId}`,
      `[transaction-live-candidate] owner-confirmed: ${result.ownerGate.confirmed}`,
      `[transaction-live-candidate] owner-phrase-accepted: ${result.ownerGate.phraseAccepted}`,
      `[transaction-live-candidate] envelope: ${result.envelope?.id ?? 'none'}`,
      `[transaction-live-candidate] certification: ${result.certificationReport.status}`,
      `[transaction-live-candidate] zavorthControl-status: ${result.zavorthControlProjection.status}`,
      `[transaction-live-candidate] no-live-execution: ${result.safety.noLiveExecution}`,
      `[transaction-live-candidate] live-execution-authorized: ${result.safety.liveExecutionAuthorized}`,
      `[transaction-live-candidate] executable-now: ${result.safety.executableNow}`,
      `[transaction-live-candidate] live-action-applied: ${result.safety.liveActionApplied}`,
      ...result.gates.map(
        (gate) => `[transaction-live-candidate] gate: ${gate.kind} passed=${gate.passed} summary=${gate.summary}`,
      ),
      ...result.nextSteps.map((step) => `[transaction-live-candidate] next: ${step}`),
    ].join('\n');
  }
}

function certificationLedgerFile(ledgerFile: string | undefined): string {
  return ledgerFile ? `${ledgerFile}.certification-matrix-certification.jsonl`
    : path.join(
        process.cwd(),
        'data',
        'runtime',
        'zavorth-transaction-live-candidate-certification-matrix-certification-ledger.jsonl',
      );
}

function certificationCredentialStoreFile(storeFile: string | undefined): string {
  return storeFile ? `${storeFile}.certification-matrix-certification.jsonl`
    : path.join(
        process.cwd(),
        'data',
        'runtime',
        'zavorth-transaction-live-candidate-certification-matrix-certification-credential-refs.jsonl',
      );
}

function createZavorthControl(input: {
  now: () => Date;
  credentialRefs: ZavorthTransactionCredentialRefService;
  ledgerFile?: string;
}): ZavorthTransactionZavorthControlProjectionService {
  const previewService = new ZavorthTransactionPreviewService();
  return new ZavorthTransactionZavorthControlProjectionService({
    now: input.now,
    surfaceGateway: new ZavorthTransactionSurfaceGatewayService({
      now: input.now,
      runtime: new ZavorthTransactionRuntimeOrchestratorService({
        now: input.now,
        previewService,
        approvalLedger: new ZavorthTransactionApprovalLedgerService({
          ledgerFile: input.ledgerFile,
          now: input.now,
          previewService,
        }),
        credentialRefs: input.credentialRefs,
        connectorRegistry: new ZavorthTransactionConnectorRegistryService({
          now: input.now,
        }),
      }),
    }),
  });
}

function buildOwnerGate(
  input: ZavorthTransactionLiveCandidateInput,
  now: Date,
): ZavorthTransactionLiveCandidateOwnerGate {
  const ownerIntent = input.ownerIntent ?? '';
  const confirmed = input.ownerConfirmed === true;
  const phraseAccepted = ownerIntent.trim() === ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE;
  return {
    ownerId: sanitizeOwnerId(input.ownerId ?? 'owner'),
    confirmed,
    requiredPhrase: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
    phraseAccepted,
    ...(confirmed && phraseAccepted ? { confirmationRecordedAt: now.toISOString() } : {}),
    intentDigest: digestPayload({
      ownerId: sanitizeOwnerId(input.ownerId ?? 'owner'),
      ownerIntent,
      confirmed,
      phraseAccepted,
    }),
  };
}

function buildEnvelope(
  projection: ZavorthTransactionZavorthControlProjection,
  now: Date,
): ZavorthTransactionLiveCandidateEnvelope | undefined {
  const runtime = projection.surfaceProjection.runtime;
  const connectorRun = runtime.connectorRun;
  const payload = connectorRun?.payload;
  const connector = connectorRun?.connector;
  const credentialRef = runtime.credentialValidation?.ref ?? payload?.credentialRef;
  const approvalEntryId = runtime.approvalEntry?.id;

  if (!connectorRun || !payload || !connector || !credentialRef || !approvalEntryId) {
    return undefined;
  }

  return {
    id: buildEnvelopeId(projection.id, payload.idempotencyKey, now),
    createdAt: now.toISOString(),
    sourceZavorthControlProjectionId: projection.id,
    sourceSurfaceProjectionId: projection.sourceProjectionId,
    surface: projection.surface,
    actionKind: runtime.preview.intent.actionKind,
    connectorKind: runtime.preview.connector.kind,
    connectorId: connector.id,
    target: {
      kind: runtime.preview.intent.target.kind,
      label: runtime.preview.intent.target.label,
    },
    ...(runtime.preview.quote.amount != null ? { amount: runtime.preview.quote.amount } : {}),
    ...(runtime.preview.quote.currency ? { currency: runtime.preview.quote.currency } : {}),
    credentialRef,
    approvalEntryId,
    previewId: runtime.preview.id,
    idempotencyKey: payload.idempotencyKey,
    payloadDigest: digestPayload(payload),
    payloadPreview: payload,
    candidateOnly: true,
    rawSecretPresent: false,
  };
}

function buildGates(input: {
  input: ZavorthTransactionLiveCandidateInput;
  zavorthControlProjection: ZavorthTransactionZavorthControlProjection;
  certificationStatus: string;
  ownerGate: ZavorthTransactionLiveCandidateOwnerGate;
  envelope: ZavorthTransactionLiveCandidateEnvelope | undefined;
}): ZavorthTransactionLiveCandidateGate[] {
  const projection = input.zavorthControlProjection;
  const runtime = projection.surfaceProjection.runtime;
  const serialized = JSON.stringify({
    projection,
    envelope: input.envelope,
  });
  const rawSecretDetected =
    includesRawSecret(input.input.text) && serialized.includes(rawSecretValue(input.input.text));
  const connectorStatus = runtime.connectorRun?.status ?? 'not-run';
  return [
    gate(
      'certification-matrix-certification',
      input.certificationStatus === 'passed',
      'Certification matrix certification must pass before any live-candidate envelope is considered.',
      [`certification=${input.certificationStatus}`],
    ),
    gate(
      'zavorthControl-dryRun',
      projection.status === 'dryRun',
      'ZavorthControl projection must represent a completed paper/sandbox dryRun.',
      [`status=${projection.status}`, `tone=${projection.tone}`],
    ),
    gate(
      'approval-ledger-approved',
      runtime.approvalEntry?.approvalStatus === 'approved' && runtime.approvalEntry?.liveActionApplied === false,
      'Approval ledger must contain an approval-granted entry that still has no live effects.',
      [`approval=${runtime.approvalEntry?.approvalStatus ?? 'none'}`, `entry=${runtime.approvalEntry?.id ?? 'none'}`],
    ),
    gate(
      'credential-ref-ready',
      runtime.credentialValidation?.status === 'ready' && runtime.credentialValidation?.valueReadableByLlm === false,
      'Credential must be a ready SecretRef/metadata reference, not a raw secret.',
      [
        `credential=${runtime.credentialValidation?.status ?? 'none'}`,
        `ref=${runtime.credentialValidation?.ref ?? 'none'}`,
      ],
    ),
    gate(
      'typed-connector-dryRun',
      connectorStatus === 'dryRun' && runtime.connectorRun?.externalSideEffects === false,
      'Typed connector must have produced a dryRun payload with no external side effects.',
      [`connector=${connectorStatus}`, `payload=${runtime.connectorRun?.payload?.method ?? 'none'}`],
    ),
    gate(
      'owner-confirmation',
      input.ownerGate.confirmed && input.ownerGate.phraseAccepted,
      'Owner must explicitly confirm the candidate-only envelope using the required phrase.',
      [`owner=${input.ownerGate.ownerId}`, `phraseAccepted=${input.ownerGate.phraseAccepted}`],
    ),
    gate(
      'raw-secret-redaction',
      !rawSecretDetected && projection.safety.noRawSecretSerialized === true,
      'Candidate output must not serialize raw transaction secrets.',
      [`rawSecretSerialized=${rawSecretDetected}`],
    ),
    gate(
      'live-switch-disabled',
      projection.safety.liveActionApplied === false &&
        projection.safety.liveExecutionAuthorized === false &&
        projection.safety.executableNow === false,
      'Intent model0 keeps live execution disabled even when a candidate envelope is ready.',
      [
        `liveActionApplied=${projection.safety.liveActionApplied}`,
        `liveExecutionAuthorized=${projection.safety.liveExecutionAuthorized}`,
        `executableNow=${projection.safety.executableNow}`,
      ],
    ),
  ];
}

function gate(
  kind: ZavorthTransactionLiveCandidateGate['kind'],
  passed: boolean,
  summary: string,
  evidence: string[],
): ZavorthTransactionLiveCandidateGate {
  return {
    kind,
    passed,
    summary,
    evidence,
  };
}

function resolveStatus(gates: ZavorthTransactionLiveCandidateGate[]): ZavorthTransactionLiveCandidateStatus {
  if (!isGatePassed(gates, 'certification-matrix-certification')) {
    return 'certification-required';
  }
  const runtimeGates = [
    'zavorthControl-dryRun',
    'approval-ledger-approved',
    'credential-ref-ready',
    'typed-connector-dryRun',
    'raw-secret-redaction',
    'live-switch-disabled',
  ];
  if (!runtimeGates.every((kind) => isGatePassed(gates, kind))) {
    return 'runtime-blocked';
  }
  if (!isGatePassed(gates, 'owner-confirmation')) {
    return 'owner-confirmation-required';
  }
  return 'candidate-ready';
}

function isGatePassed(gates: ZavorthTransactionLiveCandidateGate[], kind: string): boolean {
  return gates.some((gate) => gate.kind === kind && gate.passed);
}

function summaryForStatus(status: ZavorthTransactionLiveCandidateStatus): string {
  if (status === 'candidate-ready') {
    return 'Owner-gated live-candidate envelope is ready for future live activation review; no live execution occurred.';
  }
  if (status === 'owner-confirmation-required') {
    return 'Runtime is ready for a candidate envelope, but explicit owner confirmation is still required.';
  }
  if (status === 'certification-required') {
    return 'Certification matrix certification must pass before a live-candidate envelope can be considered.';
  }
  return 'Runtime, approval, credential, connector or redaction gate blocked the live-candidate envelope.';
}

function nextStepsForStatus(status: ZavorthTransactionLiveCandidateStatus, blockers: string[]): string[] {
  if (status === 'candidate-ready') {
    return [
      'Review the candidate envelope in a separate owner-gated live activation phase.',
      'Do not execute live from Intent model0; this result is candidate-only.',
    ];
  }
  if (status === 'owner-confirmation-required') {
    return [`Re-run with owner confirmation phrase: ${ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE}`];
  }
  if (status === 'certification-required') {
    return ['Run Certification matrix certification and resolve any failed gate before trying Intent model0 again.'];
  }
  return blockers.map((blocker) => `Resolve gate: ${blocker}`);
}

function buildResultId(text: string, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:intent-model0:${text}`).digest('hex').slice(0, 16);
  return `ztx-live-candidate-${hash}`;
}

function buildEnvelopeId(projectionId: string, idempotencyKey: string, now: Date): string {
  const hash = createHash('sha256')
    .update(`${now.toISOString()}:${projectionId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 16);
  return `ztx-live-envelope-${hash}`;
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
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sanitizeOwnerId(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9._:-]+/g, '-')
      .slice(0, 80) || 'owner'
  );
}

function includesRawSecret(text: string): boolean {
  return rawSecretValue(text).length > 0;
}

function rawSecretValue(text: string): string {
  const assignment = /\b(?:api[_-]...key|token|secret|private[_-]...key|senha|password)\b\s*[:=]\s*([^\s,;]+)/i.exec(
    text,
  )?.[1];
  if (assignment) {
    return assignment;
  }
  return /\b(sk-[A-Za-z0-9_-]{12}|pk_live_[A-Za-z0-9_-]{12}|rk_live_[A-Za-z0-9_-]{12})\b/.exec(text)?.[1] ?? '';
}
