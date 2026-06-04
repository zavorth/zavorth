import type { SandboxExecutionReceipt } from './SandboxExecutionReceiptContract.js';
import type { ZavorthCapabilityCandidate } from './ZavorthCapabilityCandidateRegistryContract.js';

export const ZAVORTH_CAPABILITY_PROTOTYPE_SANDBOX_CONTRACT_VERSION = '2026-06-02.capability-prototype-sandbox.v1' as const;

export type ZavorthCapabilityPrototypeStatus = 'simulated' | 'skipped' | 'blocked';

export type ZavorthCapabilityPrototypeArtifact = {
  kind: 'manifest' | 'notes' | 'sandbox-receipt';
  path: string;
  sha256: string;
};

export type ZavorthCapabilityPrototypeRecord = {
  id: string;
  candidateId: string;
  title: string;
  status: ZavorthCapabilityPrototypeStatus;
  workspaceDir: string;
  createdAt: string;
  updatedAt: string;
  artifacts: ZavorthCapabilityPrototypeArtifact[];
  sandboxReceipt: SandboxExecutionReceipt;
  evidence: {
    candidateStatusAtPrototype: ZavorthCapabilityCandidate['status'];
    candidateEvidenceCount: number;
    sourceIds: string[];
  };
  nextSafeAction: string;
};

export type ZavorthCapabilityPrototypeReceipt = {
  id: string;
  at: string;
  actor: string;
  operation: 'prototype';
  status: 'applied' | 'skipped' | 'blocked';
  candidateId: string | null;
  prototypeId: string | null;
  summary: string;
};

export type ZavorthCapabilityPrototypeSandboxSnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_PROTOTYPE_SANDBOX_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-prototype-sandbox';
  status: 'ready' | 'attention';
  storeFile: string;
  prototypeRoot: string;
  summary: {
    prototypes: number;
    simulated: number;
    skipped: number;
    blocked: number;
    receipts: number;
  };
  prototypes: ZavorthCapabilityPrototypeRecord[];
  receipts: ZavorthCapabilityPrototypeReceipt[];
  safety: {
    prototypeReadyCandidatesOnly: true;
    sandboxWorkspaceOnly: true;
    previewOnlyFallbackByDefault: true;
    hostWorkspaceUntouched: true;
    noCapabilityInstalled: true;
    noToolExposed: true;
    noLiveActivation: true;
    secretsRedacted: true;
  };
  commands: {
    list: string;
    prototypeAllReady: string;
    prototypeSelected: string;
    nextStage: string;
  };
};

export type ZavorthCapabilityPrototypeSandboxRunInput = {
  registry?: {
    candidates: ZavorthCapabilityCandidate[];
  };
  candidateIds?: string[];
  allReady?: boolean;
  actor?: string;
};
