/**
 * Media plane capability: native wrtc RTP vs HTTP MediaRecorder+VAD product path.
 */

import { recordVoiceMetric } from './VoiceMetricsService.js';
import { loadWrtcModule } from './VoiceWrtcLoader.js';

export const VOICE_MEDIA_PLANE_VERSION = 'voice-media-plane/v1' as const;

export type VoiceMediaPlaneSnapshot = {
  version: typeof VOICE_MEDIA_PLANE_VERSION;
  available: boolean;
  packageName: string | null;
  mode: 'native_wrtc' | 'http_chunk_vad' | 'unavailable';
  reason: string;
  features: {
    serverPeerConnection: boolean;
    rtpReceive: boolean;
    rtpToStt: boolean;
    httpChunkIngest: boolean;
    browserVad: boolean;
    sdpSignaling: boolean;
  };
  installHint: string | null;
};

let cached: VoiceMediaPlaneSnapshot | null = null;

/**
 * Probe once (cached) whether native server WebRTC media plane is available.
 */
export async function probeVoiceMediaPlane(force = false): Promise<VoiceMediaPlaneSnapshot> {
  if (cached && !force) return cached;

  const loaded = await loadWrtcModule();
  if (loaded) {
    cached = {
      version: VOICE_MEDIA_PLANE_VERSION,
      available: true,
      packageName: loaded.name,
      mode: 'native_wrtc',
      reason: `Native WebRTC media plane via ${loaded.name}: server receives RTP audio → PCM → STT → agent.`,
      features: {
        serverPeerConnection: true,
        rtpReceive: true,
        rtpToStt: true,
        httpChunkIngest: true,
        browserVad: true,
        sdpSignaling: true,
      },
      installHint: null,
    };
    recordVoiceMetric({
      kind: 'duplex',
      ok: true,
      code: 'media_plane_native',
      source: 'media_plane',
      message: loaded.name,
    });
    return cached;
  }

  cached = {
    version: VOICE_MEDIA_PLANE_VERSION,
    available: true,
    packageName: null,
    mode: 'http_chunk_vad',
    reason:
      'Product voice call uses HTTP MediaRecorder + browser VAD + SDP signaling. Install optional wrtc for native RTP→STT.',
    features: {
      serverPeerConnection: false,
      rtpReceive: false,
      rtpToStt: false,
      httpChunkIngest: true,
      browserVad: true,
      sdpSignaling: true,
    },
    installHint:
      'Optional: npm i @roamhq/wrtc  (or wrtc) — enables server RTCPeerConnection + RTCAudioSink → STT.',
  };
  recordVoiceMetric({
    kind: 'duplex',
    ok: true,
    code: 'media_plane_http_vad',
    source: 'media_plane',
  });
  return cached;
}

export function getCachedVoiceMediaPlane(): VoiceMediaPlaneSnapshot | null {
  return cached;
}

export function resetVoiceMediaPlaneForTests(): void {
  cached = null;
}

export function describeDefaultMediaPlane(): VoiceMediaPlaneSnapshot {
  return {
    version: VOICE_MEDIA_PLANE_VERSION,
    available: true,
    packageName: null,
    mode: 'http_chunk_vad',
    reason: 'Default product path: HTTP chunks + VAD + Experience agent + backend TTS.',
    features: {
      serverPeerConnection: false,
      rtpReceive: false,
      rtpToStt: false,
      httpChunkIngest: true,
      browserVad: true,
      sdpSignaling: true,
    },
    installHint: 'Optional: npm i @roamhq/wrtc for native server RTP media plane.',
  };
}
