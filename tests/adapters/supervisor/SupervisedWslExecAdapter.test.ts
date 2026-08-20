import { SupervisedWslExecAdapter } from '../../../src/adapters/supervisor/SupervisedWslExecAdapter.js';


describe('SupervisedWslExecAdapter', () => {
  it('supports inspect mode to list available WSL distributions', async () => {
    const runner = jest.fn(async () => ({
      ok: true,
      exitCode: 0,
      stdout: 'U\u0000b\u0000u\u0000n\u0000t\u0000u\u0000-\u00002\u00004\u0000.\u00000\u00004\u0000\r\u0000\n\u0000U\u0000b\u0000u\u0000n\u0000t\u0000u\u0000\r\u0000\n\u0000',
      stderr: '',
      errorCode: null,
      errorMessage: null,
    }));
    const adapter = new SupervisedWslExecAdapter({
      runner,
      platform: 'win32',
    });

    const result = await adapter.execute(
      {
        capability: 'wsl.exec',
        command: JSON.stringify({
          action: 'inspect',
        }),
        workspace: __dirname,
      },
      {
        runtimeTarget: 'wsl',
      } as any,
    );

    expect(runner).toHaveBeenCalledWith(expect.objectContaining({
      executable: 'wsl',
      args: ['-l', '-q'],
    }));
    expect(result.ok).toBe(true);
    expect(result.metadata?.distributions).toEqual(['Ubuntu-24.04', 'Ubuntu']);
    expect(result.metadata?.defaultDistribution).toBe('Ubuntu-24.04');
  });

  it('executes WSL commands with distribution and cwd', async () => {
    const runner = jest.fn(async () => ({
      ok: true,
      exitCode: 0,
      stdout: 'ubuntu ok',
      stderr: '',
      errorCode: null,
      errorMessage: null,
    }));
    const adapter = new SupervisedWslExecAdapter({
      runner,
      platform: 'win32',
    });

    const result = await adapter.execute(
      {
        capability: 'wsl.exec',
        command: JSON.stringify({
          distribution: 'Ubuntu-24.04',
          command: 'bash',
          args: ['-lc', 'pwd'],
          cwd: '/home/ermys',
        }),
        workspace: __dirname,
      },
      {
        runtimeTarget: 'wsl',
      } as any,
    );

    expect(runner).toHaveBeenCalledWith(expect.objectContaining({
      executable: 'wsl',
      args: ['-d', 'Ubuntu-24.04', '--cd', '/home/ermys', '--', 'bash', '-lc', 'pwd'],
    }));
    expect(result.ok).toBe(true);
    expect(result.metadata?.distribution).toBe('Ubuntu-24.04');
  });

  it('rejects WSL adapter outside Windows hosts', async () => {
    const adapter = new SupervisedWslExecAdapter({
      runner: jest.fn(),
      platform: 'linux',
    });

    const result = await adapter.execute(
      {
        capability: 'wsl.exec',
        command: JSON.stringify({
          command: 'bash',
        }),
      },
      {
        runtimeTarget: 'wsl',
      } as any,
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('wsl_windows_required');
  });
});
