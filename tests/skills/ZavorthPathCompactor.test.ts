import os from 'node:os';
import process from 'node:process';
import { ZavorthPathCompactor } from '../../src/skills/ZavorthPathCompactor.js';

describe('ZavorthPathCompactor', () => {
  let originalPlatform: string;
  let homedirSpy: jest.SpyInstance;

  beforeAll(() => {
    originalPlatform = process.platform;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  it('normalizes Windows backslashes to Unix forward slashes', () => {
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('/var/empty');
    expect(ZavorthPathCompactor.compact('C:\\foo\\bar')).toBe('C:/foo/bar');
    expect(ZavorthPathCompactor.compact('foo\\bar\\baz')).toBe('foo/bar/baz');
  });

  it('preserves Windows drive roots while normalizing slashes', () => {
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('/var/empty');

    expect(ZavorthPathCompactor.compact('C:\\')).toBe('C:/');
    expect(ZavorthPathCompactor.compact('C:/')).toBe('C:/');
  });

  it('compacts exactly home directory to ~', () => {
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('/home/zavorth-user');
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    expect(ZavorthPathCompactor.compact('/home/zavorth-user')).toBe('~');
    expect(ZavorthPathCompactor.compact('/home/zavorth-user/')).toBe('~');
  });

  it('compacts home subdirectories to ~/relative_path', () => {
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('/home/zavorth-user');
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    expect(ZavorthPathCompactor.compact('/home/zavorth-user/src/main.ts')).toBe('~/src/main.ts');
  });

  it('is case-insensitive for home directories on Windows', () => {
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\ZavorthUser');
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    expect(ZavorthPathCompactor.compact('c:\\users\\zavorthuser')).toBe('~');
    expect(ZavorthPathCompactor.compact('c:\\users\\zavorthuser\\src\\main.ts')).toBe('~/src/main.ts');
  });

  it('is case-sensitive for home directories on Darwin/Linux', () => {
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('/Users/ZavorthUser');
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

    expect(ZavorthPathCompactor.compact('/users/zavorthuser')).toBe('/users/zavorthuser');
  });

  it('avoids prefix matching collision on similar home directories', () => {
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('/home/user');
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    expect(ZavorthPathCompactor.compact('/home/user2/src/main.ts')).toBe('/home/user2/src/main.ts');
  });

  it('expands compacted ~ or ~/ paths back into absolute paths', () => {
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('/home/zavorth-user');

    expect(ZavorthPathCompactor.expand('~')).toBe('/home/zavorth-user');
    expect(ZavorthPathCompactor.expand('~/docs/file.txt')).toBe('/home/zavorth-user/docs/file.txt');
    expect(ZavorthPathCompactor.expand('/other/path')).toBe('/other/path');
  });
});
