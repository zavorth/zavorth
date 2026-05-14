import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TtsService } from './TtsService.js';

export type GatewayCloudTtsOptions = {
  enabled?: boolean;
  baseUrl?: string;
  model?: string;
  voice?: string;
  responseFormat?: string;
  surface?: string;
  requestedBy?: string;
  sessionId?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  audioPlayer?: (filePath: string) => Promise<void>;
};

export type GatewayCloudTtsStatus = {
  available: boolean;
  method: string;
};

/**
 * Optional cloud TTS adapter for the local agent.
 * It prefers Zavorth's canonical `/api/v2/echo/audio/speech` route so the
 * agent stays adapter-only while the backend owns provider selection.
 */
export class GatewayCloudTtsService {
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly voice: string;
  private readonly responseFormat: string;
  private readonly surface: string;
  private readonly requestedBy: string;
  private readonly sessionId: string | null;
  private readonly apiKey: string | null;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly audioPlayer: (filePath: string) => Promise<void>;

  constructor(options?: GatewayCloudTtsOptions) {
    this.enabled = options?.enabled === true;
    this.baseUrl = normalizeBaseUrl(options?.baseUrl || 'http://localhost:3000');
    this.model = normalizeText(options?.model) || 'gemini-3.1-flash-tts-preview';
    this.voice = normalizeText(options?.voice) || 'Kore';
    this.responseFormat = normalizeText(options?.responseFormat) || 'wav';
    this.surface = normalizeText(options?.surface) || 'agent';
    this.requestedBy = normalizeText(options?.requestedBy) || 'zavorth-agent';
    this.sessionId = normalizeText(options?.sessionId) || null;
    this.apiKey = normalizeText(options?.apiKey) || null;
    this.timeoutMs = Number.isFinite(options?.timeoutMs) ? Math.max(1000, Number(options?.timeoutMs)) : 15000;
    this.fetchImpl = options?.fetchImpl || fetch;
    this.audioPlayer = options?.audioPlayer || TtsService.playAudioFile;
  }

  public isConfigured(): boolean {
    return this.enabled && this.baseUrl.length > 0 && this.model.length > 0;
  }

  public async isAvailable(): Promise<GatewayCloudTtsStatus> {
    if (!this.isConfigured()) {
      return { available: false, method: 'cloud-disabled' };
    }

    return {
      available: true,
      method: `cloud:${this.model}`,
    };
  }

  public async speak(text: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Cloud TTS disabled or not configured.');
    }

    const payload = {
      model: this.model,
      input: text,
      voice: this.voice,
      response_format: this.responseFormat,
      surface: this.surface,
      requestedBy: this.requestedBy,
      sessionId: this.sessionId,
    };

    let lastError: Error | null = null;
    for (const endpoint of buildEndpointCandidates(this.baseUrl)) {
      try {
        const response = await this.fetchImpl(endpoint, {
          method: 'POST',
          headers: buildHeaders(this.apiKey),
          body: JSON.stringify(buildPayloadForEndpoint(endpoint, payload)),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!response.ok) {
          throw new Error(`Cloud TTS request failed (${response.status}): ${await readErrorMessage(response)}`);
        }

        const audioBytes = Buffer.from(await response.arrayBuffer());
        if (audioBytes.length === 0) {
          throw new Error('Cloud TTS returned an empty audio payload.');
        }

        const audioPath = path.join(
          os.tmpdir(),
          `zavorth_cloud_tts_${Date.now()}_${Math.random().toString(36).slice(2)}.${resolveAudioExtension(this.responseFormat, response.headers.get('content-type'))}`,
        );

        fs.writeFileSync(audioPath, audioBytes);
        await this.audioPlayer(audioPath);
        return audioPath;
      } catch (error) {
        lastError = toError(error);
      }
    }

    throw new Error(`Cloud TTS unavailable: ${lastError?.message || 'unknown error'}`);
  }

  public cleanup(filePath: string): void {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore
    }
  }
}

function buildHeaders(apiKey: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function buildEndpointCandidates(baseUrl: string): string[] {
  const root = normalizeBaseUrl(baseUrl);
  const url = new URL(root);
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/api/v2/echo/audio/speech')) {
    return [root];
  }

  if (pathname.endsWith('/api/v2/echo')) {
    return [joinUrl(root, '/audio/speech')];
  }

  if (pathname.endsWith('/api/v1')) {
    return [joinUrl(root, '/audio/speech')];
  }

  if (pathname.endsWith('/v1')) {
    return [joinUrl(root, '/audio/speech')];
  }

  if (pathname.endsWith('/api')) {
    return [joinUrl(root, '/v1/audio/speech')];
  }

  if (pathname.endsWith('/audio/speech')) {
    return [root];
  }

  return [
    joinUrl(root, '/api/v2/echo/audio/speech'),
    joinUrl(root, '/api/v1/audio/speech'),
    joinUrl(root, '/v1/audio/speech'),
  ];
}

function buildPayloadForEndpoint(
  endpoint: string,
  payload: {
    model: string;
    input: string;
    voice: string;
    response_format: string;
    surface: string;
    requestedBy: string;
    sessionId: string | null;
  },
): Record<string, unknown> {
  if (/\/api\/v2\/echo\/audio\/speech$/i.test(endpoint)) {
    return payload;
  }

  return {
    model: payload.model,
    input: payload.input,
    voice: payload.voice,
    response_format: payload.response_format,
  };
}

function joinUrl(baseUrl: string, suffix: string): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  return `${normalizedBase}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

function normalizeBaseUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function resolveAudioExtension(responseFormat: string, contentType: string | null): string {
  const format = normalizeText(responseFormat).toLowerCase();
  if (format) {
    return format === 'mpeg' ? 'mp3' : format;
  }

  const content = normalizeText(contentType).toLowerCase();
  if (content.includes('audio/wav')) return 'wav';
  if (content.includes('audio/flac')) return 'flac';
  if (content.includes('audio/ogg')) return 'ogg';
  if (content.includes('audio/aac')) return 'aac';
  return 'mp3';
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === 'string') return data.error;
    if (typeof data?.message === 'string') return data.message;
    return JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return 'unreadable error payload';
    }
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
