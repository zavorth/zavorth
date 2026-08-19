import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ZavorthAutonomyHarnessService, type BenchmarkScenario } from '../../../src/services/benchmark/ZavorthAutonomyHarnessService';

describe('ZavorthAutonomyHarnessService', () => {
  let harness: ZavorthAutonomyHarnessService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-bench-test-'));
    harness = new ZavorthAutonomyHarnessService({ storageDir: tempDir, maxHistoryLimit: 3 });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should run benchmark suite, calculate autonomy score, and render terminal scorecard', async () => {
    const scenarios: BenchmarkScenario[] = [
      {
        id: 'sc-1',
        title: 'Fix typo in auth token validator',
        complexity: 'EASY',
        execute: async () => ({ success: true, tokensUsed: 150, durationMs: 200, repaired: false }),
      },
      {
        id: 'sc-2',
        title: 'Refactor broken import graph',
        complexity: 'MEDIUM',
        execute: async () => ({ success: true, tokensUsed: 400, durationMs: 500, repaired: true }),
      },
    ];

    const result = await harness.runBenchmarkSuite(scenarios);

    expect(result.totalScenarios).toBe(2);
    expect(result.passedScenarios).toBe(2);
    expect(result.autonomyScorePercentage).toBe(100);
    expect(result.totalTokensConsumed).toBe(550);

    const scorecard = harness.renderTerminalScorecard(result);
    expect(scorecard).toContain('ZAVORTH AUTONOMY BENCHMARK SCORECARD');
    expect(scorecard).toContain('Autonomy Score: 100%');
    expect(scorecard).toContain('Fix typo in auth token validator');
  });

  it('should maintain a clean circular rolling history without unbounded file growth', async () => {
    const scenario: BenchmarkScenario = {
      id: 'sc-test',
      title: 'Quick test',
      complexity: 'EASY',
      execute: async () => ({ success: true, tokensUsed: 10, durationMs: 10, repaired: false }),
    };

    for (let i = 0; i < 5; i++) {
      await harness.runBenchmarkSuite([scenario]);
    }

    const history = harness.getHistoricalReports();
    expect(history.length).toBe(3); // Capped at maxHistoryLimit: 3
  });
});
