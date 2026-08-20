import { SupervisedDockerExecAdapter } from '../../../src/adapters/supervisor/SupervisedDockerExecAdapter.js';


describe('SupervisedDockerExecAdapter', () => {
  it('supports inspect mode to list running containers', async () => {
    const runner = jest.fn(async () => ({
      ok: true,
      exitCode: 0,
      stdout: 'web\nworker\n',
      stderr: '',
      errorCode: null,
      errorMessage: null,
    }));
    const adapter = new SupervisedDockerExecAdapter({ runner });

    const result = await adapter.execute(
      {
        capability: 'docker.exec',
        command: JSON.stringify({
          action: 'inspect',
        }),
        workspace: __dirname,
      },
      {
        runtimeTarget: 'container',
      } as any,
    );

    expect(runner).toHaveBeenCalledWith(expect.objectContaining({
      executable: 'docker',
      args: ['ps', '--format', '{{.Names}}'],
    }));
    expect(result.ok).toBe(true);
    expect(result.metadata?.containers).toEqual(['web', 'worker']);
  });

  it('executes docker exec through the supervised runner with structured payload', async () => {
    const runner = jest.fn(async () => ({
      ok: true,
      exitCode: 0,
      stdout: 'container ok',
      stderr: '',
      errorCode: null,
      errorMessage: null,
    }));
    const adapter = new SupervisedDockerExecAdapter({ runner });

    const result = await adapter.execute(
      {
        capability: 'docker.exec',
        command: JSON.stringify({
          container: 'web',
          command: 'node',
          args: ['-v'],
          workdir: '/app',
        }),
        workspace: __dirname,
      },
      {
        runtimeTarget: 'container',
      } as any,
    );

    expect(runner).toHaveBeenCalledWith(expect.objectContaining({
      executable: 'docker',
      args: ['exec', '--workdir', '/app', 'web', 'node', '-v'],
    }));
    expect(result.ok).toBe(true);
    expect(result.metadata?.container).toBe('web');
  });

  it('can provision and remove a temporary container through supervised actions', async () => {
    const runner = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: 'zavorth-smoke-container\n',
        stderr: '',
        errorCode: null,
        errorMessage: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        stdout: 'zavorth-smoke-container\n',
        stderr: '',
        errorCode: null,
        errorMessage: null,
      });
    const adapter = new SupervisedDockerExecAdapter({ runner });

    const runResult = await adapter.execute(
      {
        capability: 'docker.exec',
        command: JSON.stringify({
          action: 'run',
          container: 'zavorth-smoke-container',
          image: 'alpine:3.20',
          command: 'sh',
          args: ['-lc', 'sleep 300'],
        }),
        workspace: __dirname,
      },
      {
        runtimeTarget: 'container',
      } as any,
    );

    const removeResult = await adapter.execute(
      {
        capability: 'docker.exec',
        command: JSON.stringify({
          action: 'rm',
          container: 'zavorth-smoke-container',
        }),
        workspace: __dirname,
      },
      {
        runtimeTarget: 'container',
      } as any,
    );

    expect(runner.mock.calls[0][0]).toEqual(expect.objectContaining({
      executable: 'docker',
      args: ['run', '-d', '--rm', '--name', 'zavorth-smoke-container', 'alpine:3.20', 'sh', '-lc', 'sleep 300'],
    }));
    expect(runner.mock.calls[1][0]).toEqual(expect.objectContaining({
      executable: 'docker',
      args: ['rm', '-f', 'zavorth-smoke-container'],
    }));
    expect(runResult.ok).toBe(true);
    expect(runResult.metadata?.container).toBe('zavorth-smoke-container');
    expect(removeResult.ok).toBe(true);
  });

  it('rejects docker exec without structured container and command', async () => {
    const adapter = new SupervisedDockerExecAdapter({
      runner: jest.fn(),
    });

    const result = await adapter.execute(
      {
        capability: 'docker.exec',
        command: 'docker exec web node -v',
      },
      {
        runtimeTarget: 'container',
      } as any,
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('docker_scope_required');
  });
});
