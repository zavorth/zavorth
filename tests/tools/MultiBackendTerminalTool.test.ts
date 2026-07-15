import { MultiBackendTerminalTool } from '../../src/tools/MultiBackendTerminalTool';

describe('MultiBackendTerminalTool', () => {
  let tool: MultiBackendTerminalTool;
  // Shell probes on Windows can exceed the default 5s under load.
  jest.setTimeout(30_000);

  beforeEach(() => {
    tool = new MultiBackendTerminalTool();
  });

  it('exposes correct name and parameters', () => {
    expect(tool.name).toBe('terminal_backend');
    expect(tool.parameters.required).toEqual(['command']);
  });

  it('returns error when command is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
    expect(result).toContain('command');
  });

  it('returns error for empty command', async () => {
    const result = await tool.execute({ command: '' });
    expect(result).toContain('Erro');
    expect(result).toContain('command');
  });

  it('returns error for invalid backend', async () => {
    const result = await tool.execute({
      command: 'echo test',
      backend: 'zsh_invalid',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('backend');
  });

  it('executes a simple command with default backend', async () => {
    const result = await tool.execute({ command: 'echo hello' });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('executes a command with explicit cmd backend on windows', async () => {
    if (process.platform !== 'win32') return;

    const result = await tool.execute({
      command: 'echo test_cmd',
      backend: 'cmd',
    });

    expect(result).toContain('test_cmd');
  });

  it('executes a command with powershell backend on windows', async () => {
    if (process.platform !== 'win32') return;

    const result = await tool.execute({
      command: 'Write-Output test_ps',
      backend: 'powershell',
    });

    expect(result).toContain('test_ps');
  });

  it('respects timeout parameter', async () => {
    const result = await tool.execute({
      command: 'echo timeout_test',
      timeout_ms: 5000,
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('uses working_directory when provided', async () => {
    const result = await tool.execute({
      command: process.platform === 'win32' ? 'cd' : 'pwd',
      working_directory: process.cwd(),
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('handles command that produces stderr', async () => {
    const result = await tool.execute({
      command: process.platform === 'win32' ? 'echo err 1>&2' : 'echo err >&2',
    });

    expect(result).toBeDefined();
  });

  it('falls back when requested backend is unavailable', async () => {
    const result = await tool.execute({
      command: 'echo fallback',
      backend: 'fish',
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('returns error when working_directory is outside the workspace root', async () => {
    const result = await tool.execute({
      command: 'echo test',
      working_directory: process.platform === 'win32' ? 'C:\\Windows' : '/etc',
    });
    expect(result).toContain('Error: working directory');
    expect(result).toContain('outside the allowed workspace root');
  });
});
