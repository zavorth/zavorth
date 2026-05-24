import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { handleZavorthCompletionsCommand, renderCompletionScript } from '../../../src/cli/completions/ZavorthCompletionsCommand.js';

describe('Zavorth completions', () => {
  it('renders completion scripts for supported shells', () => {
    expect(renderCompletionScript('bash')).toContain('complete -F _zavorth_complete zavorth');
    expect(renderCompletionScript('zsh')).toContain('compdef _zavorth zavorth');
    expect(renderCompletionScript('fish')).toContain('complete -c zavorth');
    expect(renderCompletionScript('powershell')).toContain('Register-ArgumentCompleter');
  });

  it('includes channels and common commands', () => {
    const script = renderCompletionScript('bash');
    expect(script).toContain('stable beta nightly dev');
    expect(script).toContain('update');
    expect(script).toContain('version');
    expect(script).toContain('--channel');
  });

  it('previews and installs completions with shell profile updates', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-completions-'));
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;
    delete process.env.USERPROFILE;
    process.env.HOME = home;
    const output: string[] = [];
    const writer = { line: (value: string) => output.push(value) };

    try {
      await handleZavorthCompletionsCommand({ commandName: 'completions', args: 'bash --install', flags: { json: false } as any, writer });
      expect(output.join('\n')).toContain('Completion install preview');
      expect(fs.existsSync(path.join(home, '.zavorth', 'completions', 'zavorth.bash'))).toBe(false);

      output.length = 0;
      await handleZavorthCompletionsCommand({ commandName: 'completions', args: 'bash --install --yes', flags: { json: false } as any, writer });
      expect(output.join('\n')).toContain('Completion script installed');
      expect(fs.existsSync(path.join(home, '.zavorth', 'completions', 'zavorth.bash'))).toBe(true);
      expect(fs.readFileSync(path.join(home, '.bashrc'), 'utf8')).toContain('Zavorth completions');
    } finally {
      if (originalHome === undefined) delete process.env.HOME;
      else process.env.HOME = originalHome;
      if (originalUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = originalUserProfile;
    }
  });
});
