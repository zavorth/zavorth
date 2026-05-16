import { RuntimeAccessLaunchService } from '../../src/runtime/access/RuntimeAccessLaunchService.js';

describe('RuntimeAccessLaunchService', () => {
  it('prefers the remote app when best is requested and remote is ready', () => {
    const service = new RuntimeAccessLaunchService({ platform: 'win32' });

    expect(service.selectTarget(
      {
        local: {
          ready: true,
          appUrl: 'http://127.0.0.1:33333/dashboard',
        },
        remote: {
          ready: true,
          appUrl: 'https://zavorth.example/dashboard',
        },
      },
      'best',
    )).toEqual({
      source: 'remote',
      url: 'https://zavorth.example/dashboard',
      reason: 'Abri o Home remoto porque ele ja esta pronto.',
    });
  });

  it('falls back to the local app when remote is not ready', () => {
    const service = new RuntimeAccessLaunchService({ platform: 'win32' });

    expect(service.selectTarget(
      {
        local: {
          ready: true,
          appUrl: 'http://127.0.0.1:33333/dashboard',
        },
        remote: {
          ready: false,
          appUrl: 'https://zavorth.example/dashboard',
        },
      },
      'best',
    )).toEqual({
      source: 'local',
      url: 'http://127.0.0.1:33333/dashboard',
      reason: 'Abri o Home local porque ele ja esta pronto.',
    });
  });

  it('returns none when the requested surface is not ready', () => {
    const service = new RuntimeAccessLaunchService({ platform: 'linux' });

    expect(service.selectTarget(
      {
        local: {
          ready: false,
          appUrl: 'http://127.0.0.1:33333/app',
        },
        remote: {
          ready: false,
          appUrl: null,
        },
      },
      'remote',
    )).toEqual({
      source: 'none',
      url: null,
      reason: 'O Home remoto ainda nao esta pronto para abrir.',
    });
  });

  it('builds a launch command for the current platform', () => {
    const windowsService = new RuntimeAccessLaunchService({ platform: 'win32' });
    expect(windowsService.buildLaunchCommand('https://zavorth.example/app')).toEqual({
      command: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-Command', "Start-Process 'https://zavorth.example/app'"],
    });

    const macService = new RuntimeAccessLaunchService({ platform: 'darwin' });
    expect(macService.buildLaunchCommand('https://zavorth.example/app')).toEqual({
      command: 'open',
      args: ['https://zavorth.example/app'],
    });
  });
});

