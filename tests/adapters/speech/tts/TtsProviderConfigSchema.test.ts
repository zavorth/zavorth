import {
  ttsProviderConfigSchema,
  resolveTtsApiKey,
  TTS_TRANSPORT_TYPES,
} from '../../../../src/adapters/speech/tts/TtsProviderConfigSchema';

describe('TtsProviderConfigSchema', () => {
  it('validates an http provider with defaults applied', () => {
    const config = ttsProviderConfigSchema.parse({
      providerId: 'azure',
      transport: 'http',
      synthesizeUrl: 'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1',
      requestStyle: 'ssml',
      apiKeyEnvVar: 'AZURE_SPEECH_KEY',
      voices: [{ id: 'en-US-GuyNeural', name: 'Guy', language: 'en-US', gender: 'male' }],
    });
    expect(config.transport).toBe('http');
    expect(config.requestStyle).toBe('ssml');
    expect(config.audioSource).toBe('body');
    expect(config.timeoutMs).toBe(120_000);
    expect(config.voices).toHaveLength(1);
  });

  it('validates a cli provider with platform commands', () => {
    const config = ttsProviderConfigSchema.parse({
      providerId: 'local',
      transport: 'cli',
      command: 'say',
      args: ['{text}'],
      platformCommands: {
        darwin: { command: 'say', args: ['{text}'], voiceArgs: ['-v', '{voice}'], rateMode: 'multiply', rateBase: 200 },
        win32: { command: 'powershell', args: ['{textFile}'], rateMode: 'delta', rateBase: 10 },
      },
      outputFormat: 'wav',
    });
    expect(config.platformCommands?.darwin?.rateMode).toBe('multiply');
    expect(config.platformCommands?.win32?.rateBase).toBe(10);
  });

  it('rejects a config with an unknown transport', () => {
    expect(() =>
      ttsProviderConfigSchema.parse({
        providerId: 'x',
        transport: 'carrier-pigeon',
      }),
    ).toThrow();
  });

  it('resolves api keys from the environment', () => {
    process.env.TTS_TEST_API_KEY = 'secret-abc';
    const config = ttsProviderConfigSchema.parse({
      providerId: 'test',
      transport: 'http',
      synthesizeUrl: 'https://example.com',
      apiKeyEnvVar: 'TTS_TEST_API_KEY',
    });
    expect(resolveTtsApiKey(config)).toBe('secret-abc');
    delete process.env.TTS_TEST_API_KEY;
  });

  it('returns null api key when the env var is missing', () => {
    const config = ttsProviderConfigSchema.parse({
      providerId: 'test',
      transport: 'http',
      synthesizeUrl: 'https://example.com',
      apiKeyEnvVar: 'TTS_TEST_MISSING_KEY',
    });
    expect(resolveTtsApiKey(config)).toBeNull();
  });

  it('exposes all TTS transport types', () => {
    expect(TTS_TRANSPORT_TYPES).toEqual(['http', 'sdk', 'cli', 'in-process', 'mcp', 'gemini-voice-service']);
  });
});
