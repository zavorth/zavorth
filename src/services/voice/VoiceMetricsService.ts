/**
 * Voice metrics with optional durable JSONL append.
 * In-memory ring buffer for live snapshot; disk for history (no secrets).
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config/index.js';

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
  persistentPath?: string | null;
};

const MAX = 300;
const events: VoiceMetricEvent[] = [];

/** Redact likely secrets from metric messages before disk. */
function sanitizeMessage(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw);
  // tokens / api keys patterns
  s = s.replace(/\b(sk-[A-Za-z0-9_-]{10,})\b/g, '[redacted]');
  s = s.replace(/\b(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1[redacted]');
  s = s.replace(/\b(api[_-]...key|token|secret|password)\s*[:=]\s*\S+/gi, '$1=[redacted]');
  if (s.length > 500) s = `${s.slice(0, 500)}...`;
  return s;
}

function resolveMetricsPath(): string {
  const override = String(process.env.ZAVORTH_VOICE_METRICS_PATH || '').trim();
  if (override) return path.resolve(override);
  const root = path.resolve(config.projectRoot || process.cwd());
  return path.join(root, 'data', 'runtime', 'voice', 'metrics.jsonl');
}

function persistEnabled(): boolean {
  const v = String(process.env.ZAVORTH_VOICE_METRICS_PERSIST || 'true').toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

function appendPersistent(entry: VoiceMetricEvent): void {
  if (!persistEnabled()) return;
  if (process.env.NODE_ENV === 'test' && !process.env.ZAVORTH_VOICE_METRICS_PATH) {
    return; // avoid writing into repo during unit tests unless path set
  }
  try {
    const filePath = resolveMetricsPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const line = JSON.stringify({
      ...entry,
      message: sanitizeMessage(entry.message),
    });
    fs.appendFileSync(filePath, `${line}\n`, { encoding: 'utf8' });
  } catch {
    // never break voice path on metrics IO
  }
}

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
    message: sanitizeMessage(event.message),
    source: event.source ?? null,
  };
  events.push(entry);
  if (events.length > MAX) events.splice(0, events.length - MAX);
  appendPersistent(entry);
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
    persistentPath: persistEnabled() ? resolveMetricsPath() : null,
  };
}

export function resetVoiceMetricsForTests(): void {
  events.length = 0;
}
