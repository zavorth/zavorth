import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../logger.js';

export interface BenchmarkScenario {
  readonly id: string;
  readonly title: string;
  readonly complexity: 'EASY' | 'MEDIUM' | 'HARD';
  readonly execute: () => Promise<{ success: boolean; tokensUsed: number; durationMs: number; repaired: boolean }>;
}

export interface ScenarioResult {
  readonly id: string;
  readonly title: string;
  readonly complexity: 'EASY' | 'MEDIUM' | 'HARD';
  readonly status: 'PASS' | 'FAIL';
  readonly tokensUsed: number;
  readonly durationMs: number;
  readonly repaired: boolean;
}

export interface BenchmarkSuiteResult {
  readonly timestamp: number;
  readonly totalScenarios: number;
  readonly passedScenarios: number;
  readonly failedScenarios: number;
  readonly autonomyScorePercentage: number;
  readonly totalTokensConsumed: number;
  readonly totalDurationMs: number;
  readonly scenarios: readonly ScenarioResult[];
}

export class ZavorthAutonomyHarnessService {
  private readonly storageDir: string;
  private readonly maxHistoryLimit: number;

  constructor(options?: { storageDir?: string; maxHistoryLimit?: number }) {
    this.storageDir = options?.storageDir || path.join(os.homedir(), '.zavorth', 'benchmarks');
    this.maxHistoryLimit = options?.maxHistoryLimit || 10;
  }

  public async runBenchmarkSuite(scenarios: readonly BenchmarkScenario[]): Promise<BenchmarkSuiteResult> {
    const startTime = Date.now();
    const scenarioResults: ScenarioResult[] = [];
    let totalTokens = 0;

    for (const scenario of scenarios) {
      try {
        const out = await scenario.execute();
        totalTokens += out.tokensUsed;
        scenarioResults.push({
          id: scenario.id,
          title: scenario.title,
          complexity: scenario.complexity,
          status: out.success ? 'PASS' : 'FAIL',
          tokensUsed: out.tokensUsed,
          durationMs: out.durationMs,
          repaired: out.repaired,
        });
      } catch (err: unknown) {
        logger.warn(`[AutonomyHarness] Scenario "${scenario.id}" threw an exception:`, { error: err });
        scenarioResults.push({
          id: scenario.id,
          title: scenario.title,
          complexity: scenario.complexity,
          status: 'FAIL',
          tokensUsed: 0,
          durationMs: 0,
          repaired: false,
        });
      }
    }

    const passedCount = scenarioResults.filter((s) => s.status === 'PASS').length;
    const failedCount = scenarioResults.length - passedCount;
    const score = scenarioResults.length > 0 ? Math.round((passedCount / scenarioResults.length) * 100) : 0;

    const suiteResult: BenchmarkSuiteResult = {
      timestamp: startTime,
      totalScenarios: scenarioResults.length,
      passedScenarios: passedCount,
      failedScenarios: failedCount,
      autonomyScorePercentage: score,
      totalTokensConsumed: totalTokens,
      totalDurationMs: Date.now() - startTime,
      scenarios: scenarioResults,
    };

    this.persistRollingReport(suiteResult);
    return suiteResult;
  }

  public renderTerminalScorecard(result: BenchmarkSuiteResult): string {
    const lines: string[] = [
      '╭────────────────────────────────────────────────────────────────────────╮',
      '│                 🏆 ZAVORTH AUTONOMY BENCHMARK SCORECARD                 │',
      '├────────────────────────────────────────────────────────────────────────┤',
      `│  Autonomy Score: ${result.autonomyScorePercentage}%  │  Passed: ${result.passedScenarios}/${result.totalScenarios}  │  Tokens: ${result.totalTokensConsumed}  │  Time: ${(result.totalDurationMs / 1000).toFixed(2)}s  │`,
      '├────────────────────────────────────────────────────────────────────────┤',
    ];

    for (const sc of result.scenarios) {
      const icon = sc.status === 'PASS' ? '✔ PASS' : '✖ FAIL';
      const repairTag = sc.repaired ? ' [Self-Repaired]' : '';
      const formattedTitle = sc.title.length > 35 ? sc.title.substring(0, 32) + '...' : sc.title.padEnd(35);
      lines.push(`│  ${icon}  ${formattedTitle}  (${sc.complexity}) ${repairTag}`);
    }

    lines.push('╰────────────────────────────────────────────────────────────────────────╯');
    return lines.join('\n');
  }

  private persistRollingReport(result: BenchmarkSuiteResult): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      const historyPath = path.join(this.storageDir, 'benchmark_history.json');
      let history: BenchmarkSuiteResult[] = [];

      if (fs.existsSync(historyPath)) {
        try {
          history = JSON.parse(fs.readFileSync(historyPath, 'utf8')) as BenchmarkSuiteResult[];
        } catch (error: unknown) { const err = error instanceof Error ? error : new Error(String(error)); logger.debug('[AutonomyHarness] Failed to parse history file', { path: historyPath, error: err.message }); }
      }

      history.unshift(result);
      if (history.length > this.maxHistoryLimit) {
        history = history.slice(0, this.maxHistoryLimit);
      }

      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
    } catch (err: unknown) {
      logger.warn('[ZavorthAutonomyHarnessService] Failed to save rolling report:', { error: err });
    }
  }

  public getHistoricalReports(): readonly BenchmarkSuiteResult[] {
    try {
      const historyPath = path.join(this.storageDir, 'benchmark_history.json');
      if (fs.existsSync(historyPath)) {
        return JSON.parse(fs.readFileSync(historyPath, 'utf8')) as BenchmarkSuiteResult[];
      }
      return [];
    } catch {
      return [];
    }
  }
}
