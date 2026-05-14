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
    const handler = new AudioHandler({
      geminiVoiceService: {
        isConfigured: () => false,
        synthesize: jest.fn(),
        cleanup: jest.fn(),
      },
    }) as any;
    const audioPath = path.join(os.tmpdir(), `zavorth-audio-test-${Date.now()}.ogg`);
    fs.writeFileSync(audioPath, Buffer.from('fake-audio'));

    handler.resolveTranscriptionProviders = jest.fn(() => ['gemini', 'openai']);
    handler.isTranscriptionProviderConfigured = jest.fn(() => true);
    handler.transcribeWithProvider = jest.fn()
      .mockResolvedValueOnce({
        text: 'dica concurso policia civil investigacao prova carreira salario beneficios edital',
        model: 'gemini-2.5-flash',
        languageCode: 'en-US',
      })
      .mockResolvedValueOnce({
        text: 'voce consegue me ouvir?',
        model: 'gpt-4o-mini-transcribe',
        languageCode: 'en-US',
      });

    try {
      const result = await handler.transcribeDetailed(audioPath, {
        validator: (candidate) => ({
          accepted: candidate.text === 'voce consegue me ouvir?',
          reason: candidate.text === 'voce consegue me ouvir?' ? undefined : 'transcricao impossivel para audio curto',
        }),
      });

      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o-mini-transcribe');
      expect(result.languageCode).toBe('en-US');
      expect(result.failures).toEqual([
        expect.objectContaining({ provider: 'gemini', error: 'transcricao impossivel para audio curto' }),
      ]);
    } finally {
      fs.rmSync(audioPath, { force: true });
    }
  });
});
