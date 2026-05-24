import { runLocalTask } from '../../../src/cli/local-task/ZavorthLocalTaskCore.js';

describe('Zavorth local task command', () => {
  it('renders install as a clean local task result', () => {
    const result = runLocalTask('install', (command, args) => ({
      pid: 1,
      output: [],
      stdout: 'up to date\nfound 0 vulnerabilities\n',
      stderr: '',
      status: 0,
      signal: null,
    } as any));

    expect(result.ok).toBe(true);
    expect(result.command).toContain('install');
    expect(result.summary).toContain('Dependencies are installed');
    expect(result.nextActions).toContain('zavorth build');
  });

  it('keeps failure output compact and actionable', () => {
    const result = runLocalTask('build', () => ({
      pid: 1,
      output: [],
      stdout: '',
      stderr: 'first line\nsecond line\nthird line\n',
      status: 1,
      signal: null,
    } as any));

    expect(result.ok).toBe(false);
    expect(result.outputTail).toEqual(['first line', 'second line', 'third line']);
    expect(result.nextActions[0]).toContain('npm');
  });
});
