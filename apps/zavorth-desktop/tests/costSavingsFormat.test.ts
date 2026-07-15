import { describe, expect, it } from 'vitest';
import {
  emptyCostSavingsSnapshot,
  formatTokenCount,
  formatUsd,
  normalizeCostSavingsSnapshot,
  savingsRatio,
} from '../src/views/panels/costSavingsFormat';

describe('costSavingsFormat', () => {
  it('formats tokens and usd', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(1500)).toBe('1.5K');
    expect(formatTokenCount(2_500_000)).toBe('2.5M');
    expect(formatUsd(0.123456)).toBe('$0.1235');
  });

  it('normalizes nested API payloads', () => {
    const snap = normalizeCostSavingsSnapshot({
      ok: true,
      data: {
        generatedAt: '2026-01-01T00:00:00.000Z',
        sessionsScanned: 2,
        totals: {
          calls: 4,
          inputTokens: 100,
          outputTokens: 50,
          estimatedCostUsd: 0.01,
          estimatedSavingsUsd: 0.04,
          backgroundRouteCalls: 1,
        },
        byModel: [{ modelKey: 'local-mini', calls: 4, inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.01 }],
        backgroundRouteHint: 'hint',
        narrative: 'Tracked 4 call(s)',
      },
    });
    expect(snap?.totals.calls).toBe(4);
    expect(snap?.byModel[0]?.modelKey).toBe('local-mini');
    expect(savingsRatio(snap!.totals)).toBeCloseTo(0.8, 5);
  });

  it('returns empty snapshot helper', () => {
    const empty = emptyCostSavingsSnapshot(new Date('2026-01-01T00:00:00.000Z'));
    expect(empty.totals.calls).toBe(0);
    expect(empty.byModel).toEqual([]);
  });

  it('rejects invalid payloads', () => {
    expect(normalizeCostSavingsSnapshot(null)).toBeNull();
    expect(normalizeCostSavingsSnapshot({ foo: 1 })).toBeNull();
  });
});
