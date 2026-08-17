import { ZavorthSelfRepairTool } from '../../src/tools/ZavorthSelfRepairTool.js';

describe('ZavorthSelfRepairTool', () => {
  jest.setTimeout(30000);

  it('should diagnose raw error output into structured findings', async () => {
    const raw = await ZavorthSelfRepairTool.execute({
      action: 'diagnose',
      rawOutput: 'src/app.ts(10,5): error TS2304: Cannot find name "missingVar".',
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.totalFindings).toBe(1);
    expect(parsed.findings[0].filePath).toBe('src/app.ts');
    expect(parsed.findings[0].errorCode).toBe('TS2304');
  });

  it('should run repair on a passing command directly and return history', async () => {
    const raw = await ZavorthSelfRepairTool.execute({
      action: 'repair_run',
      command: 'node -e "process.exit(0);"',
      maxAttempts: 1,
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.receipt.status).toBe('resolved');

    const historyRaw = await ZavorthSelfRepairTool.execute({
      action: 'history',
    });
    const historyParsed = JSON.parse(historyRaw);
    expect(historyParsed.status).toBe('success');
    expect(historyParsed.total).toBeGreaterThanOrEqual(1);
  });
});
