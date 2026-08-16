import { TtsBackendRegistry } from '../../../../src/adapters/speech/tts/TtsBackendRegistry';
import { ttsProviderConfigSchema } from '../../../../src/adapters/speech/tts/TtsProviderConfigSchema';
import type { ISpeechSynthesisAdapter, TtsSynthesizeOutput } from '../../../../src/adapters/speech/tts/SpeechSynthesisContract';

function fakeAdapter(providerId: string, available = true): ISpeechSynthesisAdapter {
  return {
    providerId,
    transport: 'http',
    modelId: null,
    defaultVoiceId: null,
    isAvailable: () => available,
    listVoices: () => [],
    async synthesize(): Promise<TtsSynthesizeOutput> {
      return {
        audio: Buffer.from([1, 2, 3]),
        format: 'mp3',
        contentType: 'audio/mpeg',
        providerEvidence: { providerId, modelId: null, metadata: { transport: 'http' } },
      };
    },
  };
}

describe('TtsBackendRegistry', () => {
  it('registers and resolves adapters by providerId', () => {
    const registry = new TtsBackendRegistry();
    registry.registerAdapter(fakeAdapter('azure'));
    expect(registry.has('azure')).toBe(true);
    expect(registry.get('azure')?.providerId).toBe('azure');
    expect(registry.get('missing')).toBeNull();
  });

  it('builds adapters from validated configs', () => {
    const registry = new TtsBackendRegistry();
    const config = ttsProviderConfigSchema.parse({
      providerId: 'local',
      transport: 'cli',
      command: 'say',
    });
    registry.registerConfig(config);
    expect(registry.has('local')).toBe(true);
  });

  it('lists registered provider ids', () => {
    const registry = new TtsBackendRegistry();
    registry.registerAdapter(fakeAdapter('a'));
    registry.registerAdapter(fakeAdapter('b'));
    expect(registry.providerIds()).toEqual(['a', 'b']);
  });

  it('clear empties the registry', () => {
    const registry = new TtsBackendRegistry();
    registry.registerAdapter(fakeAdapter('a'));
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});
