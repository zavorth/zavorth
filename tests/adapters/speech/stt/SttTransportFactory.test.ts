import { SttTransportFactory } from '../../../../src/adapters/speech/stt/SttTransportFactory';
import { HttpTranscriptionAdapter } from '../../../../src/adapters/speech/stt/transports/HttpTranscriptionAdapter';
import { WebsocketTranscriptionAdapter } from '../../../../src/adapters/speech/stt/transports/WebsocketTranscriptionAdapter';
import { SdkTranscriptionAdapter } from '../../../../src/adapters/speech/stt/transports/SdkTranscriptionAdapter';
import { CliTranscriptionAdapter } from '../../../../src/adapters/speech/stt/transports/CliTranscriptionAdapter';
import { InProcessTranscriptionAdapter } from '../../../../src/adapters/speech/stt/transports/InProcessTranscriptionAdapter';
import { McpTranscriptionAdapter } from '../../../../src/adapters/speech/stt/transports/McpTranscriptionAdapter';

describe('SttTransportFactory', () => {
  const factory = new SttTransportFactory();

  it('creates an http adapter', () => {
    const adapter = factory.create({
      providerId: 'a',
      transport: 'http',
      transcribeUrl: 'https://api.example.com/v1/transcribe',
    });
    expect(adapter).toBeInstanceOf(HttpTranscriptionAdapter);
    expect(adapter.transport).toBe('http');
  });

  it('creates a websocket adapter', () => {
    const adapter = factory.create({
      providerId: 'b',
      transport: 'websocket',
      wsUrl: 'wss://stt.example.com',
    });
    expect(adapter).toBeInstanceOf(WebsocketTranscriptionAdapter);
    expect(adapter.transport).toBe('websocket');
  });

  it('creates an sdk adapter', () => {
    const adapter = factory.create({
      providerId: 'c',
      transport: 'sdk',
      sdkModule: 'acme-stt',
      factoryFunction: 'createClient',
    });
    expect(adapter).toBeInstanceOf(SdkTranscriptionAdapter);
    expect(adapter.transport).toBe('sdk');
  });

  it('creates a cli adapter', () => {
    const adapter = factory.create({
      providerId: 'd',
      transport: 'cli',
      command: 'whisper',
    });
    expect(adapter).toBeInstanceOf(CliTranscriptionAdapter);
    expect(adapter.transport).toBe('cli');
  });

  it('creates an in-process adapter', () => {
    const adapter = factory.create({
      providerId: 'e',
      transport: 'in-process',
      engineModule: './stt.js',
      engineFunction: 'transcribe',
    });
    expect(adapter).toBeInstanceOf(InProcessTranscriptionAdapter);
    expect(adapter.transport).toBe('in-process');
  });

  it('creates an mcp adapter', () => {
    const adapter = factory.create({
      providerId: 'f',
      transport: 'mcp',
      mcpServerId: 'npx',
      toolName: 'transcribe',
    });
    expect(adapter).toBeInstanceOf(McpTranscriptionAdapter);
    expect(adapter.transport).toBe('mcp');
  });
});
