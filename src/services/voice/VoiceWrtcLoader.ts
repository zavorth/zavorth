/**
 * Optional loader for native WebRTC (wrtc / @roamhq/wrtc).
 */

export type WrtcModule = {
  RTCPeerConnection: new (config?: RTCConfiguration) => RTCPeerConnection;
  RTCSessionDescription?: new (init: RTCSessionDescriptionInit) => RTCSessionDescription;
  RTCIceCandidate?: new (init: RTCIceCandidateInit) => RTCIceCandidate;
  nonstandard?: {
    RTCAudioSink?: new (track: MediaStreamTrack) => {
      ondata: ((data: {
        samples: Int16Array;
        sampleRate: number;
        bitsPerSample: number;
        channelCount: number;
        numberOfFrames: number;
      }) => void) | null;
      stop: () => void;
    };
  };
};

let cached: { name: string; mod: WrtcModule } | null | undefined;

export async function loadWrtcModule(): Promise<{ name: string; mod: WrtcModule } | null> {
  if (cached !== undefined) return cached;

  const candidates = ['@roamhq/wrtc', 'wrtc'];
  for (const name of candidates) {
    try {
      const mod = (await import(/* webpackIgnore: true */ name)) as WrtcModule & {
        default?: WrtcModule;
      };
      const resolved = (mod?.default || mod) as WrtcModule;
      if (resolved?.RTCPeerConnection) {
        cached = { name, mod: resolved };
        return cached;
      }
    } catch {
      // try next
    }
  }
  cached = null;
  return null;
}

export function resetWrtcLoaderForTests(): void {
  cached = undefined;
}

/** Inject local module for unit tests */
export function injectWrtcModuleForTests(
  value: { name: string; mod: WrtcModule } | null,
): void {
  cached = value;
}
