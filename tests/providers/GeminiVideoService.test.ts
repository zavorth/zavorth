import { GeminiVideoService } from '../../src/providers/GeminiVideoService';

const buildJsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('GeminiVideoService', () => {
  it('is disabled without an API key regardless of ambient config', () => {
    expect(new GeminiVideoService({ apiKey: '' }).isEnabled()).toBe(false);
  });

  it('is enabled when constructed with an API key', () => {
    expect(new GeminiVideoService({ apiKey: 'gemini-test-key' }).isEnabled()).toBe(true);
  });

  it('analyzes a YouTube URL through generateContent with native Gemini sourcing', async () => {
    const fetchImpl = jest.fn(async () => buildJsonResponse({
      candidates: [
        {
          content: {
            parts: [{ text: 'video overview text' }],
          },
        },
      ],
    }));

    const service = new GeminiVideoService({
      apiKey: 'gemini-test-key',
      model: 'gemini-test-model',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const analysis = await service.analyzeYouTubeUrl('https://www.youtube.com/watch?v=abc123');

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(':generateContent'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'gemini-test-key' }),
      }),
    );
    expect(analysis).not.toBeNull();
    expect(analysis?.analysisText).toBe('video overview text');
    expect(analysis?.source).toBe('native Gemini analysis (gemini-test-model) via YouTube URL');
    expect(analysis?.warnings).toEqual([]);
  });

  it('throws with the upstream status when generateContent fails', async () => {
    const fetchImpl = jest.fn(async () => buildJsonResponse({ error: { message: 'quota exceeded' } }, 500));

    const service = new GeminiVideoService({
      apiKey: 'gemini-test-key',
      model: 'gemini-test-model',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      service.analyzeYouTubeUrl('https://www.youtube.com/watch?v=abc123'),
    ).rejects.toThrow('Gemini generateContent failed (500)');
  });

  it('joins text parts across candidates into a single analysis text', async () => {
    const fetchImpl = jest.fn(async () => buildJsonResponse({
      candidates: [
        {
          content: {
            parts: [{ text: 'first part' }, { text: 'second part' }],
          },
        },
        {
          content: {
            parts: [{ text: 'third part' }],
          },
        },
      ],
    }));

    const service = new GeminiVideoService({
      apiKey: 'gemini-test-key',
      model: 'gemini-test-model',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const analysis = await service.analyzeYouTubeUrl('https://youtu.be/abc123');

    expect(analysis?.analysisText).toBe(['first part', 'second part', 'third part'].join('\n'));
  });
});
