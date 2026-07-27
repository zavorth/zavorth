/**
 * Native WebRTC media plane:
 * Desktop RTCPeerConnection → server wrtc peer → RTCAudioSink PCM → VAD → WAV → STT → duplex agent.
 *
 * Falls back gracefully when wrtc is not installed.
 */

import {
  loadWrtcModule,
  type WrtcModule,
} from './VoiceWrtcLoader.js';
import {
  getVoiceWebRtcSignalingService,
  type VoiceWebRtcIceCandidate,
  type VoiceWebRtcSession,
  type VoiceWebRtcSignalingService,
} from './VoiceWebRtcSignaling.js';
import {
  getVoiceRealtimeDuplexSessionService,
  type VoiceDuplexSessionSnapshot,
  type VoiceRealtimeDuplexSessionService,
} from './VoiceRealtimeDuplexSession.js';
import { AudioTranscriptionService } from '../AudioTranscriptionService.js';
import { getVoicePreferenceService } from './VoicePreferenceService.js';
import { normalizeVoiceLanguage } from './VoiceLanguage.js';
import { pcmInt16ToWav } from './VoicePcmWav.js';
import {
  downmixToMono,
  improvedSpeechRms,
  preparePcmForStt,
} from './VoiceAudioQuality.js';
import { recordVoiceMetric } from './VoiceMetricsService.js';
import { resolveVoiceIceConfig } from './VoiceWebRtcIceConfig.js';

export const VOICE_NATIVE_RTP_VERSION = 'voice-native-rtp/v1' as const;

export type NativePeerHandle = {
  signalId: string;
  duplexSessionId: string | null;
  pc: RTCPeerConnection;
  sinks: Array<{ stop: () => void }>;
  pcmChunks: Int16Array[];
  sampleRate: number;
  channels: number;
  speaking: boolean;
  /** First continuous speech-energy frame of current candidate (ms epoch). */
  speechCandidateAt: number | null;
  lastSpeechAt: number;
  silenceStartedAt: number | null;
  flushing: boolean;
  closed: boolean;
  /** Last barge-in attempt (debounce) */
  lastBargeInAt: number;
};

export type AcceptOfferResult = {
  ok: boolean;
  mode: 'native_wrtc' | 'unavailable';
  signal?: VoiceWebRtcSession;
  error?: string;
};

type AudioSinkData = {
  samples: Int16Array;
  sampleRate: number;
  bitsPerSample: number;
  channelCount: number;
  numberOfFrames: number;
};

export class VoiceNativeRtpBridge {
  private readonly peers = new Map<string, NativePeerHandle>();
  private readonly signaling: VoiceWebRtcSignalingService;
  private readonly duplex: VoiceRealtimeDuplexSessionService;
  private readonly stt: AudioTranscriptionService;
  private readonly speechThreshold: number;
  private readonly silenceMs: number;
  private readonly maxUtteranceMs: number;
  /** Require continuous speech energy for this long before counting as speaking. */
  private readonly minSpeechMs: number;

  constructor(options: {
    signaling?: VoiceWebRtcSignalingService;
    duplex?: VoiceRealtimeDuplexSessionService;
    stt?: AudioTranscriptionService;
    speechThreshold?: number;
    silenceMs?: number;
    maxUtteranceMs?: number;
    minSpeechMs?: number;
  } = {}) {
    this.signaling = options.signaling || getVoiceWebRtcSignalingService();
    this.duplex = options.duplex || getVoiceRealtimeDuplexSessionService();
    this.stt = options.stt || new AudioTranscriptionService();
    this.speechThreshold = Number(options.speechThreshold || 0.015);
    this.silenceMs = Math.max(200, Number(options.silenceMs || 800));
    this.maxUtteranceMs = Math.max(this.silenceMs, Number(options.maxUtteranceMs || 8000));
    this.minSpeechMs = Math.max(40, Number(options.minSpeechMs || 120));
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(await loadWrtcModule());
  }

