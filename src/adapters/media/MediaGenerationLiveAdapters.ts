import type {
  AdapterGenerationOutput,
  IMediaGenerationAdapter,
  MediaGenerationModality,
  MediaGenerationRequest,
} from '../../contracts/MediaGenerationContract.js';type FetchRuntime = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  sleepMs?: (ms: number) => Promise<void>;
};

export type DirectImageGenerationAdapterConfig = {
  adapterId: string;
  providerId: string;
  baseUrl: string;
  apiKey?: string | null;
  modelId?: string | null;
  route?: string;
};

export type AsyncMediaJobAdapterConfig = {
  adapterId: string;
  providerId: string;
  supportedModalities: MediaGenerationModality[];
  submitUrl: string;
  apiKey?: string | null;
  modelId?: string | null;
  pollUrlTemplate?: string | null;
  statusPath?: string;
  jobIdPath?: string;
  resultPath?: string;
  maxPolls?: number;
  pollIntervalMs?: number;
  completedStatuses?: string[];
  failedStatuses?: string[];
};

export type MediaJobStatusReceipt = {
  providerId: string;
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'unknown';
  liveIo: true;
  secretValuesSerialized: false;
  checkedAt: string;
};

export type MediaJobCancelReceipt = {
  providerId: string;
  jobId: string;
  status: 'cancel-requested';
  liveIo: true;
  secretValuesSerialized: false;
  cancelledAt: string;
};

export class DirectImageGenerationLiveAdapter implements IMediaGenerationAdapter {
  public readonly supportedModalities: MediaGenerationModality[] = ['image'];
  public readonly adapterId: string;

  private readonly config: DirectImageGenerationAdapterConfig;
  private readonly fetchImpl: typeof fetch | null;

