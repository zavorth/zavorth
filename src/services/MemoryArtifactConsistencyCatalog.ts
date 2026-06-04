import type {
  MemoryArtifactConsistencyEntry,
  MemoryArtifactConsistencySurface,
  MemoryArtifactPrimitive,
} from '../contracts/MemoryArtifactConsistencyContract.js';

export type MemoryArtifactSourceFileKey =
  | 'artifactContract'
  | 'artifactPipeline'
  | 'artifactMemory'
  | 'memoryWithReceipts'
  | 'runArtifactReplay'
  | 'hybridMemoryContract'
  | 'hybridMemoryService'
  | 'memoryService'
  | 'memoryVectorStore'
  | 'memoryWikiService'
  | 'memoryPlane'
  | 'workspaceMemory'
  | 'sessionReplay'
  | 'gatewaySession'
  | 'settingsExport'
  | 'settingsImport';

export type MemoryArtifactSpec = {
  surface: MemoryArtifactConsistencySurface;
  primitiveId: MemoryArtifactPrimitive;
  summary: string;
  targetFiles: MemoryArtifactConsistencyEntry['targetFiles'];
  markers: Array<{
    file: MemoryArtifactSourceFileKey;
    marker: string;
  }>;
  nativeWhenAllPresent?: boolean;
  artifactReadyWhenAllPresent?: boolean;
  ledgerReadyWhenAllPresent?: boolean;
  backendReadyWhenAllPresent?: boolean;
  declaredOnlyWhenAnyPresent?: boolean;
  templateReady?: boolean;
  decisionRequired?: boolean;
};

export const SOURCE_FILE_NAMES: Record<MemoryArtifactSourceFileKey, string> = {
  artifactContract: 'src/contracts/ArtifactContract.ts',
  artifactPipeline: 'src/services/ArtifactPipelineService.ts',
  artifactMemory: 'src/runtime/agent/ArtifactMemoryService.ts',
  memoryWithReceipts: 'src/runtime/agent/MemoryWithReceiptsService.ts',
  runArtifactReplay: 'src/runtime/agent/RunArtifactReceiptReplayService.ts',
  hybridMemoryContract: 'src/contracts/HybridMemoryContract.ts',
  hybridMemoryService: 'src/services/HybridMemoryService.ts',
  memoryService: 'src/services/MemoryService.ts',
  memoryVectorStore: 'src/storage/MemoryVectorStore.ts',
  memoryWikiService: 'src/services/MemoryWikiService.ts',
  memoryPlane: 'src/services/ZavorthMemoryPlaneService.ts',
  workspaceMemory: 'src/runtime/context/WorkspaceOperationalMemoryService.ts',
  sessionReplay: 'src/services/SessionReplayService.ts',
  gatewaySession: 'src/services/GatewaySessionService.ts',
  settingsExport: 'src/ai-gateway/app/api/settings/export-json/route.ts',
  settingsImport: 'src/ai-gateway/app/api/settings/import-json/route.ts',
};

