import { describeDefaultMediaPlane, probeVoiceMediaPlane, resetVoiceMediaPlaneForTests } from '../../src/services/voice/VoiceMediaPlane.js';

describe('VoiceMediaPlane', () => {
  beforeEach(() => {
    resetVoiceMediaPlaneForTests();
  });

  it('describes default HTTP+VAD product path', () => {
    const plane = describeDefaultMediaPlane();
    expect(plane.mode).toBe('http_chunk_vad');
    expect(plane.features.httpChunkIngest).toBe(true);
    expect(plane.features.browserVad).toBe(true);
    expect(plane.features.sdpSignaling).toBe(true);
    expect(plane.features.rtpToStt).toBe(false);
  });

  it('probes media plane without crashing when wrtc is absent or present', async () => {
    const plane = await probeVoiceMediaPlane(true);
    expect(plane.version).toBe('voice-media-plane/v1');
    expect(plane.available).toBe(true);
    expect(['http_chunk_vad', 'native_wrtc']).toContain(plane.mode);
    expect(plane.features.httpChunkIngest).toBe(true);
    if (plane.mode === 'native_wrtc') {
      expect(plane.features.rtpToStt).toBe(true);
      expect(plane.features.serverPeerConnection).toBe(true);
    }
  });
});
