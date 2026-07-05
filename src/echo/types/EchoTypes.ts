import type { ToolDefinition } from '../../providers/ILlmProvider';
import type {
  ZavorthBoundaryCorrelation,
  RunContext,
} from '../../contracts/InternalBoundaryContract.js';
import type { EchoVoiceMetricsSnapshot } from '../../domain/observability/infrastructure/EchoVoiceTelemetryService.js';

/**
 * EchoExecutionEntry records a complete Echo pipeline execution.
 * It stores the original prompt, tool calls, final response, and execution metadata.
 */
export interface EchoExecutionEntry {
  id: string;
  timestamp: string;
  prompt: string;
  llmRaw: string | null;
  toolCalls: EchoToolCall[];
  finalResponse: string;
  status: 'success' | 'blocked' | 'permission_pending' | 'permission_denied' | 'error';
  durationMs: number;
  correlation?: ZavorthBoundaryCorrelation | null;
  runContext?: RunContext | null;
  metadata?: Record<string, unknown>;
}

/**
 * EchoToolCall records an individual tool call.
 */
export interface EchoToolCall {
  toolName: string;
  args: Record<string, any>;
  securityDecision: 'approved' | 'blocked' | 'permission_required' | 'permission_denied';
  result: string;
  durationMs: number;
  data?: any;
  correlation?: ZavorthBoundaryCorrelation | null;
  lifecycle?: EchoCapabilityLifecycleRecord | null;
  artifact?: EchoCapabilityArtifactRecord | null;
  policy?: EchoCapabilityPolicyRecord | null;
}

export interface EchoCapabilityLifecycleRecord {
  mode: string | null;
  status: string | null;
  details: Record<string, unknown>;
}

export interface EchoCapabilityArtifactRecord {
  id: string | null;
  kind: string | null;
  source: string | null;
  details: Record<string, unknown>;
}

export interface EchoCapabilityPolicyRecord {
  scope: string | null;
  details: Record<string, unknown>;
}

export interface EchoCapabilitySurfaceState {
  capabilityId: string;
  toolName: string;
  category: string;
  dangerLevel: string | null;
  requiresPermission: boolean;
  lifecycle: EchoCapabilityLifecycleRecord | null;
}

/**
 * EchoResult is returned to REST APIs or voice-agent callers.
 */
export interface EchoResult {
  response: string;
  toolsExecuted: string[];
  permissionsRequested: string[];
  executionEntry: EchoExecutionEntry;
}

export interface EchoPermissionResolutionResult {
  ok: boolean;
  id: string;
  status?: 'approved' | 'denied';
  response?: string;
  toolsExecuted?: string[];
  executionEntry?: EchoExecutionEntry;
  error?: string;
  correlation?: ZavorthBoundaryCorrelation | null;
  resolvedBy?: EchoPermissionResolverContext | null;
}

export interface EchoPermissionResolverContext {
  sessionId: string | null;
  surface: string;
  requestedBy: string;
  channel?: string | null;
  chatId?: string | null;
  threadId?: string | null;
  userId?: string | null;
}

export interface EchoWatchModeSurfaceSnapshot {
  generatedAt: string;
  posture: 'healthy' | 'attention' | 'critical';
  activeStatus: string;
  pendingApprovals: number;
  artifactEntries: number;
  throttledScreenshots: number;
  droppedTimelineEntries: number;
  averageApprovalLatencyMs: number;
  strictApprovalDefault: boolean;
  allowedApps: number;
  allowedSites: number;
  cost: {
    level: 'low' | 'moderate' | 'high';
    score: number;
    summary: string;
  };
  headline: string;
  operatorSummary: string;
  nextAction: string;
  cards: Array<{
    id: 'status' | 'policy' | 'approvals' | 'replay';
    label: string;
    posture: 'healthy' | 'attention' | 'critical';
    summary: string;
    command: string | null;
  }>;
  actions: Array<{
    id: string;
    label: string;
    severity: 'info' | 'warn' | 'critical';
    reason: string;
    command: string | null;
  }>;
}

export interface EchoPhysicalSignalRecord {
  id: string;
  source: string;
  timestamp: string;
  entityId: string;
  oldState: string | null;
  newState: string;
  feedback: string;
  severity: 'info' | 'warn' | 'critical';
}

/**
 * EchoSnapshot is an operational Echo snapshot for the Gateway and ZavorthControl.
 */
export interface EchoSnapshot {
  generatedAt: string;
  summary: {
    totalTools: number;
    categoryCounts: Record<string, number>;
    recentExecutions: number;
    llmOnline: boolean;
    preferredProvider: string;
    ollamaOnline: boolean;
  };
  tools: ToolDefinition[];
  recentHistory: EchoExecutionEntry[];
  watchMode: EchoWatchModeSurfaceSnapshot | null;
  voiceMetrics: EchoVoiceMetricsSnapshot;
  capabilityLifecycle: EchoCapabilitySurfaceState[];
  signals: {
    recentPhysicalEvents: EchoPhysicalSignalRecord[];
  };
}
