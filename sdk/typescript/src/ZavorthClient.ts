import type {
  ArtifactListDTO,
  ZavorthClientHeaders,
  ZavorthRequestOptions,
  GatewayDomainListDTO,
  GatewayStatusDTO,
  LayeredMemoryMetricsDTO,
  LayeredMemoryProcedureDTO,
  LayeredMemorySearchDTO,
  LayeredMemoryStatusDTO,
  LearningActionExecutionDTO,
  LearningCandidatesDTO,
  LearningMetricsDTO,
  LearningStatusDTO,
  NodeListDTO,
  OpsHealthDTO,
  OpsQualityDTO,
  PlatformCatalogDTO,
  PlatformStatusDTO,
  SessionListDTO,
  TransportListDTO,
} from './types';

export type ZavorthClientOptions = {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
  defaultHeaders?: ZavorthClientHeaders;
  defaultTimeoutMs?: number;
  sdkLabel?: string;
};

export class ZavorthApiError extends Error {
  public readonly status: number;
  public readonly code: string | null;
  public readonly details: unknown;
  public readonly body: unknown;

  constructor(input: {
    message: string;
    status: number;
    code?: string | null;
    details?: unknown;
    body?: unknown;
  }) {
    super(input.message);
    this.name = 'ZavorthApiError';
    this.status = input.status;
    this.code = input.code || null;
    this.details = input.details;
    this.body = input.body;
  }
}

