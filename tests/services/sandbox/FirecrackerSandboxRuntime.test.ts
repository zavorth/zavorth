import {
  buildDisabledFirecrackerStatus,
  buildReadyFirecrackerStatus,
  buildWslBaseArgs,
  toWslPath,
} from '../../../src/services/sandbox/firecracker-runtime/FirecrackerSandboxEnvironment.js';

describe('Firecracker sandbox runtime helpers', () => {
  it('normalizes Windows paths into WSL paths', () => {
    expect(toWslPath('C:\\TESTES DEV\\zavorth-core\\Zavorth')).toBe(
      '/mnt/c/TESTES DEV/zavorth-core/Zavorth',
    );
  });

  it('builds WSL command args with the configured distro and user', () => {
    expect(buildWslBaseArgs('Ubuntu-22.04', 'zavorth', 'echo ready')).toEqual([
      '-d',
      'Ubuntu-22.04',
      '-u',
      'zavorth',
      '--',
      'bash',
      '-lc',
      'echo ready',
    ]);
  });

  it('keeps status envelopes compatible with the existing runtime shape', () => {
    expect(buildDisabledFirecrackerStatus('wsl')).toMatchObject({
      enabled: false,
      transport: 'wsl',
      firecrackerReachable: false,
      canRun: false,
    });

    expect(buildReadyFirecrackerStatus()).toMatchObject({
      enabled: true,
      transport: 'direct',
      kernelPresent: true,
      rootfsPresent: true,
      canRun: true,
    });
  });
});
