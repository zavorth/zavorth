import fs from 'fs';
import os from 'os';
import path from 'path';
import { GeminiVoiceSynthesisAdapter } from '../../../../../src/adapters/speech/tts/transports/GeminiVoiceSynthesisAdapter';
import type { GeminiVoiceServiceLike } from '../../../../../src/adapters/speech/tts/transports/GeminiVoiceSynthesisAdapter';
import type { GeminiVoiceServiceTtsProviderConfig } from '../../../../../src/adapters/speech/tts/TtsProviderConfigSchema';
import { ttsProviderConfigSchema } from '../../../../../src/adapters/speech/tts/TtsProviderConfigSchema';
import type {
  GeminiVoiceSynthesisOptions,
  GeminiVoiceSynthesisResult,
} from '../../../../../src/providers/GeminiVoiceService';

function adapterConfig(overrides: Record<string, unknown> = {}): GeminiVoiceServiceTtsProviderConfig {
  return ttsProviderConfigSchema.parse({
    providerId: 'gemini-voice-service',
    transport: 'gemini-voice-service',
    apiKeyEnvVar: 'ZAVORTH_TTS_GVS_TEST_KEY',
    modelId: 'gemini-2.5-flash',
    defaultVoiceId: 'Kore',
    languageCode: 'en-US',
    voices: [
      { id: 'Kore', name: 'Kore', language: 'en-US', gender: 'female' },
      { id: 'Puck', name: 'Puck', language: 'en-US', gender: 'male' },
    ],
    ...overrides,
  }) as GeminiVoiceServiceTtsProviderConfig;
}

function synthesisResult(filePath: string): GeminiVoiceSynthesisResult {
  return {
    filePath,
    model: 'gemini-2.5-flash',
    voiceName: 'Kore',
    languageCode: 'en-US',
    mimeType: 'audio/wav',
    sourceMimeType: 'audio/pcm',
    latencyMs: 12,
    inputChars: 2,
    outputBytes: 48,
  };
}

function makeVoiceService(
  overrides: Partial<Record<'isConfigured' | 'synthesizeDetailed' | 'cleanup', unknown>> = {},
  defaultResult: GeminiVoiceSynthesisResult | null = null,
): GeminiVoiceServiceLike {
  const service: GeminiVoiceServiceLike = {
    isConfigured: jest.fn((): boolean => true),
    synthesizeDetailed: jest.fn(async (_text: string, _options?: GeminiVoiceSynthesisOptions) => defaultResult),
    cleanup: jest.fn((_filePath: string): void => undefined),
  };
  return { ...service, ...overrides } as GeminiVoiceServiceLike;
}

describe('GeminiVoiceSynthesisAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes model/voice/language overrides onto the service call', async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-gvs-adapter-'));
    const filePath = path.join(dir, 'override.wav');
    await fs.promises.writeFile(filePath, Buffer.from('RIFF-override', 'ascii'));
    const service = makeVoiceService({}, synthesisResult(filePath));
    const adapter = new GeminiVoiceSynthesisAdapter(adapterConfig(), { voiceService: service });

    await adapter.synthesize({
      text: 'hello world',
      voiceId: 'Puck',
      language: 'pt-BR',
      modelId: 'gemini-2.5-pro',
    });

    expect(service.synthesizeDetailed).toHaveBeenCalledTimes(1);
    expect(service.synthesizeDetailed).toHaveBeenCalledWith('hello world', {
      model: 'gemini-2.5-pro',
      voiceName: 'Puck',
      languageCode: 'pt-BR',
    });
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it('falls back to config defaults and returns the wav bytes with evidence', async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-gvs-adapter-'));
    const filePath = path.join(dir, 'out.wav');
    const wavBytes = Buffer.concat([Buffer.from('RIFF0000WAVEfmt ', 'ascii'), Buffer.alloc(12, 7)]);
    await fs.promises.writeFile(filePath, wavBytes);

    const service = makeVoiceService({}, synthesisResult(filePath));
    const adapter = new GeminiVoiceSynthesisAdapter(adapterConfig(), { voiceService: service });
    const output = await adapter.synthesize({ text: 'hi' });

    expect(service.synthesizeDetailed).toHaveBeenCalledWith('hi', {
      model: 'gemini-2.5-flash',
      voiceName: 'Kore',
      languageCode: 'en-US',
    });
    expect(output.format).toBe('wav');
    expect(output.contentType).toBe('audio/wav');
    expect(output.audio.equals(wavBytes)).toBe(true);
    expect(output.audio.subarray(0, 4).toString('ascii')).toBe('RIFF');

    expect(output.providerEvidence.providerId).toBe('gemini-voice-service');
    expect(output.providerEvidence.modelId).toBe('gemini-2.5-flash');
    expect(output.providerEvidence.metadata.transport).toBe('gemini-voice-service');
    expect(typeof output.providerEvidence.metadata.latencyMs).toBe('number');
    expect(output.providerEvidence.metadata.voiceName).toBe('Kore');
    expect(output.providerEvidence.metadata.secretValuesSerialized).toBe(false);

    expect(service.cleanup).toHaveBeenCalledTimes(1);
    expect(service.cleanup).toHaveBeenCalledWith(filePath);
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it('cleans up the temp file exactly once even when reading fails', async () => {
    const filePath = path.join(os.tmpdir(), 'zavorth-gvs-missing.wav');
    const service = makeVoiceService({}, synthesisResult(filePath));
    const adapter = new GeminiVoiceSynthesisAdapter(adapterConfig(), { voiceService: service });
    const readFileSpy = jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(new Error('disk gone'));

    await expect(adapter.synthesize({ text: 'hi' })).rejects.toThrow('disk gone');

    expect(readFileSpy).toHaveBeenCalledWith(filePath);
    expect(service.cleanup).toHaveBeenCalledTimes(1);
    expect(service.cleanup).toHaveBeenCalledWith(filePath);
  });

  it('throws the pinned message when the service returns no audio', async () => {
    const service = makeVoiceService({}, null);
    const adapter = new GeminiVoiceSynthesisAdapter(adapterConfig(), { voiceService: service });

    await expect(adapter.synthesize({ text: 'hi' })).rejects.toThrow(
      'Gemini voice synthesis returned no audio.',
    );
    expect(service.cleanup).not.toHaveBeenCalled();
  });

  it('mirrors the service availability', () => {
    const configured = new GeminiVoiceSynthesisAdapter(adapterConfig(), { voiceService: makeVoiceService() });
    expect(configured.isAvailable()).toBe(true);
    expect(configured.modelId).toBe('gemini-2.5-flash');
    expect(configured.defaultVoiceId).toBe('Kore');
    expect(configured.transport).toBe('gemini-voice-service');

    const unconfigured = makeVoiceService({ isConfigured: jest.fn((): boolean => false) });
    const unavailable = new GeminiVoiceSynthesisAdapter(adapterConfig(), { voiceService: unconfigured });
    expect(unavailable.isAvailable()).toBe(false);
  });

  it('lists the config voices', () => {
    const adapter = new GeminiVoiceSynthesisAdapter(adapterConfig(), { voiceService: makeVoiceService() });
    expect(adapter.listVoices()).toEqual([
      { id: 'Kore', name: 'Kore', language: 'en-US', gender: 'female' },
      { id: 'Puck', name: 'Puck', language: 'en-US', gender: 'male' },
    ]);
  });
});
