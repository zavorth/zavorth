export const HYBRID_MEMORY_CONTRACT_VERSION = 'hybrid-memory-v1' as const;

export const HYBRID_MEMORY_DEFAULT_TOP_K = 8;
export const HYBRID_MEMORY_DEFAULT_CONTEXT_TOKEN_BUDGET = 2000;

export type HybridMemoryRecallMode = 'ledger_only' | 'hybrid';

export type HybridMemoryEmbeddingStatus =
  | 'not_configured'
  | 'not_requested'
  | 'ready'
  | 'failed';

export type HybridMemorySourceType = 'ledger' | 'recall';

export type HybridMemorySourceKind =
  | 'session'
  | 'workspace'
  | 'artifact'
  | 'selfmod'
  | 'procedure'
  | 'memory'
  | 'vector';

export type HybridMemoryRecallInput = {
  sessionId: string;
  chatId?: string | null;
  userId?: string | null;
  sourceUserId?: string | null;
  platform?: string | null;
  workspaceHint?: string | null;
  query?: string | null;
  limit?: number | null;
  contextTokenBudget?: number | null;
};

export type HybridMemoryRecallSource = {
  id: string;
  type: HybridMemorySourceType;
  kind: HybridMemorySourceKind;
  label: string;
  summary: string;
  source: string;
  score: number;
  reason: string;
  lastValidatedAt: string | null;
  metadata: Record<string, unknown>;
};

export type HybridMemoryRecallResult = {
  ok: true;
  contractVersion: typeof HYBRID_MEMORY_CONTRACT_VERSION;
  generatedAt: string;
  sessionId: string;
  query: string;
  mode: HybridMemoryRecallMode;
  embeddingStatus: HybridMemoryEmbeddingStatus;
  budget: {
    topK: number;
    contextTokenBudget: number;
    estimatedTokens: number;
  };
  summary: {
    total: number;
    ledger: number;
    recall: number;
    returned: number;
    ledgerAuthoritative: boolean;
  };
  sources: HybridMemoryRecallSource[];
  context: string;
  warnings: string[];
  commands: {
    preview: 'memory.recall.preview';
    sources: 'memory.sources.list';
    httpPreview: '/api/web/memory/recall';
    httpSources: '/api/web/memory/sources';
  };
};

export type HybridMemorySourceInventoryItem = {
  id: string;
  type: HybridMemorySourceType;
  kind: HybridMemorySourceKind;
  label: string;
  status: 'available' | 'empty' | 'unavailable';
  count: number;
  reason: string;
};

export type HybridMemorySourcesResult = {
  ok: true;
  contractVersion: typeof HYBRID_MEMORY_CONTRACT_VERSION;
  generatedAt: string;
  sessionId: string;
  sources: HybridMemorySourceInventoryItem[];
  warnings: string[];
};

export const MEMORY_WIKI_CAPABILITY_ID = 'memory.wiki' as const;

export type MemoryWikiPageStatus = 'draft' | 'published' | 'archived';

export type MemoryWikiPageRef = {
  pageId: string;
  title: string;
  slug: string;
  status: MemoryWikiPageStatus;
  updatedAt: string;
};

export type MemoryWikiUpsertRequest = {
  title: string;
  body: string;
  tags?: string[];
  sourceArtifactIds?: string[];
  sessionId?: string | null;
  correlationId?: string | null;
};

export type MemoryWikiUpsertResult = {
  ok: boolean;
  contractVersion: typeof HYBRID_MEMORY_CONTRACT_VERSION;
  page: MemoryWikiPageRef | null;
  receiptId: string;
  processedAt: string;
  error: string | null;
};

export type MemoryWikiSearchRequest = {
  query: string;
  limit?: number;
  sessionId?: string | null;
};

export type MemoryWikiSearchResult = {
  ok: boolean;
  contractVersion: typeof HYBRID_MEMORY_CONTRACT_VERSION;
  pages: MemoryWikiPageRef[];
  receiptId: string;
  processedAt: string;
};
