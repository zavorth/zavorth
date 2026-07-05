import fs from 'fs';
import { randomUUID } from 'node:crypto';
import path from 'path';
import { config } from '../../../config/index.js';
import { TelemetryRuntimeService } from '../../../services/telemetry/TelemetryRuntimeService.js';
import { logger } from '../../../logger.js';

export type EchoVoiceTelemetryInput = {
  surface: string;
  provider: string;
  model?: string | null;
  voiceName?: string | null;
  languageCode?: string | null;
  inputChars: number;
  latencyMs: number;
  mimeType?: string | null;
  outputBytes?: number | null;
  estimatedCostUsd?: number | null;
  fallbackFrom?: string | null;
  requestedBy?: string | null;
  sessionId?: string | null;
  traceId?: string | null;
  error?: string | null;
};

type VoiceTelemetryEvent = {
  timestamp: string;
  traceId: string;
  source: string;
  eventType: string;
  status?: string;
  payload?: Record<string, unknown>;
};

export type EchoVoiceSurfaceMetricsEntry = {
  surface: string;
  requests: number;
  successes: number;
  failures: number;
  totalInputChars: number;
  averageLatencyMs: number;
  knownCostUsd: number;
  unknownCostRequests: number;
  providers: string[];
  lastModel: string | null;
  lastVoiceName: string | null;
  lastUsedAt: string | null;
};

export type EchoVoiceMetricsSnapshot = {
  generatedAt: string;
  windowHours: number;
  totalRequests: number;
  successes: number;
  failures: number;
  totalInputChars: number;
  averageLatencyMs: number;
  knownCostUsd: number;
  unknownCostRequests: number;
  lastUsedAt: string | null;
  surfaces: EchoVoiceSurfaceMetricsEntry[];
  recommendation: string | null;
};

type MutableSurfaceMetrics = {
  surface: string;
  requests: number;
  successes: number;
  failures: number;
  totalInputChars: number;
  totalLatencyMs: number;
  knownCostUsd: number;
  unknownCostRequests: number;
  providers: Set<string>;
  lastModel: string | null;
  lastVoiceName: string | null;
  lastUsedAt: string | null;
};

type EchoVoiceTelemetryRuntime = {
  filePath?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  telemetryRuntime?: TelemetryRuntimeService;
};

const VOICE_TELEMETRY_SOURCE = 'echo-voice';

export class EchoVoiceTelemetryService {
  private readonly filePath: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly telemetryRuntime: TelemetryRuntimeService;

  constructor(runtime: EchoVoiceTelemetryRuntime = {}) {
    this.filePath = runtime.filePath || config.telemetryEventsFile || path.join(config.dataDir, 'runtime', 'telemetry-events.jsonl');
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.telemetryRuntime = runtime.telemetryRuntime || new TelemetryRuntimeService(this.filePath);
  }

  public async recordSuccess(input: EchoVoiceTelemetryInput): Promise<void> {
    await this.safeRecord({
      ...input,
      traceId: this.resolveTraceId(input.traceId),
      error: null,
    }, 'voice.tts.completed', 'completed');
  }

  public async recordFailure(input: EchoVoiceTelemetryInput): Promise<void> {
    await this.safeRecord({
      ...input,
      traceId: this.resolveTraceId(input.traceId),
    }, 'voice.tts.failed', 'failed');
  }

