import { describe, it, expect, vi } from 'vitest';
import { MediaAnalysisTool } from '../../src/tools/MediaAnalysisTool';

describe('MediaAnalysisTool', () => {
  it('exposes artifact_id instead of file_path', () => {
    const tool = new MediaAnalysisTool({ service: { analyze: vi.fn() } as any });

    expect(tool.parameters.required).toEqual(['artifact_id']);
    expect(tool.parameters.properties).toHaveProperty('artifact_id');
    expect(tool.parameters.properties).not.toHaveProperty('file_path');
  });

  it('passes artifact-ref source to the service', async () => {
    const analyze = vi.fn(async () => ({
      ok: false,
      analysisType: 'describe',
      modality: 'image',
      analysis: null,
      policyDecision: {
        allowed: true,
        reason: 'test',
        policySource: 'source-validation',
        sourceValidated: false,
      },
      error: {
        code: 'INVALID_SOURCE',
        message: 'test stop',
      },
      summary: 'test stop',
      processedAt: new Date().toISOString(),
    }));
    const tool = new MediaAnalysisTool({ service: { analyze } as any });

    await tool.execute({
      artifact_id: 'artifact-123',
      analysis_type: 'qa',
      prompt: 'What is shown?',
    });

    expect(analyze).toHaveBeenCalledWith({
      source: {
        kind: 'artifact-ref',
        artifactId: 'artifact-123',
      },
      analysisType: 'qa',
      prompt: 'What is shown?',
    });
  });
});
