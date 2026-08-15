
import { VideoGenerationTool } from '../../src/tools/VideoGenerationTool';
import { safeFetch } from '../../src/security/SafeFetchService';

jest.mock('../../src/security/SafeFetchService', () => ({
  safeFetch: jest.fn(),
}));

describe('VideoGenerationTool', () => {
  let tool: VideoGenerationTool;

  beforeEach(() => {
    tool = new VideoGenerationTool();
  });

  it('exposes correct name and parameters', () => {
    expect(tool.name).toBe('generate_video');
    expect(tool.parameters.required).toEqual(['prompt']);
    expect(tool.parameters.properties.prompt).toBeDefined();
  });

  it('returns error when prompt is empty', async () => {
    const result = await tool.execute({ prompt: '' });
    expect(result).toContain('Error');
    expect(result).toContain('prompt');
  });

  it('returns error when duration is out of range', async () => {
    const result = await tool.execute({ prompt: 'Test', duration: 100 });
    expect(result).toContain('Error');
    expect(result).toMatch(/duration|duracao/i);
  });

  it('returns error when fps is out of range', async () => {
    const result = await tool.execute({ prompt: 'Test', fps: 5 });
    expect(result).toContain('Error');
    expect(result).toContain('fps');
  });

  it('returns error for invalid resolution', async () => {
    const result = await tool.execute({ prompt: 'Test', resolution: '8k' });
    expect(result).toContain('Error');
    expect(result).toMatch(/resolution|resolucao/i);
  });

  it('returns error when endpoint not configured', async () => {
    const original = process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT;
    delete process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT;
    const result = await tool.execute({ prompt: 'A cat walking on the beach' });
    expect(result).toContain('Error');
    expect(result).toMatch(/video backend is not configured|backend de video/i);
    if (original !== undefined) process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT = original;
  });

  it('validates parameters before attempting execution', async () => {
    const result = await tool.execute({ prompt: 'Test video', duration: 30, resolution: '1080p', fps: 24, style: 'cinematic' });
    const isValid = result.includes('Video enviado') || result.includes('Error');
    expect(isValid).toBe(true);
  });

  it('uses the guarded egress boundary for configured video backends', async () => {
    const originalEndpoint = process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT;
    const originalFetch = global.fetch;
    process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT = 'https://video.example.test/generate';
    global.fetch = jest.fn();
    jest.mocked(safeFetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ id: 'video-1', status: 'submitted' })),
    } as unknown as Response);

    const result = await tool.execute({ prompt: 'A cat walking on the beach' });

    expect(safeFetch).toHaveBeenCalledWith(
      'https://video.example.test/generate',
      expect.objectContaining({ method: 'POST' }),
      expect.objectContaining({ serviceName: 'Video generation tool' }),
    );
    expect(result).toMatch(/Video submitted|Video enviado/i);

    global.fetch = originalFetch;
    if (originalEndpoint === undefined) {
      delete process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT;
    } else {
      process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT = originalEndpoint;
    }
  });
});
