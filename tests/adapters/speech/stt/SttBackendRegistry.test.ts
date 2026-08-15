import { SttBackendRegistry } from '../../../../src/adapters/speech/stt/SttBackendRegistry';
import { builtinSttProviderConfigs } from '../../../../src/adapters/speech/stt/builtinSttProviderConfigs';
import type { ISpeechTranscriptionAdapter } from '../../../../src/adapters/speech/stt/SpeechTranscriptionContract';

class FakeAdapter implements ISpeechTranscriptionAdapter {
  public readonly providerId: string;
  public readonly transport = 'http' as const;
  public readonly modelId = null;
  private readonly available: boolean;

  constructor(providerId: string, available = true) {
    this.providerId = providerId;
    this.available = available;
  }

  public isAvailable(): boolean {
    return this.available;
  }

  public async transcribe(): Promise<never> {
    throw new Error('not implemented in fake');
  }
}

describe('SttBackendRegistry', () => {
  it('registers and resolves an adapter by providerId', () => {
    const registry = new SttBackendRegistry();
    registry.registerAdapter(new FakeAdapter('openai'));
    expect(registry.get('openai')).not.toBeNull();
    expect(registry.has('openai')).toBe(true);
  });

  it('returns null for unknown providers', () => {
    const registry = new SttBackendRegistry();
    expect(registry.get('unknown')).toBeNull();
    expect(registry.has('unknown')).toBe(false);
  });

  it('lists registered provider ids', () => {
    const registry = new SttBackendRegistry();
    registry.registerAdapter(new FakeAdapter('deepgram'));
    registry.registerAdapter(new FakeAdapter('gemini'));
    expect(registry.providerIds()).toEqual(expect.arrayContaining(['deepgram', 'gemini']));
  });

  it('registers configs through the transport factory', () => {
    const registry = new SttBackendRegistry();
    registry.registerConfig({
      providerId: 'openai',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
      requestStyle: 'multipart',
    });
    const adapter = registry.get('openai');
    expect(adapter).not.toBeNull();
    expect(adapter!.providerId).toBe('openai');
    expect(adapter!.transport).toBe('http');
  });

  it('replaces an existing adapter with a warning on duplicate registration', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const registry = new SttBackendRegistry();
    registry.registerAdapter(new FakeAdapter('openai'));
    registry.registerAdapter(new FakeAdapter('openai', false));
    const adapter = registry.get('openai');
    expect(adapter!.isAvailable()).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('clears all adapters', () => {
    const registry = new SttBackendRegistry();
    registry.registerAdapter(new FakeAdapter('deepgram'));
    registry.clear();
    expect(registry.providerIds()).toHaveLength(0);
  });

  describe('builtin configs', () => {
    it('exposes the legacy backends as provider configs', () => {
      const configs = builtinSttProviderConfigs();
      const ids = configs.map((c) => c.providerId);
      expect(ids).toEqual(expect.arrayContaining(['openai', 'deepgram', 'gemini', 'azure', 'whisper.cpp']));
    });

    it('can build a working registry from builtin configs', () => {
      const registry = new SttBackendRegistry();
      for (const config of builtinSttProviderConfigs()) {
        registry.registerConfig(config);
      }
      expect(registry.get('openai')).not.toBeNull();
      expect(registry.get('deepgram')).not.toBeNull();
      expect(registry.get('gemini')).not.toBeNull();
      expect(registry.get('azure')).not.toBeNull();
      expect(registry.get('whisper.cpp')).not.toBeNull();
    });
  });
});
