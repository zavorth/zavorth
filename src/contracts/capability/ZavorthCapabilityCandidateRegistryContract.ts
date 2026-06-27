import type {
  ZavorthInnovationRadarCategory,
  ZavorthInnovationRadarSnapshot,
} from '../ZavorthInnovationRadarContract.js';

export const ZAVORTH_CAPABILITY_CANDIDATE_REGISTRY_CONTRACT_VERSION = '2026-06-02.capability-candidate-registry.v1' as const;

export type ZavorthCapabilityCandidateStatus =
  | 'observed'
  | 'reviewed'
  | 'prototype_ready'
  | 'archived';

export type ZavorthCapabilityCandidateEvidence = {
  id: string;
  radarCandidateId: string;
  radarGeneratedAt: string;
  reportFile: string | null;
  sourceSignalIds: string[];
  sourceIds: string[];
  noveltyScore: number;
  confidence: number;
  capturedAt: string;
};

export type ZavorthCapabilityCandidateHistoryEntry = {
  id: string;
  at: string;
  actor: string;
  event: 'candidate.registered' | 'candidate.evidence.updated' | 'candidate.transitioned';
  from: ZavorthCapabilityCandidateStatus | null;
  to: ZavorthCapabilityCandidateStatus;
  summary: string;
};

export type ZavorthCapabilityCandidate = {
  id: string;
  radarCandidateId: string;
  title: string;
  summary: string;
  category: ZavorthInnovationRadarCategory;
  tags: string[];
  status: ZavorthCapabilityCandidateStatus;
  noveltyScore: number;
  confidence: number;
  sourceIds: string[];
  evidence: ZavorthCapabilityCandidateEvidence[];
  history: ZavorthCapabilityCandidateHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  nextSafeAction: string;
};

export type ZavorthCapabilityCandidateRegistryReceipt = {
  id: string;
  at: string;
  actor: string;
  operation: 'register' | 'transition';
  status: 'applied' | 'skipped' | 'blocked';
  candidateId: string | null;
  summary: string;
};

export type ZavorthCapabilityCandidateRegistrySnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_CANDIDATE_REGISTRY_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-candidate-registry';
  status: 'ready' | 'attention';
  storeFile: string;
  summary: {
    total: number;
    observed: number;
    reviewed: number;
    prototypeReady: number;
    archived: number;
    receipts: number;
  };
  candidates: ZavorthCapabilityCandidate[];
  receipts: ZavorthCapabilityCandidateRegistryReceipt[];
  safety: {
    registrationExplicitOnly: true;
    radarObservationRequired: true;
    knownCapabilitiesRejected: true;
    atomicPersistence: true;
    secretsRedacted: true;
    noPrototypeCreated: true;
    noCapabilityInstalled: true;
    noToolExposed: true;
    noLiveActivation: true;
  };
  commands: {
    list: string;
    registerAllNew: string;
    registerSelected: string;
    review: string;
    preparePrototype: string;
    nextStage: string;
  };
};

export type ZavorthCapabilityCandidateRegistryRegisterInput = {
  radar: ZavorthInnovationRadarSnapshot;
  candidateIds?: string[];
  allNew?: boolean;
  actor?: string;
};

export type ZavorthCapabilityCandidateRegistryTransitionInput = {
  candidateId: string;
  to: ZavorthCapabilityCandidateStatus;
  actor?: string;
};
