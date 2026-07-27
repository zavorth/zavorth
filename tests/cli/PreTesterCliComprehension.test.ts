import { ZavorthCli } from '../../src/cli/ZavorthCli';

describe('PreTesterCliComprehension', () => {
  it('deve validar descobrabilidade do help e status na CLI e actions acionaveis', async () => {
    const writes: string[] = [];
    const errors: string[] = [];

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: (text: string) => errors.push(text),
      },
    });

    // Run help command
    const exitCodeHelp = await cli.run(['help']);
    expect(exitCodeHelp).toBe(0);

    const helpOutput = writes.join('\n');
    expect(helpOutput).toContain('status');
    expect(helpOutput).toContain('doctor');
    expect(helpOutput).toContain('setup');

    // Run status command
    writes.length = 0;
    errors.length = 0;
    const exitCodeStatus = await cli.run(['status']);
    expect(exitCodeStatus).toBeDefined();

    const statusOutput = writes.join('\n') + '\n' + errors.join('\n');
    expect(statusOutput).not.toContain('undefined');
    expect(statusOutput).not.toContain('null');
    expect(statusOutput).not.toContain('[object Object]');
    expect(statusOutput).not.toContain('secretRef');
    expect(statusOutput).not.toContain('rawKey');
    expect(statusOutput).not.toContain('ciphertext');
    expect(statusOutput).not.toContain('authTag');
  });
});
