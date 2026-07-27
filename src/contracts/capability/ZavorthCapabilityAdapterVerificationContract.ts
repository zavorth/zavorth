import type { ZavorthCapabilityAdapterDraftRecord } from './ZavorthCapabilityAdapterDraftContract.js';

export const ZAVORTH_CAPABILITY_ADAPTER_VERIFICATION_CONTRACT_VERSION = '2026-06-02.capability-adapter-verification.v1' as const;

export type ZavorthCapabilityAdapterVerificationCheckKind = 'eval' | 'canary' | 'security';

export type ZavorthCapabilityAdapterVerificationCheckStatus = 'passed' | 'warning' | 'blocked';

export type ZavorthCapabilityAdapterVerificationCheck = {
  id: string;
  kind: ZavorthCapabilityAdapterVerificationCheckKind;
  status: ZavorthCapabilityAdapterVerificationCheckStatus;
  summary: string;
  detail: string;
};

export type ZavorthCapabilityAdapterVerificationArtifact = {
  kind: 'verification-report' | 'eval-report' | 'canary-report' | 'security-report';
  path: string;
  sha256: string;
};

export type ZavorthCapabilityAdapterVerificationStatus = 'verified' | 'attention' | 'blocked';

export type ZavorthCapabilityAdapterVerificationRecord = {
  id: string;
  adapterDraftId: string;
  prototypeId: string;
  candidateId: string;
  title: string;
  status: ZavorthCapabilityAdapterVerificationStatus;
  createdAt: string;
  updatedAt: string;
  workspaceDir: string;
  checks: ZavorthCapabilityAdapterVerificationCheck[];
  artifacts: ZavorthCapabilityAdapterVerificationArtifact[];
  sourceAdapter: Pick<ZavorthCapabilityAdapterDraftRecord, 'id' | 'status' | 'adapterKind' | 'workspaceDir'>;
  score: {
    passed: number;
    warnings: number;
    blocked: number;
  };
  nextSafeAction: string;
};

export type ZavorthCapabilityAdapterVerificationReceipt = {
  id: string;
  at: string;
  actor: string;
  operation: 'verify-adapter';
  status: 'applied' | 'skipped' | 'blocked';
  adapterDraftId: string | null;
  verificationId: string | null;
  summary: string;
};

export type ZavorthCapabilityAdapterVerificationSnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_ADAPTER_VERIFICATION_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-adapter-verification';
  status: 'ready' | 'attention';
  storeFile: string;
  verificationRoot: string;
  summary: {
    verifications: number;
    verified: number;
    attention: number;
    blocked: number;
    receipts: number;
  };
  verifications: ZavorthCapabilityAdapterVerificationRecord[];
  receipts: ZavorthCapabilityAdapterVerificationReceipt[];
  safety: {
    draftReadyAdaptersOnly: true;
    deterministicEvalOnly: true;
    localCanaryOnly: true;
    securityChecksRequired: true;
    noNetworkUsed: true;
    noActionHarnessExposure: true;
    noToolExposed: true;
    noLiveActivation: true;
    secretsRedacted: true;
  };
  commands: {
    list: string;
    verifyAll: string;
    verifySelected: string;
    nextAction: string;
  };
};

export type ZavorthCapabilityAdapterVerificationInput = {
  adapters?: {
    adapterRoot: string;
    adapters: ZavorthCapabilityAdapterDraftRecord[];
  };
  adapterIds?: string[];
  allAdapters?: boolean;
  actor?: string;
};
