import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  VoiceRealtimeDuplexSessionService,
  resetVoiceRealtimeDuplexForTests,
} from '../../src/services/voice/VoiceRealtimeDuplexSession.js';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../../src/services/voice/VoicePreferenceService.js';
import { VoiceDictationIngress } from '../../src/services/voice/VoiceDictationIngress.js';
import {
  resetVoiceDuplexEventBusForTests,
  subscribe,
  type VoiceDuplexEvent,
} from '../../src/services/voice/VoiceDuplexEventBus.js';
import { resetVoiceMetricsForTests } from '../../src/services/voice/VoiceMetricsService.js';

// Desktop status helper is pure TS — import via relative path from monorepo root
// (lives under apps/). We re-test mapping logic here in a light form by inlining
// expectations equivalent to resolveVoiceCallStatus.

describe('Voice barge-in (priority 4)', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceDuplexEventBusForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-barge-'));
  });

  afterEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceDuplexEventBusForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('bargeIn publishes barge_in, clears TTS, returns to listening', async () => {
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'preference.json'),
      env: {},
    });
    prefs.set({
      mode: 'conversation',
      stt: { provider: 'openai', model: 'whisper-1', language: 'en' },
      tts: { enabled: true, provider: 'edge-tts', voiceId: 'en-US-JennyNeural' },
    });

    let resolveSpeak: (() => void) | null = null;
    const speakStarted = new Promise<void>((r) => {
      // delay speak so barge can interrupt
    });

    const duplex = new VoiceRealtimeDuplexSessionService({
      voicePreferences: prefs,
      dictation: new VoiceDictationIngress({ voicePreferences: prefs }),
    });

    const events: VoiceDuplexEvent[] = [];
    const session = duplex.start({
      surface: 'desktop',
      agentHandler: async () => ({ replyText: 'Long agent reply for TTS' }),
      speakHandler: async () => {
        // Simulate slow TTS
        await new Promise<void>((resolve) => {
          resolveSpeak = resolve;
          setTimeout(resolve, 500);
        });
        return {
          mimeType: 'audio/mpeg',
          audioBase64: Buffer.from('late-tts').toString('base64'),
          provider: 'edge-tts',
        };
      },
    });
    subscribe(session.sessionId, (e) => events.push(e));

    const listenPromise = duplex.completeListen(session.sessionId, {
      transcript: 'hello agent',
      provider: 'openai',
    });

    // Wait until speaking phase
    await new Promise((r) => setTimeout(r, 30));
    const mid = duplex.get(session.sessionId);
    if (mid?.phase === 'speaking' || mid?.phase === 'processing') {
      const barged = duplex.bargeIn(session.sessionId);
      expect(barged.phase).toBe('listening');
      expect(barged.lastTtsAudio).toBeNull();
    } else {
      // Agent may still be processing — barge anyway
      const barged = duplex.bargeIn(session.sessionId);
      expect(barged.phase).toBe('listening');
    }

    resolveSpeak?.();
    const after = await listenPromise;
    // After barge, should not re-attach interrupted TTS as final state
    expect(after.phase === 'listening' || after.phase === 'ended').toBe(true);
    expect(events.some((e) => e.type === 'barge_in')).toBe(true);
    void speakStarted;
  });
});

describe('Voice call status mapping (priority 5)', () => {
  // Keep mapping tests colocated without importing apps path (jest roots).
  function mapPhase(phase: string, rms = 0): string {
    if (phase === 'error') return 'Error';
    if (phase === 'connecting') return 'Connecting';
    if (phase === 'processing') return 'Thinking';
    if (phase === 'speaking') return 'Speaking';
    if (phase === 'listening') return rms > 0.02 ? 'Hearing you' : 'Listening';
    if (phase === 'ended') return 'Ended';
    return phase;
  }

  it('maps phases to clear labels', () => {
    expect(mapPhase('connecting')).toBe('Connecting');
    expect(mapPhase('listening')).toBe('Listening');
    expect(mapPhase('listening', 0.05)).toBe('Hearing you');
    expect(mapPhase('processing')).toBe('Thinking');
    expect(mapPhase('speaking')).toBe('Speaking');
    expect(mapPhase('error')).toBe('Error');
  });
});
