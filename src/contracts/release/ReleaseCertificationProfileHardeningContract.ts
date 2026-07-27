import type {
  ReleaseCertificationGateStatus,
  ReleaseCertificationProfile,
  ReleaseCertificationSnapshot,
} from './ReleaseCertificationContract.js';

export const ZAVORTH_RELEASE_CERTIFICATION_PROFILE_HARDENING_CONTRACT_VERSION = '2026-05-04.gate-14';

export const RELEASE_CERTIFICATION_HARDENED_PROFILES = [
  'private-absorption',
  'release-candidate',
  'public-launch',
] as const satisfies readonly ReleaseCertificationProfile[];

export type ReleaseCertificationProfileHardeningStatus = 'certified' | 'attention' | 'blocked';

export type ReleaseCertificationProfilePolicy = {
  profile: ReleaseCertificationProfile;
  gateId: string;
  label: string;
  maxP0Gaps: 0;
  maxP1Gaps: 0;
  maxP2Gaps: 0;
  requireCertifiedStatus: true;
  requireReleaseReady: true;
  requireNoWarnings: true;
  requireNoWaivers: true;
  requireReceipts: true;
  requireNoLiveIo: true;
  requireSecretRedaction: true;
  command: string;
  jsonCommand: string;
  requireReadyCommand: string;
};

export type ReleaseCertificationProfileResult = {
  profile: ReleaseCertificationProfile;
  gateId: string;
  status: ReleaseCertificationSnapshot['status'];
  certified: boolean;
  releaseReady: boolean;
  sourceOpenGaps: number;
  sourceP0Gaps: number;
  sourceP1Gaps: number;
  sourceP2Gaps: number;
  warned: number;
  failed: number;
  waived: number;
  receipts: number;
  noLiveIo: boolean;
  secretValuesSerialized: false;
  command: string;
  jsonCommand: string;
  requireReadyCommand: string;
  receiptIds: string[];
};

export type ReleaseCertificationHardeningGate = {
  id: string;
  profile: ReleaseCertificationProfile | 'all';
  status: ReleaseCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type ReleaseCertificationFinalReceipt = {
  id: string;
  profile: ReleaseCertificationProfile;
  sourceReceiptId: string;
  gateId: string;
  status: ReleaseCertificationGateStatus;
  evidence: string;
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type ReleaseCertificationProfileHardeningSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_RELEASE_CERTIFICATION_PROFILE_HARDENING_CONTRACT_VERSION;
  status: ReleaseCertificationProfileHardeningStatus;
  summary: {
    profiles: number;
    certifiedProfiles: number;
    releaseReadyProfiles: number;
    failedProfiles: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    finalReceipts: number;
    sourceOpenGaps: number;
    sourceP0Gaps: number;
    sourceP1Gaps: number;
    sourceP2Gaps: number;
    warnings: number;
    waivers: number;
    releaseReady: boolean;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    liveDeviceRequired: false;
    liveMemoryWriteRequired: false;
    filesystemReadRequired: false;
    secretValuesSerialized: false;
  };
  profilePolicyMatrix: ReleaseCertificationProfilePolicy[];
  profileResults: ReleaseCertificationProfileResult[];
  gates: ReleaseCertificationHardeningGate[];
  finalReceipts: ReleaseCertificationFinalReceipt[];
  certifications: Array<Pick<ReleaseCertificationSnapshot, 'contractVersion' | 'profile' | 'status' | 'summary' | 'recommendations'>>;
  commands: {
    run: string;
    runJson: string;
    check: string;
    releaseCandidate: string;
    publicLaunch: string;
    focusedTests: string[];
    typecheck: string;
    nextAction: 'Public launch smoke and evidence ledger';
  };
  policy: {
    hardensAllProfiles: true;
    requiresReleaseCandidate: true;
    requiresPublicLaunch: true;
    requiresFinalReceipts: true;
    requiresZeroP0P1P2: true;
    noExternalCalls: true;
    noLiveSends: true;
    noDeviceAccess: true;
    noMemoryWrites: true;
    noArtifactBodyReads: true;
    noWaiversForFinalCertification: true;
    secretsSerialized: false;
  };
};
