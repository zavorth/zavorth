// schemas complementares a Intent model

export interface PluginDTO {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  status: 'installed' | 'active' | 'error';
}

export interface PlatformRegistryItemDTO {
  id: string;
  label: string;
  kind: 'plugin' | 'skill' | 'mcp';
  source: string;
  origin: 'official' | 'trusted-third-party' | 'learned-local' | 'quarantined';
  readiness: 'ready' | 'partial' | 'planned' | 'disabled';
  trustState: 'trusted' | 'review' | 'planned' | 'quarantined';
  reviewState: 'not-required' | 'pending' | 'approved' | 'rejected';
  installState: 'installed' | 'available' | 'workspace' | 'enabled' | 'disabled';
  signatureState: 'verified' | 'catalog-verified' | 'workspace' | 'unsigned' | 'none';
  runtimePermissionProfile: 'native-runtime' | 'workspace-skill' | 'mcp-exec' | 'learned-review' | 'catalog-discovery';
  promotedFromLearning: boolean;
  discoveryOnly: boolean;
  featured: boolean;
  summary: string;
  registrySource?: string;
  provenance: {
    sourceLocator?: string;
    sourceDigest?: string;
    sourceTrusted?: boolean;
  };
}

export interface PlatformStatusSummaryDTO {
  total: number;
  plugins: number;
  skills: number;
  mcps: number;
  trusted: number;
  reviewPending: number;
  quarantined: number;
  learnedLocal: number;
}

export interface PlatformStatusDTO {
  registryConnected: boolean;
  lastSync?: string; // ISO-8601
  summary?: PlatformStatusSummaryDTO;
  plugins: PluginDTO[];
  items?: PlatformRegistryItemDTO[];
}

export interface PlatformCatalogCollectionDTO {
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
}

export interface PlatformCatalogRecipeDTO {
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
}

export interface PlatformCatalogDTO {
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
  summary: PlatformStatusSummaryDTO & {
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
  items: PlatformRegistryItemDTO[];
  collections: PlatformCatalogCollectionDTO[];
  recipes: PlatformCatalogRecipeDTO[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
}

export interface OpsHealthDTO {
  healthy: boolean;
  uptime: number; // in seconds
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  components: {
    database: 'ok' | 'error';
    eventBus: 'ok' | 'error';
  }
}

export interface OpsQualityDTO {
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
}

export interface ArtifactRegistryDTO {
  artifactsCount: number;
  totalSizeInBytes: number;
}
