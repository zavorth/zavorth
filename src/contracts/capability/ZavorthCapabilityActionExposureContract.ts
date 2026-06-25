import type { ZavorthCapabilityAdapterVerificationRecord } from './ZavorthCapabilityAdapterVerificationContract.js';

export const ZAVORTH_CAPABILITY_ACTION_EXPOSURE_CONTRACT_VERSION = '2026-06-02.capability-action-exposure.v1' as const;

export type ZavorthCapabilityActionExposureStatus = 'exposed' | 'blocked';

export type ZavorthCapabilityActionExposureManifest = {
  actionId: string;
  title: string;
  description: string;
  aliases: string[];
  domains: string[];
  surface: Array<'cli' | 'dashboard' | 'tui' | 'api' | 'channel' | 'llm'>;
  risk: 'attention';
  requiresPreview: true;
  requiresApproval: true;
  liveActivationAllowed: false;
  toolExecutionAllowed: false;
};

export type ZavorthCapabilityActionExposureArtifact = {
  kind: 'action-manifest' | 'action-policy' | 'source-verification';
  path: string;
  sha256: string;
};

export type ZavorthCapabilityActionExposureRecord = {
  id: string;
  actionId: string;
  verificationId: string;
  adapterDraftId: string;
  candidateId: string;
  title: string;
  status: ZavorthCapabilityActionExposureStatus;
  createdAt: string;
  updatedAt: string;
  workspaceDir: string;
  manifest: ZavorthCapabilityActionExposureManifest;
  artifacts: ZavorthCapabilityActionExposureArtifact[];
  sourceVerification: Pick<ZavorthCapabilityAdapterVerificationRecord, 'id' | 'status' | 'adapterDraftId' | 'workspaceDir'>;
  nextSafeAction: string;
};

export type ZavorthCapabilityActionExposureReceipt = {
  id: string;
  at: string;
  actor: string;
  operation: 'expose-capability-action';
  status: 'applied' | 'skipped' | 'blocked';
  verificationId: string | null;
  exposureId: string | null;
  summary: string;
};

export type ZavorthCapabilityActionExposurePreview = {
  generatedAt: string;
  selected: number;
  alreadyExposed: number;
  missing: number;
  verifiedOnly: true;
  plannedActions: ZavorthCapabilityActionExposureManifest[];
  lines: string[];
};

export type ZavorthCapabilityActionExposureSnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_ACTION_EXPOSURE_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-action-exposure';
  status: 'ready' | 'attention';
  storeFile: string;
  exposureRoot: string;
  summary: {
    exposures: number;
    exposed: number;
    blocked: number;
    receipts: number;
  };
  exposures: ZavorthCapabilityActionExposureRecord[];
  receipts: ZavorthCapabilityActionExposureReceipt[];
  safety: {
    verifiedAdaptersOnly: true;
    actionHarnessOnly: true;
    previewRequired: true;
    approvalRequired: true;
    noToolExecution: true;
    noLiveActivation: true;
    noNetworkUsed: true;
    secretsRedacted: true;
  };
  commands: {
    list: string;
    previewAll: string;
    exposeAll: string;
    exposeSelected: string;
    nextStage: string;
  };
};

export type ZavorthCapabilityActionExposureInput = {
  verifications?: {
    verificationRoot: string;
    verifications: ZavorthCapabilityAdapterVerificationRecord[];
  };
  verificationIds?: string[];
  allVerified?: boolean;
  actor?: string;
};
