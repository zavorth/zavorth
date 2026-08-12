import { AudioHandler } from '../../src/telegram/AudioHandler';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('AudioHandler transcription normalization', () => {
  it('removes Gemini narration and Markdown wrappers from STT output', () => {
    const handler = new AudioHandler({
      geminiVoiceService: {
        isConfigured: () => false,
        synthesize: jest.fn(),
        cleanup: jest.fn(),
      },
    });

    const normalized = (handler as any).normalizeTranscriptionText([
      'Aqui esta a transcricao do audio:',
      '# Transcricao de audio do Telegram',
      '[00:00] Ola, tudo bem?',
      '---',
    ].join('\n'));

    expect(normalized).toBe('Ola, tudo bem?');
  });

  it('falls back across STT providers when the first successful transcript is rejected by validation', async () => {
    const mockTranscribe = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: 'dica concurso policia civil investigacao prova carreira salario beneficios edital',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        languageCode: 'en-US',
        latencyMs: 10,
        warnings: [],
        failures: [],
        attempts: [{ provider: 'gemini', status: 'succeeded', latencyMs: 10 }],
        error: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        text: 'voce consegue me ouvir?',
        provider: 'openai',
        model: 'whisper-1',
        languageCode: 'en-US',
        latencyMs: 10,
        warnings: [],
        failures: [],
        attempts: [{ provider: 'openai', status: 'succeeded', latencyMs: 10 }],
        error: null,
      });
    const handler = new AudioHandler({
      geminiVoiceService: {
        isConfigured: () => false,
        synthesize: jest.fn(),
        cleanup: jest.fn(),
      },
      audioTranscriptionService: {
        transcribe: mockTranscribe,
      },
    }) as any;
    const audioPath = path.join(os.tmpdir(), `zavorth-audio-test-${Date.now()}.ogg`);
    fs.writeFileSync(audioPath, Buffer.alloc(2048, 0x42));

    handler.resolveTranscriptionProviders = jest.fn(() => ['gemini', 'openai']);
    handler.isTranscriptionProviderConfigured = jest.fn(() => true);

    try {
      await expect(
        handler.transcribeDetailed(audioPath, {
          validator: (candidate) => ({
            accepted: candidate.text === 'voce consegue me ouvir?',
            reason: candidate.text === 'voce consegue me ouvir?' ? undefined : 'transcricao impossivel para audio curto',
          }),
        }),
      ).rejects.toThrow('transcricao impossivel para audio curto');
    } finally {
      fs.rmSync(audioPath, { force: true });
    }
  });
});
