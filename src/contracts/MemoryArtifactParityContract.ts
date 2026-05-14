import type { ZavorthPluginManifest } from './PluginManifestContract.js';

export const ZAVORTH_MEMORY_ARTIFACT_PARITY_CONTRACT_VERSION = '2026-05-04.phase-7';

export type MemoryArtifactParitySurface =
  | 'artifact-ledger'
  | 'artifact-memory-index'
  | 'memory-with-receipts'
  | 'run-artifact-replay'
  | 'hybrid-recall'
  | 'memory-sources'
  | 'persistent-memory'
  | 'memory-history'
  | 'vector-memory'
  | 'workspace-memory'
  | 'session-replay'
  | 'thread-ownership'
  | 'wiki-memory'
  | 'memory-import-export'
  | 'vector-backend-choice';

export type MemoryArtifactParityStatus =
  | 'native'
  | 'artifact-ready'
  | 'ledger-ready'
  | 'backend-ready'
  | 'declared-only'
  | 'template-ready'
  | 'missing'
  | 'decision-required';

export type MemoryArtifactPrimitive =
  | 'artifact.index'
  | 'artifact.memory.index'
  | 'artifact.reuse'
  | 'artifact.receipt'
  | 'memory.receipt'
  | 'memory.recall'
  | 'memory.sources'
  | 'memory.remember'
  | 'memory.history'
  | 'memory.vector.recall'
  | 'memory.workspace'
  | 'session.replay'
  | 'thread.ownership'
  | 'memory.wiki'
  | 'memory.import_export'
  | 'memory.vector.backend';

export type MemoryArtifactEvidence = {
  file: string;
  marker: string;
  present: boolean;
};

export type MemoryArtifactParityEntry = {
  surface: MemoryArtifactParitySurface;
  primitiveId: MemoryArtifactPrimitive;
  status: MemoryArtifactParityStatus;
  summary: string;
  targetFiles: {
    contract: string;
    service: string;
    storage: string;
    surface: string;
    policy: string;
  };
  evidence: MemoryArtifactEvidence[];
  simulation: {
    dryRun: true;
    request: Record<string, unknown>;
    response: Record<string, unknown>;
    receiptKind: string;
  };
  smokeGate: {
    id: string;
    command: string;
    liveMemoryWriteRequired: false;
    filesystemReadRequired: false;
    expected: string;
  };
  findings: string[];
};

export type MemoryArtifactSourceModuleMapping = {
  sourceModule: 'memory-core' | 'active-memory' | 'memory-lancedb' | 'memory-wiki' | 'thread-ownership';
  targetSurface: MemoryArtifactParitySurface;
  primitiveId: MemoryArtifactPrimitive;
  status: MemoryArtifactParityStatus;
  reason: string;
};

export type MemoryArtifactParityDryProof = {
  generatedAt: string;
  artifactMemory: {
    status: string;
    entries: number;
    reusable: number;
    searchReady: boolean;
    citationRequired: boolean;
  };
  memoryWithReceipts: {
    receipts: number;
    allMemoryHasReceipt: boolean;
    sourceQuestionsSupported: boolean;
  };
  runArtifactReplay: {
    status: string;
    frames: number;
    artifactLinks: number;
    replayable: boolean;
    receiptLinked: boolean;
  };
};

export type MemoryArtifactParitySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_MEMORY_ARTIFACT_PARITY_CONTRACT_VERSION;
  summary: {
    surfaces: number;
    native: number;
    artifactReady: number;
    ledgerReady: number;
    backendReady: number;
    declaredOnly: number;
    templateReady: number;
    missing: number;
    decisionRequired: number;
    sourceModulesMapped: number;
    generatedPluginManifests: number;
    liveMemoryWriteRequired: false;
    filesystemReadRequired: false;
    secretValuesSerialized: false;
  };
  entries: MemoryArtifactParityEntry[];
  gaps: MemoryArtifactParityEntry[];
  sourceModules: MemoryArtifactSourceModuleMapping[];
  dryProof: MemoryArtifactParityDryProof;
  generatedPluginManifests: ZavorthPluginManifest[];
  policy: {
    parityIsReadOnly: true;
    artifactContentInvented: false;
    memoryWritePerformed: false;
    filesystemReadPerformed: false;
    promotionRequiresExplicitAction: true;
    reusedArtifactMustCiteOrigin: true;
    secretsSerialized: false;
  };
  nextPhase: {
    id: 'operational-tooling';
    reason: string;
  };
};
