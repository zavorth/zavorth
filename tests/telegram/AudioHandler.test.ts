import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import { config } from '../../src/config/index';
import { AudioHandler } from '../../src/telegram/AudioHandler';
import { CapabilityUnavailableError } from '../../src/services/OptionalCapabilityGuard';

describe('AudioHandler', () => {
  it('prefere Edge-TTS para respostas curtas quando a voz local combina com o idioma', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-audio-handler-'));
    const setMetadata = jest.fn(async () => undefined);
    const toStream = jest.fn(() => ({
      audioStream: Readable.from([Buffer.from('edge-audio')]),
    }));
    const close = jest.fn();
    const voiceTelemetryService = {
      recordSuccess: jest.fn(async () => undefined),
      recordFailure: jest.fn(async () => undefined),
    };
    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesizeDetailed: jest.fn(async () => null),
      synthesize: jest.fn(async () => null),
      cleanup: jest.fn(),
    };

    class FakeMsEdgeTTS {
      public setMetadata = setMetadata;
      public toStream = toStream;
      public close = close;
    }

    const handler = new AudioHandler({
      geminiVoiceService,
      voiceTelemetryService,
      loadEdgeTts: async () => ({ MsEdgeTTS: FakeMsEdgeTTS as any }),
    });

    const output = await handler.synthesize('Resposta curta sobre as ultimas noticias.', {
      preferredLanguageCode: 'en-US',
      policyHint: 'short_reply',
    });

    expect(output).toMatch(/tts_.*\.mp3$/);
    expect(setMetadata).toHaveBeenCalledWith(config.ttsVoice, 'audio-24khz-48kbitrate-mono-mp3');
    expect(toStream).toHaveBeenCalledWith('Resposta curta sobre as ultimas noticias.');
    expect(geminiVoiceService.synthesizeDetailed).not.toHaveBeenCalled();
    expect(voiceTelemetryService.recordSuccess).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'edge-tts',
      voiceName: config.ttsVoice,
      languageCode: 'en-US',
    }));

    if (output) {
      handler.cleanup(output);
    }
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('prefere Gemini para respostas longas', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-audio-handler-'));
    const geminiFile = path.join(tempDir, 'gemini.wav');
    await fs.promises.writeFile(geminiFile, 'wav');
    const loadEdgeTts = jest.fn(async () => {
      throw new Error('edge nao deveria ser chamado para resposta longa');
    });
    const voiceTelemetryService = {
      recordSuccess: jest.fn(async () => undefined),
      recordFailure: jest.fn(async () => undefined),
    };
    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesizeDetailed: jest.fn(async () => ({
        filePath: geminiFile,
        model: 'gemini-2.5-flash',
        voiceName: 'Kore',
        languageCode: 'en-US',
        mimeType: 'audio/wav',
        sourceMimeType: 'audio/pcm',
        latencyMs: 42,
        inputChars: 700,
        outputBytes: 3,
      })),
      synthesize: jest.fn(async () => geminiFile),
      cleanup: jest.fn(),
    };

    const handler = new AudioHandler({
      geminiVoiceService,
      voiceTelemetryService,
      loadEdgeTts,
    });

    const output = await handler.synthesize('A'.repeat(700), {
      preferredLanguageCode: 'en-US',
      policyHint: 'long_reply',
    });

    expect(output).toBe(geminiFile);
    expect(geminiVoiceService.synthesizeDetailed).toHaveBeenCalledWith('A'.repeat(700), {
      languageCode: 'en-US',
    });
    expect(loadEdgeTts).not.toHaveBeenCalled();
    expect(voiceTelemetryService.recordSuccess).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      voiceName: 'Kore',
      languageCode: 'en-US',
    }));

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('prefere Gemini quando o idioma pedido nao tem voz Edge configurada', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-audio-handler-'));
    const geminiFile = path.join(tempDir, 'gemini.wav');
    await fs.promises.writeFile(geminiFile, 'wav');
    const loadEdgeTts = jest.fn(async () => {
      throw new Error('edge nao deveria ser chamado sem voz compativel');
    });
    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesizeDetailed: jest.fn(async () => ({
        filePath: geminiFile,
        model: 'gemini-2.5-flash',
        voiceName: 'Kore',
        languageCode: 'es',
        mimeType: 'audio/wav',
        sourceMimeType: 'audio/pcm',
        latencyMs: 21,
        inputChars: 'Can you hear me clearly?'.length,
        outputBytes: 3,
      })),
      synthesize: jest.fn(async () => geminiFile),
      cleanup: jest.fn(),
    };

    const handler = new AudioHandler({
      geminiVoiceService,
      loadEdgeTts,
    });

    const output = await handler.synthesize('Puedes escucharme claramente?', {
      preferredLanguageCode: 'es',
      policyHint: 'short_reply',
    });

    expect(output).toBe(geminiFile);
    expect(geminiVoiceService.synthesizeDetailed).toHaveBeenCalledWith('Puedes escucharme claramente?', {
      languageCode: 'es',
    });
    expect(loadEdgeTts).not.toHaveBeenCalled();

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('cai para Gemini TTS quando edge-tts nao esta disponivel', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-audio-handler-'));
    const geminiFile = path.join(tempDir, 'gemini.wav');
    await fs.promises.writeFile(geminiFile, 'wav');
    const voiceTelemetryService = {
      recordSuccess: jest.fn(async () => undefined),
      recordFailure: jest.fn(async () => undefined),
    };

    const geminiVoiceService = {
      isConfigured: jest.fn(() => true),
      synthesizeDetailed: jest.fn(async () => ({
        filePath: geminiFile,
        model: 'gemini-2.5-flash',
        voiceName: 'Kore',
        languageCode: 'en-US',
        mimeType: 'audio/wav',
        sourceMimeType: 'audio/pcm',
        latencyMs: 42,
        inputChars: 'Fale uma resposta curta.'.length,
        outputBytes: 3,
      })),
      synthesize: jest.fn(async () => geminiFile),
      cleanup: jest.fn(),
    };

    const handler = new AudioHandler({
      geminiVoiceService,
      voiceTelemetryService,
      loadEdgeTts: async () => {
        throw new CapabilityUnavailableError({
          capabilityId: 'media',
          reason: 'edge-tts ausente',
        });
      },
    });

    const output = await handler.synthesize('Fale uma resposta curta.');

    expect(output).toBe(geminiFile);
    expect(geminiVoiceService.synthesizeDetailed).toHaveBeenCalledWith('Fale uma resposta curta.', {
      languageCode: 'auto',
    });
    expect(voiceTelemetryService.recordSuccess).toHaveBeenCalledWith(expect.objectContaining({
      surface: 'unknown',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      voiceName: 'Kore',
      fallbackFrom: 'edge-tts',
    }));

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
});
