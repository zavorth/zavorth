import { z } from 'zod';
import {
  sttProviderConfigSchema,
  resolveSttApiKey,
  STT_TRANSPORT_TYPES,
} from '../../../../src/adapters/speech/stt/SttProviderConfigSchema';

describe('SttProviderConfigSchema', () => {
  it('accepts a valid http multipart config (OpenAI-style)', () => {
    const config = sttProviderConfigSchema.parse({
      providerId: 'openai',
      transport: 'http',
      transcribeUrl: 'https://api.openai.com/v1/audio/transcriptions',
      requestStyle: 'multipart',
      apiKeyEnvVar: 'OPENAI_API_KEY',
    });
    expect(config.transport).toBe('http');
    expect(config.requestStyle).toBe('multipart');
    expect(config.authScheme).toBe('Bearer');
    expect(config.timeoutMs).toBe(120_000);
  });

  it('accepts a valid cli config', () => {
    const config = sttProviderConfigSchema.parse({
      providerId: 'whisper.cpp',
      transport: 'cli',
      command: 'whisper',
      args: ['{audio}', '--output_format', 'txt'],
    });
    expect(config.transport).toBe('cli');
    expect(config.command).toBe('whisper');
  });

  it('accepts a valid sdk config', () => {
    const config = sttProviderConfigSchema.parse({
      providerId: 'custom-sdk',
      transport: 'sdk',
      sdkModule: 'acme-stt',
      factoryFunction: 'createClient',
    });
    expect(config.transport).toBe('sdk');
  });

  it('accepts a valid websocket config', () => {
    const config = sttProviderConfigSchema.parse({
      providerId: 'ws-provider',
      transport: 'websocket',
      wsUrl: 'wss://stt.example.com',
    });
    expect(config.transport).toBe('websocket');
  });

  it('accepts a valid in-process config', () => {
    const config = sttProviderConfigSchema.parse({
      providerId: 'local-engine',
      transport: 'in-process',
      engineModule: './stt-engine.js',
      engineFunction: 'transcribe',
    });
    expect(config.transport).toBe('in-process');
  });

  it('accepts a valid mcp config', () => {
    const config = sttProviderConfigSchema.parse({
      providerId: 'mcp-stt',
      transport: 'mcp',
      mcpServerId: 'npx',
      toolName: 'transcribe',
      serverArgs: ['-y', 'stt-mcp-server'],
    });
    expect(config.transport).toBe('mcp');
  });

  it('rejects a config with a mismatched transport body', () => {
    const parse = () =>
      sttProviderConfigSchema.parse({
        providerId: 'broken',
        transport: 'http',
        command: 'whisper',
      });
    expect(parse).toThrow(z.ZodError);
  });

  it('rejects a config with an unknown transport', () => {
    const parse = () =>
      sttProviderConfigSchema.parse({
        providerId: 'broken',
        transport: 'carrier-pigeon',
      });
    expect(parse).toThrow(z.ZodError);
  });

  it('rejects a config missing providerId', () => {
    const parse = () =>
      sttProviderConfigSchema.parse({
        transport: 'http',
        transcribeUrl: 'https://api.example.com',
      });
    expect(parse).toThrow(z.ZodError);
  });

  it('exposes all six transport types', () => {
    expect(STT_TRANSPORT_TYPES).toEqual(
      expect.arrayContaining(['http', 'websocket', 'sdk', 'cli', 'in-process', 'mcp']),
    );
  });

  describe('resolveSttApiKey', () => {
    const original = process.env;

    afterEach(() => {
      process.env = original;
    });

    it('returns null when no env var is declared', () => {
      const config = sttProviderConfigSchema.parse({
        providerId: 'nokey',
        transport: 'http',
        transcribeUrl: 'https://api.example.com',
      });
      expect(resolveSttApiKey(config)).toBeNull();
    });

    it('returns null when the env var is missing', () => {
      delete process.env.CUSTOM_STT_KEY;
      const config = sttProviderConfigSchema.parse({
        providerId: 'nokey',
        transport: 'http',
        transcribeUrl: 'https://api.example.com',
        apiKeyEnvVar: 'CUSTOM_STT_KEY',
      });
      expect(resolveSttApiKey(config)).toBeNull();
    });

    it('returns the value when the env var is set', () => {
      process.env.CUSTOM_STT_KEY = 'secret-123';
      const config = sttProviderConfigSchema.parse({
        providerId: 'withkey',
        transport: 'http',
        transcribeUrl: 'https://api.example.com',
        apiKeyEnvVar: 'CUSTOM_STT_KEY',
      });
      expect(resolveSttApiKey(config)).toBe('secret-123');
    });
  });
});
