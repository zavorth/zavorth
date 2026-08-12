
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GeminiVoiceService } from '../../src/providers/GeminiVoiceService';

describe('GeminiVoiceService', () => {
  it('gera um arquivo wav a partir do payload inlineData do Gemini TTS', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-gemini-voice-'));
    const pcm = Buffer.from([0x00, 0x00, 0xff, 0x7f]);
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: pcm.toString('base64'),
                  mimeType: 'audio/pcm',
                },
              },
            ],
          },
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const service = new GeminiVoiceService({
      apiKey: 'gemini-test-key',
      tmpDir: tempDir,
      fetchImpl: fetchImpl as any,
      model: 'gemini-2.5-flash',
      voiceName: 'Kore',
      languageCode: 'en-US',
    });

    const filePath = await service.synthesize('Fale oi de forma amistosa.');

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(':generateContent'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'gemini-test-key' }),
      }),
    );
    expect(filePath).toBeTruthy();
    expect(filePath).toMatch(/\.wav$/);
    expect(fs.existsSync(filePath!)).toBe(true);

    const output = fs.readFileSync(filePath!);
    expect(output.subarray(0, 4).toString()).toBe('RIFF');
    expect(output.subarray(8, 12).toString()).toBe('WAVE');

    service.cleanup(filePath!);
    expect(fs.existsSync(filePath!)).toBe(false);
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
});
