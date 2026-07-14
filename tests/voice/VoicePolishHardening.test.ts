import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeVoiceLanguage, whisperLanguageParam } from '../../src/services/voice/VoiceLanguage.js';
import {
  getVoiceWebRtcSignalingService,
  resetVoiceWebRtcSignalingForTests,
} from '../../src/services/voice/VoiceWebRtcSignaling.js';
import { createExperienceDuplexAgentHandler } from '../../src/services/voice/createExperienceDuplexAgentHandler.js';
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
import {
  isDiscordAudioAttachment,
  mergeDiscordVoiceText,
} from '../../src/gateways/channels/discord/DiscordVoiceAttachmentIngest.js';

describe('Voice polish hardening (5 items)', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceWebRtcSignalingForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-polish-'));
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

  it('normalizes language tags for Whisper / Deepgram', () => {
    expect(normalizeVoiceLanguage('pt-BR').whisper).toBe('pt');
    expect(normalizeVoiceLanguage('portuguese').bcp47).toBe('pt-BR');
    expect(whisperLanguageParam('auto')).toBeNull();
    expect(whisperLanguageParam('en-US')).toBe('en');
  });

  it('wires duplex turns to experience agent handler', async () => {
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'preference.json'),
      env: {},
    });
    prefs.set({
      mode: 'conversation',
      stt: { provider: 'openai', model: 'whisper-1', language: 'en' },
      tts: { enabled: true, provider: 'edge-tts', voiceId: 'en-US-JennyNeural' },
    });

    const handler = createExperienceDuplexAgentHandler({
      ensureReady: async () => undefined,
      execute: async ({ text }) => ({
        ok: true,
        replies: [{ role: 'assistant', text: `REAL:${text}` }],
      }),
    });

    const duplex = new VoiceRealtimeDuplexSessionService({
      voicePreferences: prefs,
      dictation: new VoiceDictationIngress({ voicePreferences: prefs }),
    });

    const session = duplex.start({
      surface: 'desktop',
      agentHandler: handler,
      speakHandler: async () => ({
        mimeType: 'audio/mpeg',
        audioBase64: 'ZmFrZQ==',
        provider: 'edge-tts',
      }),
    });

    const after = await duplex.completeListen(session.sessionId, {
      transcript: 'what is the weather',
      provider: 'openai',
    });

    expect(after.lastAgentText).toBe('REAL:what is the weather');
    expect(after.lastTtsAudio?.audioBase64).toBe('ZmFrZQ==');
    expect(after.lastTtsAudio?.mimeType).toBe('audio/mpeg');
  });

  it('stores WebRTC offer/answer/ice signaling', () => {
    const rtc = getVoiceWebRtcSignalingService();
    const created = rtc.create({ surface: 'desktop' });
    const offer = 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\n';
    rtc.setOffer(created.signalId, offer);
    const answered = rtc.setAnswer(created.signalId, 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=recvonly\r\n');
    expect(answered.state).toBe('answer');
    const iced = rtc.addIce(created.signalId, { candidate: 'cand-1' });
    expect(iced.ice[0]?.candidate).toBe('cand-1');
  });

  it('detects Discord audio attachments for STT path', () => {
    expect(
      isDiscordAudioAttachment({
        id: 'a',
        name: 'voice-message.ogg',
        url: 'https://cdn/x.ogg',
        contentType: 'audio/ogg',
        size: 10,
      }),
    ).toBe(true);
    expect(
      isDiscordAudioAttachment({
        id: 'b',
        name: 'img.png',
        url: 'https://cdn/x.png',
        contentType: 'image/png',
        size: 10,
      }),
    ).toBe(false);
    expect(
      mergeDiscordVoiceText('', {
        ok: true,
        transcript: 'hi',
        agentText: 'hi there',
        provider: 'openai',
        message: null,
      }),
    ).toBe('hi there');
  });

  it('returns honest error when experience agent throws', async () => {
    const handler = createExperienceDuplexAgentHandler({
      ensureReady: async () => undefined,
      execute: async () => {
        throw new Error('gateway down');
      },
    });
    const reply = await handler({
      sessionId: 's1',
      agentText: 'hello',
      surface: 'desktop',
    });
    expect(reply.replyText).toMatch(/Type your message instead/i);
    expect(reply.replyText).toMatch(/gateway down/i);
  });
});
