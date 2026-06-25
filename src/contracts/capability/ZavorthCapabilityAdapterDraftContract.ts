import type { IntelligenceCapabilityManifest } from './IntelligenceFabricContract.js';
import type { CapabilityLabSnapshot } from './PracticalAgencyContract.js';
import type { ZavorthCapabilityPrototypeRecord } from './ZavorthCapabilityPrototypeSandboxContract.js';

export const ZAVORTH_CAPABILITY_ADAPTER_DRAFT_CONTRACT_VERSION = '2026-06-02.capability-adapter-draft.v1' as const;

export type ZavorthCapabilityAdapterDraftKind =
  | 'runtime-adapter'
  | 'channel-adapter'
  | 'provider-adapter'
  | 'memory-adapter'
  | 'tool-adapter'
  | 'sandbox-adapter'
  | 'multimodal-adapter'
  | 'workflow-adapter'
  | 'surface-adapter'
  | 'policy-adapter'
  | 'generic-adapter';

export type ZavorthCapabilityAdapterDraftStatus = 'draft_ready' | 'skipped' | 'blocked';

export type ZavorthCapabilityAdapterDraftArtifact = {
  kind: 'adapter-manifest' | 'adapter-policy' | 'adapter-tests' | 'capability-lab-report';
  path: string;
  sha256: string;
};

export type ZavorthCapabilityAdapterDraftRecord = {
  id: string;
  prototypeId: string;
  candidateId: string;
  title: string;
  status: ZavorthCapabilityAdapterDraftStatus;
  adapterKind: ZavorthCapabilityAdapterDraftKind;
  workspaceDir: string;
  createdAt: string;
  updatedAt: string;
  manifest: IntelligenceCapabilityManifest;
  lab: CapabilityLabSnapshot;
  artifacts: ZavorthCapabilityAdapterDraftArtifact[];
  sourcePrototype: Pick<ZavorthCapabilityPrototypeRecord, 'id' | 'candidateId' | 'status' | 'workspaceDir'>;
  nextSafeAction: string;
};

export type ZavorthCapabilityAdapterDraftReceipt = {
  id: string;
  at: string;
  actor: string;
  operation: 'draft-adapter';
  status: 'applied' | 'skipped' | 'blocked';
  prototypeId: string | null;
  adapterDraftId: string | null;
  summary: string;
};

export type ZavorthCapabilityAdapterDraftSnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_ADAPTER_DRAFT_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-adapter-draft';
  status: 'ready' | 'attention';
  storeFile: string;
  adapterRoot: string;
  summary: {
    adapters: number;
    draftReady: number;
    skipped: number;
    blocked: number;
    receipts: number;
  };
  adapters: ZavorthCapabilityAdapterDraftRecord[];
  receipts: ZavorthCapabilityAdapterDraftReceipt[];
  safety: {
    simulatedPrototypesOnly: true;
    adapterDraftOnly: true;
    capabilityLabRequired: true;
    defaultEnabledFalse: true;
    liveAllowedByDefaultFalse: true;
    noCapabilityInstalled: true;
    noToolExposed: true;
    noLiveActivation: true;
    secretsRedacted: true;
  };
  commands: {
    list: string;
    draftAll: string;
    draftSelected: string;
    nextStage: string;
  };
};

export type ZavorthCapabilityAdapterDraftInput = {
  prototypes?: {
    prototypeRoot: string;
    prototypes: ZavorthCapabilityPrototypeRecord[];
  };
  prototypeIds?: string[];
  allPrototypes?: boolean;
  actor?: string;
};
