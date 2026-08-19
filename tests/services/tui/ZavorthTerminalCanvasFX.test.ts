import { ZavorthTerminalCanvasFX, ModelCardMetrics } from '../../../src/services/tui/ZavorthTerminalCanvasFX';

describe('ZavorthTerminalCanvasFX', () => {
  let fx: ZavorthTerminalCanvasFX;

  beforeEach(() => {
    fx = new ZavorthTerminalCanvasFX();
  });

  it('should interpolate RGB colors accurately without out-of-bounds channels', () => {
    const c1 = { r: 0, g: 0, b: 0 };
    const c2 = { r: 200, g: 100, b: 50 };

    const mid = fx.lerpColor(c1, c2, 0.5);
    expect(mid.r).toBe(100);
    expect(mid.g).toBe(50);
    expect(mid.b).toBe(25);

    const ansi = fx.toAnsiRgbForeground(mid);
    expect(ansi).toBe('\x1b[38;2;100;50;25m');
  });

  it('should compute reasoning pulse dynamics based on thinking intensity', () => {
    const pulseLow = fx.calculateReasoningPulse(1000, 30, 'low');
    const pulseExtreme = fx.calculateReasoningPulse(1000, 30, 'extreme');

    expect(pulseLow.glyph).toBe('✦');
    expect(pulseExtreme.glyph).toBe('✶');
    expect(pulseExtreme.label).toBe('Deep Reasoning');
    expect(pulseLow.color.r).toBeGreaterThanOrEqual(0);
    expect(pulseLow.color.r).toBeLessThanOrEqual(255);
  });

  it('should recommend optimal model based on context, reasoning and budget requirements', () => {
    const models: ModelCardMetrics[] = [
      {
        id: 'heavy-cloud',
        name: 'Heavy Cloud Pro',
        provider: 'CloudAI',
        contextWindowTokens: 1000000,
        costPer1MInputUsd: 15,
        costPer1MOutputUsd: 60,
        reasoningScore: 10,
        speedTokensPerSec: 40,
        isLocal: false,
      },
      {
        id: 'local-fast',
        name: 'Local Mistral/Qwen',
        provider: 'Ollama',
        contextWindowTokens: 32000,
        costPer1MInputUsd: 0,
        costPer1MOutputUsd: 0,
        reasoningScore: 7,
        speedTokensPerSec: 80,
        isLocal: true,
      },
    ];

    const recLocal = fx.recommendModels(models, {
      estimatedTokens: 8000,
      requiresHighReasoning: false,
      prioritizeLocal: true,
      budgetSensitive: true,
    });

    expect(recLocal[0].model.id).toBe('local-fast');
    expect(recLocal[0].isRecommended).toBe(true);

    const recHeavy = fx.recommendModels(models, {
      estimatedTokens: 150000,
      requiresHighReasoning: true,
      prioritizeLocal: false,
      budgetSensitive: false,
    });

    expect(recHeavy[0].model.id).toBe('heavy-cloud');
    expect(recHeavy[0].isRecommended).toBe(true);
  });
});
