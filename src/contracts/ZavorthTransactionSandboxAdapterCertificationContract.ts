import type {
  ZavorthTransactionConnectorKind,
} from './ZavorthTransactionPreviewContract.js';
import type {
  ZavorthTransactionLiveActivationReviewResult,
} from './ZavorthTransactionLiveActivationReviewContract.js';

export const ZAVORTH_TRANSACTION_SANDBOX_ADAPTER_CERTIFICATION_CONTRACT_VERSION =
  'zavorth-transaction-sandbox-adapter-certification/phase-12' as const;

export type ZavorthTransactionSandboxAdapterCertificationStatus =
  | 'activation-review-required'
  | 'adapter-manifest-required'
  | 'sandbox-policy-blocked'
  | 'sandbox-certification-ready';

export type ZavorthTransactionSandboxAdapterEnvironment =
  | 'sandbox'
  | 'paper'
  | 'live'
  | 'production';

export type ZavorthTransactionSandboxAdapterCertificationGateKind =
  | 'phase11-review-ready'
  | 'review-packet-present'
  | 'adapter-manifest-present'
  | 'sandbox-environment-only'
  | 'endpoint-allowlist-ready'
  | 'credential-ref-bound'
  | 'idempotency-ready'
  | 'rate-limit-ready'
  | 'timeout-ready'
  | 'circuit-breaker-ready'
  | 'kill-switch-linked'
  | 'rollback-linked'
  | 'live-endpoint-blocked'
  | 'separate-sandbox-executor-required'
  | 'no-external-io'
  | 'raw-secret-redaction';

export type ZavorthTransactionSandboxAdapterCertificationGate = {
  kind: ZavorthTransactionSandboxAdapterCertificationGateKind;
  passed: boolean;
  summary: string;
  evidence: string[];
};

export type ZavorthTransactionSandboxAdapterManifest = {
  id: string;
  connectorId: string;
  connectorKind: ZavorthTransactionConnectorKind;
  displayName: string;
  environment: ZavorthTransactionSandboxAdapterEnvironment;
  endpointBaseUrl: string;
  allowedHosts: string[];
  credentialRef: string;
  idempotencyHeader: string;
  maxRequestsPerMinute: number | null;
  timeoutMs: number | null;
  circuitBreaker: boolean;
  dryRunCommand: string;
  sandboxSmokeCommand: string;
  supportsLive: boolean;
  rawSecretsAccepted: boolean;
  redacted: true;
};

export type ZavorthTransactionSandboxAdapterManifestInput = Partial<ZavorthTransactionSandboxAdapterManifest> & {
  connectorKind?: ZavorthTransactionConnectorKind | string;
};

export type ZavorthTransactionSandboxAdapterCertificationPacket = {
  id: string;
  createdAt: string;
  sourceActivationReviewResultId: string;
  sourceReviewPacketId: string;
  sourceCandidateEnvelopeId: string;
  adapterManifestDigest: string;
  adapterId: string;
  connectorId: string;
  connectorKind: ZavorthTransactionConnectorKind;
  environment: 'sandbox' | 'paper';
  endpointHost: string;
  credentialRef: string;
  idempotencyKey: string;
  idempotencyHeader: string;
  rateLimitPerMinute: number;
  timeoutMs: number;
  killSwitchId: string;
  rollbackDrillId: string;
  certificationOnly: true;
  sandboxExecutionAuthorized: false;
  sandboxExternalIoPerformed: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  externalSideEffects: false;
  separateSandboxExecutorRequired: true;
  separateLiveExecutorRequired: true;
  conditions: string[];
};

export type ZavorthTransactionSandboxAdapterCertificationSafety = {
  certificationOnly: true;
  noSandboxNetworkCall: true;
  noLiveExecution: true;
  noHiddenLiveAction: true;
  noRawSecretSerialized: true;
  externalSideEffects: false;
  sandboxExecutionAuthorized: false;
  sandboxExternalIoPerformed: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  separateSandboxExecutorRequired: true;
  separateLiveExecutorRequired: true;
};