  /**
   * Accept browser offer with a real server RTCPeerConnection + audio sink.
   */
  public async acceptOffer(input: {
    signalId: string;
    offerSdp: string;
    duplexSessionId?: string | null;
  }): Promise<AcceptOfferResult> {
    const loaded = await loadWrtcModule();
    if (!loaded) {
      return {
        ok: false,
        mode: 'unavailable',
        error: 'wrtc not installed',
      };
    }

    const signalId = String(input.signalId || '').trim();
    if (!signalId) {
      return { ok: false, mode: 'unavailable', error: 'signalId required' };
    }

    // Close previous peer for this signal
    await this.close(signalId);

    const { mod, name } = loaded;
    const RTCPeerConnection = mod.RTCPeerConnection;
    const ice = resolveVoiceIceConfig();
    const pc = new RTCPeerConnection({
      iceServers: ice.iceServers as RTCIceServer[],
    });

    const handle: NativePeerHandle = {
      signalId,
      duplexSessionId: input.duplexSessionId || null,
      pc,
      sinks: [],
      pcmChunks: [],
      sampleRate: 48000,
      channels: 1,
      speaking: false,
      speechCandidateAt: null,
      lastSpeechAt: 0,
      silenceStartedAt: null,
      flushing: false,
      closed: false,
      lastBargeInAt: 0,
    };
    this.peers.set(signalId, handle);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      try {
        this.signaling.addIce(signalId, {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      } catch {
        // signal may be gone
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        try {
          this.signaling.markConnected(signalId);
        } catch {
          // ignore
        }
        recordVoiceMetric({
          kind: 'duplex',
          ok: true,
          code: 'native_rtp_connected',
          source: 'native_wrtc',
          message: name,
        });
      }
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed' ||
        pc.connectionState === 'disconnected'
      ) {
        // keep sink until explicit close; disconnected may recover
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      if (!track || track.kind !== 'audio') return;
      this.attachAudioSink(handle, mod, track);
    };

    try {
      this.signaling.setOffer(signalId, input.offerSdp);

      // Ensure we can receive audio before answering
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch {
        // transceiver may already exist from remote offer
      }

      await pc.setRemoteDescription({ type: 'offer', sdp: input.offerSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const answerSdp = String(answer.sdp || pc.localDescription?.sdp || '');
      if (!answerSdp) {
        throw new Error('Native peer created empty answer SDP.');
      }

      // Apply any ICE already stored from client
      const existing = this.signaling.get(signalId);
      if (existing) {
        for (const ice of existing.ice) {
          await this.applyRemoteIce(handle, ice);
        }
      }

      // Prefer duplex binding from signal store if not provided
      if (!handle.duplexSessionId) {
        handle.duplexSessionId = existing?.duplexSessionId || null;
      }

      const signal = this.signaling.setAnswer(signalId, answerSdp, 'native_wrtc');
      recordVoiceMetric({
        kind: 'duplex',
        ok: true,
        code: 'native_rtp_answer',
        source: 'native_wrtc',
        message: name,
      });

      return {
        ok: true,
        mode: 'native_wrtc',
        signal,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.close(signalId);
      recordVoiceMetric({
        kind: 'duplex',
        ok: false,
        code: 'native_rtp_failed',
        message,
        source: 'native_wrtc',
      });
      return {
        ok: false,
        mode: 'unavailable',
        error: message,
      };
    }
  }

  public async addRemoteIce(
    signalId: string,
    candidate: VoiceWebRtcIceCandidate,
  ): Promise<void> {
    const handle = this.peers.get(signalId);
    if (!handle || handle.closed) return;
    this.signaling.addIce(signalId, candidate);
    await this.applyRemoteIce(handle, candidate);
  }

  public async close(signalId: string): Promise<void> {
    const handle = this.peers.get(signalId);
    if (!handle) return;
    handle.closed = true;
    for (const sink of handle.sinks) {
      try {
        sink.stop();
      } catch {
        // ignore
      }
    }
    handle.sinks = [];
    try {
      handle.pc.close();
    } catch {
      // ignore
    }
    this.peers.delete(signalId);
  }

  public hasPeer(signalId: string): boolean {
    const h = this.peers.get(signalId);
    return Boolean(h && !h.closed);
  }

  public listActive(): string[] {
    return [...this.peers.keys()];
  }

  /** Test helper: push synthetic PCM as if from RTCAudioSink */
  public async ingestPcmForTests(
    signalId: string,
    samples: Int16Array,
    sampleRate = 16000,
  ): Promise<VoiceDuplexSessionSnapshot | null> {
    let handle = this.peers.get(signalId);
    if (!handle) {
      // allow synthetic handle for unit tests without real PC
      handle = {
        signalId,
        duplexSessionId: this.signaling.get(signalId)?.duplexSessionId || null,
        pc: null as unknown as RTCPeerConnection,
        sinks: [],
        pcmChunks: [],
        sampleRate,
        channels: 1,
        speaking: false,
        speechCandidateAt: null,
        lastSpeechAt: 0,
        silenceStartedAt: null,
        flushing: false,
        closed: false,
        lastBargeInAt: 0,
      };
      this.peers.set(signalId, handle);
    }
    this.onPcmData(handle, {
      samples,
      sampleRate,
      bitsPerSample: 16,
      channelCount: 1,
      numberOfFrames: samples.length,
    });
    // Force flush for tests after speech
    return this.flushUtterance(handle);
  }

  private attachAudioSink(
    handle: NativePeerHandle,
    mod: WrtcModule,
    track: MediaStreamTrack,
  ): void {
    const Sink = mod.nonstandard?.RTCAudioSink;
    if (!Sink) {
      recordVoiceMetric({
        kind: 'duplex',
        ok: false,
        code: 'native_rtp_no_sink',
        message: 'RTCAudioSink unavailable on wrtc build',
        source: 'native_wrtc',
      });
      return;
    }
    try {
      const sink = new Sink(track);
      sink.ondata = (data) => {
        if (handle.closed) return;
        this.onPcmData(handle, data);
      };
      handle.sinks.push(sink);
      recordVoiceMetric({
        kind: 'duplex',
        ok: true,
        code: 'native_rtp_sink_attached',
        source: 'native_wrtc',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      recordVoiceMetric({
        kind: 'duplex',
        ok: false,
        code: 'native_rtp_sink_failed',
        message,
        source: 'native_wrtc',
      });
    }
  }

  private onPcmData(handle: NativePeerHandle, data: AudioSinkData): void {
    if (!data?.samples?.length) return;
    handle.sampleRate = data.sampleRate || handle.sampleRate;
    const channelCount = Math.max(1, data.channelCount || 1);
    handle.channels = channelCount;

    // Downmix multi-channel to mono on receive (copy — sink may reuse buffer)
    const frames =
      data.numberOfFrames || Math.floor(data.samples.length / channelCount);
    const mono = downmixToMono(data.samples, channelCount, frames);

    const rms = improvedSpeechRms(mono);
    const now = Date.now();
    const isSpeech = rms >= this.speechThreshold;

    if (isSpeech) {
      if (handle.speechCandidateAt == null) {
        handle.speechCandidateAt = now;
      }
      // copy samples into utterance buffer while energy is high
      handle.pcmChunks.push(Int16Array.from(mono));
      // Cap buffer ~ max utterance duration at current sample rate
      const maxSamples = Math.floor((handle.sampleRate * this.maxUtteranceMs) / 1000);
      let total = handle.pcmChunks.reduce((a, c) => a + c.length, 0);
      while (total > maxSamples && handle.pcmChunks.length > 1) {
        const dropped = handle.pcmChunks.shift();
        total -= dropped?.length || 0;
      }

      // Require min continuous speech (~120ms) before counting as speaking
      if (
        !handle.speaking &&
        now - handle.speechCandidateAt >= this.minSpeechMs
      ) {
        handle.speaking = true;
        // User started talking while agent is speaking/processing → real barge-in
        this.tryNativeBargeIn(handle, now);
      }
      if (handle.speaking) {
        handle.lastSpeechAt = now;
        handle.silenceStartedAt = null;
        this.tryNativeBargeIn(handle, now);
      }
      return;
    }

    // silence — drop short noise bursts that never became real speech
    handle.speechCandidateAt = null;
    if (!handle.speaking) {
      if (handle.pcmChunks.length) {
        handle.pcmChunks = [];
      }
      return;
    }

    if (handle.silenceStartedAt == null) handle.silenceStartedAt = now;
    // still append a little silence for natural edges
    if (handle.pcmChunks.length) {
      handle.pcmChunks.push(Int16Array.from(mono));
    }
    const silentFor = now - handle.silenceStartedAt;
    const utteranceMs =
      handle.lastSpeechAt && handle.pcmChunks.length ? now - (handle.lastSpeechAt - silentFor)
        : 0;
    if (silentFor >= this.silenceMs || utteranceMs >= this.maxUtteranceMs) {
      handle.speaking = false;
      handle.silenceStartedAt = null;
      void this.flushUtterance(handle);
    }
  }

  /**
   * When user speech is confirmed while duplex is speaking/processing,
   * interrupt TTS path and notify Desktop via barge_in event.
   */
  private tryNativeBargeIn(handle: NativePeerHandle, now: number): void {
    if (handle.closed) return;
    if (now - handle.lastBargeInAt < 400) return; // debounce

    const duplexSessionId =
      handle.duplexSessionId ||
      this.signaling.get(handle.signalId)?.duplexSessionId ||
      null;
    if (!duplexSessionId) return;

    const session = this.duplex.get(duplexSessionId);
    if (!session) return;
    if (session.phase !== 'speaking' && session.phase !== 'processing') {
      return;
    }

    handle.lastBargeInAt = now;
    try {
      this.duplex.bargeIn(duplexSessionId);
      recordVoiceMetric({
        kind: 'duplex',
        ok: true,
        code: 'native_rtp_barge_in',
        surface: session.surface,
        source: 'native_wrtc',
      });
    } catch {
      // session may have ended
    }
  }

  private async flushUtterance(
    handle: NativePeerHandle,
  ): Promise<VoiceDuplexSessionSnapshot | null> {
    if (handle.flushing || handle.closed) return null;
    if (!handle.pcmChunks.length) return null;

    const chunks = handle.pcmChunks;
    handle.pcmChunks = [];
    handle.flushing = true;

    const total = chunks.reduce((a, c) => a + c.length, 0);
    if (total < handle.sampleRate * 0.15) {
      // <150ms — skip
      handle.flushing = false;
      return null;
    }

    const merged = new Int16Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    // Mono AGC + resample to 16 kHz before packaging WAV for STT
    const prepared = preparePcmForStt({
      samples: merged,
      sampleRate: handle.sampleRate,
      channels: 1,
    });
    const wav = pcmInt16ToWav(prepared.samples, {
      sampleRate: prepared.sampleRate,
      channels: prepared.channels,
    });

    const duplexSessionId =
      handle.duplexSessionId ||
      this.signaling.get(handle.signalId)?.duplexSessionId ||
      null;

    if (!duplexSessionId) {
      handle.flushing = false;
      recordVoiceMetric({
        kind: 'duplex',
        ok: false,
        code: 'native_rtp_no_duplex',
        message: 'No duplexSessionId bound to native peer',
        source: 'native_wrtc',
      });
      return null;
    }

    const existing = this.duplex.get(duplexSessionId);
    if (!existing || existing.phase === 'ended' || existing.phase === 'processing') {
      handle.flushing = false;
      return existing;
    }

    const pref = getVoicePreferenceService().get();
    const lang = normalizeVoiceLanguage(pref.stt.language || 'auto');
    const t0 = Date.now();

    try {
      const stt = await this.stt.transcribe({
        audio: wav,
        mimeType: 'audio/wav',
        fileName: 'native-rtp.wav',
        language: lang.isAuto ? null : lang.whisper,
        sessionId: `native-rtp:${duplexSessionId}`,
      });

      if (!stt.ok || !stt.text?.trim()) {
        recordVoiceMetric({
          kind: 'stt',
          ok: false,
          message: stt.error || 'empty transcript from native RTP',
          surface: existing.surface,
          latencyMs: Date.now() - t0,
          source: 'native_wrtc',
        });
        handle.flushing = false;
        return existing;
      }

      const session = await this.duplex.completeListen(duplexSessionId, {
        transcript: stt.text.trim(),
        provider: stt.provider,
        model: stt.model,
        languageCode: lang.whisper,
      });

      recordVoiceMetric({
        kind: 'duplex',
        ok: !session.lastError,
        code: 'native_rtp_turn',
        surface: session.surface,
        chars: stt.text.length,
        latencyMs: Date.now() - t0,
        source: 'native_wrtc',
      });

      return session;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      recordVoiceMetric({
        kind: 'duplex',
        ok: false,
        code: 'native_rtp_stt_error',
        message,
        source: 'native_wrtc',
      });
      return existing;
    } finally {
      handle.flushing = false;
    }
  }

  private async applyRemoteIce(
    handle: NativePeerHandle,
    ice: VoiceWebRtcIceCandidate,
  ): Promise<void> {
    const c = String(ice.candidate || '').trim();
    if (!c || handle.closed) return;
    try {
      await handle.pc.addIceCandidate({
        candidate: c,
        sdpMid: ice.sdpMid ?? undefined,
        sdpMLineIndex: ice.sdpMLineIndex ?? undefined,
      });
    } catch {
      // ignore bad candidates
    }
  }
}

let defaultBridge: VoiceNativeRtpBridge | null = null;

export function getVoiceNativeRtpBridge(): VoiceNativeRtpBridge {
  if (!defaultBridge) defaultBridge = new VoiceNativeRtpBridge();
  return defaultBridge;
}

export function resetVoiceNativeRtpBridgeForTests(): void {
  defaultBridge = null;
}
