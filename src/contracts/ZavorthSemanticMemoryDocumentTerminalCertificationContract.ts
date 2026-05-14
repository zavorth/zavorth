import type {
  DocumentExtractionKind,
  MemoryKnowledgeBackendId,
  ShellSafetyLevel,
  SourceMemoryDocumentTerminalPackSnapshot,
  SourceMemoryDocumentTerminalPackageName,
} from './SourceMemoryDocumentTerminalPackContract.js';

export const ZAVORTH_SEMANTIC_MEMORY_DOCUMENT_TERMINAL_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.semantic-s5' as const;

export type ZavorthSemanticMemoryDocumentTerminalCertificationStatus =
  | 'passed'
  | 'failed';

export type ZavorthSemanticMemoryDocumentTerminalClaimKind =
  | 'package-coverage'
  | 'memory-runtime'
  | 'document-extraction'
  | 'search-fetch-policy'
  | 'proxy-policy'
  | 'shell-safety-policy'
  | 'terminal-runtime'
  | 'cwd-sandbox'
  | 'optional-runtime-policy'
  | 'live-io-policy'
  | 'receipt-policy'
  | 'unsafe-operation-policy';

export type ZavorthSemanticMemoryDocumentTerminalClaimStatus =
  | 'covered'
  | 'replaced'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticMemoryDocumentTerminalClaimPriority =
  | 'P0'
  | 'P1'
  | 'P2';

export type ZavorthSemanticMemoryDocumentTerminalClaim = {
  id: string;
  kind: ZavorthSemanticMemoryDocumentTerminalClaimKind;
  status: ZavorthSemanticMemoryDocumentTerminalClaimStatus;
  priority: ZavorthSemanticMemoryDocumentTerminalClaimPriority;
  packageName?: SourceMemoryDocumentTerminalPackageName;
  backendId?: MemoryKnowledgeBackendId;
  documentKind?: DocumentExtractionKind;
  shellSafetyLevel?: ShellSafetyLevel;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds: string[];
  notes: string[];
};

export type ZavorthSemanticMemoryDocumentTerminalScenario = {
  id: 'memory-write-query' | 'blocked-live-fetch-without-confirm' | 'blocked-terminal-without-policy' | 'blocked-dangerous-command';
  status: 'passed' | 'failed';
  evidence: string[];
  liveNetworkPerformed: boolean;
  liveProcessSpawned: boolean;
  secretValuesSerialized: false;
};

export type ZavorthSemanticMemoryDocumentTerminalCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_MEMORY_DOCUMENT_TERMINAL_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthSemanticMemoryDocumentTerminalCertificationStatus;
  semanticPhase: 'S5';
  statement: 'Memory, document, search and terminal semantics are certified as governed Zavorth-native runtimes with replayable artifact-first receipts.';
  sourceRoot: string;
  zavorthRoot: string;
  packStatus: SourceMemoryDocumentTerminalPackSnapshot['status'];
  packContractVersion: SourceMemoryDocumentTerminalPackSnapshot['contractVersion'];
  claims: ZavorthSemanticMemoryDocumentTerminalClaim[];
  scenarios: ZavorthSemanticMemoryDocumentTerminalScenario[];
  summary: {
    semanticClaims: number;
    covered: number;
    replaced: number;
    ownerGated: number;
    rejected: number;
    gaps: number;
    p0Claims: number;
    p1Claims: number;
    p2Claims: number;
    receiptBackedClaims: number;
    packagesCertified: number;
    memoryClaimsCertified: number;
    documentClaimsCertified: number;
    searchClaimsCertified: number;
    shellSafetyClaimsCertified: number;
    terminalClaimsCertified: number;
    scenariosPassed: number;
    liveNetworkPerformed: false;
    liveProcessSpawnedByDefault: false;
    secretValuesSerialized: false;
    sourceCodeCopied: false;
  };
  policy: {
    semanticClaimRequiredForEveryPackage: true;
    artifactFirstReceipts: true;
    memoryWriteReadReplayable: true;
    documentExtractionProducesArtifacts: true;
    searchAndFetchLiveNetworkRequiresExplicitCommand: true;
    proxyValuesAreRefsOnly: true;
    terminalDisabledUntilPolicyAllows: true;
    dangerousShellRequiresApproval: true;
    scopedCwdRootsRequired: true;
    ptyIsOptionalRuntimeOnly: true;
    noLiveIoDuringCertification: true;
    rawSecretValuesRejected: true;
    unsafeShellBypassRejected: true;
    noSourceSourceCopy: true;
    gapsBlockRelease: true;
  };
  commands: {
    inspect: 'npm run semantic-memory-document-terminal-certification --silent';
    inspectJson: 'npm run semantic-memory-document-terminal-certification:json --silent';
    check: 'npm run semantic-memory-document-terminal-certification:check --silent';
    qa: 'npm run qa:semantic-memory-document-terminal-certification --silent';
    nextPhase: 'S6 - Native Companion And Device Capability Semantics';
  };
};
