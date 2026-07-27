import { RuntimeLauncherInstallService } from '../../src/services/RuntimeLauncherInstallService';

describe('RuntimeLauncherInstallService', () => {
  it('builds the desktop launcher install command', () => {
    const service = new RuntimeLauncherInstallService({
      platform: 'win32',
      projectRoot: 'C:/repo',
      systemRoot: 'C:/Windows',
    });

    expect(service.buildInstallCommand('desktop')).toEqual({
      command: 'npm run launcher:install',
      scriptPath: 'C:\\repo\\scripts\\install-windows-launcher.ps1',
      powershellPath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    });
  });

  it('builds the startup launcher install command', () => {
    const service = new RuntimeLauncherInstallService({
      platform: 'win32',
      projectRoot: 'C:/repo',
      systemRoot: 'C:/Windows',
    });

    expect(service.buildInstallCommand('startup')).toEqual({
      command: 'npm run launcher:startup:install',
      scriptPath: 'C:\\repo\\scripts\\install-windows-startup.ps1',
      powershellPath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    });
  });

  it('skips installation outside Windows', () => {
    const service = new RuntimeLauncherInstallService({
      platform: 'linux',
      projectRoot: '/repo',
    });

    expect(service.install('startup')).toEqual(
      expect.objectContaining({
        attempted: false,
        applied: false,
        skipped: true,
        mode: 'startup',
        command: 'npm run launcher:startup:install',
      }),
    );
  });

  it('returns a dry-run result without spawning', () => {
    const spawnSyncImpl = jest.fn();
    const service = new RuntimeLauncherInstallService({
      platform: 'win32',
      projectRoot: 'C:/repo',
      existsSync: jest.fn(() => true),
      spawnSyncImpl: spawnSyncImpl as any,
      systemRoot: 'C:/Windows',
    });

    const result = service.install('startup', { dryRun: true });

    expect(spawnSyncImpl).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        attempted: false,
        applied: false,
        skipped: true,
        mode: 'startup',
        command: 'npm run launcher:startup:install',
        output: 'dry-run: launcher de startup was not instalado.',
      }),
    );
  });

  it('keeps startup installation blocked until it is explicitly confirmed', () => {
    const spawnSyncImpl = jest.fn();
    const service = new RuntimeLauncherInstallService({
      platform: 'win32',
      projectRoot: 'C:/repo',
      existsSync: jest.fn(() => true),
      spawnSyncImpl: spawnSyncImpl as any,
      systemRoot: 'C:/Windows',
    });

    const result = service.install('startup');

    expect(spawnSyncImpl).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        attempted: false,
        applied: false,
        skipped: true,
        mode: 'startup',
        output: expect.stringContaining('automatic startup remains blocked'),
      }),
    );
  });

  it('spawns PowerShell when installation runs on Windows after explicit confirmation', () => {
    const spawnSyncImpl = jest.fn(() => ({
      status: 0,
      stdout: 'ok',
      stderr: '',
    }));
    const existsSync = jest.fn(() => true);
    const service = new RuntimeLauncherInstallService({
      platform: 'win32',
      projectRoot: 'C:/repo',
      existsSync,
      spawnSyncImpl: spawnSyncImpl as any,
      systemRoot: 'C:/Windows',
    });

    const result = service.install('startup', { confirmStartup: true });

    expect(spawnSyncImpl).toHaveBeenCalledWith(
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      ['-ExecutionPolicy', 'Bypass', '-File', 'C:\\repo\\scripts\\install-windows-startup.ps1', '-AllowInstall'],
      expect.objectContaining({
        cwd: 'C:/repo',
        encoding: 'utf8',
        windowsHide: true,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        attempted: true,
        applied: true,
        skipped: false,
        mode: 'startup',
        command: 'npm run launcher:startup:install',
      }),
    );
  });
});
