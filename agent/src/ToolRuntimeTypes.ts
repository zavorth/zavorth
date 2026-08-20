export type EchoClientApiNamespace = 'echo' | 'nexus';

export interface EchoAgentResult {
  success: boolean;
  response: string;
  toolsUsed: string[];
  permissionsRequested?: string[];
  durationMs?: number;
  executionStatus?: string;
  correlation?: EchoAgentCorrelation | null;
  runContext?: EchoAgentRunContext | null;
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  approvalId?: string | null;
  artifactId?: string | null;
}

export interface ConnectionCheck {
  backendOnline: boolean;
  ollamaOnline: boolean;
  model: string;
  latencyMs: number;
}

export interface EchoClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  sessionId?: string;
  requestedBy?: string;
  surface?: string;
  apiNamespace?: EchoClientApiNamespace;
}

export interface EchoAgentSurfaceContext {
  sessionId: string;
  surface: string;
  requestedBy: string;
}

export interface EchoAgentCorrelation {
  traceId: string;
  runId: string;
  sessionId: string | null;
  approvalId: string | null;
  artifactId: string | null;
}

export interface EchoAgentRunContext {
  traceId: string;
  runId: string;
  sessionId: string | null;
  surface: string;
  requestedBy: string;
  profile: string | null;
}

export interface EchoAgentHistoryEntry {
  id: string;
  timestamp: string | null;
  prompt: string;
  status: string;
  finalResponse: string;
  durationMs?: number;
  toolsUsed: string[];
  toolStates: EchoAgentToolState[];
  correlation: EchoAgentCorrelation | null;
  runContext: EchoAgentRunContext | null;
  traceId: string | null;
  runId: string | null;
}

export interface EchoAgentPermission {
  id: string;
  action: string;
  resource: string | null;
  reason: string;
  status: string;
  requestedAt: string | null;
  kind: string | null;
  toolName: string | null;
  category: string | null;
  surface: string | null;
  requestedBy: string | null;
  approvalId: string;
  correlation: EchoAgentCorrelation | null;
  runContext: EchoAgentRunContext | null;
}

export interface EchoAgentSurfaceState {
  context: EchoAgentSurfaceContext;
  pendingPermissions: EchoAgentPermission[];
  recentHistory: EchoAgentHistoryEntry[];
  recentPhysicalEvents: EchoAgentPhysicalEvent[];
  summary: {
    pendingApprovals: number;
    recentRuns: number;
    lastRunId: string | null;
    lastTraceId: string | null;
    lastStatus: string | null;
    lastPrompt: string | null;
    lastResponse: string | null;
    lastSurface: string | null;
    lastCapabilityStatus: string | null;
    physicalSignals: number;
    lastPhysicalEventId: string | null;
    lastPhysicalFeedback: string | null;
    lastPhysicalSeverity: 'info' | 'warn' | 'critical' | null;
  };
}

export interface EchoAgentPhysicalEvent {
  id: string;
  source: string;
  timestamp: string | null;
  entityId: string;
  oldState: string | null;
  newState: string;
  feedback: string;
  severity: 'info' | 'warn' | 'critical';
}

export interface EchoAgentToolState {
  toolName: string;
  securityDecision: string;
  lifecycle: EchoAgentCapabilityLifecycle | null;
  artifact: EchoAgentCapabilityArtifact | null;
  policy: EchoAgentCapabilityPolicy | null;
}

export interface EchoAgentCapabilityLifecycle {
  mode: string | null;
  status: string | null;
  details: Record<string, unknown>;
}

export interface EchoAgentCapabilityArtifact {
  id: string | null;
  kind: string | null;
  source: string | null;
  details: Record<string, unknown>;
}

export interface EchoAgentCapabilityPolicy {
  scope: string | null;
  details: Record<string, unknown>;
}
