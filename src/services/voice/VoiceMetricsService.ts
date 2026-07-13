/**
 * Phase 4 — fine metrics for voice STT/TTS (latencies, failures, language).
 */

export const VOICE_METRICS_CONTRACT_VERSION = 'voice-metrics/v1' as const;

export type VoiceMetricKind = 'stt' | 'tts' | 'dictation' | 'duplex';

export type VoiceMetricEvent = {
  at: string;
  kind: VoiceMetricKind;
  surface?: string | null;
  ok: boolean;
  provider?: string | null;
  model?: string | null;
  language?: string | null;
  latencyMs?: number | null;
  chars?: number | null;
  code?: string | null;
  message?: string | null;
  source?: string | null;
};

export type VoiceMetricsSnapshot = {
  version: typeof VOICE_METRICS_CONTRACT_VERSION;
  generatedAt: string;
  total: number;
  stt: { ok: number; fail: number; avgLatencyMs: number | null };
  tts: { ok: number; fail: number; avgLatencyMs: number | null };
  dictation: { ok: number; fail: number };
  duplex: { sessions: number; turns: number };
  recent: VoiceMetricEvent[];
};

const MAX = 300;
const events: VoiceMetricEvent[] = [];

export function recordVoiceMetric(
  event: Omit<VoiceMetricEvent, 'at'> & { at?: string },
): VoiceMetricEvent {
  const entry: VoiceMetricEvent = {
    at: event.at || new Date().toISOString(),
    kind: event.kind,
    surface: event.surface ?? null,
    ok: Boolean(event.ok),
    provider: event.provider ?? null,
    model: event.model ?? null,
    language: event.language ?? null,
    latencyMs: event.latencyMs ?? null,
    chars: event.chars ?? null,
    code: event.code ?? null,
    message: event.message ?? null,
    source: event.source ?? null,
  };
  events.push(entry);
  if (events.length > MAX) events.splice(0, events.length - MAX);
  return entry;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function getVoiceMetricsSnapshot(limit = 40): VoiceMetricsSnapshot {
  const stt = events.filter((e) => e.kind === 'stt');
  const tts = events.filter((e) => e.kind === 'tts');
  const dictation = events.filter((e) => e.kind === 'dictation');
  const duplex = events.filter((e) => e.kind === 'duplex');
  const sttLat = stt.filter((e) => e.ok && typeof e.latencyMs === 'number').map((e) => Number(e.latencyMs));
  const ttsLat = tts.filter((e) => e.ok && typeof e.latencyMs === 'number').map((e) => Number(e.latencyMs));

  return {
    version: VOICE_METRICS_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    total: events.length,
    stt: {
      ok: stt.filter((e) => e.ok).length,
      fail: stt.filter((e) => !e.ok).length,
      avgLatencyMs: avg(sttLat),
    },
    tts: {
      ok: tts.filter((e) => e.ok).length,
      fail: tts.filter((e) => !e.ok).length,
      avgLatencyMs: avg(ttsLat),
    },
    dictation: {
      ok: dictation.filter((e) => e.ok).length,
      fail: dictation.filter((e) => !e.ok).length,
    },
    duplex: {
      sessions: duplex.filter((e) => e.code === 'session_start').length,
      turns: duplex.filter((e) => e.code === 'turn').length,
    },
    recent: events.slice(-Math.max(1, Math.min(100, limit))),
  };
}

export function resetVoiceMetricsForTests(): void {
  events.length = 0;
}
