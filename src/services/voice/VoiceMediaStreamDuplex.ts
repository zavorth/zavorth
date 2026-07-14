/**
 * Chunked media-stream duplex with VAD + utterance assembly.
 *
 * Client: MediaRecorder (VAD-gated) → base64 chunks → ingestAudioChunk
 *   → energy filter → STT → assemble utterance → duplex completeListen (agent)
 */

import {
  getVoiceRealtimeDuplexSessionService,
  type VoiceDuplexSessionSnapshot,
  type VoiceRealtimeDuplexSessionService,
} from './VoiceRealtimeDuplexSession.js';
import { AudioTranscriptionService } from '../AudioTranscriptionService.js';
import { getVoicePreferenceService } from './VoicePreferenceService.js';
import { normalizeVoiceLanguage } from './VoiceLanguage.js';
import { recordVoiceMetric } from './VoiceMetricsService.js';
import { estimateChunkEnergy, VoiceUtteranceAssembler } from './VoiceVad.js';
import { publish } from './VoiceDuplexEventBus.js';

export const VOICE_MEDIA_STREAM_VERSION = 'voice-media-stream/v2' as const;

export type VoiceMediaChunkResult = {
  version: typeof VOICE_MEDIA_STREAM_VERSION;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  transcript?: string | null;
  bufferedUtterance?: string | null;
  sttProvider?: string | null;
  energy?: number | null;
  session?: VoiceDuplexSessionSnapshot | null;
  error?: string | null;
  utteranceFlushed?: boolean;
};

type SessionMediaState = {
  assembler: VoiceUtteranceAssembler;
  audioParts: Buffer[];
  mimeType: string;
  lastActivityAt: number;
};

export class VoiceMediaStreamDuplexService {
  private readonly duplex: VoiceRealtimeDuplexSessionService;
  private readonly stt: AudioTranscriptionService;
  private readonly bySession = new Map<string, SessionMediaState>();

  constructor(options: {
    duplex?: VoiceRealtimeDuplexSessionService;
    stt?: AudioTranscriptionService;
  } = {}) {
    this.duplex = options.duplex || getVoiceRealtimeDuplexSessionService();
    this.stt = options.stt || new AudioTranscriptionService();
  }

  public resetSession(sessionId: string): void {
    this.bySession.delete(sessionId);
  }

  /**
   * Ingest one media chunk for an active duplex session.
   * Uses energy VAD + utterance assembly so agent turns fire on end-of-speech, not every timeslice.
   */
  public async ingestAudioChunk(input: {
    sessionId: string;
    audioBase64: string;
    mimeType?: string;
    fileName?: string;
    language?: string | null;
    /** When true (default), run agent after utterance flush */
    runAgent?: boolean;
    /** Client VAD says this ends an utterance */
    endOfUtterance?: boolean;
    /** Client-reported RMS 0..1 (optional) */
    clientEnergy?: number | null;
  }): Promise<VoiceMediaChunkResult> {
    const sessionId = String(input.sessionId || '').trim();
    if (!sessionId) {
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: false,
        error: 'sessionId is required for media chunk.',
      };
    }

