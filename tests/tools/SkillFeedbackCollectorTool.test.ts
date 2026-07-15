import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillFeedbackCollectorTool } from '../../src/tools/SkillFeedbackCollectorTool';

describe('SkillFeedbackCollectorTool', () => {
  let tool: SkillFeedbackCollectorTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-feedback-test-'));
    tool = new SkillFeedbackCollectorTool({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('skill_feedback');
  });

  it('returns error when skill_name is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
    expect(result).toContain('skill_name');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ skill_name: 'test_skill', action: 'invalid' });
    expect(result).toContain('Erro');
    expect(result).toContain('invalid');
  });

  it('records a metric successfully', async () => {
    const result = await tool.execute({
      skill_name: 'web_search',
      action: 'record',
      rating: 4,
      notes: 'Fast and accurate',
      execution_time_ms: 1500,
    });

    expect(result).toContain('Feedback registrado');
    expect(result).toContain('web_search');
    expect(result).toContain('rating=4');

    const metricsFile = path.join(tempDir, 'web_search.json');
    expect(fs.existsSync(metricsFile)).toBe(true);
  });

  it('rejects invalid rating', async () => {
    const result = await tool.execute({
      skill_name: 'test_skill',
      action: 'record',
      rating: 6,
    });

    expect(result).toContain('Erro');
    expect(result).toContain('rating');
  });

  it('uses default rating when not provided', async () => {
    const result = await tool.execute({
      skill_name: 'test_skill',
      action: 'record',
    });

    expect(result).toContain('rating=3');
  });

  it('reviews metrics for a skill', async () => {
    await tool.execute({ skill_name: 'my_skill', action: 'record', rating: 5, execution_time_ms: 100 });
    await tool.execute({ skill_name: 'my_skill', action: 'record', rating: 3, execution_time_ms: 200 });

    const result = await tool.execute({ skill_name: 'my_skill', action: 'review' });

    expect(result).toContain('Metricas da skill');
    expect(result).toContain('Total de execucoes: 2');
    expect(result).toContain('4.00');
  });

  it('returns message when no metrics exist for review', async () => {
    const result = await tool.execute({ skill_name: 'empty_skill', action: 'review' });
    expect(result).toContain('No metrics');
  });

  it('suggests optimizations with enough data', async () => {
    for (let i = 0; i < 5; i++) {
      await tool.execute({ skill_name: 'slow_skill', action: 'record', rating: 2, execution_time_ms: 15000 });
    }

    const result = await tool.execute({ skill_name: 'slow_skill', action: 'optimize' });

    expect(result).toContain('Optimization suggestions');
    expect(result).toContain('Rating medio abaixo de 3');
    expect(result).toMatch(/Tempo|execucao|optimization|otimizacao|slow/i);
  });

  it('returns insufficient data message for optimization with few executions', async () => {
    await tool.execute({ skill_name: 'new_skill', action: 'record', rating: 4 });

    const result = await tool.execute({ skill_name: 'new_skill', action: 'optimize' });
    expect(result).toContain('Insufficient data');
  });
});
