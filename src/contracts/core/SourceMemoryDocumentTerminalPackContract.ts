export const ZAVORTH_SOURCE_MEMORY_DOCUMENT_TERMINAL_PACK_CONTRACT_VERSION = '2026-05-05.checkpoint-5' as const;

export const SOURCE_MEMORY_DOCUMENT_TERMINAL_PACKAGES = [
  '@source/memory-host-sdk',
  'sqlite-vec',
  'pdfjs-dist',
  '@mozilla/readability',
  'jsdom',
  'node-pty',
  '@lydell/node-pty',
  'tree-sitter-bash',
  'web-tree-sitter',
  'duck-duck-scrape',
  'proxy-agent',
  'https-proxy-agent',
  'undici',
] as const;

export type SourceMemoryDocumentTerminalPackageName =
  typeof SOURCE_MEMORY_DOCUMENT_TERMINAL_PACKAGES[number];

export type SourceStage5Decision =
  | 'implemented'
  | 'implemented-zavorth-native'
  | 'implemented-optional-runtime'
  | 'replaced-by-existing-zavorth-capability'
  | 'owner-gated'
  | 'not-needed';

export type MemoryKnowledgeBackendId =
  | 'sqlite-vec-memory-backend'
  | 'sqlite-vector-concept-backend'
  | 'json-fallback-memory-backend';

export type MemoryKnowledgeRecord = {
  id: string;
  namespace: string;
  text: string;
  metadata: Record<string, unknown>;
  keywords: string[];
  vector: number[];
  vectorHash: string;
  createdAt: string;
};

export type MemoryAtRestEncryptionMode = 'field' | 'field+file' | 'json-field';

export type MemoryFullFileEncryptionStatus =
  | 'off'
  | 'active'
  | 'unavailable'
  | 'required-unavailable'
  | 'unverified';

export type MemoryKnowledgeWriteReceipt = {
  id: string;
  status: 'applied' | 'blocked';
  backendId: MemoryKnowledgeBackendId;
  recordId: string | null;
  namespace: string;
  vectorDimensions: number;
  sqliteVecExtensionLoaded: boolean;
  atRestEncrypted: true;
  atRestEncryptionMode: MemoryAtRestEncryptionMode;
  fullFileEncrypted: boolean;
  fullFileEncryptionStatus: MemoryFullFileEncryptionStatus;
  artifactFirst: true;
  replayable: true;
  liveIoPerformed: false;
  secretValuesSerialized: false;
  reason: string;
};

