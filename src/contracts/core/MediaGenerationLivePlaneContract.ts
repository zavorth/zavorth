import type { LiveReadinessStatus } from './LiveReadinessContract.js';
import type { MediaGenerationModality } from './MediaGenerationContract.js';

export const ZAVORTH_MEDIA_GENERATION_LIVE_PLANE_CONTRACT_VERSION = '2026-05-04.live-checkpoint-6' as const;

export type MediaGenerationLiveTargetId =
  | 'image-generation-core'
  | 'video-generation-core'
  | 'fal'
  | 'runway'
  | 'comfy'
  | 'minimax'
  | 'byteplus'
  | 'volcengine';

export type MediaGenerationLiveStatus =
  | 'image-live'
  | 'video-live'
  | 'image-video-live'
  | 'local-image-video-live'
  | 'routed-to-checkpoint-7'
  | 'blocked';

export type MediaGenerationLiveAdapterFamily =
  | 'direct-image'
  | 'async-media-job'
  | 'local-comfy-job'
  | 'provider-gateway-job';

export type MediaGenerationLiveGateKind =
  | 'modality-adapter'
  | 'artifact-storage'
  | 'async-polling'
  | 'job-status'
  | 'job-cancel'
  | 'provider-evidence'
  | 'safety-policy'
  | 'configured-doctor'
  | 'mock-smoke'
  | 'staging-live-smoke'
  | 'redacted-receipt';

export type MediaGenerationLiveGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type MediaGenerationLiveConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  artifactEnv: string[];
  secretValuesSerialized: false;
};

export type MediaGenerationLiveGate = {
  kind: MediaGenerationLiveGateKind;
  status: MediaGenerationLiveGateStatus;
  evidence: string;
  command: string | null;
};

export type MediaGenerationLiveReceipt = {
  id: string;
  targetId: MediaGenerationLiveTargetId;
  status: MediaGenerationLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  modalities: MediaGenerationModality[];
  family: MediaGenerationLiveAdapterFamily;
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  artifactFirst: true;
  secretValuesSerialized: false;
};

export type MediaGenerationLiveEntry = {
  targetId: MediaGenerationLiveTargetId;
  status: MediaGenerationLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  primitiveId: 'media.generate';
  modalities: MediaGenerationModality[];
  adapterFamily: MediaGenerationLiveAdapterFamily;
  adapterTarget: string;
  serviceTarget: string;
  defaultModelName: string;
  configSchema: MediaGenerationLiveConfigSchema;
  gates: MediaGenerationLiveGate[];
  gaps: string[];
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  receipt: MediaGenerationLiveReceipt;
};

export type MediaGenerationLivePlaneSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_MEDIA_GENERATION_LIVE_PLANE_CONTRACT_VERSION;
  gate: 'media-generation-live-plane';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    targets: 8;
    imageCapableTargets: number;
    videoCapableTargets: number;
    audioRoutedToStage7: true;
    directImageTargets: number;
    asyncJobTargets: number;
    localTargets: number;
    artifactStorageTargets: number;
    pollingTargets: number;
    statusTargets: number;
    cancelTargets: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    blocked: number;
    liveIoRequiredByStage6Check: false;
    secretValuesSerialized: false;
  };
  entries: MediaGenerationLiveEntry[];
  receipts: MediaGenerationLiveReceipt[];
  policy: {
    noLiveIoDuringStage6Check: true;
    artifactFirstOutputsRequired: true;
    imageOnlyCannotCloseVideo: true;
    asyncProvidersRequirePollingAndStatus: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    promptSafetyPolicyRequired: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run media-generation-live-plane:check --silent';
    doctor: 'npm run media-generation-live-plane -- --profile configured';
    stagingLiveSmoke: 'npm run media-generation-live-plane -- --profile staging-live --target <target> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'Surface controls - Speech, TTS And Voice Live Plane';
  };
};
