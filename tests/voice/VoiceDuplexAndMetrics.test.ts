import {
  getVoiceMetricsSnapshot,
  recordVoiceMetric,
  resetVoiceMetricsForTests,
} from '../../src/services/voice/VoiceMetricsService.js';
import {
  VoiceRealtimeDuplexSessionService,
  resetVoiceRealtimeDuplexForTests,
} from '../../src/services/voice/VoiceRealtimeDuplexSession.js';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../../src/services/voice/VoicePreferenceService.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VoiceDictationIngress } from '../../src/services/voice/VoiceDictationIngress.js';

describe('Voice duplex and metrics', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetVoiceMetricsForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoicePreferenceServiceForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-duplex-'));
  });

  afterEach(() => {
    resetVoiceMetricsForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoicePreferenceServiceForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('records and aggregates metrics', () => {
    recordVoiceMetric({ kind: 'stt', ok: true, latencyMs: 100, provider: 'openai' });
    recordVoiceMetric({ kind: 'stt', ok: false, message: 'timeout' });
    recordVoiceMetric({ kind: 'tts', ok: true, latencyMs: 200, provider: 'edge-tts' });
    const snap = getVoiceMetricsSnapshot();
    expect(snap.stt.ok).toBe(1);
    expect(snap.stt.fail).toBe(1);
    expect(snap.stt.avgLatencyMs).toBe(100);
    expect(snap.tts.ok).toBe(1);
    expect(snap.recent.length).toBeGreaterThanOrEqual(3);
  });

  it('runs a duplex listen→agent turn with barge-in', async () => {
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
      agentHandler: async ({ agentText }) => ({
        replyText: `Echo: ${agentText}`,
      }),
    });
    expect(session.phase).toBe('listening');

    const after = await duplex.completeListen(session.sessionId, {
      transcript: 'list project files',
      provider: 'openai',
    });
    expect(after.turnCount).toBe(1);
    expect(after.lastTranscript).toBe('list project files');
    expect(after.lastAgentText).toBe('Echo: list project files');
    expect(after.phase).toBe('listening');

    const barged = duplex.bargeIn(session.sessionId);
    expect(barged.phase).toBe('listening');

    const ended = duplex.end(session.sessionId);
    expect(ended?.phase).toBe('ended');

    const metrics = getVoiceMetricsSnapshot();
    expect(metrics.duplex.sessions).toBeGreaterThanOrEqual(1);
    expect(metrics.duplex.turns).toBeGreaterThanOrEqual(1);
  });
});