export type MemoryKnowledgeQueryResult = {
  recordId: string;
  namespace: string;
  text: string;
  score: number;
  keywords: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type MemoryKnowledgeQueryReceipt = {
  id: string;
  status: 'applied' | 'blocked';
  backendId: MemoryKnowledgeBackendId;
  namespace: string;
  query: string;
  resultRecordIds: string[];
  topScore: number;
  atRestEncrypted: true;
  atRestEncryptionMode: MemoryAtRestEncryptionMode;
  fullFileEncrypted: boolean;
  fullFileEncryptionStatus: MemoryFullFileEncryptionStatus;
  artifactFirst: true;
  replayable: true;
  liveIoPerformed: false;
  secretValuesSerialized: false;
  reason: string;
};

export type DocumentExtractionKind = 'pdf' | 'html' | 'text';

export type DocumentExtractionArtifact = {
  id: string;
  kind: DocumentExtractionKind;
  sourceName: string;
  mimeType: string;
  title: string | null;
  text: string;
  excerpt: string;
  metadata: Record<string, unknown>;
  producedAt: string;
  receiptId: string;
  secretValuesSerialized: false;
};

export type DocumentExtractionReceipt = {
  id: string;
  status: 'artifact-created' | 'blocked' | 'failed';
  kind: DocumentExtractionKind;
  artifactId: string | null;
  parser: string;
  bytes: number;
  artifactFirst: true;
  replayable: true;
  liveIoPerformed: false;
  secretValuesSerialized: false;
  reason: string;
};

export type ProxyRoutingPolicyReceipt = {
  status: 'configured' | 'not-configured';
  proxyRefs: string[];
  noProxyRefPresent: boolean;
  rawProxyValuesSerialized: false;
};

export type SearchFetchReceipt = {
  id: string;
  status: 'simulated' | 'fetched' | 'blocked' | 'failed';
  mode: 'search' | 'fetch';
  query: string | null;
  url: string | null;
  resultCount: number;
  proxyPolicy: ProxyRoutingPolicyReceipt;
  artifactFirst: true;
  liveNetworkPerformed: boolean;
  secretValuesSerialized: false;
  reason: string;
};

export type ShellSafetyLevel = 'safe' | 'attention' | 'dangerous' | 'blocked';

export type ShellSafetyReceipt = {
  id: string;
  command: string;
  level: ShellSafetyLevel;
  approvalRequired: boolean;
  blocked: boolean;
  cwdAllowed: boolean;
  hazards: string[];
  shellParser: 'zavorth-token-classifier' | 'tree-sitter-bash-available';
  treeSitterAvailable: boolean;
  reason: string;
};

export type GovernedTerminalReceipt = {
  id: string;
  status: 'applied' | 'blocked' | 'failed';
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  approvalId: string | null;
  ptyRequested: boolean;
  ptyAvailable: boolean;
  liveProcessSpawned: boolean;
  artifactFirst: true;
  secretValuesSerialized: false;
  classification: ShellSafetyReceipt;
  reason: string;
};

export type Stage5PackageEvidence = {
  packageName: SourceMemoryDocumentTerminalPackageName;
  presentInSource: boolean;
  presentInZavorthPackageJson: boolean;
  presentInZavorthLockfile: boolean;
  sourceReferenceFiles: string[];
  zavorthReferenceFiles: string[];
  decision: SourceStage5Decision;
};

export type SourceMemoryDocumentTerminalPackSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_MEMORY_DOCUMENT_TERMINAL_PACK_CONTRACT_VERSION;
  status: 'passed' | 'failed';
  gate: 'source-memory-document-terminal-pack';
  statement: 'Source memory, document, search and terminal behavior is absorbed as governed Zavorth-native runtimes with artifact-first receipts.';
  sourceRoot: string;
  zavorthRoot: string;
  packageEvidence: Stage5PackageEvidence[];
  memory: {
    backendId: MemoryKnowledgeBackendId;
    writeReceipt: MemoryKnowledgeWriteReceipt;
    queryReceipt: MemoryKnowledgeQueryReceipt;
    resultCount: number;
  };
  documents: {
    artifacts: DocumentExtractionArtifact[];
    receipts: DocumentExtractionReceipt[];
  };
  search: {
    receipts: SearchFetchReceipt[];
  };
  terminal: {
    shellSafetyReceipts: ShellSafetyReceipt[];
    terminalReceipts: GovernedTerminalReceipt[];
  };
  summary: {
    packagesTracked: number;
    packagesPresentInSource: number;
    packagesImplementedInZavorth: number;
    memoryReceipts: number;
    documentArtifacts: number;
    searchReceipts: number;
    terminalReceipts: number;
    dangerousCommandsBlocked: number;
    liveNetworkPerformed: false;
    liveProcessSpawnedByDefault: false;
    secretValuesSerialized: false;
  };
  policy: {
    noSourceSourceCopy: true;
    artifactFirstReceipts: true;
    memoryWriteReadReplayable: true;
    pdfAndHtmlExtractionProduceArtifacts: true;
    terminalDisabledUntilPolicyAllows: true;
    dangerousShellRequiresApproval: true;
    scopedCwdRootsRequired: true;
    proxyValuesAreRefsOnly: true;
    liveNetworkRequiresExplicitCommand: true;
  };
  commands: {
    inspect: 'npm run source-memory-document-terminal-pack --silent';
    inspectJson: 'npm run source-memory-document-terminal-pack:json --silent';
    check: 'npm run source-memory-document-terminal-pack:check --silent';
    qa: 'npm run qa:source-memory-document-terminal-pack --silent';
    liveFetch: 'npm run source-memory-document-terminal-pack -- --fetch <url> --confirm-live-network';
    terminalSmoke: 'npm run source-memory-document-terminal-pack -- --terminal <command> --cwd <path> --approval-id <id>';
    nextStage: 'Runtime gateway - Native Companion And Device Capability Pack';
  };
};
