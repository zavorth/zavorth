import { pcmInt16ToWav, pcmRms } from '../../src/services/voice/VoicePcmWav.js';
import {
  VoiceNativeRtpBridge,
  resetVoiceNativeRtpBridgeForTests,
} from '../../src/services/voice/VoiceNativeRtpBridge.js';
import {
  getVoiceWebRtcSignalingService,
  resetVoiceWebRtcSignalingForTests,
} from '../../src/services/voice/VoiceWebRtcSignaling.js';
import {
  VoiceRealtimeDuplexSessionService,
  resetVoiceRealtimeDuplexForTests,
} from '../../src/services/voice/VoiceRealtimeDuplexSession.js';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../../src/services/voice/VoicePreferenceService.js';
import { VoiceDictationIngress } from '../../src/services/voice/VoiceDictationIngress.js';
import { resetVoiceMetricsForTests } from '../../src/services/voice/VoiceMetricsService.js';
import { injectWrtcModuleForTests, resetWrtcLoaderForTests } from '../../src/services/voice/VoiceWrtcLoader.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Voice native RTP + PCM→WAV→STT path', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceWebRtcSignalingForTests();
    resetVoiceNativeRtpBridgeForTests();
    resetWrtcLoaderForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-native-rtp-'));
  });

  afterEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceWebRtcSignalingForTests();
    resetVoiceNativeRtpBridgeForTests();
    resetWrtcLoaderForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('converts PCM Int16 to valid WAV', () => {
    const samples = new Int16Array(1600);
    for (let i = 0; i < samples.length; i += 1) samples[i] = (i % 200) * 100;
    const wav = pcmInt16ToWav(samples, { sampleRate: 16000, channels: 1 });
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wav.length).toBe(44 + samples.length * 2);
    expect(pcmRms(samples)).toBeGreaterThan(0);
  });

  it('acceptOffer reports unavailable without wrtc', async () => {
    injectWrtcModuleForTests(null);
    const bridge = new VoiceNativeRtpBridge();
    const result = await bridge.acceptOffer({
      signalId: 'sig-1',
      offerSdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
    });
    expect(result.ok).toBe(false);
    expect(result.mode).toBe('unavailable');
  });

  it('ingestPcmForTests runs duplex STT path with mocked STT', async () => {
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'preference.json'),
      env: {},
    });
    prefs.set({
      mode: 'dictation',
      stt: { provider: 'openai', model: 'whisper-1', language: 'en' },
    });

    const duplex = new VoiceRealtimeDuplexSessionService({
      voicePreferences: prefs,
      dictation: new VoiceDictationIngress({ voicePreferences: prefs }),
    });
    const session = duplex.start({
      surface: 'desktop',
      agentHandler: async ({ agentText }) => ({ replyText: `NATIVE:${agentText}` }),
    });

    const signaling = getVoiceWebRtcSignalingService();
    const sig = signaling.create({
      duplexSessionId: session.sessionId,
      surface: 'desktop',
    });

    // Mock STT service
    const stt = {
      transcribe: async () => ({
        ok: true,
        text: 'hello from rtp',
        provider: 'openai',
        model: 'whisper-1',
        attempts: [],
        error: null,
      }),
    };

    const bridge = new VoiceNativeRtpBridge({
      duplex,
      signaling,
      stt: stt as any,
      silenceMs: 50,
    });

    // Generate ~0.3s of loud PCM at 16kHz
    const samples = new Int16Array(4800);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = i % 2 === 0 ? 12000 : -12000;
    }

    const after = await bridge.ingestPcmForTests(sig.signalId, samples, 16000);
    expect(after?.lastTranscript).toBe('hello from rtp');
    expect(after?.lastAgentText).toBe('NATIVE:hello from rtp');
  });
});
