import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('skill execution storage hardening', () => {
  it('stores redacted skill inputs, outputs and errors', () => {
    const executor = readFileSync(
      join(rootDir, 'src/ai-gateway/lib/skills/executor.ts'),
      'utf8',
    );

    expect(executor).toContain('import { protectPayloadForLog } from "../logPayloads"');
    expect(executor).toContain('const storedInput = protectPayloadForLog(input)');
    expect(executor).toContain('JSON.stringify(storedInput)');
    expect(executor).toContain('const storedOutput = output ? protectPayloadForLog(output) : null');
    expect(executor).toContain('JSON.stringify(storedOutput)');
    expect(executor).toContain('protectPayloadForLog(err instanceof Error ? err.message : String(err))');
    expect(executor).not.toContain('JSON.stringify(input)');
    expect(executor).not.toContain('JSON.stringify(output)');
  });
});
