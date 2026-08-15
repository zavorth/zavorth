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
import { resetVoiceMetricsForTests, recordVoiceMetric, getVoiceMetricsSnapshot } from '../../src/services/voice/VoiceMetricsService.js';
import { resolveVoiceIceConfig, publicVoiceIceConfig } from '../../src/services/voice/VoiceWebRtcIceConfig.js';
import {
  extractAudioMediaFromPayload,
  isMessagingAudioAttachment,
  mergeMessagingVoiceText,
} from '../../src/services/voice/MessagingChannelVoiceIngest.js';

describe('Voice backend gaps 1–7', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceDuplexEventBusForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-gaps-'));
  });

  afterEach(() => {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceDuplexEventBusForTests();
    delete process.env.ZAVORTH_VOICE_METRICS_PATH;
    delete process.env.ZAVORTH_WEBRTC_TURN_URLS;
    delete process.env.ZAVORTH_WEBRTC_TURN_USERNAME;
    delete process.env.ZAVORTH_WEBRTC_TURN_CREDENTIAL;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('Gap1: barge-in aborts in-flight agent and discards reply', async () => {
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'preference.json'),
      env: {},
    });
    prefs.set({
      mode: 'dictation',
      stt: { provider: 'openai', model: 'whisper-1', language: 'en' },
    });

    let agentStarted = false;
    const duplex = new VoiceRealtimeDuplexSessionService({
      voicePreferences: prefs,
      dictation: new VoiceDictationIngress({ voicePreferences: prefs }),
    });

    const events: VoiceDuplexEvent[] = [];
    const session = duplex.start({
      surface: 'desktop',
      ownerUserId: 'u1',
      agentHandler: async ({ signal }) => {
        agentStarted = true;
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => path.resolve(), 800);
          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(t);
              reject(new Error('Voice turn aborted (barge-in).'));
            },
            { once: true },
          );
        });
        return { replyText: 'should-not-surface' };
      },
    });
    subscribe(session.sessionId, (e) => events.push(e));

    const listenP = duplex.completeListen(session.sessionId, {
      transcript: 'hello',
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(agentStarted).toBe(true);
    duplex.bargeIn(session.sessionId);
    const after = await listenP;
    expect(after.phase).toBe('listening');
    expect(after.lastAgentText).not.toBe('should-not-surface');
    expect(events.some((e) => e.type === 'barge_in')).toBe(true);
  });

  it('Gap2: TURN only with credentials; STUN always present', () => {
    const stunOnly = resolveVoiceIceConfig({});
    expect(stunOnly.iceServers.length).toBeGreaterThanOrEqual(1);
    expect(stunOnly.hasTurn).toBe(false);

    const withTurn = resolveVoiceIceConfig({
      ZAVORTH_WEBRTC_TURN_URLS: 'turn:turn.example.com:3478',
      ZAVORTH_WEBRTC_TURN_USERNAME: 'user',
      ZAVORTH_WEBRTC_TURN_CREDENTIAL: 'secret',
    });
    expect(withTurn.hasTurn).toBe(true);
    const pub = publicVoiceIceConfig({
      ZAVORTH_WEBRTC_TURN_URLS: 'turn:turn.example.com:3478',
      ZAVORTH_WEBRTC_TURN_USERNAME: 'user',
      ZAVORTH_WEBRTC_TURN_CREDENTIAL: 'secret',
    });
    expect(pub.hasTurn).toBe(true);
    expect(JSON.stringify(pub)).not.toMatch(/secret/);
  });

  it('Gap3: max sessions enforced', () => {
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'preference.json'),
      env: {},
    });
    const duplex = new VoiceRealtimeDuplexSessionService({
      voicePreferences: prefs,
      dictation: new VoiceDictationIngress({ voicePreferences: prefs }),
      maxSessions: 2,
      ttlMs: 60_000,
    });
    const h = async () => ({ replyText: 'ok' });
    duplex.start({ surface: 'desktop', agentHandler: h });
    duplex.start({ surface: 'desktop', agentHandler: h });
    expect(() => duplex.start({ surface: 'desktop', agentHandler: h })).toThrow(/Too many active voice sessions/i);
  });

  it('Gap4: metrics redact secrets and can persist to path', () => {
    const metricsPath = path.join(tmpDir, 'metrics.jsonl');
    process.env.ZAVORTH_VOICE_METRICS_PATH = metricsPath;
    process.env.ZAVORTH_VOICE_METRICS_PERSIST = 'true';
    recordVoiceMetric({
      kind: 'stt',
      ok: false,
      message: 'failed Bearer sk-abcdefghijklmnop token=xyz',
    });
    const snap = getVoiceMetricsSnapshot();
    expect(snap.recent[0]?.message).toMatch(/redacted/i);
    expect(fs.existsSync(metricsPath)).toBe(true);
    const line = fs.readFileSync(metricsPath, 'utf8');
    expect(line).not.toMatch(/sk-abcdefghijklmnop/);
  });

  it('Gap5: extract audio media + merge voice text', () => {
    expect(
      isMessagingAudioAttachment({
        name: 'note.ogg',
        contentType: 'audio/ogg',
        url: 'https://cdn.example/a.ogg',
      }),
    ).toBe(true);
    const media = extractAudioMediaFromPayload({
      messages: [{ type: 'audio', audio: { link: 'https://cdn.example/v.ogg', mime_type: 'audio/ogg' } }],
    });
    expect(media?.url).toContain('cdn.example');
    expect(
      mergeMessagingVoiceText('', {
        ok: true,
        transcript: 'hi',
        agentText: 'hello there',
        provider: 'openai',
        message: null,
      }),
    ).toBe('hello there');
  });

  it('Gap7: assertOwner for wait_event binding', () => {
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'preference.json'),
      env: {},
    });
    const duplex = new VoiceRealtimeDuplexSessionService({
      voicePreferences: prefs,
      dictation: new VoiceDictationIngress({ voicePreferences: prefs }),
    });
    const s = duplex.start({
      surface: 'desktop',
      ownerUserId: 'alice',
      agentHandler: async () => ({ replyText: 'x' }),
    });
    expect(duplex.assertOwner(s.sessionId, 'alice')).toBe(true);
    expect(duplex.assertOwner(s.sessionId, 'bob')).toBe(false);
  });
});
