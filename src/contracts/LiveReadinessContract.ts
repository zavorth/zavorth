import type { CapabilityNormalizationFamily } from './CapabilityNormalizationContract.js';

export const ZAVORTH_LIVE_READINESS_CONTRACT_VERSION = '2026-05-04.live-phase-1' as const;

export type LiveReadinessProfile =
  | 'dry-audit'
  | 'configured-doctor'
  | 'mock-live'
  | 'staging-live'
  | 'production-live';

export type LiveReadinessStatus =
  | 'live-ready'
  | 'partial-live'
  | 'configured-only'
  | 'dry-run-only'
  | 'template-only'
  | 'planned'
  | 'blocked';

export type LiveReadinessSnapshotStatus =
  | 'live-ready'
  | 'attention'
  | 'blocked';

export type LiveReadinessSurface = CapabilityNormalizationFamily | 'unknown';

export type LiveReadinessGateKind =
  | 'native-contract'
  | 'real-adapter'
  | 'operator-config'
  | 'safety-policy'
  | 'runtime-wiring'
  | 'artifact-receipt'
  | 'mock-smoke'
  | 'configured-doctor'
  | 'live-smoke'
  | 'truthful-status';

export type LiveReadinessGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'not-required'
  | 'blocked';

export type LiveReadinessGate = {
  kind: LiveReadinessGateKind;
  status: LiveReadinessGateStatus;
  evidence: string;
  command: string | null;
};

export type LiveReadinessReceipt = {
  id: string;
  sourceName: string;
  primitiveId: string | null;
  status: LiveReadinessStatus;
  profileFloor: LiveReadinessProfile;
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type LiveReadinessEntry = {
  id: string;
  sourceName: string;
  normalizedSourceName: string;
  primitiveId: string | null;
  family: LiveReadinessSurface;
  status: LiveReadinessStatus;
  profileFloor: LiveReadinessProfile;
  recommendedPhase: string;
  reason: string;
  serviceTarget: string | null;
  adapterTarget: string | null;
  liveAdapterTarget: string | null;
  requiredConfig: string[];
  gaps: string[];
  gates: LiveReadinessGate[];
  receipt: LiveReadinessReceipt;
};

export type LiveReadinessGapGroup = {
  phase: string;
  status: LiveReadinessStatus;
  count: number;
  itemIds: string[];
  summary: string;
};

export type LiveReadinessSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_LIVE_READINESS_CONTRACT_VERSION;
  profile: 'dry-audit';
  status: LiveReadinessSnapshotStatus;
  summary: {
    sourceModules: number;
    liveReady: number;
    partialLive: number;
    configuredOnly: number;
    dryRunOnly: number;
    templateOnly: number;
    planned: number;
    blocked: number;
    notFullyLive: number;
    requiresOperatorConfiguration: number;
    receipts: number;
    liveExternalCallRequiredToBuildSnapshot: false;
    liveChannelSendRequiredToBuildSnapshot: false;
    secretValuesSerialized: false;
  };
  entries: LiveReadinessEntry[];
  gaps: LiveReadinessGapGroup[];
  receipts: LiveReadinessReceipt[];
  policy: {
    noLiveIoDuringReadinessKernel: true;
    noSecretsSerialized: true;
    liveActivationRequiresOperatorConfiguration: true;
    liveActivationRequiresReceipts: true;
    templatesCannotBeCertifiedAsLive: true;
    dryRunCannotBeCertifiedAsLive: true;
    truthfulStatusRequired: true;
  };
  commands: {
    check: 'npm run live-readiness:check --silent';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextPhase: 'Phase 2 - Channel Live Activation P0';
  };
};
