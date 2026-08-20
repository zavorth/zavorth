import { AutomaticTrajectoryCompactorService } from '../../../src/services/compression/AutomaticTrajectoryCompactorService.js';
import type { TrajectoryTurn } from '../../../src/services/compression/ZavorthTrajectoryCompressorService.js';

describe('AutomaticTrajectoryCompactorService', () => {
  let compactor: AutomaticTrajectoryCompactorService;

  beforeEach(() => {
    compactor = new AutomaticTrajectoryCompactorService();
  });

  it('skips compaction when token usage is below 75% threshold', () => {
    const turns: TrajectoryTurn[] = [
      { id: '1', role: 'user', content: 'Short query', estimatedTokens: 10 },
      { id: '2', role: 'assistant', content: 'Short reply', estimatedTokens: 15 },
    ];

    const result = compactor.compactIfNeeded(turns, { contextLimitTokens: 10000 });
    expect(result.compacted).toBe(false);
    expect(result.turns).toHaveLength(2);
    expect(result.tokensSaved).toBe(0);
  });

  it('triggers transparent compaction when token usage exceeds 75% threshold', () => {
    const longTurnContent = 'x'.repeat(4000);
    const turns: TrajectoryTurn[] = [
      { id: '1', role: 'user', content: 'Initial user prompt requirement', estimatedTokens: 200, isProtectedAnchor: true },
      { id: '2', role: 'assistant', content: 'Beginning investigation.', estimatedTokens: 100 },
      { id: '3', role: 'tool', content: `Tool output: ${longTurnContent}`, estimatedTokens: 1200 },
      { id: '4', role: 'tool', content: `Second tool output: ${longTurnContent}`, estimatedTokens: 1200 },
      { id: '5', role: 'tool', content: `Third tool output: ${longTurnContent}`, estimatedTokens: 1200 },
      { id: '6', role: 'assistant', content: 'Finished analysis.', estimatedTokens: 100 },
      { id: '7', role: 'user', content: 'Please apply the fix.', estimatedTokens: 50 },
    ];

    // Context limit of 4000 tokens -> 75% threshold is 3000 tokens. Total tokens here ~ 4050 tokens.
    const result = compactor.compactIfNeeded(turns, {
      contextLimitTokens: 4000,
      activationThresholdRatio: 0.75,
      targetCompactedBudget: 1500,
    });

    expect(result.compacted).toBe(true);
    expect(result.tokensSaved).toBeGreaterThan(0);
    expect(result.summary).toContain('Compacted');
  });
});
