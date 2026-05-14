import { randomUUID } from 'node:crypto';

/**
 * Lightweight HTTP adapter between the local voice agent and the Zavorth
 * Echo backend. It never owns routing, policy, approvals, or lifecycle state.
 */
export class EchoClientService {
  private baseUrl: string;
  private timeoutMs: number;
  private readonly apiNamespace: EchoClientApiNamespace;
  private readonly context: EchoAgentSurfaceContext;

  constructor(options?: EchoClientOptions) {
    this.baseUrl = options?.baseUrl || 'http://localhost:3000';
    this.timeoutMs = options?.timeoutMs || 30000;
    this.apiNamespace = normalizeApiNamespace(options?.apiNamespace);
    this.context = {
      sessionId: normalizeText(options?.sessionId) || createAgentSessionId(),
      surface: normalizeText(options?.surface) || 'agent',
      requestedBy: normalizeText(options?.requestedBy) || 'zavorth-agent',
    };
  }

  public getSurfaceContext(): EchoAgentSurfaceContext {
    return { ...this.context };
  }

  public getApiNamespace(): EchoClientApiNamespace {
    return this.apiNamespace;
  }

  /**
   * Sends a voice transcript to the configured Zavorth surface API.
   */
  public async processIntent(prompt: string, category?: string): Promise<EchoAgentResult> {
    console.log(`[EchoClient] Sending to ${this.apiNamespace}: "${prompt}" (${this.context.surface}/${this.context.sessionId})`);

    try {
      const res = await fetch(this.endpoint('execute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          category,
          sessionId: this.context.sessionId,
          requestedBy: this.context.requestedBy,
          surface: this.context.surface,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const error = await res.text();
        return {
          success: false,
          response: `Erro do backend (${res.status}): ${error}`,
          toolsUsed: [],
        };
      }

      const data = await res.json();
      const executionEntry = isRecord(data.executionEntry) ? data.executionEntry : null;
      const correlation = readCorrelation(executionEntry?.correlation)
        || readCorrelation(isRecord(data) ? data.correlation : null);
      const runContext = readRunContext(executionEntry?.runContext);
      const executionStatus = normalizeText(executionEntry?.status) || 'unknown';

      console.log(`[EchoClient] Response received: "${String(data.response || '').substring(0, 80)}..."`);

      return {
        success: true,
        response: normalizeText(data.response) || 'Comando executado.',
        toolsUsed: toStringArray(data.toolsExecuted),
        permissionsRequested: toStringArray(data.permissionsRequested),
        durationMs: toNumber(executionEntry?.durationMs),
        executionStatus,
        correlation,
        runContext,
        traceId: correlation?.traceId || runContext?.traceId || null,
        runId: correlation?.runId || runContext?.runId || null,
        sessionId: correlation?.sessionId || runContext?.sessionId || this.context.sessionId,
        approvalId: correlation?.approvalId || null,
        artifactId: correlation?.artifactId || null,
      };

    } catch (error: any) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return {
          success: false,
          response: 'O backend demorou demais para responder. Verifique se o Ollama esta rodando.',
          toolsUsed: [],
        };
      }
      return {
        success: false,
        response: `Falha de conexao com o backend: ${error.message}`,
        toolsUsed: [],
      };
    }
  }

  public async readHistory(limit = 5): Promise<EchoAgentHistoryEntry[]> {
    try {
      const safeLimit = Math.max(1, Math.min(Math.floor(limit), 20));
      const res = await fetch(this.endpoint(`history?limit=${safeLimit}`), {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        return [];
      }
      const data = await res.json();
      return Array.isArray(data)
        ? data.map(readHistoryEntry).filter((entry): entry is EchoAgentHistoryEntry => Boolean(entry))
        : [];
    } catch {
      return [];
    }
  }

  public async readPendingPermissions(): Promise<EchoAgentPermission[]> {
    try {
      const res = await fetch(this.endpoint('permissions'), {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        return [];
      }
      const data = await res.json();
      return Array.isArray(data)
        ? data.map(readPermission).filter((entry): entry is EchoAgentPermission => Boolean(entry))
        : [];
    } catch {
      return [];
    }
  }

  public async readSurfaceState(limit = 5): Promise<EchoAgentSurfaceState> {
    const [recentHistory, pendingPermissions, snapshot] = await Promise.all([
      this.readHistory(limit),
      this.readPendingPermissions(),
      this.readSnapshot(),
    ]);
    const latest = recentHistory[0] || null;
    const recentPhysicalEvents = readPhysicalEvents(snapshot?.signals?.recentPhysicalEvents);
    const latestPhysicalEvent = recentPhysicalEvents[0] || null;
    return {
      context: this.getSurfaceContext(),
      pendingPermissions,
      recentHistory,
      recentPhysicalEvents,
      summary: {
        pendingApprovals: pendingPermissions.length,
        recentRuns: recentHistory.length,
        lastRunId: latest?.runId || null,
        lastTraceId: latest?.traceId || null,
        lastStatus: latest?.status || null,
        lastPrompt: latest?.prompt || null,
        lastResponse: latest?.finalResponse || null,
        lastSurface: latest?.runContext?.surface || null,
        lastCapabilityStatus: latest?.toolStates[0]?.lifecycle?.status || null,
        physicalSignals: recentPhysicalEvents.length,
        lastPhysicalEventId: latestPhysicalEvent?.id || null,
        lastPhysicalFeedback: latestPhysicalEvent?.feedback || null,
        lastPhysicalSeverity: latestPhysicalEvent?.severity || null,
      },
    };
  }

  public async readSnapshot(): Promise<Record<string, any> | null> {
    try {
      const res = await fetch(this.endpoint('snapshot'), {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      return isRecord(data) ? data : null;
    } catch {
      return null;
    }
  }

  /**
   * Verifies whether the backend is online and the model provider is responding.
   */
  public async checkConnection(): Promise<ConnectionCheck> {
    try {
      const res = await fetch(this.endpoint('connection'), {
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          backendOnline: true,
          ollamaOnline: data.online || false,
          model: data.model || 'desconhecido',
          latencyMs: data.latencyMs || 0,
        };
      }

      return { backendOnline: true, ollamaOnline: false, model: '', latencyMs: 0 };

    } catch {
      return { backendOnline: false, ollamaOnline: false, model: '', latencyMs: 0 };
    }
  }

  /**
   * Simple backend healthcheck.
   */
  public async isBackendAlive(): Promise<boolean> {
    try {
      const res = await fetch(this.endpoint('tools'), {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private endpoint(path: string): string {
    const normalizedPath = String(path || '').replace(/^\/+/, '');
    return `${this.baseUrl}/api/v2/${this.apiNamespace}/${normalizedPath}`;
  }
}

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

function createAgentSessionId(): string {
  return `agent-${randomUUID().slice(0, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeApiNamespace(value: unknown): EchoClientApiNamespace {
  return normalizeText(value).toLowerCase() === 'nexus' ? 'nexus' : 'echo';
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => normalizeText(entry)).filter((entry) => entry.length > 0)
    : [];
}

function toNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function readCorrelation(value: unknown): EchoAgentCorrelation | null {
  if (!isRecord(value)) {
    return null;
  }
  const traceId = normalizeText(value.traceId);
  const runId = normalizeText(value.runId);
  if (!traceId || !runId) {
    return null;
  }
  return {
    traceId,
    runId,
    sessionId: normalizeNullableText(value.sessionId),
    approvalId: normalizeNullableText(value.approvalId),
    artifactId: normalizeNullableText(value.artifactId),
  };
}

function readRunContext(value: unknown): EchoAgentRunContext | null {
  if (!isRecord(value)) {
    return null;
  }
  const traceId = normalizeText(value.traceId);
  const runId = normalizeText(value.runId);
  const surface = normalizeText(value.surface);
  const requestedBy = normalizeText(value.requestedBy);
  if (!traceId || !runId || !surface || !requestedBy) {
    return null;
  }
  return {
    traceId,
    runId,
    sessionId: normalizeNullableText(value.sessionId),
    surface,
    requestedBy,
    profile: normalizeNullableText(value.profile),
  };
}

function readHistoryEntry(value: unknown): EchoAgentHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeText(value.id);
  if (!id) {
    return null;
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const correlation = readCorrelation(value.correlation);
  const runContext = readRunContext(value.runContext);
  return {
    id,
    timestamp: normalizeNullableText(value.timestamp),
    prompt: normalizeText(value.prompt),
    status: normalizeText(value.status) || 'unknown',
    finalResponse: normalizeText(value.finalResponse),
    durationMs: toNumber(value.durationMs),
    toolsUsed: readToolsUsed(value.toolCalls, metadata.toolsExecuted),
    toolStates: readToolStates(value.toolCalls),
    correlation,
    runContext,
    traceId: correlation?.traceId || runContext?.traceId || null,
    runId: correlation?.runId || runContext?.runId || null,
  };
}

function readPermission(value: unknown): EchoAgentPermission | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeText(value.id);
  if (!id) {
    return null;
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const correlation = readCorrelation(metadata.correlation);
  const runContext = readRunContext(metadata.runContext);
  return {
    id,
    action: normalizeText(value.action),
    resource: normalizeNullableText(value.resource),
    reason: normalizeText(value.reason),
    status: normalizeText(value.status) || 'pending',
    requestedAt: normalizeNullableText(value.requestedAt),
    kind: normalizeNullableText(metadata.kind),
    toolName: normalizeNullableText(metadata.toolName),
    category: normalizeNullableText(metadata.category),
    surface: normalizeNullableText(metadata.surface) || runContext?.surface || null,
    requestedBy: normalizeNullableText(metadata.requestedBy) || runContext?.requestedBy || null,
    approvalId: correlation?.approvalId || id,
    correlation,
    runContext,
  };
}

function readToolsUsed(toolCalls: unknown, metadataTools: unknown): string[] {
  const fromMetadata = toStringArray(metadataTools);
  if (fromMetadata.length > 0) {
    return fromMetadata;
  }
  if (!Array.isArray(toolCalls)) {
    return [];
  }
  return toolCalls
    .map((entry) => isRecord(entry) ? normalizeText(entry.toolName) : '')
    .filter((entry) => entry.length > 0);
}

function readToolStates(toolCalls: unknown): EchoAgentToolState[] {
  if (!Array.isArray(toolCalls)) {
    return [];
  }
  return toolCalls
    .map((entry) => readToolState(entry))
    .filter((entry): entry is EchoAgentToolState => Boolean(entry));
}

function readToolState(value: unknown): EchoAgentToolState | null {
  if (!isRecord(value)) {
    return null;
  }
  const toolName = normalizeText(value.toolName);
  if (!toolName) {
    return null;
  }
  return {
    toolName,
    securityDecision: normalizeText(value.securityDecision) || 'unknown',
    lifecycle: readLifecycle(value.lifecycle),
    artifact: readArtifact(value.artifact),
    policy: readPolicy(value.policy),
  };
}

function readLifecycle(value: unknown): EchoAgentCapabilityLifecycle | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    mode: normalizeNullableText(value.mode),
    status: normalizeNullableText(value.status),
    details: cloneRecord(value),
  };
}

function readArtifact(value: unknown): EchoAgentCapabilityArtifact | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    id: normalizeNullableText(value.id),
    kind: normalizeNullableText(value.kind),
    source: normalizeNullableText(value.source),
    details: cloneRecord(value),
  };
}

function readPolicy(value: unknown): EchoAgentCapabilityPolicy | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    scope: normalizeNullableText(value.scope),
    details: cloneRecord(value),
  };
}

function readPhysicalEvents(value: unknown): EchoAgentPhysicalEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => readPhysicalEvent(entry))
    .filter((entry): entry is EchoAgentPhysicalEvent => Boolean(entry));
}

function readPhysicalEvent(value: unknown): EchoAgentPhysicalEvent | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeText(value.id);
  const entityId = normalizeText(value.entityId);
  const newState = normalizeText(value.newState);
  const feedback = normalizeText(value.feedback);
  if (!id || !entityId || !newState || !feedback) {
    return null;
  }
  const severity = normalizeText(value.severity).toLowerCase();
  return {
    id,
    source: normalizeText(value.source) || 'iot',
    timestamp: normalizeNullableText(value.timestamp),
    entityId,
    oldState: normalizeNullableText(value.oldState),
    newState,
    feedback,
    severity: severity === 'critical' || severity === 'warn' ? severity : 'info',
  };
}

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
