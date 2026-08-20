import { randomUUID } from 'node:crypto';

type EchoVoiceAssetStoreOptions = {
  now?: () => number;
  defaultTtlMs?: number;
  maxAssets?: number;
  maxBytes?: number;
};

type EchoVoiceAssetRecord = {
  id: string;
  accessToken: string;
  audio: Buffer;
  mimeType: string;
  bytes: number;
  createdAt: string;
  expiresAt: string;
  surface: string;
  requestedBy: string | null;
  sessionId: string | null;
  traceId: string | null;
  model: string | null;
  voiceName: string | null;
  languageCode: string | null;
};

export type PublishedEchoVoiceAsset = Omit<EchoVoiceAssetRecord, 'audio'> & {
  routePath: string;
  publicUrl: string;
};

export type ResolvedEchoVoiceAsset = EchoVoiceAssetRecord;

/**
 * Short-lived in-memory voice artifact store shared by Echo surfaces.
 * Assets are tokenized, TTL-bound and aggressively pruned so Home Assistant can
 * fetch generated audio without leaving persistent files behind.
 */
export class EchoVoiceAssetStoreService {
  private readonly now: () => number;
  private readonly defaultTtlMs: number;
  private readonly maxAssets: number;
  private readonly maxBytes: number;
  private readonly assets = new Map<string, EchoVoiceAssetRecord>();

  constructor(options: EchoVoiceAssetStoreOptions = {}) {
    this.now = options.now || (() => Date.now());
    this.defaultTtlMs = sanitizeInteger(options.defaultTtlMs, 15 * 60 * 1000);
    this.maxAssets = sanitizeInteger(options.maxAssets, 24);
    this.maxBytes = sanitizeInteger(options.maxBytes, 32 * 1024 * 1024);
  }

  public publish(input: {
    audio: Buffer;
    mimeType: string;
    publicBaseUrl: string;
    surface: string;
    requestedBy?: string | null;
    sessionId?: string | null;
    traceId?: string | null;
    model?: string | null;
    voiceName?: string | null;
    languageCode?: string | null;
    ttlMs?: number;
  }): PublishedEchoVoiceAsset {
    const audio = Buffer.isBuffer(input.audio) ? Buffer.from(input.audio) : Buffer.from([]);
    if (audio.length === 0) {
      throw new Error('Empty Echo audio cannot be published as an asset.');
    }

    const publicBaseUrl = normalizeBaseUrl(input.publicBaseUrl);
    if (!publicBaseUrl) {
      throw new Error('ZAVORTH_PUBLIC_BASE_URL must be configured to deliver audio to Home Assistant.');
    }

    this.pruneExpired();

    const id = `voice-${this.now()}-${randomUUID().slice(0, 8)}`;
    const accessToken = randomUUID().replace(/-/g, '');
    const createdAt = new Date(this.now()).toISOString();
    const ttlMs = sanitizeInteger(input.ttlMs, this.defaultTtlMs);
    const expiresAt = new Date(this.now() + ttlMs).toISOString();
    const record: EchoVoiceAssetRecord = {
      id,
      accessToken,
      audio,
      mimeType: String(input.mimeType || 'audio/wav').trim() || 'audio/wav',
      bytes: audio.length,
      createdAt,
      expiresAt,
      surface: String(input.surface || 'unknown').trim() || 'unknown',
      requestedBy: normalizeNullableText(input.requestedBy),
      sessionId: normalizeNullableText(input.sessionId),
      traceId: normalizeNullableText(input.traceId),
      model: normalizeNullableText(input.model),
      voiceName: normalizeNullableText(input.voiceName),
      languageCode: normalizeNullableText(input.languageCode),
    };
    this.assets.set(id, record);
    this.enforceBudgets();

    const routePath = this.buildRoutePath(id, accessToken);
    return {
      ...omitAudio(record),
      routePath,
      publicUrl: `${publicBaseUrl}${routePath}`,
    };
  }

  public read(id: string, accessToken: string): ResolvedEchoVoiceAsset | null {
    this.pruneExpired();
    const record = this.assets.get(String(id || '').trim());
    if (!record) {
      return null;
    }
    if (record.accessToken !== String(accessToken || '').trim()) {
      return null;
    }
    return {
      ...record,
      audio: Buffer.from(record.audio),
    };
  }

  public remove(id: string): void {
    this.assets.delete(String(id || '').trim());
  }

  public clear(): void {
    this.assets.clear();
  }

  private enforceBudgets(): void {
    this.pruneExpired();

    const entries = Array.from(this.assets.values())
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    let totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);

    while (entries.length > this.maxAssets || totalBytes > this.maxBytes) {
      const victim = entries.shift();
      if (!victim) {
        break;
      }
      this.assets.delete(victim.id);
      totalBytes -= victim.bytes;
    }
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [id, record] of this.assets.entries()) {
      const expiresAtMs = Date.parse(record.expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
        this.assets.delete(id);
      }
    }
  }

  private buildRoutePath(id: string, accessToken: string): string {
    return `/api/v2/echo/audio/assets/${encodeURIComponent(id)}/access/${encodeURIComponent(accessToken)}`;
  }
}

let defaultEchoVoiceAssetStore: EchoVoiceAssetStoreService | null = null;

export function getDefaultEchoVoiceAssetStore(): EchoVoiceAssetStoreService {
  if (!defaultEchoVoiceAssetStore) {
    defaultEchoVoiceAssetStore = new EchoVoiceAssetStoreService();
  }
  return defaultEchoVoiceAssetStore;
}

function normalizeBaseUrl(value: string): string {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(normalized) ? normalized : '';
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function sanitizeInteger(value: unknown, fallback: number): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function omitAudio(record: EchoVoiceAssetRecord): Omit<EchoVoiceAssetRecord, 'audio'> {
  const { audio: _audio, ...rest } = record;
  return rest;
}
