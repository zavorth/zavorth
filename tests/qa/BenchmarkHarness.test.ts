import fs from 'fs';
import os from 'os';
import path from 'path';
import { BenchmarkHarness } from '../../qa/benchmarks/Harness';

describe('BenchmarkHarness', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('builds and writes a report with summary metrics', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-harness-'));
    tempDirs.push(root);
    const harness = new BenchmarkHarness('Harness Test', (fileName, payload) => {
      const filePath = path.join(root, fileName);
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
      return filePath;
    });

    await harness.measure('fast op', async () => 'ok', {
      detail: (value) => ({ value }),
    });

    const report = harness.buildReport();
    expect(report.status).toBe('passed');
    expect(report.summary.totalRuns).toBe(1);
    expect(report.runs[0]?.details).toEqual({ value: 'ok' });

    const filePath = harness.writeReport('benchmark-harness-test.json');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('marks failures when a measured operation throws', async () => {
    const harness = new BenchmarkHarness('Failure Harness');

    await expect(
      harness.measure('broken op', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const report = harness.buildReport();
    expect(report.status).toBe('failed');
    expect(report.summary.failed).toBe(1);
    expect(report.runs[0]?.error).toBe('boom');
  });
});
