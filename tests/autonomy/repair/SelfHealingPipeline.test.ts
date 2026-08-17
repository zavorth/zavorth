import * as fs from 'node:fs';
import * as path from 'node:path';
import { SelfHealingPipeline } from '../../../src/autonomy/repair/SelfHealingPipeline.js';

describe('SelfHealingPipeline', () => {
  jest.setTimeout(30000);
  const testDir = path.join(process.cwd(), '.zavorth', 'test_repair_pipeline');
  const brokenScript = path.join(testDir, 'script.js');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('should execute repair loop and resolve on patch application', async () => {
    // Write broken code that throws on syntax/logic
    fs.writeFileSync(brokenScript, 'throw new Error("Broken on attempt 1");\n', 'utf-8');

    const pipeline = new SelfHealingPipeline();
    const receipt = await pipeline.executeRepair(
      {
        id: 'test_repair_run',
        command: `node "${brokenScript}"`,
        maxAttempts: 2,
      },
      async (_finding, attemptNum) => {
        // Fix the script on attempt 1
        fs.writeFileSync(brokenScript, 'console.log("Fixed successfully!");\n', 'utf-8');
        return {
          modifiedFiles: [brokenScript],
          description: `Fixed broken script on attempt ${attemptNum}`,
        };
      },
    );

    expect(receipt.status).toBe('resolved');
    expect(receipt.attempts.length).toBe(1);
    expect(receipt.attempts[0].success).toBe(true);
    expect(receipt.finalOutput).toContain('Fixed successfully!');
  });
});