export class ZavorthClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: ZavorthClientHeaders;
  private readonly defaultTimeoutMs: number | null;
  private readonly sdkLabel: string;

  constructor(options: ZavorthClientOptions) {
    this.baseUrl = String(options.baseUrl || '').trim().replace(/\/+$/, '');
    this.token = String(options.token || '').trim() || null;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.defaultHeaders = { ...(options.defaultHeaders || {}) };
    this.defaultTimeoutMs = Number.isFinite(options.defaultTimeoutMs)
      ? Math.max(1, Number(options.defaultTimeoutMs))
      : null;
    this.sdkLabel = String(options.sdkLabel || 'zavorth-typescript-sdk/1.0').trim() || 'zavorth-typescript-sdk/1.0';
    if (!this.baseUrl) {
      throw new Error('ZavorthClient requer baseUrl.');
    }
    if (!this.fetchImpl) {
      throw new Error('ZavorthClient requer fetch no runtime atual.');
    }
  }

  public async getGatewayStatus(): Promise<GatewayStatusDTO> {
    return this.getJson<GatewayStatusDTO>('/api/v1/gateway/status');
  }

  public async getGatewayDomains(options: {
    userId?: string;
    sessionId?: string;
    chatId?: string;
    detail?: 'summary' | 'full';
  } = {}): Promise<GatewayDomainListDTO> {
    return this.getJson<GatewayDomainListDTO>('/api/v1/gateway/domains', options);
  }

  public async getOpsHealth(options: { live?: boolean } = {}): Promise<OpsHealthDTO> {
    return this.getJson<OpsHealthDTO>('/api/v1/ops/health', {
      live: options.live ? 'true' : undefined,
    });
  }

  public async getOpsQuality(options: {
    live?: boolean;
    userId?: string;
    sessionId?: string;
    chatId?: string;
    workspaceHint?: string;
  } = {}): Promise<OpsQualityDTO> {
    return this.getJson<OpsQualityDTO>('/api/v1/ops/quality', {
      live: options.live ? 'true' : undefined,
      userId: options.userId,
      sessionId: options.sessionId,
      chatId: options.chatId,
      workspace: options.workspaceHint,
    });
  }

  public async listSessions(options: {
    userId?: string;
    sessionId?: string;
    chatId?: string;
    sourceUserId?: string;
    limit?: number;
  } = {}): Promise<SessionListDTO> {
    return this.getJson<SessionListDTO>('/api/v1/sessions', options);
  }

  public async getPlatformStatus(): Promise<PlatformStatusDTO> {
    return this.getJson<PlatformStatusDTO>('/api/v1/platform/status');
  }

  public async getPlatformCatalog(options: {
    selectedId?: string;
    query?: string;
  } = {}): Promise<PlatformCatalogDTO> {
    return this.getJson<PlatformCatalogDTO>('/api/v1/platform/catalog', {
      selectedId: options.selectedId,
      q: options.query,
    });
  }

  public async getLearningStatus(options: { workspace?: string } = {}): Promise<LearningStatusDTO> {
    return this.getJson<LearningStatusDTO>('/api/v1/learning/status', options);
  }

  public async getLearningCandidates(options: { workspace?: string } = {}): Promise<LearningCandidatesDTO> {
    return this.getJson<LearningCandidatesDTO>('/api/v1/learning/candidates', options);
  }

  public async getLearningMetrics(options: { workspace?: string } = {}): Promise<LearningMetricsDTO> {
    return this.getJson<LearningMetricsDTO>('/api/v1/learning/metrics', options);
  }

  public async runLearningAction(input: {
    candidateId: string;
    actionId: 'approve' | 'reject' | 'promote';
  }): Promise<LearningActionExecutionDTO> {
    return this.postJson<LearningActionExecutionDTO>('/api/v1/learning/actions', input);
  }

  public async approveLearningCandidate(candidateId: string): Promise<LearningActionExecutionDTO> {
    return this.runLearningAction({ candidateId, actionId: 'approve' });
  }

  public async rejectLearningCandidate(candidateId: string): Promise<LearningActionExecutionDTO> {
    return this.runLearningAction({ candidateId, actionId: 'reject' });
  }

  public async promoteLearningCandidate(candidateId: string): Promise<LearningActionExecutionDTO> {
    return this.runLearningAction({ candidateId, actionId: 'promote' });
  }

  public async getMemoryStatus(options: {
    userId?: string;
    sessionId?: string;
    chatId?: string;
    workspaceHint?: string;
  } = {}): Promise<LayeredMemoryStatusDTO> {
    return this.getJson<LayeredMemoryStatusDTO>('/api/v1/memory/status', {
      userId: options.userId,
      sessionId: options.sessionId,
      chatId: options.chatId,
      workspace: options.workspaceHint,
    });
  }

  public async getMemoryMetrics(options: {
    userId?: string;
    sessionId?: string;
    chatId?: string;
    workspaceHint?: string;
  } = {}): Promise<LayeredMemoryMetricsDTO> {
    return this.getJson<LayeredMemoryMetricsDTO>('/api/v1/memory/metrics', {
      userId: options.userId,
      sessionId: options.sessionId,
      chatId: options.chatId,
      workspace: options.workspaceHint,
    });
  }

  public async searchMemory(options: {
    query: string;
    userId?: string;
    sessionId?: string;
    chatId?: string;
    workspaceHint?: string;
    limit?: number;
  }): Promise<LayeredMemorySearchDTO> {
    return this.getJson<LayeredMemorySearchDTO>('/api/v1/memory/search', {
      q: options.query,
      userId: options.userId,
      sessionId: options.sessionId,
      chatId: options.chatId,
      workspace: options.workspaceHint,
      limit: options.limit,
    });
  }

  public async getMemoryProcedures(options: { workspaceHint?: string } = {}): Promise<LayeredMemoryProcedureDTO> {
    return this.getJson<LayeredMemoryProcedureDTO>('/api/v1/memory/procedures', {
      workspace: options.workspaceHint,
    });
  }

  public async listNodes(options: { selectedId?: string } = {}): Promise<NodeListDTO> {
    return this.getJson<NodeListDTO>('/api/v1/nodes', options);
  }

  public async listTransports(options: { selectedId?: string } = {}): Promise<TransportListDTO> {
    return this.getJson<TransportListDTO>('/api/v1/transports', options);
  }

  public async listArtifacts(options: {
    userId?: string;
    sessionId?: string;
    chatId?: string;
  } = {}): Promise<ArtifactListDTO> {
    return this.getJson<ArtifactListDTO>('/api/v1/artifacts', options);
  }

  public async requestJson<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    pathname: string,
    options: ZavorthRequestOptions = {},
  ): Promise<T> {
    const url = new URL(pathname, `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(options.query || {})) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      url.searchParams.set(key, String(value));
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, Number(options.timeoutMs)) : this.defaultTimeoutMs;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let externalAbortListener: (() => void) | null = null;

    if (controller && options.signal) {
      if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        externalAbortListener = () => controller.abort(options.signal?.reason);
        options.signal.addEventListener('abort', externalAbortListener, { once: true });
      }
    }
    if (controller && timeoutMs) {
      timeoutHandle = setTimeout(() => controller.abort(new Error(`Timeout apos ${timeoutMs}ms.`)), timeoutMs);
    }

    try {
      const response = await this.fetchImpl(url.toString(), {
        method,
        headers: this.buildHeaders(options.headers, Boolean(options.body)),
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller?.signal || options.signal,
      });
      const payload = await this.readPayload(response);
      if (!response.ok) {
        throw this.toApiError(response.status, payload);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof ZavorthApiError) {
        throw error;
      }
      if (controller?.signal.aborted) {
        const reason = controller.signal.reason;
        throw new Error(reason instanceof Error ? reason.message : String(reason || 'Requisicao abortada.'));
      }
      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (externalAbortListener && options.signal) {
        options.signal.removeEventListener('abort', externalAbortListener);
      }
    }
  }

  public async getJson<T>(pathname: string, query: Record<string, unknown> = {}): Promise<T> {
    return this.requestJson<T>('GET', pathname, { query });
  }

  public async postJson<T>(pathname: string, body: Record<string, unknown>): Promise<T> {
    return this.requestJson<T>('POST', pathname, { body });
  }

  private async readPayload(response: Response): Promise<unknown> {
    if (typeof response.text !== 'function' && typeof response.json === 'function') {
      return response.json() as Promise<unknown>;
    }
    const raw = await response.text();
    if (!raw.trim()) {
      return null;
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return {
        raw,
      };
    }
  }

  private toApiError(status: number, payload: unknown): ZavorthApiError {
    const apiPayload = payload as {
      error?: {
        code?: string;
        message?: string;
        details?: unknown;
      };
      raw?: string;
    } | null;
    return new ZavorthApiError({
      status,
      code: apiPayload?.error?.code || null,
      message: apiPayload?.error?.message || apiPayload?.raw || `HTTP ${status}`,
      details: apiPayload?.error?.details,
      body: payload,
    });
  }

  private buildHeaders(headers: ZavorthClientHeaders = {}, hasBody = false): HeadersInit {
    const combined: ZavorthClientHeaders = {
      Accept: 'application/json',
      'X-Zavorth-SDK': this.sdkLabel,
      ...this.defaultHeaders,
      ...headers,
    };
    if (this.token) {
      combined.Authorization = `Bearer ${this.token}`;
    }
    if (hasBody && !combined['Content-Type']) {
      combined['Content-Type'] = 'application/json';
    }
    return combined;
  }
}
