import fs from 'fs';
import os from 'os';
import path from 'path';
import { CommandCenterAccessService, parseCommandCenterAccessAction } from '../../src/services/CommandCenterAccessService';

const queryTokenMarker = `?${new URLSearchParams({ token: '' }).toString()}`;

describe('CommandCenterAccessService', () => {
  it('opens the Command Center with a fragment token without exposing query-token URLs', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-command-center-access-'));
    const tokenFile = path.join(tmp, 'web-api-token.txt');
    const spawn = jest.fn(() => ({ unref: jest.fn() })) as any;

    const service = new CommandCenterAccessService({
      env: {},
      spawn,
      config: {
        host: '0.0.0.0',
        port: 3000,
        token: '',
        tokenFile,
        projectRoot: tmp,
      },
    });

    const snapshot = await service.run('open');

    expect(snapshot.opened).toBe(true);
    expect(snapshot.publicUrl).toBe('http://127.0.0.1:3000/dashboard');
    expect(snapshot.url).toContain('http://127.0.0.1:3000/dashboard#token=');
    expect(snapshot.url).not.toContain(queryTokenMarker);
    expect(snapshot.tokenSource).toBe('generated-runtime-file');
    expect(snapshot.token).toMatch(/^bsk_cc_[A-Za-z0-9_-]{40,}$/);
    expect(snapshot.token).not.toContain('zavorth-access');
    expect(fs.readFileSync(tokenFile, 'utf8').trim()).toBe(snapshot.token);
    expect(spawn).toHaveBeenCalled();
  });

  it('prefers ZAVORTH_WEB_AUTH_TOKEN and only prints token when explicitly requested', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-command-center-env-'));
    const service = new CommandCenterAccessService({
      env: { ZAVORTH_WEB_AUTH_TOKEN: 'env-token-for-test' },
      spawn: jest.fn(() => ({ unref: jest.fn() })) as any,
      config: {
        host: '127.0.0.1',
        port: 3100,
        token: '',
        tokenFile: path.join(tmp, 'web-api-token.txt'),
        projectRoot: tmp,
      },
    });

    const snapshot = await service.run('token');

    expect(snapshot.token).toBe('env-token-for-test');
    expect(snapshot.tokenSource).toBe('env');
    expect(snapshot.url).toBe('http://127.0.0.1:3100/dashboard#token=env-token-for-test');
  });

  it('ignores placeholder env tokens and generates a strong runtime token instead', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-command-center-weak-env-'));
    const tokenFile = path.join(tmp, 'web-api-token.txt');
    const service = new CommandCenterAccessService({
      env: { ZAVORTH_WEB_AUTH_TOKEN: 'zavorth-access-2026' },
      spawn: jest.fn(() => ({ unref: jest.fn() })) as any,
      config: {
        host: '127.0.0.1',
        port: 3100,
        token: '',
        tokenFile,
        projectRoot: tmp,
      },
    });

    const snapshot = await service.run('token');

    expect(snapshot.tokenSource).toBe('generated-runtime-file');
    expect(snapshot.token).toMatch(/^bsk_cc_[A-Za-z0-9_-]{40,}$/);
    expect(snapshot.token).not.toBe('zavorth-access-2026');
    expect(fs.readFileSync(tokenFile, 'utf8').trim()).toBe(snapshot.token);
  });

  it('parses human dashboard actions', () => {
    expect(parseCommandCenterAccessAction('')).toBe('open');
    expect(parseCommandCenterAccessAction('abrir')).toBe('open');
    expect(parseCommandCenterAccessAction('url')).toBe('url');
    expect(parseCommandCenterAccessAction('copiar')).toBe('url');
    expect(parseCommandCenterAccessAction('token')).toBe('token');
    expect(parseCommandCenterAccessAction('status')).toBe('status');
    expect(parseCommandCenterAccessAction('doctor')).toBe('doctor');
    expect(parseCommandCenterAccessAction('repair')).toBe('repair');
    expect(parseCommandCenterAccessAction('generate-token')).toBe('generate-token');
  });

  it('diagnoses and repairs a missing runtime-file token without exposing it by default', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-command-center-repair-'));
    const tokenFile = path.join(tmp, 'runtime', 'web-api-token.txt');
    const service = new CommandCenterAccessService({
      env: {},
      config: {
        host: '127.0.0.1',
        port: 3000,
        token: '',
        tokenFile,
        projectRoot: tmp,
      },
    });

    const before = service.doctor();
    expect(before.status).toBe('repairable');
    expect(before.tokenSource).toBe('missing');
    expect(before.problems).toContain('Token local ausente.');

    const repaired = service.repair();
    expect(repaired.status).toBe('repaired');
    expect(repaired.repaired).toBe(true);
    expect(repaired.generated).toBe(true);
    expect(fs.existsSync(tokenFile)).toBe(true);

    const after = service.doctor();
    expect(after.status).toBe('ready');
    expect(after.tokenSource).toBe('runtime-file');
    expect(after.problems).toEqual([]);
  });

  it('does not rotate runtime-file token when env token is active', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-command-center-env-locked-'));
    const tokenFile = path.join(tmp, 'web-api-token.txt');
    fs.writeFileSync(tokenFile, 'file-token', 'utf8');
    const service = new CommandCenterAccessService({
      env: { ZAVORTH_WEB_AUTH_TOKEN: 'env-token' },
      config: {
        host: '127.0.0.1',
        port: 3000,
        token: '',
        tokenFile,
        projectRoot: tmp,
      },
    });

    const result = service.generateToken();
    expect(result.status).toBe('env-locked');
    expect(result.generated).toBe(false);
    expect(result.notes.join('\n')).toContain('ZAVORTH_WEB_AUTH_TOKEN');
    expect(fs.readFileSync(tokenFile, 'utf8')).toBe('file-token');
  });
});
