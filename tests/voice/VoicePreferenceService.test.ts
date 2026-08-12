import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../../src/services/voice/VoicePreferenceService.js';
import { AudioTranscriptionService } from '../../src/services/AudioTranscriptionService.js';
import { isVoiceSttConfigured } from '../../src/contracts/voice/VoicePreferenceContract.js';

describe('VoicePreferenceService sovereignty', () => {
  let tmpDir: string;
  let preferencePath: string;

  beforeEach(() => {
    resetVoicePreferenceServiceForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-voice-pref-'));
    preferencePath = path.join(tmpDir, 'preference.json');
  });

  afterEach(() => {
    resetVoicePreferenceServiceForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function service(env: NodeJS.ProcessEnv = {}) {
    return new VoicePreferenceService({
      preferencePath,
      env: { ...env },
    });
  }

  it('starts unconfigured and refuses STT resolve without cascade', () => {
    const svc = service({});
    const pref = svc.get();
    expect(pref.stt.provider).toBe('none');
    expect(isVoiceSttConfigured(pref)).toBe(false);
    const resolved = svc.resolveStt();
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.code).toBe('stt_not_configured');
      expect(resolved.configureHint).toMatch(/voice-pref|ZAVORTH_AUDIO_STT_PROVIDERS/i);
    }
  });

  it('uses single user-chosen provider only', () => {
    const svc = service({});
    svc.set({
      stt: { provider: 'openai', model: 'whisper-1', language: 'pt' },
      mode: 'dictation',
    });
    const resolved = svc.resolveStt();
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.providers).toEqual(['openai']);
      expect(resolved.model).toBe('whisper-1');
      expect(resolved.language).toBe('pt');
      expect(resolved.source).toBe('preference');
    }
  });

  it('honors explicit env list as ops sovereignty', () => {
    const svc = service({ ZAVORTH_AUDIO_STT_PROVIDERS: 'deepgram,groq' });
    const resolved = svc.resolveStt();
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.providers).toEqual(['deepgram', 'groq']);
      expect(resolved.source).toBe('env_explicit');
    }
  });

  it('preference beats env', () => {
    const svc = service({ ZAVORTH_AUDIO_STT_PROVIDERS: 'deepgram' });
    svc.set({ stt: { provider: 'openai', model: null } });
    const resolved = svc.resolveStt();
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.providers).toEqual(['openai']);
      expect(resolved.source).toBe('preference');
    }
  });

  it('legacy cascade only with explicit flag', () => {
    const blocked = service({}).resolveStt();
    expect(blocked.ok).toBe(false);

    const allowed = service({ ZAVORTH_VOICE_ALLOW_LEGACY_STT_CASCADE: 'true' }).resolveStt();
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.source).toBe('legacy_cascade');
      expect(allowed.providers.length).toBeGreaterThan(1);
    }
  });

  it('AudioTranscriptionService fails closed without preference', async () => {
    const prefs = service({});
    const stt = new AudioTranscriptionService({
      voicePreferences: prefs,
    });
    const result = await stt.transcribe({
      audio: Buffer.alloc(2048, 1),
      mimeType: 'audio/ogg',
    });
    expect(result.ok).toBe(false);
    expect(String(result.error || '')).toMatch(/not configured|Configure STT/i);
  });

  it('clear resets to unconfigured', () => {
    const svc = service({});
    svc.set({ stt: { provider: 'gemini', model: 'x' } });
    expect(svc.isSttConfigured()).toBe(true);
    svc.clear();
    expect(svc.isSttConfigured()).toBe(false);
    expect(svc.resolveStt().ok).toBe(false);
  });
});