export const SPECS: MemoryArtifactSpec[] = [
  {
    surface: 'artifact-ledger',
    primitiveId: 'artifact.index',
    summary: 'Normalized artifact records, delivery channels, manifests, lifecycle links, and reusable artifact metadata.',
    targetFiles: {
      contract: 'src/contracts/ArtifactContract.ts',
      service: 'src/services/ArtifactPipelineService.ts',
      storage: 'runtime artifact ledger',
      surface: 'CLI, Telegram, Dashboard',
      policy: 'src/security',
    },
    markers: [
      { file: 'artifactContract', marker: 'ArtifactRecord' },
      { file: 'artifactContract', marker: 'ArtifactDeliveryChannel' },
      { file: 'artifactPipeline', marker: 'normalizeArtifacts' },
      { file: 'artifactPipeline', marker: 'buildManifest' },
      { file: 'artifactPipeline', marker: 'buildArtifactLifecycle' },
    ],
    artifactReadyWhenAllPresent: true,
  },
  {
    surface: 'artifact-memory-index',
    primitiveId: 'artifact.memory.index',
    summary: 'Artifact Memory indexes plans, diffs, reports, logs, handoffs, releases, prompts, and run summaries as searchable memory.',
    targetFiles: {
      contract: 'src/runtime/agent/ArtifactMemoryService.ts',
      service: 'src/runtime/agent/ArtifactMemoryService.ts',
      storage: 'run.metadata.artifactMemory',
      surface: 'src/cli/ZavorthCliArtifactMemoryRenderer.ts',
      policy: 'src/security',
    },
    markers: [
      { file: 'artifactMemory', marker: 'ARTIFACT_MEMORY_CONTRACT_VERSION' },
      { file: 'artifactMemory', marker: 'ArtifactMemoryEntry' },
      { file: 'artifactMemory', marker: 'searchableText' },
      { file: 'artifactMemory', marker: 'promotionRequiresExplicitAction' },
      { file: 'artifactMemory', marker: 'reusedArtifactMustCiteOrigin' },
    ],
    nativeWhenAllPresent: true,
  },
  {
    surface: 'memory-with-receipts',
    primitiveId: 'memory.receipt',
    summary: 'Every promoted memory signal can cite its origin, confidence, correction path, and forget path.',
    targetFiles: {
      contract: 'src/runtime/agent/MemoryWithReceiptsService.ts',
      service: 'src/runtime/agent/MemoryWithReceiptsService.ts',
      storage: 'run.metadata.memoryWithReceipts',
      surface: 'src/cli/ZavorthCliMemoryWithReceiptsRenderer.ts',
      policy: 'src/security',
    },
    markers: [
      { file: 'memoryWithReceipts', marker: 'MEMORY_WITH_RECEIPTS_CONTRACT_VERSION' },
      { file: 'memoryWithReceipts', marker: 'MemoryWithReceipt' },
      { file: 'memoryWithReceipts', marker: 'allMemoryHasReceipt' },
      { file: 'memoryWithReceipts', marker: 'canForgetOrCorrect' },
      { file: 'memoryWithReceipts', marker: 'noMemoryInvented' },
    ],
    nativeWhenAllPresent: true,
  },
  {
    surface: 'run-artifact-replay',
    primitiveId: 'artifact.receipt',
    summary: 'Run replay links events, artifacts, approvals, feature snapshots, memory receipts, and artifact receipts without re-executing tools.',
    targetFiles: {
      contract: 'src/runtime/agent/RunArtifactReceiptReplayService.ts',
      service: 'src/runtime/agent/RunArtifactReceiptReplayService.ts',
      storage: 'run observatory receipts',
      surface: 'src/cli/ZavorthCliRunArtifactReceiptReplayRenderer.ts',
      policy: 'src/security',
    },
    markers: [
      { file: 'runArtifactReplay', marker: 'RUN_ARTIFACT_RECEIPT_REPLAY_CONTRACT_VERSION' },
      { file: 'runArtifactReplay', marker: 'RunArtifactReceiptReplayFrame' },
      { file: 'runArtifactReplay', marker: 'artifactLinks' },
      { file: 'runArtifactReplay', marker: 'replayUsesReceiptsOnly' },
      { file: 'runArtifactReplay', marker: 'artifactsMustCiteOrigin' },
    ],
    nativeWhenAllPresent: true,
  },
  {
    surface: 'hybrid-recall',
    primitiveId: 'memory.recall',
    summary: 'Hybrid recall merges authoritative ledger sources with vector recall support under a context budget.',
    targetFiles: {
      contract: 'src/contracts/HybridMemoryContract.ts',
      service: 'src/services/HybridMemoryService.ts',
      storage: 'src/storage/MemoryVectorStore.ts',
      surface: '/api/web/memory/recall',
      policy: 'src/security',
    },
    markers: [
      { file: 'hybridMemoryContract', marker: 'HYBRID_MEMORY_CONTRACT_VERSION' },
      { file: 'hybridMemoryService', marker: 'previewRecall' },
      { file: 'hybridMemoryService', marker: 'ledgerAuthoritative' },
      { file: 'hybridMemoryService', marker: 'searchSemantic' },
      { file: 'hybridMemoryService', marker: 'MemoryVectorStore' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'memory-sources',
    primitiveId: 'memory.sources',
    summary: 'Memory source inventory separates session ledger, layered memory, artifacts, and vector recall.',
    targetFiles: {
      contract: 'src/contracts/HybridMemoryContract.ts',
      service: 'src/services/HybridMemoryService.ts',
      storage: 'memory plane and vector store',
      surface: '/api/web/memory/sources',
      policy: 'src/security',
    },
    markers: [
      { file: 'hybridMemoryContract', marker: 'HybridMemorySourcesResult' },
      { file: 'hybridMemoryService', marker: 'listSources' },
      { file: 'hybridMemoryService', marker: 'ledger:session' },
      { file: 'hybridMemoryService', marker: 'ledger:artifact' },
      { file: 'hybridMemoryService', marker: 'recall:vector' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'persistent-memory',
    primitiveId: 'memory.remember',
    summary: 'Persistent memory supports remember, recall, relevant search, auto extraction, and explicit forget.',
    targetFiles: {
      contract: 'src/services/MemoryService.ts',
      service: 'src/services/MemoryService.ts',
      storage: 'user_memory and user_memory_history',
      surface: 'CLI, Web API, runtime context',
      policy: 'src/security',
    },
    markers: [
      { file: 'memoryService', marker: 'remember(' },
      { file: 'memoryService', marker: 'recall(' },
      { file: 'memoryService', marker: 'listRelevant' },
      { file: 'memoryService', marker: 'autoExtract' },
      { file: 'memoryService', marker: 'forget(' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'memory-history',
    primitiveId: 'memory.history',
    summary: 'Memory history preserves superseded and forgotten facts so changed facts remain visible instead of overwritten silently.',
    targetFiles: {
      contract: 'src/services/MemoryService.ts',
      service: 'src/services/ZavorthMemoryPlaneService.ts',
      storage: 'user_memory_history',
      surface: '/dashboard memory plane',
      policy: 'src/security',
    },
    markers: [
      { file: 'memoryService', marker: 'user_memory_history' },
      { file: 'memoryService', marker: 'archiveEntry' },
      { file: 'memoryService', marker: 'listHistoricalRelevant' },
      { file: 'memoryPlane', marker: 'changedFacts' },
      { file: 'memoryPlane', marker: 'timeline.conflicts' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'vector-memory',
    primitiveId: 'memory.vector.recall',
    summary: 'Compressed memory chunks can be searched by keyword or semantic vector with SQLite/JSON fallback storage.',
    targetFiles: {
      contract: 'src/runtime/sessions/v2/InfiniteMemoryCompressor.ts',
      service: 'src/storage/MemoryVectorStore.ts',
      storage: 'data/memory/memory_vectors.sqlite',
      surface: 'HybridMemoryService',
      policy: 'src/security',
    },
    markers: [
      { file: 'memoryVectorStore', marker: 'MemoryVectorStore' },
      { file: 'memoryVectorStore', marker: 'searchSemantic' },
      { file: 'memoryVectorStore', marker: 'better-sqlite3' },
      { file: 'memoryVectorStore', marker: 'fallbackPath' },
      { file: 'memoryVectorStore', marker: 'embedding_json' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'workspace-memory',
    primitiveId: 'memory.workspace',
    summary: 'Workspace operational memory links artifacts, workflows, recommendations, and continuity summaries.',
    targetFiles: {
      contract: 'src/runtime/context/WorkspaceOperationalMemoryService.ts',
      service: 'src/services/ZavorthMemoryPlaneService.ts',
      storage: 'workspace operational memory',
      surface: '/dashboard memory plane',
      policy: 'src/security',
    },
    markers: [
      { file: 'memoryPlane', marker: 'WorkspaceOperationalMemoryService' },
      { file: 'memoryPlane', marker: 'workspaceSignals' },
      { file: 'memoryPlane', marker: 'workflowRecommendations' },
      { file: 'memoryPlane', marker: 'continuityRecommendations' },
      { file: 'memoryPlane', marker: 'recentArtifacts' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'session-replay',
    primitiveId: 'session.replay',
    summary: 'Session replay turns tasks, permissions, workflows, artifacts, lifecycle, and handoff into resumable context.',
    targetFiles: {
      contract: 'src/services/SessionReplayService.ts',
      service: 'src/services/GatewaySessionService.ts',
      storage: 'GatewaySessionLedgerService',
      surface: 'Dashboard and CLI',
      policy: 'src/security',
    },
    markers: [
      { file: 'sessionReplay', marker: 'SessionReplaySnapshot' },
      { file: 'sessionReplay', marker: 'recentArtifacts' },
      { file: 'sessionReplay', marker: 'recommendedEntry' },
      { file: 'sessionReplay', marker: 'buildReplayLifecycle' },
      { file: 'gatewaySession', marker: 'replay' },
    ],
    nativeWhenAllPresent: true,
  },
  {
    surface: 'thread-ownership',
    primitiveId: 'thread.ownership',
    summary: 'Session ownership and thread identity keep memory scoped by user, channel, platform, chat, source user, and pinned metadata.',
    targetFiles: {
      contract: 'src/services/GatewaySessionService.ts',
      service: 'src/services/GatewaySessionService.ts',
      storage: 'GatewaySessionLedgerService',
      surface: 'session list and Dashboard',
      policy: 'src/security',
    },
    markers: [
      { file: 'gatewaySession', marker: 'runtimeUserId' },
      { file: 'gatewaySession', marker: 'sourceUserId' },
      { file: 'gatewaySession', marker: 'readSessionMetadata' },
      { file: 'gatewaySession', marker: 'patchSessionMetadata' },
      { file: 'gatewaySession', marker: 'pinned' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'wiki-memory',
    primitiveId: 'memory.wiki',
    summary: 'Wiki/knowledge memory is a Zavorth-native page/search runtime with receipts and artifact-linked source references.',
    targetFiles: {
      contract: 'src/contracts/HybridMemoryContract.ts',
      service: 'src/services/MemoryWikiService.ts',
      storage: 'memory wiki page store',
      surface: 'memory wiki service',
      policy: 'src/security',
    },
    markers: [
      { file: 'hybridMemoryContract', marker: 'MEMORY_WIKI_CAPABILITY_ID' },
      { file: 'hybridMemoryContract', marker: 'MemoryWikiUpsertRequest' },
      { file: 'hybridMemoryContract', marker: 'MemoryWikiSearchResult' },
      { file: 'memoryWikiService', marker: 'MemoryWikiService' },
      { file: 'memoryWikiService', marker: 'upsertPage' },
      { file: 'memoryWikiService', marker: 'searchPages' },
      { file: 'memoryWikiService', marker: 'receiptId' },
    ],
    backendReadyWhenAllPresent: true,
  },
  {
    surface: 'memory-import-export',
    primitiveId: 'memory.import_export',
    summary: 'Settings import/export routes exist, but dedicated memory import/export still needs a memory-scoped contract.',
    targetFiles: {
      contract: 'src/contracts/MemoryArtifactConsistencyContract.ts',
      service: 'src/services/MemoryArtifactConsistencyService.ts',
      storage: 'future memory portable bundle',
      surface: 'settings import/export and CLI',
      policy: 'src/security',
    },
    markers: [
      { file: 'settingsExport', marker: 'export' },
      { file: 'settingsImport', marker: 'import' },
      { file: 'memoryService', marker: 'listAll' },
      { file: 'memoryService', marker: 'remember(' },
      { file: 'memoryService', marker: 'forget(' },
    ],
    declaredOnlyWhenAnyPresent: true,
  },
  {
    surface: 'vector-backend-choice',
    primitiveId: 'memory.vector.backend',
    summary: 'Vector backend decision is signed to the existing MemoryVectorStore with SQLite/JSON fallback.',
    targetFiles: {
      contract: 'src/storage/MemoryVectorStore.ts',
      service: 'src/services/HybridMemoryService.ts',
      storage: 'MemoryVectorStore',
      surface: 'HybridMemoryService',
      policy: 'src/security',
    },
    markers: [
      { file: 'memoryVectorStore', marker: 'MemoryVectorStore' },
      { file: 'memoryVectorStore', marker: 'SQLite-backed' },
      { file: 'memoryVectorStore', marker: 'JSON file store' },
    ],
    backendReadyWhenAllPresent: true,
  },
];

