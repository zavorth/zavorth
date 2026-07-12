/** JSON DTOs consumed by the classic Control client. Keep presentation detached from services. */
export type ClassicSnippetDto = { id: number; user_id: string; name: string; content: string; created_at: string };
type NarrativeDto = { operatorSummary?: string; trustBoundary?: string };

export type ClassicPluginRegistryDto = {
  summary: { total?: number; installed?: number; trusted?: number; workspaceExtensions?: number };
  selected?: {
    id?: string;
    kind?: string;
    source?: string;
    summary?: string;
    actionHint?: string;
    actions?: Array<{ id?: string; label?: string }>;
  } | null;
  entries?: Array<{ id?: string; label?: string; kind?: string; installState?: string; trust?: string }>;
  narrative?: NarrativeDto;
};

export type ClassicRuntimeModesDto = {
  summary: { total?: number; ready?: number; partial?: number; planned?: number; disabled?: number };
  entries?: Array<{
    id?: string;
    label?: string;
    readiness?: string;
    operatorSummary?: string;
    recommendedFor?: string;
    actionHint?: string | null;
    details?: string[];
  }>;
  narrative?: NarrativeDto;
};

type ClassicSecurityModeDto = { id?: string; label?: string; readiness?: string };
export type ClassicSecurityMeshDto = {
  posture: { level?: string; label?: string; summary?: string };
  summary: { coreReady?: number; extensionsReady?: number; gvisorActive?: boolean; neverDowngrade?: boolean };
  policies?: {
    lowRiskToLocalJail?: boolean;
    mediumRiskToContainer?: boolean;
    highRiskToMicrovm?: boolean;
    neverDowngrade?: boolean;
    gvisorActive?: boolean;
    firecrackerReady?: boolean;
  };
  modes?: { core?: ClassicSecurityModeDto[]; extensions?: ClassicSecurityModeDto[] };
  suggestedActions?: Array<{ id?: string; label?: string; severity?: string; reason?: string; command?: string }>;
  narrative?: NarrativeDto;
};

export type ClassicTeamCatalogDto = {
  summary: { total?: number; resumable?: number; active?: number; completedRecently?: number; executors?: string[] };
  teams?: Array<{
    id?: string;
    label?: string;
    status?: string;
    summary?: string;
    operatorSummary?: string;
    entryCommand?: string;
    members?: Array<{ label?: string; role?: string; responsibility?: string; executor?: string }>;
    latestRun?: { workflowRunId?: string; status?: string; resumeAvailable?: boolean } | null;
  }>;
  narrative?: NarrativeDto;
};

export type ClassicCapabilityCatalogDto = {
  summary: { total?: number; commands?: number; implicitRoutes?: number; plugin?: number };
  categories?: Array<{ label?: string; type?: string; total?: number; commands?: number; implicitRoutes?: number }>;
  featuredCommands?: Array<{
    command?: string;
    label?: string;
    source?: string;
    description?: string;
    section?: string;
    executorPreference?: string;
    usage?: string;
  }>;
  featuredImplicitRoutes?: Array<{
    label?: string;
    executorPreference?: string;
    routingReason?: string;
    description?: string;
    confidence?: number | null;
  }>;
  platforms?: { summary?: { ready?: number; partial?: number; planned?: number; disabled?: number } };
  integrations: { ready?: number; total?: number; templates?: number; installed?: number };
  capabilityActions: {
    summary?: { exposed?: number };
    items?: Array<{ title?: string; actionId?: string; status?: string; detail?: string; previewCommand?: string }>;
  };
  narrative?: NarrativeDto;
};
