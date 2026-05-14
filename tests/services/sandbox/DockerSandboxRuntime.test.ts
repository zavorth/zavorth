import { DockerSandboxRuntime } from '../../../src/services/sandbox/DockerSandboxRuntime';

describe('DockerSandboxRuntime', () => {
  it('builds a shell-wrapped docker command that stays invokable on Windows shells', () => {
    const runtime = new DockerSandboxRuntime();
    const invocation = runtime.buildWrappedInvocation(
      'echo smoke',
      'C:/workspace/zavorth',
      'shell',
    );
    const command = runtime.buildWrappedCommand(
      'echo smoke',
      'C:/workspace/zavorth',
      'shell',
    );

    if (process.platform === 'win32') {
      expect(command).toContain(' run --rm');
      expect(command).not.toContain('"docker" run');
      expect(invocation.args).toContain('-v');
      const volumeIndex = invocation.args.indexOf('-v');
      expect(invocation.args[volumeIndex + 1]).toContain(':ro');
      if (String(invocation.command).toLowerCase().includes('docker-wsl-zavorth.cmd')) {
        expect(invocation.args[volumeIndex + 1]).toContain('/mnt/c/');
      }
      return;
    }

    expect(command).toContain(' run --rm');
  });

  it('reuses the docker version probe across multiple status reads in the cache window', () => {
    const syncRunner = jest.fn(() => ({
      status: 1,
      stdout: '',
      stderr: 'docker unavailable',
      error: new Error('docker unavailable'),
    }));
    let now = 1_000;
    const runtime = new DockerSandboxRuntime({
      syncRunner,
      now: () => now,
    });

    runtime.getStatus('javascript');
    runtime.getStatus('python');
    runtime.getStatus('shell');

    expect(syncRunner).toHaveBeenCalledTimes(1);
    expect(syncRunner).toHaveBeenCalledWith(
      expect.any(String),
      ['version', '--format', '{{.Server.Version}}'],
      expect.any(Number),
    );

    now += 20_000;
    runtime.getStatus('javascript');
    expect(syncRunner).toHaveBeenCalledTimes(2);
  });
});
