import type {
  EchoExecutionEntry,
  EchoPermissionResolutionResult,
} from '../../../tool-runtime/types/EchoTypes.js';
import { safeFetch } from '../../../security/SafeFetchService.js';

export type TelegramEchoSurfaceContext = {
  channel: 'telegram';
  chatId: string;
  threadId: string | null;
  userId: string | null;
  sessionId: string;
  surface: 'telegram';
  requestedBy: string;
};

export type TelegramEchoSurfaceClientOptions = {
  baseUrl?: string;
  chatId: string | number;
  threadId?: string | number | null;
  userId?: string | number | null;
  sessionId?: string;
  requestedBy?: string;
  timeoutMs?: number;
};

export type TelegramEchoCorrelation = {
  traceId: string;
  runId: string;
  sessionId: string | null;
  approvalId: string | null;
  artifactId: string | null;
};

export type TelegramEchoRunContext = {
  traceId: string;
  runId: string;
  sessionId: string | null;
  surface: string;
  requestedBy: string;
  profile: string | null;
};

export type TelegramEchoPermission = {
  id: string;
  action: string;
  resource: string | null;
  reason: string;
  status: string;
  requestedAt: string | null;
  approvalId: string;
  correlation: TelegramEchoCorrelation | null;
  runContext: TelegramEchoRunContext | null;
  metadata: Record<string, unknown>;
};

export type TelegramEchoSurfaceState = {
  context: TelegramEchoSurfaceContext;
  pendingPermissions: TelegramEchoPermission[];
  recentHistory: EchoExecutionEntry[];
  summary: {
    pendingApprovals: number;
    recentRuns: number;
    lastRunId: string | null;
    lastTraceId: string | null;
    lastStatus: string | null;
    lastPrompt: string | null;
    lastResponse: string | null;
  };
};

export type TelegramEchoPermissionResolutionResult = EchoPermissionResolutionResult & {
  resolvedBy?: TelegramEchoSurfaceContext | null;
};

export type TelegramEchoExecuteResult = {
  response: string;
  toolsExecuted: string[];
  permissionsRequested: string[];
  executionEntry: EchoExecutionEntry;
};

/**
 * Thin adapter between the Telegram bot and the public Echo facade.
 * It has no policy, routing, or approval state; it only carries the
 * Telegram identity to the canonical surface contracts.
 */
export class TelegramEchoSurfaceClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly context: TelegramEchoSurfaceContext;

  constructor(options: TelegramEchoSurfaceClientOptions) {
    const chatId = normalizeRequired(options.chatId, 'telegram chatId');
    const threadId = normalizeNullableText(options.threadId);
    this.baseUrl = String(options.baseUrl || 'http://localhost:3000').replace(/\/+$/, '');
    this.timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs || 30000)));
    this.context = {
      channel: 'telegram',
      chatId,
      threadId,
      userId: normalizeNullableText(options.userId),
      sessionId: normalizeText(options.sessionId) || buildTelegramSessionId(chatId, threadId),
      surface: 'telegram',
      requestedBy: normalizeText(options.requestedBy) || `telegram:${chatId}`,
    };
  }

  public getSurfaceContext(): TelegramEchoSurfaceContext {
    return { ...this.context };
  }

  public async readHistory(limit = 10): Promise<EchoExecutionEntry[]> {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
    return this.requestJson<EchoExecutionEntry[]>(`/api/v2/echo/history...limit=${safeLimit}`, {
      fallback: [],
    });
  }

  public async readPendingPermissions(): Promise<TelegramEchoPermission[]> {
    const permissions = await this.requestJson<unknown[]>('/api/v2/echo/permissions', {
      fallback: [],
    });
    return Array.isArray(permissions)
      ? permissions.map(readPermission).filter((entry): entry is TelegramEchoPermission => Boolean(entry))
      : [];
  }

  public async readSurfaceState(limit = 10): Promise<TelegramEchoSurfaceState> {
    const [recentHistory, pendingPermissions] = await Promise.all([
      this.readHistory(limit),
      this.readPendingPermissions(),
    ]);
    const latest = recentHistory[0] || null;
    const correlation = readCorrelation(latest?.correlation);
    return {
      context: this.getSurfaceContext(),
      pendingPermissions,
      recentHistory,
      summary: {
        pendingApprovals: pendingPermissions.length,
        recentRuns: recentHistory.length,
        lastRunId: correlation?.runId || readRunContext(latest?.runContext)?.runId || null,
        lastTraceId: correlation?.traceId || readRunContext(latest?.runContext)?.traceId || null,
        lastStatus: normalizeNullableText(latest?.status),
        lastPrompt: normalizeNullableText(latest?.prompt),
        lastResponse: normalizeNullableText(latest?.finalResponse),
      },
    };
  }

  public async resolvePermission(
    id: string,
    approved: boolean,
  ): Promise<TelegramEchoPermissionResolutionResult> {
    return this.requestJson<TelegramEchoPermissionResolutionResult>('/api/v2/echo/permissions/resolve', {
      method: 'POST',
      body: {
        id,
        approved,
        sessionId: this.context.sessionId,
        surface: this.context.surface,
        requestedBy: this.context.requestedBy,
        channel: this.context.channel,
        chatId: this.context.chatId,
        threadId: this.context.threadId,
        userId: this.context.userId,
      },
    });
  }

  public async execute(prompt: string, category?: string): Promise<TelegramEchoExecuteResult> {
    return this.requestJson<TelegramEchoExecuteResult>('/api/v2/echo/execute', {
      method: 'POST',
      body: {
        prompt,
        category,
        sessionId: this.context.sessionId,
        requestedBy: this.context.requestedBy,
        surface: this.context.surface,
        channel: this.context.channel,
        chatId: this.context.chatId,
        threadId: this.context.threadId,
        userId: this.context.userId,
      },
    });
  }

  private async requestJson<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST';
      body?: Record<string, unknown>;
      fallback?: T;
    } = {},
  ): Promise<T> {
    const response = await safeFetch(`${this.baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    }, {
      serviceName: 'Telegram Echo surface client',
      allowLoopback: true,
    });

    if (!response.ok) {
      if ('fallback' in options) {
        return options.fallback as T;
      }
      const text = await response.text();
      throw new Error(text || `Telegram Echo request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}

function buildTelegramSessionId(chatId: string, threadId: string | null): string {
  const suffix = threadId ? `${chatId}-thread-${threadId}` : chatId;
  return `telegram-${suffix.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)}`;
}

function readPermission(value: unknown): TelegramEchoPermission | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeText(value.id);
  if (!id) {
    return null;
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const correlation = readCorrelation(metadata.correlation);
  return {
    id,
    action: normalizeText(value.action),
    resource: normalizeNullableText(value.resource),
    reason: normalizeText(value.reason),
    status: normalizeText(value.status) || 'pending',
    requestedAt: normalizeNullableText(value.requestedAt),
    approvalId: correlation?.approvalId || id,
    correlation,
    runContext: readRunContext(metadata.runContext),
    metadata,
  };
}

function readCorrelation(value: unknown): TelegramEchoCorrelation | null {
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

function readRunContext(value: unknown): TelegramEchoRunContext | null {
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

function normalizeRequired(value: unknown, label: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
