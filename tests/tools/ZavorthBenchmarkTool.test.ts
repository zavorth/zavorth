import { ZavorthBenchmarkTool } from '../../src/tools/ZavorthBenchmarkTool';
import { ZavorthAutonomyHarnessService } from '../../src/services/benchmark/ZavorthAutonomyHarnessService';

describe('ZavorthBenchmarkTool', () => {
  let tool: ZavorthBenchmarkTool;
  let harness: ZavorthAutonomyHarnessService;

  beforeEach(() => {
    harness = new ZavorthAutonomyHarnessService();
    tool = new ZavorthBenchmarkTool(harness);
  });

  it('should run benchmark suite and return scorecard via tool interface', async () => {
    const res = await tool.execute({ action: 'run_suite' });
    const parsed = JSON.parse(res);

    expect(parsed.success).toBe(true);
    expect(parsed.suiteResult.autonomyScorePercentage).toBeGreaterThanOrEqual(0);
    expect(parsed.scorecard).toContain('ZAVORTH AUTONOMY BENCHMARK SCORECARD');
  });

  it('should retrieve benchmark historical reports', async () => {
    const res = await tool.execute({ action: 'get_history' });
    const parsed = JSON.parse(res);

    expect(parsed.success).toBe(true);
    expect(Array.isArray(parsed.reports)).toBe(true);
  });
});