  public buildSnapshot(
    input: Date | Partial<{ referenceDate: Date; windowHours: number }> = {},
  ): EchoVoiceMetricsSnapshot {
    const normalizedInput = input instanceof Date ? { referenceDate: input } : (input || {});
    const referenceDate = normalizedInput.referenceDate || this.now();
    const windowHours = Math.max(1, Math.min(Number(normalizedInput.windowHours || 24 * 7), 24 * 30));
    const generatedAt = referenceDate.toISOString();

    if (!this.filePath || !this.existsSync(this.filePath)) {
      return {
        generatedAt,
        windowHours,
        totalRequests: 0,
        successes: 0,
        failures: 0,
        totalInputChars: 0,
        averageLatencyMs: 0,
        knownCostUsd: 0,
        unknownCostRequests: 0,
        lastUsedAt: null,
        surfaces: [],
        recommendation: 'Ainda nao ha telemetria de voz registrada por surface neste host.',
      };
    }

    const sinceMs = referenceDate.getTime() - windowHours * 60 * 60 * 1000;
    const events = this.readEvents().filter((event) => {
      const timestamp = Date.parse(String(event.timestamp || ''));
      return Number.isFinite(timestamp) && timestamp >= sinceMs;
    });

    const totals = {
      requests: 0,
      successes: 0,
      failures: 0,
      totalInputChars: 0,
      totalLatencyMs: 0,
      knownCostUsd: 0,
      unknownCostRequests: 0,
      lastUsedAt: null as string | null,
    };
    const surfaces = new Map<string, MutableSurfaceMetrics>();

    for (const event of events) {
      const payload = event.payload || {};
      const surface = this.normalizeText(payload.surface, 'unknown');
      const status = this.normalizeText(event.status || payload.status).toLowerCase();
      const inputChars = this.toPositiveNumber(payload.inputChars);
      const latencyMs = this.toPositiveNumber(payload.latencyMs);
      const estimatedCostUsd = this.toNullableNumber(payload.estimatedCostUsd);
      const provider = this.normalizeText(payload.provider, 'unknown');
      const model = this.normalizeNullableText(payload.model);
      const voiceName = this.normalizeNullableText(payload.voiceName);

      totals.requests += 1;
      totals.totalInputChars += inputChars;
      totals.totalLatencyMs += latencyMs;
      if (status === 'failed') {
        totals.failures += 1;
      } else {
        totals.successes += 1;
      }
      if (estimatedCostUsd === null) {
        totals.unknownCostRequests += 1;
      } else {
        totals.knownCostUsd += estimatedCostUsd;
      }
      if (!totals.lastUsedAt || String(event.timestamp).localeCompare(totals.lastUsedAt) > 0) {
        totals.lastUsedAt = event.timestamp;
      }

      const surfaceMetrics = surfaces.get(surface) || {
        surface,
        requests: 0,
        successes: 0,
        failures: 0,
        totalInputChars: 0,
        totalLatencyMs: 0,
        knownCostUsd: 0,
        unknownCostRequests: 0,
        providers: new Set<string>(),
        lastModel: null,
        lastVoiceName: null,
        lastUsedAt: null,
      };
      surfaceMetrics.requests += 1;
      surfaceMetrics.totalInputChars += inputChars;
      surfaceMetrics.totalLatencyMs += latencyMs;
      if (status === 'failed') {
        surfaceMetrics.failures += 1;
      } else {
        surfaceMetrics.successes += 1;
      }
      if (estimatedCostUsd === null) {
        surfaceMetrics.unknownCostRequests += 1;
      } else {
        surfaceMetrics.knownCostUsd += estimatedCostUsd;
      }
      surfaceMetrics.providers.add(provider);
      surfaceMetrics.lastModel = model || surfaceMetrics.lastModel;
      surfaceMetrics.lastVoiceName = voiceName || surfaceMetrics.lastVoiceName;
      if (!surfaceMetrics.lastUsedAt || String(event.timestamp).localeCompare(surfaceMetrics.lastUsedAt) > 0) {
        surfaceMetrics.lastUsedAt = event.timestamp;
      }
      surfaces.set(surface, surfaceMetrics);
    }

    const surfaceEntries = Array.from(surfaces.values())
      .map((entry) => ({
        surface: entry.surface,
        requests: entry.requests,
        successes: entry.successes,
        failures: entry.failures,
        totalInputChars: entry.totalInputChars,
        averageLatencyMs: entry.requests > 0 ? Math.round(entry.totalLatencyMs / entry.requests) : 0,
        knownCostUsd: roundUsd(entry.knownCostUsd),
        unknownCostRequests: entry.unknownCostRequests,
        providers: Array.from(entry.providers.values()).sort(),
        lastModel: entry.lastModel,
        lastVoiceName: entry.lastVoiceName,
        lastUsedAt: entry.lastUsedAt,
      }))
      .sort((left, right) => right.requests - left.requests || left.surface.localeCompare(right.surface));

    return {
      generatedAt,
      windowHours,
      totalRequests: totals.requests,
      successes: totals.successes,
      failures: totals.failures,
      totalInputChars: totals.totalInputChars,
      averageLatencyMs: totals.requests > 0 ? Math.round(totals.totalLatencyMs / totals.requests) : 0,
      knownCostUsd: roundUsd(totals.knownCostUsd),
      unknownCostRequests: totals.unknownCostRequests,
      lastUsedAt: totals.lastUsedAt,
      surfaces: surfaceEntries,
      recommendation: this.buildRecommendation({
        totalRequests: totals.requests,
        failures: totals.failures,
        unknownCostRequests: totals.unknownCostRequests,
        surfaces: surfaceEntries.length,
      }),
    };
  }

