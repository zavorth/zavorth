export type SessionDTO = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  status: 'active' | 'archived' | 'error';
  tags?: string[];
  tenantId?: string;
};

export type SessionListDTO = {
  data: SessionDTO[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
};

export type GatewayStatusDTO = {
  version: string;
  status: 'ready' | 'starting' | 'error' | 'maintenance';
  uptime: number;
  environment: 'development' | 'production' | 'test';
};

export type GatewayDomainDTO = {
  id: string;
  label: string;
  initialized: boolean;
  initializedAt: string | null;
  summary?: string;
  metrics?: Record<string, unknown>;
};

export type GatewayDomainListDTO = {
  generatedAt: string;
  summary: {
    total: number;
    initialized: number;
    pending: number;
  };
  domains: GatewayDomainDTO[];
};

export type NodeDTO = {
  id: string;
  status: 'online' | 'offline' | 'pairing';
  lastSeen: string;
  identity: {
    arch: string;
    osRelease: string;
    deviceModel?: string;
    networkType?: string;
    locationLabel?: string;
  };
  capabilities: string[];
};

export type NodeListDTO = {
  data: NodeDTO[];
  total: number;
};

export type TransportDTO = {
  id: string;
  type: string;
  status: 'connected' | 'disconnected' | 'degraded';
  remoteUrl?: string;
  lastPing?: string;
};

export type ArtifactDTO = {
  id: string;
  sessionId: string;
  type: string;
  createdAt: string;
  title: string;
  metadata?: Record<string, unknown>;
  contentUri: string;
};

export type PluginDTO = {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  status: 'installed' | 'active' | 'error';
};

export type PlatformStatusDTO = {
  registryConnected: boolean;
  lastSync?: string;
  plugins: PluginDTO[];
  summary?: {
    total: number;
    plugins: number;
    skills: number;
    mcps: number;
    collections?: number;
    recipes?: number;
    reviewPending?: number;
    quarantined?: number;
    learnedLocal?: number;
  };
  items?: Array<Record<string, unknown>>;
};

export type PlatformCatalogCollectionDTO = {
  id: string;
  label: string;
  source: string;
  summary: string;
  actionHint: string;
  featured: boolean;
  itemCount: number;
  readyCount: number;
  adoptedCount: number;
  missingCount: number;
  kinds: Array<'plugin' | 'skill' | 'mcp'>;
  tags: string[];
  capabilities: string[];
  entryIds: string[];
};

export type PlatformCatalogRecipeDTO = {
  id: string;
  label: string;
  source: string;
  summary: string;
  actionHint: string;
  featured: boolean;
  itemCount: number;
  readyCount: number;
  adoptedCount: number;
  missingCount: number;
  tags: string[];
  steps: string[];
  targetIds: string[];
};

export type PlatformCatalogDTO = {
  generatedAt: string;
  selectedId?: string;
  query?: string;
  sync: {
    status: string;
    summary: string;
    sourceTrusted: boolean;
    stale: boolean;
    entryCount: number;
    collectionCount: number;
    recipeCount: number;
    checkedAt?: string;
    syncedAt?: string;
  };
  summary: NonNullable<PlatformStatusDTO['summary']> & {
    collections: number;
    featuredCollections: number;
    recipes: number;
    featuredRecipes: number;
    ready: number;
    partial: number;
    planned: number;
    disabled: number;
    catalogBacked: number;
    discoveryOnly: number;
    featured: number;
    official: number;
    trustedThirdParty: number;
  };
  items: Array<Record<string, unknown>>;
  collections: PlatformCatalogCollectionDTO[];
  recipes: PlatformCatalogRecipeDTO[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type OpsHealthDTO = {
  healthy: boolean;
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  components: {
    database: 'ok' | 'error';
    eventBus: 'ok' | 'error';
  };
};

export type ArtifactListDTO = {
  data: ArtifactDTO[];
};

export type TransportListDTO = {
  data: TransportDTO[];
};

export type LearningCandidateDTO = {
  id: string;
  platformEntryId: string;
  title: string;
  kind: 'skill' | 'recipe' | 'playbook';
  summary: string;
  score: number;
  reviewState: 'pending' | 'approved' | 'rejected';
  lifecycle: 'learned_draft' | 'trusted_local' | 'published' | 'quarantined';
  createdAt: string;
  updatedAt: string;
  lastValidatedAt: string;
  source: Record<string, unknown>;
  steps: string[];
  details: string[];
};

export type LearningStatusDTO = {
  generatedAt: string;
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    promoted: number;
    published: number;
    quarantined: number;
    highConfidence: number;
  };
};

export type LearningCandidatesDTO = LearningStatusDTO & {
  data: LearningCandidateDTO[];
};

export type LearningMetricsDTO = {
  generatedAt: string;
  summary: {
    totalCandidates: number;
    acceptedRate: number;
    rejectedRate: number;
    promotedRate: number;
    averageScore: number;
  };
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    promoted: number;
    published: number;
    quarantined: number;
    highConfidence: number;
  };
};

export type LearningPlaneDTO = LearningStatusDTO & {
  narrative: {
    headline: string;
    operatorSummary: string;
  };
  candidates: LearningCandidateDTO[];
};

export type LearningActionExecutionDTO = {
  generatedAt: string;
  candidateId: string;
  actionId: 'approve' | 'reject' | 'promote';
  status: 'applied' | 'blocked' | 'noop';
  ok: boolean;
  summary: string;
  details: string[];
  snapshot: LearningPlaneDTO;
};

export type LayeredMemoryStatusDTO = {
  generatedAt: string;
  summary: {
    total: number;
    episodic: number;
    semantic: number;
    procedural: number;
  };
  budgets: {
    perLayer: number;
    episodicUsage: number;
    semanticUsage: number;
    proceduralUsage: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type LayeredMemorySearchEntryDTO = {
  id: string;
  label: string;
  summary: string;
  memoryLayer: 'episodic' | 'semantic' | 'procedural';
  source: string;
  confidence: number;
  lastValidatedAt: string | null;
  metadata?: Record<string, unknown>;
};

export type LayeredMemorySearchDTO = {
  generatedAt: string;
  query: string;
  total: number;
  data: LayeredMemorySearchEntryDTO[];
};

export type LayeredMemoryProcedureDTO = {
  generatedAt: string;
  total: number;
  data: Array<LayeredMemorySearchEntryDTO & { steps: string[] }>;
};

export type LayeredMemoryMetricsDTO = {
  generatedAt: string;
  summary: {
    totalEntries: number;
    episodic: number;
    semantic: number;
    procedural: number;
    averageBudgetUsage: number;
    pressure: 'ok' | 'elevated' | 'critical';
  };
  budgets: LayeredMemoryStatusDTO['budgets'];
  procedures: {
    total: number;
    trustedLocal: number;
    learnedDraft: number;
    implicit: number;
  };
};

export type OpsQualityDTO = {
  generatedAt: string;
  score: number;
  healthy: boolean;
  gate: {
    state: 'pass' | 'warn' | 'block';
    allowsPromotion: boolean;
    allowsPublishing: boolean;
    blockers: string[];
    warnings: string[];
    nextStep: string | null;
  };
  summary: {
    recoveryState: 'ready' | 'degraded';
    learningPending: number;
    quarantinedItems: number;
    memoryPressure: 'ok' | 'elevated' | 'critical';
  };
  operations: {
    uptime: number;
    components: OpsHealthDTO['components'];
  };
  learning: {
    totalCandidates: number;
    acceptedRate: number;
    rejectedRate: number;
    promotedRate: number;
    averageScore: number;
    pending: number;
    quarantined: number;
  };
  memory: {
    totalEntries: number;
    episodic: number;
    semantic: number;
    procedural: number;
    averageBudgetUsage: number;
    pressure: 'ok' | 'elevated' | 'critical';
  };
  platform: {
    total: number;
    trusted: number;
    reviewPending: number;
    quarantined: number;
    learnedLocal: number;
  };
};

export type ZavorthClientHeaders = Record<string, string>;

export type ZavorthRequestQuery = Record<string, unknown>;

export type ZavorthRequestOptions = {
  query?: ZavorthRequestQuery;
  body?: Record<string, unknown>;
  headers?: ZavorthClientHeaders;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type LearningActionResultDTO = LearningActionExecutionDTO;
export type MemoryStatusDTO = LayeredMemoryStatusDTO;
export type MemorySearchResultsDTO = LayeredMemorySearchDTO;
export type MemoryProceduresDTO = LayeredMemoryProcedureDTO;
export type MemoryMetricsDTO = LayeredMemoryMetricsDTO;
