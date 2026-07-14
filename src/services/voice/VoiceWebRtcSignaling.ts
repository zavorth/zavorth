/**
 * WebRTC signaling for Desktop duplex.
 * Stores SDP offer/answer + ICE candidates; can auto-answer audio offers for real
 * RTCPeerConnection connectivity (media STT remains MediaRecorder+VAD path).
 */

import { randomUUID } from 'node:crypto';
import { recordVoiceMetric } from './VoiceMetricsService.js';
import { buildWebRtcAnswerFromOffer, isLikelySdp } from './VoiceWebRtcSdp.js';

export const VOICE_WEBRTC_SIGNAL_VERSION = 'voice-webrtc-signal/v1' as const;

export type VoiceWebRtcSignalRole = 'desktop' | 'agent' | 'peer';

export type VoiceWebRtcIceCandidate = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
};

export type VoiceWebRtcMediaPlane = 'native_wrtc' | 'sdp_munged' | null;

export type VoiceWebRtcSession = {
  version: typeof VOICE_WEBRTC_SIGNAL_VERSION;
  signalId: string;
  duplexSessionId: string | null;
  surface: string;
  createdAt: string;
  updatedAt: string;
  offerSdp: string | null;
  answerSdp: string | null;
  ice: VoiceWebRtcIceCandidate[];
  state: 'created' | 'offer' | 'answer' | 'connected' | 'closed';
  /** How the answer was produced */
  mediaPlane: VoiceWebRtcMediaPlane;
};

const sessions = new Map<string, VoiceWebRtcSession>();

export class VoiceWebRtcSignalingService {
  public create(input: {
    duplexSessionId?: string | null;
    surface?: string;
  } = {}): VoiceWebRtcSession {
    const now = new Date().toISOString();
    const session: VoiceWebRtcSession = {
      version: VOICE_WEBRTC_SIGNAL_VERSION,
      signalId: randomUUID(),
      duplexSessionId: input.duplexSessionId || null,
      surface: String(input.surface || 'desktop'),
      createdAt: now,
      updatedAt: now,
      offerSdp: null,
      answerSdp: null,
      ice: [],
      state: 'created',
      mediaPlane: null,
    };
    sessions.set(session.signalId, session);
    recordVoiceMetric({
      kind: 'duplex',
      ok: true,
      code: 'webrtc_signal_create',
      surface: session.surface,
      source: 'webrtc',
    });
    return { ...session, ice: [...session.ice] };
  }

  public get(signalId: string): VoiceWebRtcSession | null {
    const s = sessions.get(signalId);
    return s ? { ...s, ice: [...s.ice] } : null;
  }

  public setOffer(signalId: string, sdp: string): VoiceWebRtcSession {
    const s = this.require(signalId);
    const offer = String(sdp || '').trim();
    if (offer && !isLikelySdp(offer)) {
      throw new Error('SDP offer does not look valid (expected v=0 / m=audio).');
    }
    s.offerSdp = offer || null;
    s.state = 'offer';
    s.updatedAt = new Date().toISOString();
    return this.public(s);
  }

  public setAnswer(
    signalId: string,
    sdp: string,
    mediaPlane: VoiceWebRtcMediaPlane = 'sdp_munged',
  ): VoiceWebRtcSession {
    const s = this.require(signalId);
    s.answerSdp = String(sdp || '').trim() || null;
    s.state = 'answer';
    s.mediaPlane = mediaPlane;
    s.updatedAt = new Date().toISOString();
    return this.public(s);
  }

  /**
   * Auto-generate answer SDP from stored offer (fallback when native wrtc unavailable).
   */
  public autoAnswer(signalId: string): VoiceWebRtcSession {
    const s = this.require(signalId);
    if (!s.offerSdp) {
      throw new Error('No offer SDP stored; call webrtc_offer first.');
    }
    const answer = buildWebRtcAnswerFromOffer(s.offerSdp);
    s.answerSdp = answer;
    s.state = 'answer';
    s.mediaPlane = 'sdp_munged';
    s.updatedAt = new Date().toISOString();
    recordVoiceMetric({
      kind: 'duplex',
      ok: true,
      code: 'webrtc_auto_answer',
      surface: s.surface,
      source: 'webrtc',
    });
    return this.public(s);
  }

  public setMediaPlane(signalId: string, mediaPlane: VoiceWebRtcMediaPlane): VoiceWebRtcSession {
    const s = this.require(signalId);
    s.mediaPlane = mediaPlane;
    s.updatedAt = new Date().toISOString();
    return this.public(s);
  }

  public addIce(signalId: string, candidate: VoiceWebRtcIceCandidate): VoiceWebRtcSession {
    const s = this.require(signalId);
    const c = String(candidate.candidate || '').trim();
    if (c) {
      s.ice.push({
        candidate: c,
        sdpMid: candidate.sdpMid ?? null,
        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      });
      // Cap ICE list
      if (s.ice.length > 64) s.ice.splice(0, s.ice.length - 64);
    }
    s.updatedAt = new Date().toISOString();
    return this.public(s);
  }

  public markConnected(signalId: string): VoiceWebRtcSession {
    const s = this.require(signalId);
    s.state = 'connected';
    s.updatedAt = new Date().toISOString();
    recordVoiceMetric({
      kind: 'duplex',
      ok: true,
      code: 'webrtc_connected',
      surface: s.surface,
      source: 'webrtc',
    });
    return this.public(s);
  }

  public close(signalId: string): VoiceWebRtcSession | null {
    const s = sessions.get(signalId);
    if (!s) return null;
    s.state = 'closed';
    s.updatedAt = new Date().toISOString();
    const snap = this.public(s);
    sessions.delete(signalId);
    return snap;
  }

  private require(signalId: string): VoiceWebRtcSession {
    const s = sessions.get(signalId);
    if (!s) throw new Error('WebRTC signal session not found.');
    return s;
  }

  private public(s: VoiceWebRtcSession): VoiceWebRtcSession {
    return { ...s, ice: [...s.ice] };
  }
}

let defaultSignal: VoiceWebRtcSignalingService | null = null;

export function getVoiceWebRtcSignalingService(): VoiceWebRtcSignalingService {
  if (!defaultSignal) defaultSignal = new VoiceWebRtcSignalingService();
  return defaultSignal;
}

export function resetVoiceWebRtcSignalingForTests(): void {
  defaultSignal = null;
  sessions.clear();
}
