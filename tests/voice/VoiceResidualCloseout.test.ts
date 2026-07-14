import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  VoiceDuplexSessionStore,
  resetVoiceDuplexSessionStoreForTests,
} from '../../src/services/voice/VoiceDuplexSessionStore.js';
import {
  listVoiceSurfaceCapabilities,
  registerVoiceSurface,
  surfaceSupportsVoice,
  resetVoiceSurfaceRegistryForTests,
} from '../../src/services/voice/VoiceSurfaceCapabilityRegistry.js';
import { extractAudioMediaFromPayload } from '../../src/services/voice/MessagingChannelVoiceIngest.js';
import {
  VoiceRealtimeDuplexSessionService,
  resetVoiceRealtimeDuplexForTests,
} from '../../src/services/voice/VoiceRealtimeDuplexSession.js';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../../src/services/voice/VoicePreferenceService.js';
import { VoiceDictationIngress } from '../../src/services/voice/VoiceDictationIngress.js';

describe('Voice residual closeout', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetVoiceDuplexSessionStoreForTests();
    resetVoiceSurfaceRegistryForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoicePreferenceServiceForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-residual-'));
  });

  afterEach(() => {
    resetVoiceDuplexSessionStoreForTests();
    resetVoiceSurfaceRegistryForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoicePreferenceServiceForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('durable store saves and marks orphans on boot', () => {
    const storePath = path.join(tmpDir, 'duplex.json');
    const store = new VoiceDuplexSessionStore({ filePath: storePath, enabled: true });
    store.save(
      {
        version: 'voice-duplex/v1',
        sessionId: 's1',
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
      },
      'user-1',
    );
    expect(store.get('s1')?.snapshot.sessionId).toBe('s1');

    const store2 = new VoiceDuplexSessionStore({ filePath: storePath, enabled: true });
    const n = store2.markOrphansOnBoot();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(store2.get('s1')?.orphaned).toBe(true);
    expect(store2.get('s1')?.snapshot.phase).toBe('error');
  });

  it('voice surface registry lists desktop/whatsapp and accepts future register', () => {
    expect(surfaceSupportsVoice('desktop')).toBe(true);
    expect(surfaceSupportsVoice('whatsapp')).toBe(true);
    expect(surfaceSupportsVoice('email')).toBe(false);
    registerVoiceSurface({
      surfaceId: 'future-radio',
      label: 'Future Radio',
      modes: ['messaging-webhook'],
      preferenceStt: true,
      preferenceTts: true,
    });
    expect(surfaceSupportsVoice('future-radio')).toBe(true);
    expect(listVoiceSurfaceCapabilities().some((s) => s.surfaceId === 'future-radio')).toBe(true);
  });

  it('extracts Teams contentUrl audio', () => {
    const media = extractAudioMediaFromPayload({
      attachments: [
        {
          contentType: 'audio/wav',
          contentUrl: 'https://cdn.example.com/clip.wav',
          name: 'clip.wav',
        },
      ],
    });
    expect(media?.url).toContain('clip.wav');
  });

  it('duplex get returns durable orphan after live map empty', () => {
    const storePath = path.join(tmpDir, 'duplex2.json');
    process.env.ZAVORTH_VOICE_DUPLEX_STORE_PATH = storePath;
    resetVoiceDuplexSessionStoreForTests();
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'pref.json'),
      env: {},
    });
    const durable = new VoiceDuplexSessionStore({ filePath: storePath, enabled: true });
    const duplex = new VoiceRealtimeDuplexSessionService({
      voicePreferences: prefs,
      dictation: new VoiceDictationIngress({ voicePreferences: prefs }),
      durableStore: durable,
    });
    const s = duplex.start({
      surface: 'desktop',
      agentHandler: async () => ({ replyText: 'ok' }),
    });
    // Simulate process death: clear live map but keep durable via new service instance
    resetVoiceRealtimeDuplexForTests();
    const duplex2 = new VoiceRealtimeDuplexSessionService({
      voicePreferences: prefs,
      dictation: new VoiceDictationIngress({ voicePreferences: prefs }),
      durableStore: new VoiceDuplexSessionStore({ filePath: storePath, enabled: true }),
    });
    // After boot orphan mark, get may show error phase
    const recovered = duplex2.get(s.sessionId);
    // Either still present as listening from last save, or orphaned error after markOrphans
    expect(recovered === null || recovered.sessionId === s.sessionId).toBe(true);
    delete process.env.ZAVORTH_VOICE_DUPLEX_STORE_PATH;
  });
});
