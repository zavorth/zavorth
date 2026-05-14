import { readFileSync } from 'fs';
import { join } from 'path';

function readSource(...segments: string[]): string {
  return readFileSync(join(process.cwd(), 'src', ...segments), 'utf8');
}

describe('execution and sandbox hardening', () => {
  it('keeps local executor safety checks before host shell execution', () => {
    const source = readSource('execution', 'LocalExecutor.ts');
    const blockerIndex = source.indexOf('DangerousCommandBlocker.validateOrThrow(cmd)');
    const shellRunnerIndex = source.indexOf('this.shellRunner(executionCommand');

    expect(blockerIndex).toBeGreaterThanOrEqual(0);
    expect(shellRunnerIndex).toBeGreaterThanOrEqual(0);
    expect(blockerIndex).toBeLessThan(shellRunnerIndex);
    expect(source).toContain('canBypassDockerForSafeCommand');
    expect(source).toContain('invoke-webrequest');
    expect(source).toContain('powershell');
    expect(source).toContain('netsh');
  });

  it('blocks local-jail shell execution and filters sensitive environment overrides', () => {
    const source = readSource('services', 'sandbox', 'LocalJailSandboxRuntime.ts');
    const shellBlockIndex = source.indexOf("request.language === 'shell'");
    const prepareScriptIndex = source.indexOf('this.prepareScript');

    expect(shellBlockIndex).toBeGreaterThanOrEqual(0);
    expect(prepareScriptIndex).toBeGreaterThanOrEqual(0);
    expect(shellBlockIndex).toBeLessThan(prepareScriptIndex);
    expect(source).toContain('ZAVORTH_ALLOW_LOCAL_JAIL_SHELL');
    expect(source).toContain('filterExtraEnv');
    expect(source).toContain("normalized.includes('secret')");
    expect(source).toContain("normalized.includes('token')");
    expect(source).toContain("normalized.includes('password')");
    expect(source).toContain('BLOCKED_ENV_NAMES');
  });
});