  constructor(config: DirectImageGenerationAdapterConfig, runtime: FetchRuntime = {}) {
    this.adapterId = config.adapterId;
    this.config = {
      ...config,
      baseUrl: stripTrailingSlash(config.baseUrl),
      route: config.route || 'images/generations',
    };
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public async generate(request: MediaGenerationRequest): Promise<AdapterGenerationOutput[]> {
    if (!this.fetchImpl) {
      throw new Error(`${this.adapterId} requires fetch in the runtime.`);
    }
    const response = await this.fetchImpl(`${this.config.baseUrl}/${this.config.route}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        prompt: request.prompt,
        n: Math.min(Math.max(request.count || 1, 1), 4),
        size: request.sizeHint || '1024x1024',
        response_format: 'b64_json',
        model: String(request.providerHints?.model || this.config.modelId || '').trim() || undefined,
        style: request.styleHint || undefined,
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`${this.adapterId} image generation failed: ${readError(payload, response.status)}`);
    }
    return normalizeMediaOutputs(payload, {
      providerId: this.config.providerId,
      modelId: String(request.providerHints?.model || this.config.modelId || '').trim() || null,
      modality: 'image',
      fallbackContentType: 'image/png',
    });
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }
}

export class AsyncMediaJobGenerationLiveAdapter implements IMediaGenerationAdapter {
  public readonly supportedModalities: MediaGenerationModality[];
  public readonly adapterId: string;

  private readonly config: Required<Omit<AsyncMediaJobAdapterConfig, 'apiKey' | 'modelId' | 'pollUrlTemplate'>> & {
    apiKey?: string | null;
    modelId?: string | null;
    pollUrlTemplate?: string | null;
  };
  private readonly fetchImpl: typeof fetch | null;
  private readonly now: () => Date;
  private readonly sleepMs: (ms: number) => Promise<void>;

  constructor(config: AsyncMediaJobAdapterConfig, runtime: FetchRuntime = {}) {
    this.adapterId = config.adapterId;
    this.supportedModalities = config.supportedModalities;
    this.config = {
      ...config,
      submitUrl: config.submitUrl,
      statusPath: config.statusPath || 'status',
      jobIdPath: config.jobIdPath || 'id',
      resultPath: config.resultPath || 'data',
      maxPolls: config.maxPolls ?? 12,
      pollIntervalMs: config.pollIntervalMs ?? 1500,
      completedStatuses: config.completedStatuses || ['succeeded', 'success', 'completed', 'complete', 'done'],
      failedStatuses: config.failedStatuses || ['failed', 'error', 'cancelled', 'canceled'],
    };
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
    this.now = runtime.now || (() => new Date());
    this.sleepMs = runtime.sleepMs || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  public async generate(request: MediaGenerationRequest): Promise<AdapterGenerationOutput[]> {
    if (!this.fetchImpl) {
      throw new Error(`${this.adapterId} requires fetch in the runtime.`);
    }
    const modality = request.modality || this.supportedModalities[0] || 'video';
    const submitted = await this.submitJob(request, modality);
    const immediate = normalizeMediaOutputs(submitted.payload, {
      providerId: this.config.providerId,
      modelId: String(request.providerHints?.model || this.config.modelId || '').trim() || null,
      modality,
      fallbackContentType: contentTypeForModality(modality),
    });
    if (immediate.length > 0) {
      return immediate;
    }
    if (!submitted.jobId || !this.config.pollUrlTemplate) {
      throw new Error(`${this.adapterId} did not return media output or a pollable job id.`);
    }

    for (let attempt = 0; attempt < this.config.maxPolls; attempt += 1) {
      if (attempt > 0 && this.config.pollIntervalMs > 0) {
        await this.sleepMs(this.config.pollIntervalMs);
      }
      const pollPayload = await this.fetchJson(this.pollUrl(submitted.jobId), 'GET');
      const status = normalizeStatus(readPath(pollPayload, this.config.statusPath));
      if (this.config.completedStatuses.includes(status)) {
        const resultPayload = readPath(pollPayload, this.config.resultPath) || pollPayload;
        const outputs = normalizeMediaOutputs(resultPayload, {
          providerId: this.config.providerId,
          modelId: String(request.providerHints?.model || this.config.modelId || '').trim() || null,
          modality,
          fallbackContentType: contentTypeForModality(modality),
        });
        if (outputs.length > 0) {
          return outputs;
        }
      }
      if (this.config.failedStatuses.includes(status)) {
        throw new Error(`${this.adapterId} job ${submitted.jobId} failed with status ${status}.`);
      }
    }

    throw new Error(`${this.adapterId} job ${submitted.jobId} did not complete within polling budget.`);
  }

  public async getJobStatus(jobId: string): Promise<MediaJobStatusReceipt> {
    if (!this.config.pollUrlTemplate) {
      throw new Error(`${this.adapterId} does not expose a poll URL template.`);
    }
    const payload = await this.fetchJson(this.pollUrl(jobId), 'GET');
    return {
      providerId: this.config.providerId,
      jobId,
      status: toReceiptStatus(normalizeStatus(readPath(payload, this.config.statusPath))),
      liveIo: true,
      secretValuesSerialized: false,
      checkedAt: this.now().toISOString(),
    };
  }

  public async cancelJob(jobId: string): Promise<MediaJobCancelReceipt> {
    await this.fetchJson(`${this.pollUrl(jobId).replace(/\/+$/, '')}/cancel`, 'POST');
    return {
      providerId: this.config.providerId,
      jobId,
      status: 'cancel-requested',
      liveIo: true,
      secretValuesSerialized: false,
      cancelledAt: this.now().toISOString(),
    };
  }

  private async submitJob(request: MediaGenerationRequest, modality: MediaGenerationModality): Promise<{
    jobId: string | null;
    payload: unknown;
  }> {
    const payload = await this.fetchJson(this.config.submitUrl, 'POST', {
      prompt: request.prompt,
      modality,
      count: Math.min(Math.max(request.count || 1, 1), 4),
      size: request.sizeHint || undefined,
      aspect_ratio: request.sizeHint || undefined,
      style: request.styleHint || undefined,
      model: String(request.providerHints?.model || this.config.modelId || '').trim() || undefined,
    });
    return {
      jobId: stringOrNull(readPath(payload, this.config.jobIdPath) || payload?.job_id || payload?.request_id),
      payload,
    };
  }

  private async fetchJson(url: string, method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<any> {
    if (!this.fetchImpl) {
      throw new Error(`${this.adapterId} requires fetch in the runtime.`);
    }
    const response = await this.fetchImpl(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`${this.adapterId} HTTP ${response.status}: ${readError(payload, response.status)}`);
    }
    return payload;
  }

  private pollUrl(jobId: string): string {
    return String(this.config.pollUrlTemplate || '').replace(/\{jobId\}/g, encodeURIComponent(jobId));
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }
}

function normalizeMediaOutputs(payload: unknown, input: {
  providerId: string;
  modelId: string | null;
  modality: MediaGenerationModality;
  fallbackContentType: string;
}): AdapterGenerationOutput[] {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.outputs)
        ? payload.outputs
        : Array.isArray(payload?.images)
          ? payload.images
          : Array.isArray(payload?.videos)
            ? payload.videos
            : payload?.url || payload?.b64_json || payload?.base64 || payload?.output
              ? [payload]
              : [];

  const outputs: Array<AdapterGenerationOutput | null> = items
    .map((item: unknown) => {
      const base64 = stringOrNull(item?.b64_json || item?.base64 || item?.data_base64);
      const sourceUrl = stringOrNull(item?.url || item?.sourceUrl || item?.video_url || item?.image_url || item?.output);
      if (!base64 && !sourceUrl) {
        return null;
      }
      const data = base64 ? Buffer.from(stripDataUrlPrefix(base64), 'base64') : null;
      return {
        data,
        sourceUrl,
        contentType: stringOrNull(item?.contentType || item?.mime_type) || input.fallbackContentType,
        sizeBytes: data ? data.length : null,
        providerEvidence: {
          providerId: input.providerId,
          modelId: input.modelId,
          sourceUrl,
          metadata: {
            modality: input.modality,
            jobId: item?.id || item?.job_id || null,
          },
        },
      } satisfies AdapterGenerationOutput;
    });

  return outputs.filter((item: AdapterGenerationOutput | null): item is AdapterGenerationOutput => Boolean(item));
}

async function readJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch (error: unknown) {return null;
  }
}

function readError(payload: any, status: number): string {
  return String(payload?.error?.message || payload?.message || payload?.error || `HTTP ${status}`);
}

function readPath(payload: any, path: string): any {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, part) => current?.[part], payload);
}

function normalizeStatus(value: unknown): string {
  return String(value || 'unknown').trim().toLowerCase();
}

function toReceiptStatus(status: string): MediaJobStatusReceipt['status'] {
  if (['queued', 'pending'].includes(status)) return 'queued';
  if (['running', 'processing', 'in_progress'].includes(status)) return 'running';
  if (['succeeded', 'success', 'completed', 'complete', 'done'].includes(status)) return 'succeeded';
  if (['failed', 'error'].includes(status)) return 'failed';
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
  return 'unknown';
}

function stringOrNull(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function stripDataUrlPrefix(value: string): string {
  return value.replace(/^data:[^;]+;base64,/i, '');
}

function stripTrailingSlash(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function contentTypeForModality(modality: MediaGenerationModality): string {
  if (modality === 'video') return 'video/mp4';
  if (modality === 'audio') return 'audio/mpeg';
  return 'image/png';
}
