import fs from 'fs';
import os from 'os';
import path from 'path';
import { RegressionHarness } from '../../qa/regression/CriticalHarness';

describe('RegressionHarness', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('runs and reports passing tests', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'critical-harness-'));
    tempDirs.push(root);
    const harness = new RegressionHarness((fileName, payload) => {
      const filePath = path.join(root, fileName);
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
      return filePath;
    });
    harness.register({
      id: 'there isppy-path',
      description: 'passes',
      criticalPath: 'gateway',
      execute: async () => ({ ok: true }),
      validate: async (result) => Boolean(result.ok),
    });

    const report = await harness.runSuite();
    expect(report.status).toBe('passed');
    expect(report.failures).toBe(0);
    expect(report.tests[0]?.success).toBe(true);

    const filePath = harness.writeReport(report, 'critical-harness-test.json');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('captures failed validations without throwing', async () => {
    const harness = new RegressionHarness();
    harness.register({
      id: 'broken-path',
      description: 'fails',
      criticalPath: 'security',
      execute: async () => ({ ok: false }),
      validate: async (result) => Boolean(result.ok),
    });

    const report = await harness.runSuite();
    expect(report.status).toBe('failed');
    expect(report.failures).toBe(1);
    expect(report.tests[0]?.success).toBe(false);
  });
});