    const existing = this.duplex.get(sessionId);
    if (!existing || existing.phase === 'ended') {
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: false,
        error: 'Duplex session not found or ended. Type your message instead.',
      };
    }

    // Don't accept new speech while agent is processing/speaking unless barge-in already set listening
    if (existing.phase === 'processing') {
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: true,
        skipped: true,
        reason: 'busy_processing',
        session: existing,
      };
    }

    let audio: Buffer;
    try {
      audio = Buffer.from(String(input.audioBase64 || ''), 'base64');
    } catch {
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: false,
        error: 'Invalid audio base64. Type your message instead.',
      };
    }

    const energy = estimateChunkEnergy(audio);
    const clientEnergy =
      typeof input.clientEnergy === 'number' ? input.clientEnergy : null;
    const speechLikely =
      energy.speechLikely ||
      (clientEnergy != null && clientEnergy >= 0.02 && audio.length >= 1200);

    if (!speechLikely && !input.endOfUtterance) {
      // Silence tick — may flush buffered utterance
      const media = this.ensureMedia(sessionId, input.mimeType);
      const polled = media.assembler.poll(Date.now());
      if (polled.ready && polled.utterance) {
        return this.flushUtterance(sessionId, polled.utterance, input, existing);
      }
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: true,
        skipped: true,
        reason: energy.reason || 'silence',
        energy: energy.energy,
        bufferedUtterance: polled.buffered || null,
        session: existing,
      };
    }

    if (!speechLikely && input.endOfUtterance) {
      const media = this.ensureMedia(sessionId, input.mimeType);
      const forced = media.assembler.forceFlush();
      if (forced) {
        return this.flushUtterance(sessionId, forced, input, existing);
      }
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: true,
        skipped: true,
        reason: 'end_without_speech',
        energy: energy.energy,
        session: existing,
      };
    }

    const pref = getVoicePreferenceService().get();
    const lang = normalizeVoiceLanguage(
      input.language || pref.stt.language || 'auto',
    );

    const t0 = Date.now();
    const stt = await this.stt.transcribe({
      audio,
      mimeType: input.mimeType || 'audio/webm',
      fileName: input.fileName || 'duplex-chunk.webm',
      language: lang.isAuto ? null : lang.whisper,
      sessionId: `duplex:${sessionId}`,
    });

    if (!stt.ok || !stt.text) {
      // Soft-skip STT noise on intermediate chunks unless endOfUtterance
      if (!input.endOfUtterance) {
        recordVoiceMetric({
          kind: 'stt',
          ok: false,
          message: stt.error || 'STT soft-fail on chunk',
          surface: existing.surface,
          latencyMs: Date.now() - t0,
          language: lang.whisper,
          source: 'media_stream',
        });
        return {
          version: VOICE_MEDIA_STREAM_VERSION,
          ok: true,
          skipped: true,
          reason: 'stt_soft_fail',
          energy: energy.energy,
          session: existing,
          error: null,
        };
      }
      recordVoiceMetric({
        kind: 'stt',
        ok: false,
        message: stt.error || 'STT failed on media chunk',
        surface: existing.surface,
        latencyMs: Date.now() - t0,
        language: lang.whisper,
        source: 'media_stream',
      });
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: false,
        error: `${stt.error || 'STT failed on media chunk'}. Type your message instead.`,
        session: existing,
      };
    }

    const transcript = String(stt.text).trim();
    if (!transcript) {
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: true,
        skipped: true,
        reason: 'empty_transcript',
        sttProvider: stt.provider,
        energy: energy.energy,
        session: existing,
      };
    }

    const media = this.ensureMedia(sessionId, input.mimeType);
    media.lastActivityAt = Date.now();
    const assembled = input.endOfUtterance
      ? (() => {
          media.assembler.push(transcript);
          const forced = media.assembler.forceFlush();
          return {
            ready: Boolean(forced),
            utterance: forced,
            buffered: forced ? '' : transcript,
          };
        })()
      : media.assembler.push(transcript);

    if (!assembled.ready || !assembled.utterance) {
      // Gap 6 — progressive partials (streaming-style UX without full provider stream)
      const buffered = assembled.buffered || transcript;
      if (buffered) {
        const media = this.ensureMedia(sessionId, input.mimeType);
        const now = Date.now();
        const lastPartialAt = (media as { lastPartialAt?: number }).lastPartialAt || 0;
        // Throttle partial bus events (~250ms) while still returning buffered text every time
        if (now - lastPartialAt >= 250) {
          (media as { lastPartialAt?: number }).lastPartialAt = now;
          publish(sessionId, {
            type: 'partial',
            sessionId,
            at: new Date().toISOString(),
            session: existing,
            partialText: buffered,
            message: 'partial_transcript',
          });
        }
      }
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: true,
        skipped: true,
        reason: 'buffering_utterance',
        transcript,
        bufferedUtterance: assembled.buffered || transcript,
        sttProvider: stt.provider,
        energy: energy.energy,
        session: existing,
      };
    }

    return this.flushUtterance(
      sessionId,
      assembled.utterance,
      { ...input, sttProvider: stt.provider, sttModel: stt.model, lang: lang.whisper },
      existing,
    );
  }

  private async flushUtterance(
    sessionId: string,
    utterance: string,
    input: {
      runAgent?: boolean;
      language?: string | null;
      sttProvider?: string | null;
      sttModel?: string | null;
      lang?: string | null;
    },
    existing: VoiceDuplexSessionSnapshot,
  ): Promise<VoiceMediaChunkResult> {
    this.bySession.delete(sessionId);

    if (input.runAgent === false) {
      return {
        version: VOICE_MEDIA_STREAM_VERSION,
        ok: true,
        transcript: utterance,
        utteranceFlushed: true,
        sttProvider: input.sttProvider || null,
        session: existing,
      };
    }

    const pref = getVoicePreferenceService().get();
    const lang = normalizeVoiceLanguage(
      input.language || pref.stt.language || input.lang || 'auto',
    );

    const session = await this.duplex.completeListen(sessionId, {
      transcript: utterance,
      provider: input.sttProvider || null,
      model: input.sttModel || null,
      languageCode: lang.whisper,
    });

    recordVoiceMetric({
      kind: 'duplex',
      ok: !session.lastError,
      code: 'utterance_flush',
      surface: session.surface,
      chars: utterance.length,
      source: 'media_stream',
    });

    return {
      version: VOICE_MEDIA_STREAM_VERSION,
      ok: true,
      transcript: utterance,
      utteranceFlushed: true,
      sttProvider: input.sttProvider || null,
      session,
      error: session.lastError,
    };
  }

  private ensureMedia(sessionId: string, mimeType?: string): SessionMediaState {
    let state = this.bySession.get(sessionId);
    if (!state) {
      state = {
        assembler: new VoiceUtteranceAssembler({
          silenceMs: 850,
          maxWaitMs: 5500,
          minChars: 2,
        }),
        audioParts: [],
        mimeType: mimeType || 'audio/webm',
        lastActivityAt: Date.now(),
      };
      this.bySession.set(sessionId, state);
    }
    return state;
  }
}

let defaultMedia: VoiceMediaStreamDuplexService | null = null;

export function getVoiceMediaStreamDuplexService(): VoiceMediaStreamDuplexService {
  if (!defaultMedia) defaultMedia = new VoiceMediaStreamDuplexService();
  return defaultMedia;
}

export function resetVoiceMediaStreamDuplexForTests(): void {
  defaultMedia = null;
}
