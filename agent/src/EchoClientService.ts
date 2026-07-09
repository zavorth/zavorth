import { t, getActiveLanguage } from './i18n.js';
import {
  EchoClientApiNamespace,
  EchoAgentSurfaceContext,
  EchoClientOptions,
  EchoAgentResult,
  EchoAgentHistoryEntry,
  EchoAgentPermission,
  EchoAgentSurfaceState,
  ConnectionCheck
} from './EchoTypes.js';
import {
  createAgentSessionId,
  normalizeText,
  normalizeApiNamespace,
  isRecord,
  readCorrelation,
  readRunContext,
  toNumber,
  toStringArray,
  readHistoryEntry,
  readPermission,
  readPhysicalEvents
} from './EchoResponseParser.js';
import { asErrorLike } from '../../src/utils/errorLike.js';

function asErrorLike(error: unknown): { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown } {
  if (error && typeof error === 'object') return error as { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown };
  if (typeof error === 'string' && error.trim()) return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean') return { message: String(error) };
  return { message: 'Unexpected error' };
}

// Re-export all types for backward compatibility
export * from './EchoTypes.js';

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
          lang: getActiveLanguage(),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const error = await res.text();
        return {
          success: false,
          response: t('error_backend', { status: res.status, error }),
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
        response: normalizeText(data.response) || t('command_executed'),
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

    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return {
          success: false,
          response: t('error_timeout'),
          toolsUsed: [],
        };
      }
      return {
        success: false,
        response: t('error_connection', { message: String(err.message || 'Unexpected error') }),
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
          model: data.model || t('model_unknown'),
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
