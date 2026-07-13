import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../../src/services/voice/VoicePreferenceService.js';
import { VoiceProbeService } from '../../src/services/voice/VoiceProbeService.js';
import {
  getVoiceMetricsSnapshot,
  resetVoiceMetricsForTests,
} from '../../src/services/voice/VoiceMetricsService.js';

describe('VoiceProbeService (Desktop Settings → Test)', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-probe-'));
  });

  afterEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('fails STT probe when unconfigured (sovereignty)', () => {
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'preference.json'),
      env: {},
    });
    const probe = new VoiceProbeService({ voicePreferences: prefs });
    const stt = probe.probeStt();
    expect(stt.ok).toBe(false);
    expect(stt.code).toBe('stt_not_configured');
    expect(stt.message).toMatch(/Type your message instead/i);
  });

  it('passes STT and TTS probes when preference is set', () => {
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'preference.json'),
      env: {},
    });
    prefs.set({
      mode: 'conversation',
      stt: { provider: 'openai', model: 'whisper-1', language: 'pt' },
      tts: { enabled: true, provider: 'edge-tts', voiceId: 'pt-BR-FranciscaNeural' },
    });
    const probe = new VoiceProbeService({ voicePreferences: prefs });
    const all = probe.probeAll();
    expect(all.stt.ok).toBe(true);
    expect(all.stt.providers).toEqual(['openai']);
    expect(all.stt.language).toBe('pt');
    expect(all.tts.ok).toBe(true);
    expect(all.tts.provider).toBe('edge-tts');
    expect(all.tts.clientSpeakRecommended).toBe(true);
    expect(all.mode).toBe('conversation');

    const metrics = getVoiceMetricsSnapshot();
    expect(metrics.stt.ok + metrics.stt.fail).toBeGreaterThanOrEqual(1);
    expect(metrics.tts.ok + metrics.tts.fail).toBeGreaterThanOrEqual(1);
  });
});
