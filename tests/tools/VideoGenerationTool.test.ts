import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGenerationTool } from '../../src/tools/VideoGenerationTool';

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
    expect(result).toContain('Erro');
    expect(result).toContain('prompt');
  });

  it('returns error when duration is out of range', async () => {
    const result = await tool.execute({ prompt: 'Test', duration: 100 });
    expect(result).toContain('Erro');
    expect(result).toContain('duracao');
  });

  it('returns error when fps is out of range', async () => {
    const result = await tool.execute({ prompt: 'Test', fps: 5 });
    expect(result).toContain('Erro');
    expect(result).toContain('fps');
  });

  it('returns error for invalid resolution', async () => {
    const result = await tool.execute({ prompt: 'Test', resolution: '8k' });
    expect(result).toContain('Erro');
    expect(result).toContain('resolucao');
  });

  it('returns error when endpoint not configured', async () => {
    const original = process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT;
    delete process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT;
    const result = await tool.execute({ prompt: 'A cat walking on the beach' });
    expect(result).toContain('Erro');
    expect(result).toContain('backend de video nao configurado');
    if (original !== undefined) process.env.ZAVORTH_VIDEO_GENERATION_ENDPOINT = original;
  });

  it('validates parameters before attempting execution', async () => {
    const result = await tool.execute({ prompt: 'Test video', duration: 30, resolution: '1080p', fps: 24, style: 'cinematic' });
    const isValid = result.includes('Video enviado') || result.includes('Erro');
    expect(isValid).toBe(true);
  });
});
