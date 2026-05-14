export interface SessionDTO {
  id: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  title?: string;
  status: 'active' | 'archived' | 'error';
  tags?: string[];
  tenantId?: string;
}

export interface SessionListDTO {
  data: SessionDTO[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface NodeDTO {
  id: string;
  status: 'online' | 'offline' | 'pairing';
  lastSeen: string; // ISO-8601
  identity: {
    arch: string;
    osRelease: string;
    deviceModel?: string;
    networkType?: string;
    locationLabel?: string;
  };
  capabilities: string[];
}

export interface NodeListDTO {
  data: NodeDTO[];
  total: number;
}

export interface ArtifactDTO {
  id: string;
  sessionId: string;
  type: string;
  createdAt: string; // ISO-8601
  title: string;
  metadata?: Record<string, unknown>;
  contentUri: string; // the path or URL where to retrieve the raw content
}

export interface GatewayStatusDTO {
  version: string;
  status: 'ready' | 'starting' | 'error' | 'maintenance';
  uptime: number; // in seconds
  environment: 'development' | 'production' | 'test';
}

export interface GatewayDomainDTO {
  id: string;
  label: string;
  initialized: boolean;
  initializedAt: string | null;
  summary?: string;
  metrics?: Record<string, unknown>;
}

export interface GatewayDomainListDTO {
  generatedAt: string; // ISO-8601
  summary: {
    total: number;
    initialized: number;
    pending: number;
  };
  domains: GatewayDomainDTO[];
}

export interface TransportDTO {
  id: string;
  type: 'AIGateway' | 'zavorth-bridge-remote' | string;
  status: 'connected' | 'disconnected' | 'degraded';
  remoteUrl?: string;
  lastPing?: string; // ISO-8601
}

export interface LearningCandidateDTO {
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
  source: {
    workflowRunId: string;
    workflow: string;
    workspace: string;
    objective: string;
    artifactCount: number;
    completedStages: number;
    totalStages: number;
    originTaskId?: string | null;
    sourceSurface?: string | null;
  };
  steps: string[];
  details: string[];
}

export interface LearningStatusDTO {
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
}

export interface LearningCandidatesDTO {
  generatedAt: string;
  summary: LearningStatusDTO['summary'];
  data: LearningCandidateDTO[];
}

export interface LearningMetricsDTO {
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
}

export interface LearningActionResultDTO {
  generatedAt: string;
  candidateId: string;
  actionId: 'approve' | 'reject' | 'promote';
  status: 'applied' | 'blocked' | 'noop';
  ok: boolean;
  summary: string;
  details: string[];
}

export interface MemoryStatusDTO {
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
}

export interface MemorySearchEntryDTO {
  id: string;
  label: string;
  summary: string;
  memoryLayer: 'episodic' | 'semantic' | 'procedural';
  source: string;
  confidence: number;
  lastValidatedAt: string | null;
  metadata?: Record<string, unknown>;
}

export interface MemorySearchResultsDTO {
  generatedAt: string;
  query: string;
  total: number;
  data: MemorySearchEntryDTO[];
}

export interface MemoryProcedureDTO extends MemorySearchEntryDTO {
  steps: string[];
}

export interface MemoryProceduresDTO {
  generatedAt: string;
  total: number;
  data: MemoryProcedureDTO[];
}

export interface MemoryMetricsDTO {
  generatedAt: string;
  summary: {
    totalEntries: number;
    episodic: number;
    semantic: number;
    procedural: number;
    averageBudgetUsage: number;
    pressure: 'ok' | 'elevated' | 'critical';
  };
  budgets: MemoryStatusDTO['budgets'];
  procedures: {
    total: number;
    trustedLocal: number;
    learnedDraft: number;
    implicit: number;
  };
}
