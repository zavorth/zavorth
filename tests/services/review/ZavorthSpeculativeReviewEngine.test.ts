import { ZavorthSpeculativeReviewEngine } from '../../../src/services/review/ZavorthSpeculativeReviewEngine';
import type { DiffFileSummary } from '../../../src/services/diff/ZavorthDiffPagerService';

describe('ZavorthSpeculativeReviewEngine', () => {
  let engine: ZavorthSpeculativeReviewEngine;

  beforeEach(() => {
    engine = new ZavorthSpeculativeReviewEngine();
  });

  it('should approve safe diffs without security or breaking findings', () => {
    const safeDiff: DiffFileSummary = {
      filePath: 'src/utils/math.ts',
      totalAdditions: 3,
      totalDeletions: 1,
      overallRisk: 'LOW',
      hunks: [
        {
          header: '@@ -1,3 +1,5 @@',
          oldStart: 1,
          oldCount: 3,
          newStart: 1,
          newCount: 5,
          lines: [
            { type: 'context', content: 'export function add(a: number, b: number) {' },
            { type: 'deletion', content: '  return a - b;' },
            { type: 'addition', content: '  return a + b;' },
            { type: 'context', content: '}' },
          ],
        },
      ],
    };

    const review = engine.reviewDiff(safeDiff);
    expect(review.decision).toBe('APPROVE');
    expect(review.overallRisk).toBe('LOW');
    expect(review.requiresInteractiveApproval).toBe(false);
  });

  it('should veto diffs containing potential hardcoded credentials', () => {
    const leakyDiff: DiffFileSummary = {
      filePath: 'src/config.ts',
      totalAdditions: 1,
      totalDeletions: 0,
      overallRisk: 'CRITICAL',
      hunks: [
        {
          header: '@@ -1,1 +1,2 @@',
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 2,
          lines: [
            { type: 'addition', content: 'const API_KEY = "sk-live-secret-99999";' },
          ],
        },
      ],
    };

    const review = engine.reviewDiff(leakyDiff);
    expect(review.decision).toBe('VETO');
    expect(review.overallRisk).toBe('CRITICAL');
    expect(review.findings.some((f) => f.category === 'SECURITY')).toBe(true);
  });

  it('should require confirmation when public exported signatures are altered or removed', () => {
    const contractDiff: DiffFileSummary = {
      filePath: 'src/api/auth.ts',
      totalAdditions: 0,
      totalDeletions: 2,
      overallRisk: 'MEDIUM',
      hunks: [
        {
          header: '@@ -1,5 +1,3 @@',
          oldStart: 1,
          oldCount: 5,
          newStart: 1,
          newCount: 3,
          lines: [
            { type: 'deletion', content: 'export function authenticate(token: string): boolean {' },
            { type: 'deletion', content: '}' },
          ],
        },
      ],
    };

    const review = engine.reviewDiff(contractDiff);
    expect(review.decision).toBe('REQUIRE_CONFIRMATION');
    expect(review.findings.some((f) => f.category === 'API_BREAKAGE')).toBe(true);
  });
});
