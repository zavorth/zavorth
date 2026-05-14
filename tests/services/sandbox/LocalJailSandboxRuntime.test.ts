import { LocalJailSandboxRuntime } from '../../../src/services/sandbox/LocalJailSandboxRuntime';

jest.setTimeout(20000);

describe('LocalJailSandboxRuntime', () => {
  it('executes javascript inside a temporary local jail', async () => {
    const runtime = new LocalJailSandboxRuntime();

    const result = await runtime.execute({
      language: 'javascript',
      code: 'console.log("zavorth-jail-ok")',
      timeoutMs: 20_000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('zavorth-jail-ok');
    expect(result.securityLevel).toBe('local-jail');
  });

  it('blocks shell code by default even when local-jail is called directly', async () => {
    const runtime = new LocalJailSandboxRuntime();

    const result = await runtime.execute({
      language: 'shell',
      code: 'echo shell-jail-ok',
      timeoutMs: 20_000,
    });

    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toContain('Shell execution is blocked');
  });

  it('filters sensitive and runtime-control environment overrides', async () => {
    const runtime = new LocalJailSandboxRuntime();

    const result = await runtime.execute({
      language: 'javascript',
      code: [
        'console.log("secret=" + String(process.env.OPENAI_API_KEY || ""));',
        'console.log("path=" + String(process.env.PATH || process.env.Path || ""));',
        'console.log("custom=" + String(process.env.ZAVORTH_TEST_SAFE_ENV || ""));',
      ].join('\n'),
      timeoutMs: 20_000,
      env: {
        OPENAI_API_KEY: 'should-not-leak',
        PATH: 'should-not-control-path',
        ZAVORTH_TEST_SAFE_ENV: 'safe-value',
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('secret=');
    expect(result.stdout).not.toContain('should-not-leak');
    expect(result.stdout).not.toContain('should-not-control-path');
    expect(result.stdout).toContain('custom=safe-value');
  });
});
