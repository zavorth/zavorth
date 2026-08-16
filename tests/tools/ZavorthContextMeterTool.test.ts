import { ZavorthContextMeterTool } from '../../src/tools/ZavorthContextMeterTool.js';

describe('ZavorthContextMeterTool', () => {
  it('should return context utilization and estimated costs', async () => {
    const rawResult = await ZavorthContextMeterTool.execute({
      model: 'gpt-4o',
      promptTokens: 30_000,
      completionTokens: 2_000,
      cacheReadTokens: 10_000,
    });

    const result = JSON.parse(rawResult);
    expect(result.status).toBe('success');
    expect(result.snapshot.model).toBe('gpt-4o');
    expect(result.snapshot.utilizationPercent).toBeGreaterThan(0);
    expect(result.snapshot.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.summaryBar).toContain('[Context:');
  });
});
