/**
 * Realtime duplex foundation — turn-coordinated full-duplex style session.
 * Media path: HTTP chunked MediaRecorder (VoiceMediaStreamDuplex) + optional WebRTC signaling.
 *
 * Flow:
 *   start() → listening
 *   completeListen(transcript|audio) → processing (dictation → agent callback)
 *   completeSpeak() / bargeIn() → listening again
 *   end()
 */

import { randomUUID } from 'node:crypto';
import {
  getVoiceDictationIngress,
  type VoiceDictationIngress,
} from './VoiceDictationIngress.js';
import {
  getVoicePreferenceService,
  type VoicePreferenceService,
} from './VoicePreferenceService.js';
import { resolveVoiceTts } from './VoiceTtsPolicy.js';
import { recordVoiceMetric } from './VoiceMetricsService.js';
import { publishToSession } from './VoiceDuplexEventBus.js';
import {
  getVoiceDuplexSessionStore,
  type VoiceDuplexSessionStore,
} from './VoiceDuplexSessionStore.js';

export const VOICE_DUPLEX_CONTRACT_VERSION = 'voice-duplex/v1' as const;

export type VoiceDuplexPhase =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'ended'
  | 'error';

export type VoiceDuplexAudioPayload = {
  mimeType: string;
  audioBase64: string;
  provider?: string | null;
};

export type VoiceDuplexSessionSnapshot = {
  version: typeof VOICE_DUPLEX_CONTRACT_VERSION;
  sessionId: string;
  phase: VoiceDuplexPhase;
  surface: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  lastTranscript: string | null;
  lastAgentText: string | null;
  lastError: string | null;
  ttsEnabled: boolean;
  bargeInSupported: true;
  /** Backend TTS audio for last agent reply (Desktop plays this instead of browser-only speech). */
  lastTtsAudio: VoiceDuplexAudioPayload | null;
  /** Experience thread session this duplex is bound to (Desktop chat continuity). */
  experienceSessionId: string | null;
  workspace: string | null;
};

export type VoiceDuplexAgentHandler = (input: {
  sessionId: string;
  agentText: string;
  surface: string;
  /** Abort when user barges-in mid-agent (Gap 1) */
  signal?: AbortSignal;
}) => Promise<{ replyText: string }>;

export type VoiceDuplexSpeakHandler = (input: {
  sessionId: string;
  text: string;
  voiceId: string | null;
  forceProvider: 'edge-tts' | 'gemini';
}) => Promise<VoiceDuplexAudioPayload | void>;

type SessionState = VoiceDuplexSessionSnapshot & {
  agentHandler: VoiceDuplexAgentHandler;
  speakHandler?: VoiceDuplexSpeakHandler | null;
  /** Incremented on barge-in so in-flight speak/agent can detect interrupt */
  bargeEpoch: number;
  /** AbortController for in-flight agent turn */
  agentAbort: AbortController | null;
  ownerUserId: string | null;
};

const sessions = new Map<string, SessionState>();

