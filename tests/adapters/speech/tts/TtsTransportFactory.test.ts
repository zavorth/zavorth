import { TtsTransportFactory } from '../../../../src/adapters/speech/tts/TtsTransportFactory';
import { ttsProviderConfigSchema } from '../../../../src/adapters/speech/tts/TtsProviderConfigSchema';
import { HttpSynthesisAdapter } from '../../../../src/adapters/speech/tts/transports/HttpSynthesisAdapter';
import { CliSynthesisAdapter } from '../../../../src/adapters/speech/tts/transports/CliSynthesisAdapter';
import { SdkSynthesisAdapter } from '../../../../src/adapters/speech/tts/transports/SdkSynthesisAdapter';
import { InProcessSynthesisAdapter } from '../../../../src/adapters/speech/tts/transports/InProcessSynthesisAdapter';
import { McpSynthesisAdapter } from '../../../../src/adapters/speech/tts/transports/McpSynthesisAdapter';

describe('TtsTransportFactory', () => {
  const factory = new TtsTransportFactory();

  it('builds an http adapter', () => {
    const config = ttsProviderConfigSchema.parse({
      providerId: 'azure',
      transport: 'http',
      synthesizeUrl: 'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1',
    });
    expect(factory.create(config)).toBeInstanceOf(HttpSynthesisAdapter);
  });

  it('builds a cli adapter', () => {
    const config = ttsProviderConfigSchema.parse({
      providerId: 'local',
      transport: 'cli',
      command: 'say',
    });
    expect(factory.create(config)).toBeInstanceOf(CliSynthesisAdapter);
  });

  it('builds an sdk adapter', () => {
    const config = ttsProviderConfigSchema.parse({
      providerId: 'sdk-tts',
      transport: 'sdk',
      sdkModule: 'some-sdk',
      factoryFunction: 'create',
    });
    expect(factory.create(config)).toBeInstanceOf(SdkSynthesisAdapter);
  });

  it('builds an in-process adapter', () => {
    const config = ttsProviderConfigSchema.parse({
      providerId: 'inproc-tts',
      transport: 'in-process',
      engineModule: 'some-engine',
      engineFunction: 'synthesize',
    });
    expect(factory.create(config)).toBeInstanceOf(InProcessSynthesisAdapter);
  });

  it('builds an mcp adapter', () => {
    const config = ttsProviderConfigSchema.parse({
      providerId: 'mcp-tts',
      transport: 'mcp',
      mcpServerId: 'tts-server',
      toolName: 'speak',
    });
    expect(factory.create(config)).toBeInstanceOf(McpSynthesisAdapter);
  });
});
