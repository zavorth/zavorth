/**
 * Realtime duplex foundation — turn-based full-duplex style session.
 * Not WebRTC streaming; coordinates listen → agent → speak with barge-in state.
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

export const VOICE_DUPLEX_CONTRACT_VERSION = 'voice-duplex/v1' as const;

export type VoiceDuplexPhase =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'ended'
  | 'error';

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
};

export type VoiceDuplexAgentHandler = (input: {
  sessionId: string;
  agentText: string;
  surface: string;
}) => Promise<{ replyText: string }>;

export type VoiceDuplexSpeakHandler = (input: {
  sessionId: string;
  text: string;
  voiceId: string | null;
  forceProvider: 'edge-tts' | 'gemini';
}) => Promise<void>;

type SessionState = VoiceDuplexSessionSnapshot & {
  agentHandler: VoiceDuplexAgentHandler;
  speakHandler?: VoiceDuplexSpeakHandler | null;
};

const sessions = new Map<string, SessionState>();

export class VoiceRealtimeDuplexSessionService {
  private readonly preferences: VoicePreferenceService;
  private readonly dictation: VoiceDictationIngress;

  constructor(options: {
    voicePreferences?: VoicePreferenceService;
    dictation?: VoiceDictationIngress;
  } = {}) {
    this.preferences = options.voicePreferences || getVoicePreferenceService();
    this.dictation = options.dictation || getVoiceDictationIngress({ voicePreferences: this.preferences });
  }

  public start(input: {
    surface?: string;
    agentHandler: VoiceDuplexAgentHandler;
    speakHandler?: VoiceDuplexSpeakHandler | null;
  }): VoiceDuplexSessionSnapshot {
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
      agentHandler: input.agentHandler,
      speakHandler: input.speakHandler || null,
    };
    sessions.set(sessionId, snap);
    recordVoiceMetric({
      kind: 'duplex',
      ok: true,
      code: 'session_start',
      surface: snap.surface,
      source: 'duplex',
    });
    return this.publicSnapshot(snap);
  }

  public get(sessionId: string): VoiceDuplexSessionSnapshot | null {
    const s = sessions.get(sessionId);
    return s ? this.publicSnapshot(s) : null;
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
      return this.publicSnapshot(session);
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

    try {
      const { replyText } = await session.agentHandler({
        sessionId,
        agentText: prepared.agentText,
        surface: session.surface,
      });
      session.lastAgentText = String(replyText || '').trim() || null;
      session.turnCount += 1;
      session.lastError = null;

      const tts = resolveVoiceTts({
        preference: this.preferences.get(),
        ttsReplyDesired: prepared.ttsReplyDesired,
      });

      if (tts.ok && session.speakHandler && session.lastAgentText) {
        session.phase = 'speaking';
        session.updatedAt = new Date().toISOString();
        const t0 = Date.now();
        try {
          await session.speakHandler({
            sessionId,
            text: session.lastAgentText,
            voiceId: tts.voiceId,
            forceProvider: tts.forceProvider,
          });
          recordVoiceMetric({
            kind: 'tts',
            ok: true,
            surface: session.surface,
            provider: tts.provider,
            latencyMs: Date.now() - t0,
            chars: session.lastAgentText.length,
            source: 'duplex',
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

      session.phase = 'listening';
      session.updatedAt = new Date().toISOString();
      recordVoiceMetric({
        kind: 'duplex',
        ok: true,
        code: 'turn',
        surface: session.surface,
        chars: session.lastAgentText?.length ?? 0,
      });
      return this.publicSnapshot(session);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      session.phase = 'error';
      session.lastError = message;
      session.updatedAt = new Date().toISOString();
      recordVoiceMetric({
        kind: 'duplex',
        ok: false,
        code: 'agent_failed',
        message,
        surface: session.surface,
      });
      return this.publicSnapshot(session);
    }
  }

  /** User interrupted TTS — return to listening immediately. */
  public bargeIn(sessionId: string): VoiceDuplexSessionSnapshot {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Duplex session not found.');
    session.phase = 'listening';
    session.updatedAt = new Date().toISOString();
    recordVoiceMetric({
      kind: 'duplex',
      ok: true,
      code: 'barge_in',
      surface: session.surface,
    });
    return this.publicSnapshot(session);
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
}