function envInt(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export class VoiceRealtimeDuplexSessionService {
  private readonly preferences: VoicePreferenceService;
  private readonly dictation: VoiceDictationIngress;
  private readonly maxSessions: number;
  private readonly ttlMs: number;
  private readonly durable: VoiceDuplexSessionStore;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: {
    voicePreferences?: VoicePreferenceService;
    dictation?: VoiceDictationIngress;
    maxSessions?: number;
    ttlMs?: number;
    durableStore?: VoiceDuplexSessionStore;
  } = {}) {
    this.preferences = options.voicePreferences || getVoicePreferenceService();
    this.dictation = options.dictation || getVoiceDictationIngress({ voicePreferences: this.preferences });
    this.maxSessions = options.maxSessions ?? envInt('ZAVORTH_VOICE_DUPLEX_MAX_SESSIONS', 32, 1, 500);
    this.ttlMs = options.ttlMs ?? envInt('ZAVORTH_VOICE_DUPLEX_TTL_MS', 30 * 60_000, 60_000, 24 * 60 * 60_000);
    this.durable = options.durableStore || getVoiceDuplexSessionStore();
    this.ensurePruneTimer();
  }

  private persist(session: SessionState): void {
    try {
      this.durable.save(this.publicSnapshot(session), session.ownerUserId);
    } catch {
      // ignore
    }
  }

  private ensurePruneTimer(): void {
    if (this.pruneTimer || process.env.NODE_ENV === 'test') return;
    this.pruneTimer = setInterval(() => {
      this.pruneExpired();
    }, 60_000);
    this.pruneTimer.unref?.();
  }

  /** Gap 3 — drop idle/expired sessions; enforce max concurrent. */
  public pruneExpired(nowMs = Date.now()): number {
    let removed = 0;
    for (const [id, s] of sessions) {
      const updated = Date.parse(s.updatedAt) || Date.parse(s.createdAt) || 0;
      if (!updated || nowMs - updated > this.ttlMs || s.phase === 'ended') {
        try {
          s.agentAbort?.abort();
        } catch {
          // ignore
        }
        sessions.delete(id);
        try {
          this.durable.remove(id);
        } catch {
          // ignore
        }
        removed += 1;
      }
    }
    // If still over cap, drop oldest by updatedAt
    if (sessions.size > this.maxSessions) {
      const ordered = [...sessions.entries()].sort(
        (a, b) => Date.parse(a[1].updatedAt) - Date.parse(b[1].updatedAt),
      );
      while (sessions.size > this.maxSessions && ordered.length) {
        const [id, s] = ordered.shift()!;
        try {
          s.agentAbort?.abort();
        } catch {
          // ignore
        }
        sessions.delete(id);
        try {
          this.durable.remove(id);
        } catch {
          // ignore
        }
        removed += 1;
      }
    }
    return removed;
  }

  public start(input: {
    surface?: string;
    agentHandler: VoiceDuplexAgentHandler;
    speakHandler?: VoiceDuplexSpeakHandler | null;
    experienceSessionId?: string | null;
    workspace?: string | null;
    ownerUserId?: string | null;
  }): VoiceDuplexSessionSnapshot {
    this.pruneExpired();
    if (sessions.size >= this.maxSessions) {
      this.pruneExpired();
      if (sessions.size >= this.maxSessions) {
        throw new Error(
          `Too many active voice sessions (max ${this.maxSessions}). End an existing call or try later.`,
        );
      }
    }
    const pref = this.preferences.get();
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const snap: SessionState = {
      version: VOICE_DUPLEX_CONTRACT_VERSION,
      sessionId,
      phase: 'listening',
      surface: String(input.surface || 'desktop').trim() || 'desktop',
      createdAt: now,
      updatedAt: now,
      turnCount: 0,
      lastTranscript: null,
      lastAgentText: null,
      lastError: null,
      ttsEnabled: Boolean(pref.tts.enabled && pref.tts.provider !== 'none'),
      bargeInSupported: true,
      lastTtsAudio: null,
      experienceSessionId: input.experienceSessionId
        ? String(input.experienceSessionId).trim() || null
        : null,
      workspace: input.workspace ? String(input.workspace).trim() || null : null,
      agentHandler: input.agentHandler,
      speakHandler: input.speakHandler || null,
      bargeEpoch: 0,
      agentAbort: null,
      ownerUserId: input.ownerUserId ? String(input.ownerUserId).trim() || null : null,
    };
    sessions.set(sessionId, snap);
    this.persist(snap);
    recordVoiceMetric({
      kind: 'duplex',
      ok: true,
      code: 'session_start',
      surface: snap.surface,
      source: 'duplex',
    });
    const publicSnap = this.publicSnapshot(snap);
    publishToSession(publicSnap, 'session');
    return publicSnap;
  }

  public get(sessionId: string): VoiceDuplexSessionSnapshot | null {
    const s = sessions.get(sessionId);
    if (s) return this.publicSnapshot(s);
    // Durable orphan after restart — honest error, not silent null
    const durable = this.durable.get(sessionId);
    if (durable?.snapshot) {
      return durable.snapshot;
    }
    return null;
  }

  /**
   * Finish a listen turn with a transcript (after STT) and run the agent.
   * Optionally speaks the reply when preference TTS is on.
   */
  public async completeListen(
    sessionId: string,
    input: {
      transcript: string;
      provider?: string | null;
      model?: string | null;
      languageCode?: string | null;
      confidence?: number | null;
    },
  ): Promise<VoiceDuplexSessionSnapshot> {
    const session = sessions.get(sessionId);
    if (!session || session.phase === 'ended') {
      throw new Error('Duplex session not found or ended.');
    }

    session.phase = 'processing';
    session.updatedAt = new Date().toISOString();
    this.persist(session);
    publishToSession(this.publicSnapshot(session), 'phase');

    const prepared = this.dictation.prepare({
      transcript: input.transcript,
      provider: input.provider,
      model: input.model,
      languageCode: input.languageCode,
      confidence: input.confidence,
      preference: this.preferences.get(),
      surface: session.surface,
    });

    if (!prepared.ok) {
      session.phase = 'error';
      session.lastError = prepared.message;
      session.updatedAt = new Date().toISOString();
      recordVoiceMetric({
        kind: 'duplex',
        ok: false,
        code: prepared.code,
        message: prepared.message,
        surface: session.surface,
      });
      const errSnap = this.publicSnapshot(session);
      publishToSession(errSnap, 'error', prepared.message);
      return errSnap;
    }

    session.lastTranscript = prepared.agentText;
    recordVoiceMetric({
      kind: 'dictation',
      ok: true,
      surface: session.surface,
      chars: prepared.agentText.length,
      language: input.languageCode,
      provider: input.provider,
      source: 'duplex',
    });

    const epochAtAgent = session.bargeEpoch;
    try {
      // Gap 1 — abortable agent turn
      try {
        session.agentAbort?.abort();
      } catch {
        // ignore
      }
      session.agentAbort = new AbortController();
      const signal = session.agentAbort.signal;

      const { replyText } = await session.agentHandler({
        sessionId,
        agentText: prepared.agentText,
        surface: session.surface,
        signal,
      });

      // Discard late agent result after barge-in
      if (session.bargeEpoch !== epochAtAgent || signal.aborted) {
        session.agentAbort = null;
        session.phase = 'listening';
        session.updatedAt = new Date().toISOString();
        session.lastTtsAudio = null;
        this.persist(session);
        const snap = this.publicSnapshot(session);
        publishToSession(snap, 'barge_in', 'agent_aborted');
        return snap;
      }

      session.agentAbort = null;
      session.lastAgentText = String(replyText || '').trim() || null;
      session.turnCount += 1;
      session.lastError = null;

      const tts = resolveVoiceTts({
        preference: this.preferences.get(),
        ttsReplyDesired: prepared.ttsReplyDesired,
      });

      session.lastTtsAudio = null;
      const epochAtSpeak = session.bargeEpoch;
      if (tts.ok && session.speakHandler && session.lastAgentText) {
        session.phase = 'speaking';
        session.updatedAt = new Date().toISOString();
        publishToSession(this.publicSnapshot(session), 'phase');
        const t0 = Date.now();
        try {
          const audio = await session.speakHandler({
            sessionId,
            text: session.lastAgentText,
            voiceId: tts.voiceId,
            forceProvider: tts.forceProvider,
          });
          // Ignore TTS if user barged-in during synthesis
          if (session.bargeEpoch === epochAtSpeak && audio && audio.audioBase64) {
            session.lastTtsAudio = {
              mimeType: audio.mimeType || 'audio/mpeg',
              audioBase64: audio.audioBase64,
              provider: audio.provider || tts.provider,
            };
          }
          recordVoiceMetric({
            kind: 'tts',
            ok: session.bargeEpoch === epochAtSpeak,
            surface: session.surface,
            provider: tts.provider,
            latencyMs: Date.now() - t0,
            chars: session.lastAgentText.length,
            source: 'duplex',
            code: session.bargeEpoch === epochAtSpeak ? 'tts_ok' : 'tts_aborted_barge_in',
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          recordVoiceMetric({
            kind: 'tts',
            ok: false,
            surface: session.surface,
            message,
            source: 'duplex',
          });
          // Fall through to listening; agent text still available
        }
      }

      // Barged mid-speak: bargeIn already set listening + published barge_in
      if (session.bargeEpoch !== epochAtSpeak) {
        return this.publicSnapshot(session);
      }

      session.phase = 'listening';
      session.updatedAt = new Date().toISOString();
      recordVoiceMetric({
        kind: 'duplex',
        ok: true,
        code: 'turn',
        surface: session.surface,
        chars: session.lastAgentText?.length ?? 0,
      });
      this.persist(session);
      const turnSnap = this.publicSnapshot(session);
      publishToSession(turnSnap, 'turn');
      return turnSnap;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      session.agentAbort = null;
      // Gap 1 — barge-in / abort is not an error surface
      if (/aborted|barge-in/i.test(message) || session.bargeEpoch !== epochAtAgent) {
        session.phase = 'listening';
        session.lastError = null;
        session.lastTtsAudio = null;
        session.updatedAt = new Date().toISOString();
        this.persist(session);
        const snap = this.publicSnapshot(session);
        publishToSession(snap, 'barge_in', 'agent_aborted');
        return snap;
      }
      session.phase = 'error';
      session.lastError = message;
      session.updatedAt = new Date().toISOString();
      this.persist(session);
      recordVoiceMetric({
        kind: 'duplex',
        ok: false,
        code: 'agent_failed',
        message,
        surface: session.surface,
      });
      const errSnap = this.publicSnapshot(session);
      publishToSession(errSnap, 'error', message);
      return errSnap;
    }
  }

  /** Gap 7 — optional owner check for push/SSE (desktop-user etc.) */
  public assertOwner(sessionId: string, userId?: string | null): boolean {
    const s = sessions.get(sessionId);
    if (!s) return false;
    if (!s.ownerUserId) return true;
    if (!userId) return false;
    return s.ownerUserId === String(userId).trim();
  }

  /**
   * User interrupted TTS / agent speak — return to listening immediately.
   * Publishes `barge_in` so Desktop cancels local audio playback.
   */
  public bargeIn(sessionId: string): VoiceDuplexSessionSnapshot {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Duplex session not found.');
    const wasSpeaking =
      session.phase === 'speaking' || session.phase === 'processing';
    session.bargeEpoch = (session.bargeEpoch || 0) + 1;
    // Gap 1 — hard-cancel in-flight agent
    try {
      session.agentAbort?.abort();
    } catch {
      // ignore
    }
    session.agentAbort = null;
    session.phase = 'listening';
    session.lastError = null;
    session.updatedAt = new Date().toISOString();
    // Drop pending TTS payload so late clients do not re-play interrupted audio
    if (wasSpeaking) {
      session.lastTtsAudio = null;
    }
    recordVoiceMetric({
      kind: 'duplex',
      ok: true,
      code: 'barge_in',
      surface: session.surface,
      message: wasSpeaking ? 'interrupted_speak' : 'already_listening',
    });
    this.persist(session);
    const snap = this.publicSnapshot(session);
    publishToSession(snap, 'barge_in', 'barge_in');
    return snap;
  }

  public end(sessionId: string): VoiceDuplexSessionSnapshot | null {
    const session = sessions.get(sessionId);
    if (!session) return null;
    session.phase = 'ended';
    session.updatedAt = new Date().toISOString();
    recordVoiceMetric({
      kind: 'duplex',
      ok: true,
      code: 'session_end',
      surface: session.surface,
    });
    const snap = this.publicSnapshot(session);
    sessions.delete(sessionId);
    try {
      this.durable.remove(sessionId);
    } catch {
      // ignore
    }
    publishToSession(snap, 'ended');
    return snap;
  }

  public listActive(): VoiceDuplexSessionSnapshot[] {
    return [...sessions.values()]
      .filter((s) => s.phase !== 'ended')
      .map((s) => this.publicSnapshot(s));
  }

  private publicSnapshot(session: SessionState): VoiceDuplexSessionSnapshot {
    return {
      version: session.version,
      sessionId: session.sessionId,
      phase: session.phase,
      surface: session.surface,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      turnCount: session.turnCount,
      lastTranscript: session.lastTranscript,
      lastAgentText: session.lastAgentText,
      lastError: session.lastError,
      ttsEnabled: session.ttsEnabled,
      bargeInSupported: true,
      lastTtsAudio: session.lastTtsAudio
        ? {
            mimeType: session.lastTtsAudio.mimeType,
            audioBase64: session.lastTtsAudio.audioBase64,
            provider: session.lastTtsAudio.provider ?? null,
          }
        : null,
      experienceSessionId: session.experienceSessionId ?? null,
      workspace: session.workspace ?? null,
    };
  }
}

let defaultDuplex: VoiceRealtimeDuplexSessionService | null = null;

export function getVoiceRealtimeDuplexSessionService(): VoiceRealtimeDuplexSessionService {
  if (!defaultDuplex) defaultDuplex = new VoiceRealtimeDuplexSessionService();
  return defaultDuplex;
}

export function resetVoiceRealtimeDuplexForTests(): void {
  defaultDuplex = null;
  sessions.clear();
  // Keep event bus independent; tests that need a clean bus call resetVoiceDuplexEventBusForTests.
}
