import type {
  CodexRuntimeInitializeResult,
  CodexRuntimeModelEntry,
  CodexRuntimeReasoningEffort,
  CodexRuntimeRpcMethod,
  CodexRuntimeRpcRequest,
  CodexRuntimeRpcRequester,
  CodexRuntimeThreadSummary,
} from '../../contracts/CodexRuntimeContract.js';

type CodexAppServerRpcAdapterRuntime = {
  requester?: CodexRuntimeRpcRequester | null;
  timeoutMs?: number;
};

type RawModel = {
  id?: unknown;
  name?: unknown;
  label?: unknown;
  reasoningEfforts?: unknown;
  reasoning_efforts?: unknown;
  supportsImages?: unknown;
  supports_images?: unknown;
  supportsTools?: unknown;
  supports_tools?: unknown;
};

type RawThread = {
  id?: unknown;
  threadId?: unknown;
  thread_id?: unknown;
  title?: unknown;
  status?: unknown;
  modelId?: unknown;
  model_id?: unknown;
};

export class CodexAppServerRpcAdapter {
  private readonly requester: CodexRuntimeRpcRequester | null;
  private readonly timeoutMs: number;
  private sequence = 0;

  constructor(runtime: CodexAppServerRpcAdapterRuntime = {}) {
    this.requester = runtime.requester || null;
    this.timeoutMs = runtime.timeoutMs || 15_000;
  }

  public hasRequester(): boolean {
    return this.requester !== null;
  }

  public async initialize(input: {
    clientName?: string | null;
    clientVersion?: string | null;
  } = {}): Promise<CodexRuntimeInitializeResult> {
    const result = await this.request<CodexRuntimeInitializeResult>('initialize', {
      clientInfo: {
        name: String(input.clientName || '').trim() || 'zavorth',
        version: String(input.clientVersion || '').trim() || 'unknown',
      },
      capabilities: {
        dynamicTools: true,
        approvals: true,
        eventProjection: true,
      },
    });

    return {
      protocolVersion: String(result.protocolVersion || 'unknown'),
      serverName: String(result.serverName || 'codex-app-server'),
      capabilities: Array.isArray(result.capabilities)
        ? result.capabilities.map((item) => String(item))
        : [],
    };
  }

  public async listModels(): Promise<CodexRuntimeModelEntry[]> {
    const result = await this.request<{ models?: RawModel[] } | RawModel[]>('model/list', null);
    const rawModels = Array.isArray(result) ? result : Array.isArray(result.models) ? result.models : [];
    return rawModels.map((model) => this.normalizeModel(model));
  }

  public async listThreads(): Promise<CodexRuntimeThreadSummary[]> {
    const result = await this.request<{ threads?: RawThread[] } | RawThread[]>('thread/list', null);
    const rawThreads = Array.isArray(result) ? result : Array.isArray(result.threads) ? result.threads : [];
    return rawThreads.map((thread) => this.normalizeThread(thread));
  }

  public async resumeThread(threadId: string): Promise<CodexRuntimeThreadSummary> {
    const result = await this.request<RawThread>('thread/resume', {
      threadId: this.requireId(threadId, 'threadId'),
    });
    return this.normalizeThread(result);
  }

  public async sendTurn(input: {
    threadId: string | null;
    prompt: string;
    modelId?: string | null;
    imageArtifactIds?: string[];
  }): Promise<{ turnId: string; threadId: string | null }> {
    const result = await this.request<{ turnId?: unknown; turn_id?: unknown; threadId?: unknown; thread_id?: unknown }>(
      'thread/turn/start',
      {
        threadId: String(input.threadId || '').trim() || null,
        prompt: String(input.prompt || ''),
        modelId: String(input.modelId || '').trim() || null,
        imageArtifactIds: input.imageArtifactIds || [],
      },
    );
    return {
      turnId: String(result.turnId || result.turn_id || 'turn-unknown'),
      threadId: String(result.threadId || result.thread_id || input.threadId || '').trim() || null,
    };
  }

  public async compactThread(threadId: string): Promise<{ threadId: string; status: string }> {
    const result = await this.request<{ threadId?: unknown; thread_id?: unknown; status?: unknown }>('thread/compact/start', {
      threadId: this.requireId(threadId, 'threadId'),
    });
    return {
      threadId: String(result.threadId || result.thread_id || threadId),
      status: String(result.status || 'started'),
    };
  }

  public async stopThread(threadId: string): Promise<{ threadId: string; status: string }> {
    const result = await this.request<{ threadId?: unknown; thread_id?: unknown; status?: unknown }>('thread/stop', {
      threadId: this.requireId(threadId, 'threadId'),
    });
    return {
      threadId: String(result.threadId || result.thread_id || threadId),
      status: String(result.status || 'stopped'),
    };
  }

  public async request<T>(method: CodexRuntimeRpcMethod, params: Record<string, unknown> | null): Promise<T> {
    if (!this.requester) {
      throw new Error('Codex app-server RPC requester is not configured.');
    }

    const request: CodexRuntimeRpcRequest = {
      id: `codex-rpc-${++this.sequence}`,
      method,
      params,
      timeoutMs: this.timeoutMs,
    };
    const response = await this.requester(request);
    if (response.error) {
      throw new Error(`Codex app-server RPC ${method} failed: ${response.error.message}`);
    }
    return response.result as T;
  }

  private normalizeModel(model: RawModel): CodexRuntimeModelEntry {
    const id = String(model.id || model.name || '').trim() || 'codex-default';
    const reasoning = model.reasoningEfforts || model.reasoning_efforts;
    return {
      id,
      label: String(model.label || model.name || id),
      provider: 'codex',
      source: 'app-server',
      reasoningEfforts: this.normalizeReasoning(reasoning),
      supportsImages: Boolean(model.supportsImages ?? model.supports_images ?? true),
      supportsTools: Boolean(model.supportsTools ?? model.supports_tools ?? true),
    };
  }

  private normalizeThread(thread: RawThread): CodexRuntimeThreadSummary {
    const threadId = String(thread.threadId || thread.thread_id || thread.id || '').trim() || 'thread-unknown';
    const rawStatus = String(thread.status || 'unknown').trim();
    const status = rawStatus === 'idle' || rawStatus === 'running' || rawStatus === 'stopped'
      ? rawStatus
      : 'unknown';
    return {
      threadId,
      title: String(thread.title || threadId),
      status,
      modelId: String(thread.modelId || thread.model_id || '').trim() || null,
    };
  }

  private normalizeReasoning(value: unknown): CodexRuntimeReasoningEffort[] {
    const raw = Array.isArray(value) ? value.map((item) => String(item)) : ['low', 'medium', 'high', 'xhigh'];
    const allowed = new Set<CodexRuntimeReasoningEffort>(['low', 'medium', 'high', 'xhigh']);
    const normalized = raw.filter((item): item is CodexRuntimeReasoningEffort =>
      allowed.has(item as CodexRuntimeReasoningEffort),
    );
    return normalized.length > 0 ? normalized : ['medium'];
  }

  private requireId(value: string, label: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new Error(`${label} is required.`);
    }
    return normalized;
  }
}
