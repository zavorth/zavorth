import { LiveContextTelemetryService } from '../../../src/services/telemetry/LiveContextTelemetryService.js';

describe('LiveContextTelemetryService', () => {
  it('should resolve model context limit correctly', () => {
    expect(LiveContextTelemetryService.getModelLimit('gpt-4o')).toBe(128_000);
    expect(LiveContextTelemetryService.getModelLimit('claude-3-7-sonnet-20250219')).toBe(200_000);
    expect(LiveContextTelemetryService.getModelLimit('gemini-2.5-pro')).toBe(2_000_000);
    expect(LiveContextTelemetryService.getModelLimit('unknown_model')).toBe(128_000);
  });

  it('should build a nominal context snapshot when utilization is low', () => {
    const snapshot = LiveContextTelemetryService.buildSnapshot({
      model: 'gpt-4o',
      promptTokens: 10_000,
      completionTokens: 2_000,
      cacheReadTokens: 5_000,
    });

    expect(snapshot.model).toBe('gpt-4o');
    expect(snapshot.maxContextLimit).toBe(128_000);
    expect(snapshot.totalTokens).toBe(12_000);
    expect(snapshot.alertLevel).toBe('nominal');
    expect(snapshot.compactionRecommended).toBe(false);
    expect(snapshot.estimatedCostUsd).toBeGreaterThan(0);
    expect(snapshot.cacheSavingsUsd).toBeGreaterThan(0);
  });

  it('should transition to critical alert level when context exceeds 80%', () => {
    const snapshot = LiveContextTelemetryService.buildSnapshot({
      model: 'gpt-4o',
      promptTokens: 110_000,
      completionTokens: 5_000,
    });

    expect(snapshot.alertLevel).toBe('critical');
    expect(snapshot.compactionRecommended).toBe(true);
    expect(snapshot.utilizationPercent).toBeGreaterThan(80);
  });

  it('should render a formatted 1-line summary bar', () => {
    const snapshot = LiveContextTelemetryService.buildSnapshot({
      model: 'gpt-4o',
      promptTokens: 24_000,
      completionTokens: 2_000,
    });
    const bar = LiveContextTelemetryService.renderSummaryBar(snapshot);
    expect(bar).toContain('[Context:');
    expect(bar).toContain('/ 128k');
    expect(bar).toContain('NOMINAL');
  });
});
