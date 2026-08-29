import {
  registry,
  estimateTextTokens,
  estimateImageTokens,
  shouldCompressToImage,
} from '../../../../src/services/llm/compression/ImageTokenCostCalculator';

describe('ImageTokenCostCalculator', () => {
  beforeEach(() => {
    registry.registerProvider('custom-certified-claude', {
      supportsImages: true,
      billing: { type: 'patch', patchSize: 28, longEdgeMax: 1568, tokenCap: 1568 },
      pageGeometry: { cols: 312, widthPx: 1568, heightPx: 728, linesPerPage: 90 },
    });
  });

  it('detects catalog models with certified image compression', () => {
    expect(registry.isImageSupported('claude-3-7-sonnet-20250219')).toBe(true);
    expect(registry.isImageSupported('claude-3-5-sonnet-20241022')).toBe(true);
  });

  it('fails closed for models that do not certify visual compression', () => {
    expect(registry.isImageSupported('gemini-2.5-flash')).toBe(false);
    expect(registry.isImageSupported('gemini-2.5-pro')).toBe(false);
    expect(registry.isImageSupported('gpt-4o')).toBe(false);
    expect(registry.isImageSupported('unknown-model-v1')).toBe(false);
  });

  it('allows registering custom providers dynamically with exact match', () => {
    expect(registry.isImageSupported('custom-certified-claude')).toBe(true);
  });

  it('refuses compression for uncertified models', () => {
    const decision = shouldCompressToImage('x'.repeat(50000), 'gemini-2.5-flash');
    expect(decision.compress).toBe(false);
    expect(decision.modelSupported).toBe(false);
  });

  it('allows compression for certified models when mathematical savings exist', () => {
    const decision = shouldCompressToImage('x'.repeat(50000), 'claude-3-7-sonnet-20250219');
    expect(decision.compress).toBe(true);
    expect(decision.modelSupported).toBe(true);
    expect(decision.savingsRatio).toBeGreaterThan(0.5);
  });

  it('estimates text tokens correctly', () => {
    expect(estimateTextTokens('')).toBe(0);
    expect(estimateTextTokens('a')).toBe(1);
    expect(estimateTextTokens('abcd')).toBe(1);
    expect(estimateTextTokens('abcde')).toBe(2);
  });

  it('computes image tokens using registered capabilities', () => {
    const tokens = estimateImageTokens(1568, 728, 'claude-3-7-sonnet-20250219');
    expect(tokens).toBeGreaterThan(0);
  });
});
