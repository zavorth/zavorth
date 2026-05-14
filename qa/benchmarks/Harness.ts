import { writeQaJsonReport } from '../QaSupport.js';

export interface BenchmarkMetrics {
  operationName: string;
  durationMs: number;
  memoryDeltaBytes: number;
  success: boolean;
  error: string | null;
  warning: string | null;
  details: Record<string, unknown>;
}

export interface BenchmarkSuiteSummary {
  totalRuns: number;
  passed: number;
  failed: number;
  warnings: number;
  totalDurationMs: number;
  averageDurationMs: number;
}

export interface BenchmarkSuiteReport {
  suiteName: string;
  generatedAt: string;
  status: 'passed' | 'failed';
  summary: BenchmarkSuiteSummary;
  runs: BenchmarkMetrics[];
}

type BenchmarkReportWriter = (fileName: string, payload: BenchmarkSuiteReport) => string;

export class BenchmarkHarness {
  private runs: BenchmarkMetrics[] = [];

  constructor(
    private readonly suiteName: string,
    private readonly reportWriter: BenchmarkReportWriter = writeQaJsonReport,
  ) {}

  public async measure<T>(
    operationName: string,
    fn: () => Promise<T>,
    options: {
      detail?: (value: T) => Record<string, unknown>;
      warning?: (value: T) => string | null;
    } = {},
  ): Promise<T> {
    const memoryBefore = process.memoryUsage().heapUsed;
    const startedAt = performance.now();

    try {
      const value = await fn();
      const warning = options.warning ? options.warning(value) : null;
      this.runs.push({
        operationName,
        durationMs: performance.now() - startedAt,
        memoryDeltaBytes: process.memoryUsage().heapUsed - memoryBefore,
        success: true,
        error: null,
        warning,
        details: options.detail ? options.detail(value) : {},
      });
      return value;
    } catch (error) {
      this.runs.push({
        operationName,
        durationMs: performance.now() - startedAt,
        memoryDeltaBytes: process.memoryUsage().heapUsed - memoryBefore,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        warning: null,
        details: {},
      });
      throw error;
    }
  }

  public buildReport(): BenchmarkSuiteReport {
    const totalDurationMs = this.runs.reduce((acc, run) => acc + run.durationMs, 0);
    const passed = this.runs.filter((run) => run.success).length;
    const failed = this.runs.length - passed;
    const warnings = this.runs.filter((run) => run.success && run.warning).length;
    return {
      suiteName: this.suiteName,
      generatedAt: new Date().toISOString(),
      status: failed > 0 ? 'failed' : 'passed',
      summary: {
        totalRuns: this.runs.length,
        passed,
        failed,
        warnings,
        totalDurationMs,
        averageDurationMs: this.runs.length > 0 ? totalDurationMs / this.runs.length : 0,
      },
      runs: [...this.runs],
    };
  }

  public writeReport(fileName: string): string {
    return this.reportWriter(fileName, this.buildReport());
  }

  public printReport(): void {
    const report = this.buildReport();
    console.log(`\n=== Benchmark Report: ${report.suiteName} ===`);
    for (const run of report.runs) {
      const status = run.success ? (run.warning ? 'WARN' : 'OK  ') : 'FAIL';
      const details =
        Object.keys(run.details).length > 0
          ? ` | ${Object.entries(run.details)
              .map(([key, value]) => `${key}=${String(value)}`)
              .join(' ')}`
          : '';
      const warning = run.warning ? ` | warning=${run.warning}` : '';
      const error = run.error ? ` | error=${run.error}` : '';
      console.log(
        `[${status}] ${run.operationName}: ${run.durationMs.toFixed(2)}ms | mem=${(run.memoryDeltaBytes / 1024 / 1024).toFixed(2)}MB${details}${warning}${error}`,
      );
    }
    console.log(
      `Summary: ${report.summary.passed}/${report.summary.totalRuns} passed | warnings=${report.summary.warnings} | avg=${report.summary.averageDurationMs.toFixed(2)}ms | total=${report.summary.totalDurationMs.toFixed(2)}ms`,
    );
    console.log('========================================\n');
  }
}