  private async safeRecord(
    input: EchoVoiceTelemetryInput & { traceId: string },
    eventType: string,
    status: 'completed' | 'failed',
  ): Promise<void> {
    try {
      await this.telemetryRuntime.record({
        traceId: input.traceId,
        source: VOICE_TELEMETRY_SOURCE,
        eventType,
        status,
        payload: {
          surface: this.normalizeText(input.surface, 'unknown'),
          provider: this.normalizeText(input.provider, 'unknown'),
          model: this.normalizeNullableText(input.model),
          voiceName: this.normalizeNullableText(input.voiceName),
          languageCode: this.normalizeNullableText(input.languageCode),
          inputChars: this.toPositiveNumber(input.inputChars),
          latencyMs: this.toPositiveNumber(input.latencyMs),
          mimeType: this.normalizeNullableText(input.mimeType),
          outputBytes: this.toNullableNumber(input.outputBytes),
          estimatedCostUsd: this.toNullableNumber(input.estimatedCostUsd),
          fallbackFrom: this.normalizeNullableText(input.fallbackFrom),
          requestedBy: this.normalizeNullableText(input.requestedBy),
          sessionId: this.normalizeNullableText(input.sessionId),
          error: this.normalizeNullableText(input.error),
          status,
        },
      });
    } catch (error) { // Observability must never break the calling surface. logger.warn('[Voice Telemetry] operation failed', error); }
  }

  private readEvents(): VoiceTelemetryEvent[] {
    try {
      const raw = this.readFileSync(this.filePath, 'utf8');
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as VoiceTelemetryEvent;
          } catch (error) { logger.warn('[Voice Telemetry] JSON parse failed', error); return null; }
        })
        .filter((entry): entry is VoiceTelemetryEvent => Boolean(entry?.traceId))
        .filter((entry) => entry.source === VOICE_TELEMETRY_SOURCE)
        .filter((entry) => /^voice\.tts\./.test(this.normalizeText(entry.eventType)));
    } catch (error) { logger.warn('[Voice Telemetry] JSON parse failed', error); return []; }
  }

  private resolveTraceId(value?: string | null): string {
    return this.normalizeText(value) || `voice-${randomUUID()}`;
  }

  private buildRecommendation(input: {
    totalRequests: number;
    failures: number;
    unknownCostRequests: number;
    surfaces: number;
  }): string | null {
    if (input.totalRequests === 0) {
      return 'Ative alguma surface de audio para formar baseline de custo e latencia.';
    }
    if (input.failures > 0) {
      return 'Revise as falhas de TTS antes de ampliar o rollout para outras surfaces.';
    }
    if (input.unknownCostRequests > 0) {
      return 'Parte do custo ainda esta sem estimativa; configure precificacao se quiser consolidar USD por surface.';
    }
    if (input.surfaces < 2) {
      return 'A telemetria ja esta ativa, mas ainda cobre poucas surfaces.';
    }
    return 'Telemetria de voz consolidada por surface, pronta para cockpit e comparacoes operacionais.';
  }

  private normalizeText(value: unknown, fallback = ''): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private normalizeNullableText(value: unknown): string | null {
    const normalized = this.normalizeText(value);
    return normalized.length > 0 ? normalized : null;
  }

  private toPositiveNumber(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
}

function roundUsd(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function estimateGeminiTtsCostUsd(
  inputChars: number,
  env: NodeJS.ProcessEnv = process.env,
): number | null {
  const per1kChars = readNullableEnvNumber(
    env.ZAVORTH_GEMINI_TTS_USD_PER_1K_CHARS
    || env.ZAVORTH_GEMINI_TTS_COST_USD_PER_1K_CHARS,
  );
  if (per1kChars === null) {
    return null;
  }
  const safeChars = Number.isFinite(inputChars) && inputChars > 0 ? inputChars : 0;
  return roundUsd((safeChars / 1000) * per1kChars);
}

function readNullableEnvNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
