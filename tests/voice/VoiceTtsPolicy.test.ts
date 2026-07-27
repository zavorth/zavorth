import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveVoiceTts,
  shouldAttemptPreferenceTts,
} from '../../src/services/voice/VoiceTtsPolicy.js';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../../src/services/voice/VoicePreferenceService.js';

describe('VoiceTtsPolicy', () => {
  let tmpDir: string;
  let preferencePath: string;
  let prefs: VoicePreferenceService;

  beforeEach(() => {
    resetVoicePreferenceServiceForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-tts-pref-'));
    preferencePath = path.join(tmpDir, 'preference.json');
    prefs = new VoicePreferenceService({ preferencePath, env: {} });
  });

  afterEach(() => {
    resetVoicePreferenceServiceForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('refuses TTS when unconfigured', () => {
    const result = resolveVoiceTts({ ttsReplyDesired: true }, prefs);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('tts_not_configured');
    }
  });

  it('allows preference TTS in conversation mode', () => {
    prefs.set({
      mode: 'conversation',
      stt: { provider: 'openai', model: 'whisper-1' },
      tts: { enabled: true, provider: 'edge-tts', voiceId: 'en-US-JennyNeural' },
    });
    const result = resolveVoiceTts({ ttsReplyDesired: true }, prefs);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('edge-tts');
      expect(result.voiceId).toBe('en-US-JennyNeural');
      expect(result.forceProvider).toBe('edge-tts');
      expect(result.source).toBe('preference');
    }
  });

  it('shouldAttemptPreferenceTts respects voiceFlow.ttsReplyDesired', () => {
    prefs.set({
      mode: 'conversation',
      tts: { enabled: true, provider: 'gemini', voiceId: 'Kore' },
      stt: { provider: 'openai' },
    });
    expect(
      shouldAttemptPreferenceTts({
        voiceFlow: { ttsReplyDesired: true },
        preference: prefs.get(),
      }),
    ).toBe(true);
    expect(
      shouldAttemptPreferenceTts({
        voiceFlow: {},
        preference: prefs.get(),
      }),
    ).toBe(true); // conversation + tts.enabled
  });

  it('gemini provider maps forceProvider', () => {
    prefs.set({
      mode: 'conversation',
      tts: { enabled: true, provider: 'gemini', voiceId: 'Puck' },
      stt: { provider: 'openai' },
    });
    const result = resolveVoiceTts({ explicitVoiceRequest: true }, prefs);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.forceProvider).toBe('gemini');
      expect(result.voiceId).toBe('Puck');
    }
  });
});
