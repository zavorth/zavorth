import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  subscribe,
  publish,
  publishToSession,
  waitForEvent,
  getVoiceDuplexEventListenerCount,
  resetVoiceDuplexEventBusForTests,
  type VoiceDuplexEvent,
} from '../../src/services/voice/VoiceDuplexEventBus.js';
import {
  VoiceRealtimeDuplexSessionService,
  resetVoiceRealtimeDuplexForTests,
  type VoiceDuplexSessionSnapshot,
} from '../../src/services/voice/VoiceRealtimeDuplexSession.js';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../../src/services/voice/VoicePreferenceService.js';
import { VoiceDictationIngress } from '../../src/services/voice/VoiceDictationIngress.js';
import { resetVoiceMetricsForTests } from '../../src/services/voice/VoiceMetricsService.js';

describe('VoiceDuplexEventBus', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetVoiceDuplexEventBusForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceMetricsForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-duplex-bus-'));
  });

  afterEach(() => {
    resetVoiceDuplexEventBusForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceMetricsForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('publishes to subscribers and supports unsubscribe', () => {
    const sessionId = 'sess-a';
    const received: VoiceDuplexEvent[] = [];
    const unsub = subscribe(sessionId, (event) => {
      received.push(event);
    });

    expect(getVoiceDuplexEventListenerCount(sessionId)).toBe(1);

    publish(sessionId, {
      type: 'phase',
      sessionId,
      at: new Date().toISOString(),
      message: 'hello',
    });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('phase');
    expect(received[0].message).toBe('hello');

    unsub();
    expect(getVoiceDuplexEventListenerCount(sessionId)).toBe(0);

    publish(sessionId, {
      type: 'phase',
      sessionId,
      at: new Date().toISOString(),
      message: 'after-unsub',
    });
    expect(received).toHaveLength(1);
  });

  it('publishToSession infers ended/error/phase and accepts explicit type', () => {
    const sessionId = 'sess-b';
    const received: VoiceDuplexEvent[] = [];
    subscribe(sessionId, (e) => received.push(e));

    const base: VoiceDuplexSessionSnapshot = {
      version: 'voice-duplex/v1',
      sessionId,
      phase: 'listening',
      surface: 'desktop',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      turnCount: 0,
      lastTranscript: null,
      lastAgentText: null,
      lastError: null,
      ttsEnabled: false,
      bargeInSupported: true,
      lastTtsAudio: null,
      experienceSessionId: null,
      workspace: null,
    };

    publishToSession(base);
    expect(received[0].type).toBe('phase');

    publishToSession({ ...base, phase: 'error', lastError: 'boom' });
    expect(received[1].type).toBe('error');
    expect(received[1].message).toBe('boom');

    publishToSession({ ...base, phase: 'ended' });
    expect(received[2].type).toBe('ended');

    publishToSession(base, 'session');
    expect(received[3].type).toBe('session');
  });

  it('completeListen emits turn event with public snapshot', async () => {
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

    const received: VoiceDuplexEvent[] = [];
    let sessionId = '';

    const session = duplex.start({
      surface: 'desktop',
      agentHandler: async ({ agentText }) => ({
        replyText: `Echo: ${agentText}`,
      }),
    });
    sessionId = session.sessionId;

    // Subscribe after start so we focus on turn (start still works for others).
    subscribe(sessionId, (e) => received.push(e));

    const after = await duplex.completeListen(sessionId, {
      transcript: 'list project files',
      provider: 'openai',
    });

    expect(after.turnCount).toBe(1);
    expect(after.lastAgentText).toBe('Echo: list project files');

    const turnEvents = received.filter((e) => e.type === 'turn');
    expect(turnEvents.length).toBeGreaterThanOrEqual(1);
    const turn = turnEvents[turnEvents.length - 1];
    expect(turn.sessionId).toBe(sessionId);
    expect(turn.session).toBeTruthy();
    expect((turn.session as VoiceDuplexSessionSnapshot).turnCount).toBe(1);
    expect((turn.session as VoiceDuplexSessionSnapshot).lastTranscript).toBe(
      'list project files',
    );

    // phase events (e.g. processing) should also have been pushed
    expect(received.some((e) => e.type === 'phase')).toBe(true);

    duplex.end(sessionId);
    expect(received.some((e) => e.type === 'ended')).toBe(true);
  });

  it('waitForEvent resolves on publish and times out when idle', async () => {
    const waiting = waitForEvent('wait-sid', 2000);
    publish('wait-sid', {
      type: 'turn',
      sessionId: 'wait-sid',
      at: new Date().toISOString(),
      message: 'hi',
    });
    const event = await waiting;
    expect(event?.type).toBe('turn');
    expect(event?.message).toBe('hi');

    const timedOut = await waitForEvent('empty-sid', 80);
    expect(timedOut).toBeNull();
  });
});
