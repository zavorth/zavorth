import { HomeAssistantBridge } from '../../src/echo/tools/iot/HomeAssistantBridge.js';
import { MemoryService } from '../../src/services/MemoryService.js';
import {
  EchoVoiceAssetStoreService,
  getDefaultEchoVoiceAssetStore,
} from '../../src/domain/surface/infrastructure/EchoVoiceAssetStoreService.js';

describe('HomeAssistantBridge', () => {
  const oldUrl = process.env.HOME_ASSISTANT_URL;
  const oldToken = process.env.HOME_ASSISTANT_TOKEN;
  const oldPublicBaseUrl = process.env.ZAVORTH_PUBLIC_BASE_URL;

  afterEach(() => {
    jest.restoreAllMocks();
    getDefaultEchoVoiceAssetStore().clear();
    if (oldUrl === undefined) {
      delete process.env.HOME_ASSISTANT_URL;
    } else {
      process.env.HOME_ASSISTANT_URL = oldUrl;
    }
    if (oldToken === undefined) {
      delete process.env.HOME_ASSISTANT_TOKEN;
    } else {
      process.env.HOME_ASSISTANT_TOKEN = oldToken;
    }
    if (oldPublicBaseUrl === undefined) {
      delete process.env.ZAVORTH_PUBLIC_BASE_URL;
    } else {
      process.env.ZAVORTH_PUBLIC_BASE_URL = oldPublicBaseUrl;
    }
  });

  it('returns canonical lifecycle, artifact, policy, and correlation metadata on successful local control', async () => {
    process.env.HOME_ASSISTANT_URL = 'http://homeassistant.local:8123';
    process.env.HOME_ASSISTANT_TOKEN = 'test-token';
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      text: async () => '',
    } as any);

    const result = await new HomeAssistantBridge().execute(
      {
        entity_id: 'light.sala',
        action: 'turn_on',
      },
      {
        traceId: 'trace-1',
        runId: 'run-1',
        sessionId: 'sess-1',
        approvalId: 'approval-1',
        artifactId: 'artifact-1',
      },
    );

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://homeassistant.local:8123/api/services/light/turn_on',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result.data).toEqual(expect.objectContaining({
      entity_id: 'light.sala',
      action: 'turn_on',
      artifact: expect.objectContaining({
        id: 'artifact-1',
        kind: 'iot-command',
        source: 'iot_home_assistant',
      }),
      lifecycle: expect.objectContaining({
        mode: 'event-bridge',
        status: 'idle',
        lastEntityId: 'light.sala',
        lastAction: 'turn_on',
      }),
      policy: expect.objectContaining({
        scope: 'private-network',
        hostname: 'homeassistant.local',
        transport: 'rest+websocket',
      }),
      correlation: expect.objectContaining({
        traceId: 'trace-1',
        runId: 'run-1',
        sessionId: 'sess-1',
        approvalId: 'approval-1',
        artifactId: 'artifact-1',
      }),
    }));
  });

  it('marks the bridge as disabled when event listening starts without a token', () => {
    delete process.env.HOME_ASSISTANT_TOKEN;
    process.env.HOME_ASSISTANT_URL = 'http://localhost:8123';
    const bridge = new HomeAssistantBridge();

    bridge.startListeningEvents();

    expect(bridge.getLifecycleSnapshot()).toEqual(expect.objectContaining({
      mode: 'event-bridge',
      status: 'disabled',
      connected: false,
      lastError: 'HOME_ASSISTANT_TOKEN nao configurado.',
    }));
  });

  it('returns blocked policy metadata before any external network call', async () => {
    process.env.HOME_ASSISTANT_URL = 'https://example.com';
    process.env.HOME_ASSISTANT_TOKEN = 'test-token';
    const fetchSpy = jest.spyOn(global, 'fetch' as any);

    const result = await new HomeAssistantBridge().execute({
      entity_id: 'light.sala',
      action: 'turn_on',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/rede privada/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.data).toEqual(expect.objectContaining({
      lifecycle: expect.objectContaining({
        mode: 'event-bridge',
        status: 'blocked',
      }),
      policy: expect.objectContaining({
        scope: 'blocked',
        hostname: 'example.com',
        transport: 'rest+websocket',
      }),
    }));
  });

  it('publishes signed Gemini audio and plays it via media_player.play_media', async () => {
    process.env.HOME_ASSISTANT_URL = 'http://homeassistant.local:8123';
    process.env.HOME_ASSISTANT_TOKEN = 'test-token';
    process.env.ZAVORTH_PUBLIC_BASE_URL = 'https://zavorth.example';
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      text: async () => '',
    } as any);
    const assetStore = new EchoVoiceAssetStoreService({
      now: () => 1_700_000_000_000,
      defaultTtlMs: 60_000,
    });
    const bridge = new HomeAssistantBridge({
      publicBaseUrl: 'https://zavorth.example',
      voiceAssetStore: assetStore,
      speechService: {
        synthesize: jest.fn(async () => ({
          ok: true,
          audio: Buffer.from('voice-binary'),
          mimeType: 'audio/wav',
          model: 'gemini-3.1-flash-tts-preview',
          voiceName: 'Kore',
          languageCode: 'en-US',
          latencyMs: 48,
          outputBytes: 12,
          traceId: 'voice-trace-1',
        })),
      },
    });

    const result = await bridge.execute(
      {
        entity_id: 'media_player.sala',
        action: 'speak_text',
        attributes: {
          text: 'Zavorth falando na sala.',
          announce: true,
        },
      },
      {
        traceId: 'trace-1',
        runId: 'run-1',
        sessionId: 'sess-1',
        approvalId: 'approval-1',
        artifactId: 'artifact-1',
      },
    );

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://homeassistant.local:8123/api/services/media_player/play_media',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"media_content_type":"music"'),
      }),
    );
    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body || '{}'));
    expect(payload).toEqual(expect.objectContaining({
      entity_id: 'media_player.sala',
      media_content_type: 'music',
      announce: true,
    }));
    expect(String(payload.media_content_id)).toMatch(
      /^https:\/\/zavorth\.example\/api\/v2\/echo\/audio\/assets\/.+\/access\/.+/,
    );
    expect(result.data).toEqual(expect.objectContaining({
      entity_id: 'media_player.sala',
      action: 'speak_text',
      artifact: expect.objectContaining({
        id: 'artifact-1',
        kind: 'iot-voice-command',
        assetId: expect.any(String),
      }),
      voice: expect.objectContaining({
        model: 'gemini-3.1-flash-tts-preview',
        voiceName: 'Kore',
        languageCode: 'en-US',
        publicUrl: payload.media_content_id,
      }),
      correlation: expect.objectContaining({
        traceId: 'trace-1',
        runId: 'run-1',
      }),
    }));
  });

  it('stores recent physical events for cross-surface feedback', async () => {
    jest.spyOn(MemoryService.prototype, 'remember').mockResolvedValue(undefined);
    const bridge = new HomeAssistantBridge() as any;

    await bridge.handlePhysicalEvent({
      entity_id: 'lock.front_door',
      old_state: { state: 'locked' },
      new_state: { state: 'unlocked' },
    });

    const events = bridge.getRecentPhysicalEvents(3);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      entityId: 'lock.front_door',
      newState: 'unlocked',
      severity: 'critical',
      feedback: expect.stringMatching(/Atencao/i),
    }));
    expect(bridge.getLifecycleSnapshot()).toEqual(expect.objectContaining({
      lastPhysicalSeverity: 'critical',
      recentPhysicalEvents: [expect.objectContaining({
        entityId: 'lock.front_door',
      })],
    }));
  });
});