export type ZavorthTransactionSandboxAdapterCertificationInput = {
  text: string;
  surface?: 'web' | 'cli' | 'telegram' | 'api' | 'natural-first';
  mode?: 'dry-run' | 'sandbox' | 'paper';
  approve?: boolean;
  reject?: boolean;
  requireCredential?: boolean;
  credentialRef?: string | null;
  connectorId?: string;
  ownerId?: string;
  ownerConfirmed?: boolean;
  ownerIntent?: string | null;
  activationReviewConfirmed?: boolean;
  activationReviewIntent?: string | null;
  activationReviewId?: string | null;
  limits?: {
    maxSingleAmount?: number | null;
    maxDailyAmount?: number | null;
    maxExecutionsPerDay?: number | null;
    allowedConnectorIds?: string[] | null;
    allowedTargetLabels?: string[] | null;
    currency?: string | null;
  } | null;
  killSwitch?: {
    id?: string | null;
    enabled?: boolean | null;
    tested?: boolean | null;
    command?: string | null;
    ownerId?: string | null;
  } | null;
  rollbackDrill?: {
    drillId?: string | null;
    performed?: boolean | null;
    successful?: boolean | null;
    summary?: string | null;
    replayCommand?: string | null;
    rollbackCommand?: string | null;
    artifacts?: string[] | null;
  } | null;
  useSafeDefaultControls?: boolean;
  useSafeSandboxAdapter?: boolean;
  adapterManifest?: ZavorthTransactionSandboxAdapterManifestInput | null;
};

export type ZavorthTransactionSandboxAdapterCertificationResult = {
  version: typeof ZAVORTH_TRANSACTION_SANDBOX_ADAPTER_CERTIFICATION_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionSandboxAdapterCertificationStatus;
  summary: string;
  sourceActivationReview: ZavorthTransactionLiveActivationReviewResult;
  adapterManifest: ZavorthTransactionSandboxAdapterManifest | null;
  gates: ZavorthTransactionSandboxAdapterCertificationGate[];
  certificationPacket?: ZavorthTransactionSandboxAdapterCertificationPacket;
  blockers: string[];
  nextSteps: string[];
  safety: ZavorthTransactionSandboxAdapterCertificationSafety;
};

export type ZavorthTransactionSandboxAdapterCertificationContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_SANDBOX_ADAPTER_CERTIFICATION_CONTRACT_VERSION;
  summary: string;
  statuses: ZavorthTransactionSandboxAdapterCertificationStatus[];
  environments: ZavorthTransactionSandboxAdapterEnvironment[];
  gateKinds: ZavorthTransactionSandboxAdapterCertificationGateKind[];
  invariants: string[];
};

export function buildZavorthTransactionSandboxAdapterCertificationContractSnapshot(): ZavorthTransactionSandboxAdapterCertificationContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_SANDBOX_ADAPTER_CERTIFICATION_CONTRACT_VERSION,
    summary: 'Sandbox/paper adapter certification contract for Zavorth Transaction Plane Phase 12.',
    statuses: [
      'activation-review-required',
      'adapter-manifest-required',
      'sandbox-policy-blocked',
      'sandbox-certification-ready',
    ],
    environments: ['sandbox', 'paper', 'live', 'production'],
    gateKinds: [
      'phase11-review-ready',
      'review-packet-present',
      'adapter-manifest-present',
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
    ],
    invariants: [
      'Phase 12 consumes a Phase 11 ready-for-live-activation-review packet before certifying any adapter.',
      'Phase 12 certifies sandbox or paper adapter readiness only; it does not call external networks.',
      'Sandbox certification requires allowlisted endpoint hosts, SecretRef binding, idempotency, rate limit, timeout and circuit breaker controls.',
      'Live and production adapter endpoints are blocked in Phase 12.',
      'A sandbox-certification-ready packet still reports sandboxExecutionAuthorized=false and liveExecutionAuthorized=false.',
      'Phase 12 requires a separate future sandbox executor and a separate future live executor.',
      'Raw transaction secrets must never be serialized by the certification packet.',
    ],
  };
}
