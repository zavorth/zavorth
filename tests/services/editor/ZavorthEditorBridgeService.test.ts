import { ZavorthEditorBridgeService } from '../../../src/services/editor/ZavorthEditorBridgeService';

describe('ZavorthEditorBridgeService', () => {
  let service: ZavorthEditorBridgeService;

  beforeEach(() => {
    service = new ZavorthEditorBridgeService();
  });

  it('should parse file:line:col references correctly on Windows and POSIX paths without regex bugs', () => {
    const locPosix = service.parseFileLineReference('src/auth/jwt.ts:42:15');
    expect(locPosix).toEqual({
      absoluteFilePath: 'src/auth/jwt.ts',
      lineNumber: 42,
      columnNumber: 15,
    });

    const locWindows = service.parseFileLineReference('C:\\DEV WORKSPACE\\Projetos\\Zavorth\\src\\main.ts:100:5');
    expect(locWindows).toEqual({
      absoluteFilePath: 'C:\\DEV WORKSPACE\\Projetos\\Zavorth\\src\\main.ts',
      lineNumber: 100,
      columnNumber: 5,
    });

    const locFileOnly = service.parseFileLineReference('C:\\DEV WORKSPACE\\src\\main.ts');
    expect(locFileOnly).toEqual({
      absoluteFilePath: 'C:\\DEV WORKSPACE\\src\\main.ts',
      lineNumber: undefined,
      columnNumber: undefined,
    });
  });

  it('should generate accurate launch commands for VSCode, Cursor, Zed and Windsurf', () => {
    const loc = {
      absoluteFilePath: 'C:/project/src/index.ts',
      lineNumber: 100,
      columnNumber: 5,
    };

    const vscode = service.generateLaunchCommand(loc, 'vscode');
    expect(vscode.cliExecutable).toBe('code');
    expect(vscode.cliArgs).toContain('--goto');
    expect(vscode.uriScheme).toContain('vscode://file/');

    const cursor = service.generateLaunchCommand(loc, 'cursor');
    expect(cursor.cliExecutable).toBe('cursor');
    expect(cursor.uriScheme).toContain('cursor://file/');

    const zed = service.generateLaunchCommand(loc, 'zed');
    expect(zed.cliExecutable).toBe('zed');
    expect(zed.uriScheme).toContain('zed://file/');

    const windsurf = service.generateLaunchCommand(loc, 'windsurf');
    expect(windsurf.cliExecutable).toBe('windsurf');
    expect(windsurf.uriScheme).toContain('windsurf://file/');
  });

  it('should handle Neovim terminal arguments properly', () => {
    const loc = {
      absoluteFilePath: '/home/user/app.ts',
      lineNumber: 88,
    };

    const nvim = service.generateLaunchCommand(loc, 'neovim');
    expect(nvim.cliExecutable).toBe('nvim');
    expect(nvim.cliArgs).toEqual(['+88', '/home/user/app.ts']);
  });
});
