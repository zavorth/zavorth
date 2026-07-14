import {
  estimateChunkEnergy,
  VoiceUtteranceAssembler,
} from '../../src/services/voice/VoiceVad.js';
import { buildWebRtcAnswerFromOffer, isLikelySdp } from '../../src/services/voice/VoiceWebRtcSdp.js';
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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Voice VAD + WebRTC + session bind improvements', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceWebRtcSignalingForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-vad-'));
  });

  afterEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceWebRtcSignalingForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('estimates chunk energy and filters tiny buffers', () => {
    const tiny = estimateChunkEnergy(Buffer.alloc(100, 128));
    expect(tiny.speechLikely).toBe(false);
    const noisy = Buffer.alloc(4000);
    for (let i = 0; i < noisy.length; i += 1) {
      noisy[i] = i % 2 === 0 ? 20 : 230;
    }
    const hot = estimateChunkEnergy(noisy);
    expect(hot.bytes).toBe(4000);
    expect(hot.energy).toBeGreaterThan(0);
  });

  it('assembles utterance across partial transcripts then flushes on silence', () => {
    const asm = new VoiceUtteranceAssembler({ silenceMs: 100, maxWaitMs: 5000, minChars: 2 });
    const t0 = 1_000_000;
    expect(asm.push('hello', t0).ready).toBe(false);
    const mid = asm.push('world', t0 + 50);
    expect(mid.ready).toBe(false);
    expect(mid.buffered).toMatch(/hello/);
    const flushed = asm.poll(t0 + 200);
    expect(flushed.ready).toBe(true);
    expect(flushed.utterance).toBe('hello world');
  });

  it('builds answer SDP from offer and auto-answers signal session', () => {
    const offer = [
      'v=0',
      'o=- 0 0 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'a=group:BUNDLE 0',
      'a=ice-ufrag:abcd',
      'a=ice-pwd:passwordpasswordpassword',
      'a=fingerprint:sha-256 AA:BB',
      'a=setup:actpass',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'c=IN IP4 0.0.0.0',
      'a=mid:0',
      'a=sendrecv',
      'a=rtcp-mux',
      'a=rtpmap:111 opus/48000/2',
    ].join('\r\n');

    expect(isLikelySdp(offer)).toBe(true);
    const answer = buildWebRtcAnswerFromOffer(offer);
    expect(answer).toMatch(/m=audio/);
    expect(answer).toMatch(/a=recvonly/);
    expect(answer).toMatch(/a=setup:passive/);

    const rtc = getVoiceWebRtcSignalingService();
    const created = rtc.create({ surface: 'desktop' });
    rtc.setOffer(created.signalId, offer);
    const answered = rtc.autoAnswer(created.signalId);
    expect(answered.state).toBe('answer');
    expect(answered.answerSdp).toBeTruthy();
  });

  it('binds experience session + workspace on duplex start', async () => {
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
      experienceSessionId: 'desktop-thread-42',
      workspace: 'C:/proj',
      agentHandler: async ({ agentText }) => ({ replyText: `ok:${agentText}` }),
    });
    expect(session.experienceSessionId).toBe('desktop-thread-42');
    expect(session.workspace).toBe('C:/proj');
    const after = await duplex.completeListen(session.sessionId, {
      transcript: 'ping',
    });
    expect(after.lastAgentText).toBe('ok:ping');
  });
});
