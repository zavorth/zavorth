import type { ReleaseCertificationGateStatus } from './ReleaseCertificationContract.js';
import type { ReleaseCertificationProfileHardeningSnapshot } from './ReleaseCertificationProfileHardeningContract.js';

export const ZAVORTH_PUBLIC_LAUNCH_SMOKE_EVIDENCE_LEDGER_CONTRACT_VERSION = '2026-05-04.checkpoint-15';

export type PublicLaunchSmokeEvidenceLedgerStatus = 'ready' | 'attention' | 'blocked';

export type PublicLaunchSmokeMode = 'dry-proof' | 'opt-in-live';

export type PublicLaunchSmokeStatus = 'dry-passed' | 'live-pending' | 'blocked';

export type PublicLaunchSmokeSurface =
  | 'certification'
  | 'runtime'
  | 'provider.mesh'
  | 'channel.mesh'
  | 'satellite.pwa'
  | 'memory.artifact'
  | 'public.surface'
  | 'release.bundle'
  | 'feedback.loop';

export type PublicLaunchSmokeEvidenceEntry = {
  id:
    | 'public-launch-certification'
    | 'release-profile-hardening'
    | 'runtime-typecheck'
    | 'provider-mesh-dry-smoke'
    | 'channel-mesh-dry-smoke'
    | 'satellite-pwa-dry-smoke'
    | 'memory-artifact-dry-smoke'
    | 'public-surface-dry-smoke'
    | 'release-bundle-dry-smoke'
    | 'feedback-loop-dry-smoke'
    | 'provider-live-opt-in'
    | 'channel-live-opt-in'
    | 'satellite-device-opt-in'
    | 'public-demo-live-opt-in';
  surface: PublicLaunchSmokeSurface;
  mode: PublicLaunchSmokeMode;
  status: PublicLaunchSmokeStatus;
  requiredForPublicLaunch: boolean;
  command: string;
  receipt: string;
  evidence: string;
  operatorAction: string;
  dependsOn: string[];
  liveExternalCallRequired: boolean;
  liveChannelSendRequired: boolean;
  liveDeviceRequired: boolean;
  liveMemoryWriteRequired: false;
  secretValuesSerialized: false;
};

export type PublicLaunchSmokeEvidenceGate = {
  id:
    | 'release-profile-hardening-ready'
    | 'required-dry-smokes-complete'
    | 'opt-in-live-smokes-explicit'
    | 'evidence-receipts-complete'
    | 'no-live-io-by-default'
    | 'no-secret-values-in-ledger';
  status: ReleaseCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type PublicLaunchSmokeEvidenceReceipt = {
  id: string;
  entryId: PublicLaunchSmokeEvidenceEntry['id'];
  status: PublicLaunchSmokeStatus;
  mode: PublicLaunchSmokeMode;
  command: string;
  evidence: string;
  noLiveIoByDefault: boolean;
  secretValuesSerialized: false;
};

export type PublicLaunchSmokeEvidenceLedgerSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PUBLIC_LAUNCH_SMOKE_EVIDENCE_LEDGER_CONTRACT_VERSION;
  status: PublicLaunchSmokeEvidenceLedgerStatus;
  summary: {
    entries: number;
    requiredDrySmokes: number;
    requiredDryPassed: number;
    optInLiveSmokes: number;
    optInLivePending: number;
    blocked: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    releaseHardeningStatus: ReleaseCertificationProfileHardeningSnapshot['status'];
    releaseHardeningReady: boolean;
    publicLaunchReady: boolean;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    liveDeviceRequired: false;
    liveMemoryWriteRequired: false;
    filesystemReadRequired: false;
    secretValuesSerialized: false;
  };
  releaseHardening: Pick<ReleaseCertificationProfileHardeningSnapshot, 'contractVersion' | 'status' | 'summary' | 'commands'>;
  entries: PublicLaunchSmokeEvidenceEntry[];
  gates: PublicLaunchSmokeEvidenceGate[];
  receipts: PublicLaunchSmokeEvidenceReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireReady: string;
    drySmokeCommands: string[];
    optInLiveCommands: string[];
    focusedTests: string[];
    typecheck: string;
    nextStage: 'Release candidate package freeze';
  };
  policy: {
    evidenceLedgerOnly: true;
    consumesReleaseHardening: true;
    requiredSmokesAreDryProofs: true;
    liveSmokesAreOptIn: true;
    noExternalCallsByDefault: true;
    noLiveChannelSendsByDefault: true;
    noDeviceAccessByDefault: true;
    noMemoryWritesByDefault: true;
    noArtifactBodyReadsByDefault: true;
    secretsSerialized: false;
  };
};
