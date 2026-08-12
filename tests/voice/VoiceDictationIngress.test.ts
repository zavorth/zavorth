import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  VoiceDictationIngress,
  formatDictationTranscriptNotice,
  normalizeDictationTranscript,
  resetVoiceDictationIngressForTests,
} from '../../src/services/voice/VoiceDictationIngress.js';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../../src/services/voice/VoicePreferenceService.js';

describe('VoiceDictationIngress', () => {
  let tmpDir: string;
  let preferencePath: string;
  let prefs: VoicePreferenceService;
  let ingress: VoiceDictationIngress;

  beforeEach(() => {
    resetVoicePreferenceServiceForTests();
    resetVoiceDictationIngressForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dictation-'));
    preferencePath = path.join(tmpDir, 'preference.json');
    prefs = new VoicePreferenceService({ preferencePath, env: {} });
    ingress = new VoiceDictationIngress({ voicePreferences: prefs });
  });

  afterEach(() => {
    resetVoicePreferenceServiceForTests();
    resetVoiceDictationIngressForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('strips legacy media placeholders', () => {
    expect(normalizeDictationTranscript('[Audio enviado para analise direta] open the browser')).toBe(
      'open the browser',
    );
    expect(normalizeDictationTranscript('[Automatically transcribed audio] list files')).toBe(
      'list files',
    );
  });

  it('blocks when mode off and STT unconfigured', () => {
    const result = ingress.prepare({ transcript: 'hello world' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code === 'mode_off' || result.code === 'stt_not_configured').toBe(true);
    }
  });

  it('dictation mode produces agentText equal to typed intent and shows transcript', () => {
    prefs.set({
      stt: { provider: 'openai', model: 'whisper-1', language: 'en' },
      mode: 'dictation',
    });
    const result = ingress.prepare({
      transcript: '  run the tests and open the PR  ',
      provider: 'openai',
      model: 'whisper-1',
      languageCode: 'en',
      surface: 'telegram',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.agentText).toBe('run the tests and open the PR');
      expect(result.showTranscript).toBe(true);
      expect(result.ttsReplyDesired).toBe(false);
      expect(result.metadata.source).toBe('voice_dictation');
      expect(result.reason).toBe('dictation_to_agent');
    }
  });

  it('conversation mode can request TTS reply when tts enabled', () => {
    prefs.set({
      mode: 'conversation',
      stt: { provider: 'openai', model: null },
      tts: { enabled: true, provider: 'edge-tts', voiceId: 'en-US-JennyNeural' },
    });
    const result = ingress.prepare({ transcript: 'summarize the file' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ttsReplyDesired).toBe(true);
      expect(result.mode).toBe('conversation');
    }
  });

  it('never invents placeholder agent text for empty garbage after strip', () => {
    prefs.set({ stt: { provider: 'openai' }, mode: 'dictation' });
    const result = ingress.prepare({ transcript: '[Audio enviado para analise direta]' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('empty_transcript');
    }
  });

  it('formatDictationTranscriptNotice is human readable', () => {
    const notice = formatDictationTranscriptNotice({
      transcript: 'hello',
      languageCode: 'en',
      provider: 'openai',
      lowConfidence: true,
    });
    expect(notice).toMatch(/📝/);
    expect(notice).toMatch(/hello/);
    expect(notice).toMatch(/low confidence/i);
  });

  it('marks low confidence when score below threshold', () => {
    prefs.set({ stt: { provider: 'openai' }, mode: 'dictation' });
    const result = ingress.prepare({
      transcript: 'maybe this',
      confidence: 0.2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lowConfidence).toBe(true);
      expect(result.showTranscript).toBe(true);
    }
  });
});
