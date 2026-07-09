import { describe, expect, it } from 'vitest';
import {
  CONTEXT_CRITICAL_RATIO,
  CONTEXT_WARN_RATIO,
  DEFAULT_CONTEXT_LIMIT_TOKENS,
  buildContextMeter,
  estimateTokensFromText,
  formatTokenCount,
} from '../src/composer/contextMeter';

describe('estimateTokensFromText', () => {
  it('returns 0 for empty', () => {
    expect(estimateTokensFromText('')).toBe(0);
  });

  it('estimates ~chars/4 rounded up', () => {
    expect(estimateTokensFromText('abcd')).toBe(1);
    expect(estimateTokensFromText('abcde')).toBe(2);
    expect(estimateTokensFromText('a'.repeat(100))).toBe(25);
    expect(estimateTokensFromText('a'.repeat(101))).toBe(26);
  });
});

describe('formatTokenCount', () => {
  it('formats sub-1000 as plain integers', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(999)).toBe('999');
  });

  it('formats thousands as compact k units', () => {
    expect(formatTokenCount(1000)).toBe('1k');
    expect(formatTokenCount(1200)).toBe('1.2k');
    expect(formatTokenCount(12_000)).toBe('12k');
    expect(formatTokenCount(128_000)).toBe('128k');
  });
});

describe('buildContextMeter', () => {
  it('returns empty/ok meter for no messages', () => {
    const meter = buildContextMeter({ messages: [] });
    expect(meter.usedTokens).toBe(0);
    expect(meter.limitTokens).toBe(DEFAULT_CONTEXT_LIMIT_TOKENS);
    expect(meter.ratio).toBe(0);
    expect(meter.level).toBe('ok');
    expect(meter.label).toBe('0 / 128k');
  });

  it('sums message content into used tokens', () => {
    // 400 chars → 100 tokens
    const meter = buildContextMeter({
      messages: [{ content: 'a'.repeat(200) }, { content: 'b'.repeat(200) }],
      limitTokens: 1000,
    });
    expect(meter.usedTokens).toBe(100);
    expect(meter.ratio).toBeCloseTo(0.1, 5);
    expect(meter.level).toBe('ok');
    expect(meter.label).toBe('100 / 1k');
  });

  it('includes systemBudget and toolPayloadChars', () => {
    // messages 40 chars → 10 tokens; tools 40 chars → 10; system 5
    const meter = buildContextMeter({
      messages: [{ content: 'x'.repeat(40) }],
      toolPayloadChars: 40,
      systemBudget: 5,
      limitTokens: 100,
    });
    expect(meter.usedTokens).toBe(25);
    expect(meter.ratio).toBeCloseTo(0.25, 5);
  });

  it('ignores messages without string content', () => {
    const meter = buildContextMeter({
      messages: [{}, { content: undefined }, { content: 'abcd' }],
      limitTokens: 100,
    });
    expect(meter.usedTokens).toBe(1);
  });

  it('marks ok when ratio < 0.7', () => {
    const limit = 1000;
    const usedChars = Math.floor(limit * 0.69) * 4; // just under 0.7
    const meter = buildContextMeter({
      messages: [{ content: 'a'.repeat(usedChars) }],
      limitTokens: limit,
    });
    expect(meter.ratio).toBeLessThan(CONTEXT_WARN_RATIO);
    expect(meter.level).toBe('ok');
  });

  it('marks warn when 0.7 <= ratio < 0.9', () => {
    const limit = 1000;
    const usedChars = Math.ceil(limit * 0.7) * 4;
    const meter = buildContextMeter({
      messages: [{ content: 'a'.repeat(usedChars) }],
      limitTokens: limit,
    });
    expect(meter.ratio).toBeGreaterThanOrEqual(CONTEXT_WARN_RATIO);
    expect(meter.ratio).toBeLessThan(CONTEXT_CRITICAL_RATIO);
    expect(meter.level).toBe('warn');
  });

  it('marks critical when ratio >= 0.9', () => {
    const limit = 1000;
    const usedChars = Math.ceil(limit * 0.9) * 4;
    const meter = buildContextMeter({
      messages: [{ content: 'a'.repeat(usedChars) }],
      limitTokens: limit,
    });
    expect(meter.ratio).toBeGreaterThanOrEqual(CONTEXT_CRITICAL_RATIO);
    expect(meter.level).toBe('critical');
  });

  it('clamps ratio to 1 when over limit but still critical', () => {
    const meter = buildContextMeter({
      messages: [{ content: 'a'.repeat(10_000) }],
      limitTokens: 100,
    });
    expect(meter.usedTokens).toBeGreaterThan(100);
    expect(meter.ratio).toBe(1);
    expect(meter.level).toBe('critical');
  });

  it('uses default 128k limit', () => {
    const meter = buildContextMeter({
      messages: [{ content: 'a'.repeat(48_000) }], // 12k tokens
    });
    expect(meter.limitTokens).toBe(128_000);
    expect(meter.usedTokens).toBe(12_000);
    expect(meter.label).toBe('12k / 128k');
    expect(meter.level).toBe('ok');
  });

  it('enforces minimum limit of 1', () => {
    const meter = buildContextMeter({
      messages: [],
      limitTokens: 0,
    });
    expect(meter.limitTokens).toBe(1);
  });

  it('threshold boundaries are exclusive for ok/warn cutoffs', () => {
    // Exactly 0.7 → warn; exactly 0.9 → critical
    const limit = 1000;
    const atWarn = buildContextMeter({
      messages: [{ content: 'a'.repeat(0.7 * limit * 4) }],
      limitTokens: limit,
    });
    expect(atWarn.ratio).toBeCloseTo(0.7, 5);
    expect(atWarn.level).toBe('warn');

    const atCrit = buildContextMeter({
      messages: [{ content: 'a'.repeat(0.9 * limit * 4) }],
      limitTokens: limit,
    });
    expect(atCrit.ratio).toBeCloseTo(0.9, 5);
    expect(atCrit.level).toBe('critical');
  });
});
