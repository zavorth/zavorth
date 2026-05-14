import { writeQaJsonReport } from '../QaSupport.js';

export interface RegressionTestDefinition<TResult = unknown> {
  id: string;
  description: string;
  criticalPath: 'gateway' | 'session' | 'mesh' | 'security' | 'web' | 'transport';
  execute: () => Promise<TResult>;
  validate?: (result: TResult) => Promise<boolean> | boolean;
}

export interface RegressionRunSnapshot {
  id: string;
  description: string;
  criticalPath: RegressionTestDefinition['criticalPath'];
  success: boolean;
  durationMs: number;
  error: string | null;
}

export interface RegressionSuiteReport {
  generatedAt: string;
  status: 'passed' | 'failed';
  failures: number;
  tests: RegressionRunSnapshot[];
}

type RegressionReportWriter = (fileName: string, payload: RegressionSuiteReport) => string;

export class RegressionHarness {
  private tests: RegressionTestDefinition[] = [];

  constructor(
    private readonly reportWriter: RegressionReportWriter = writeQaJsonReport,
  ) {}

  public register(test: RegressionTestDefinition): void {
    this.tests.push(test);
  }

  public async runSuite(): Promise<RegressionSuiteReport> {
    console.log('\n--- Critical Path Regression Suite ---');
    const results: RegressionRunSnapshot[] = [];

    for (const test of this.tests) {
      console.log(`[Regression] Running ${test.id} (${test.criticalPath})...`);
      const startedAt = performance.now();
      try {
        const value = await test.execute();
        const valid = test.validate ? await test.validate(value) : true;
        if (!valid) {
          throw new Error('Validation hook returned false.');
        }
        results.push({
          id: test.id,
          description: test.description,
          criticalPath: test.criticalPath,
          success: true,
          durationMs: performance.now() - startedAt,
          error: null,
        });
        console.log(`[Regression] ${test.id} PASS`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          id: test.id,
          description: test.description,
          criticalPath: test.criticalPath,
          success: false,
          durationMs: performance.now() - startedAt,
          error: message,
        });
        console.log(`[Regression] ${test.id} FAIL - ${message}`);
      }
    }

    const failures = results.filter((result) => !result.success).length;
    return {
      generatedAt: new Date().toISOString(),
      status: failures > 0 ? 'failed' : 'passed',
      failures,
      tests: results,
    };
  }

  public printReport(report: RegressionSuiteReport): void {
    console.log('\n--- Critical Path Regression Report ---');
    for (const test of report.tests) {
      console.log(
        `[${test.success ? 'OK' : 'FAIL'}] ${test.id} (${test.criticalPath}) ${test.durationMs.toFixed(2)}ms${test.error ? ` | ${test.error}` : ''}`,
      );
    }
    console.log(`Summary: ${report.tests.length - report.failures}/${report.tests.length} passed`);
    console.log('--------------------------------------\n');
  }

  public writeReport(report: RegressionSuiteReport, fileName: string): string {
    return this.reportWriter(fileName, report);
  }
}
