import fs from 'fs';
import os from 'os';
import path from 'path';
import { DashboardAccessService, parseDashboardAccessAction } from '../../src/services/DashboardAccessService';

const queryTokenMarker = `?${new URLSearchParams({ token: '' }).toString()}`;

describe('DashboardAccessService', () => {
  it('opens the Dashboard with a fragment token without exposing query-token URLs', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-access-'));
    const tokenFile = path.join(tmp, 'web-api-token.txt');
    const spawn = jest.fn(() => ({ unref: jest.fn() })) as any;

    const service = new DashboardAccessService({
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
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-env-'));
    const service = new DashboardAccessService({
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
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-weak-env-'));
    const tokenFile = path.join(tmp, 'web-api-token.txt');
    const service = new DashboardAccessService({
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
    expect(parseDashboardAccessAction('')).toBe('open');
    expect(parseDashboardAccessAction('abrir')).toBe('open');
    expect(parseDashboardAccessAction('url')).toBe('url');
    expect(parseDashboardAccessAction('copiar')).toBe('url');
    expect(parseDashboardAccessAction('token')).toBe('token');
    expect(parseDashboardAccessAction('status')).toBe('status');
    expect(parseDashboardAccessAction('doctor')).toBe('doctor');
    expect(parseDashboardAccessAction('repair')).toBe('repair');
    expect(parseDashboardAccessAction('generate-token')).toBe('generate-token');
  });

  it('diagnoses and repairs a missing runtime-file token without exposing it by default', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-repair-'));
    const tokenFile = path.join(tmp, 'runtime', 'web-api-token.txt');
    const service = new DashboardAccessService({
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
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-env-locked-'));
    const tokenFile = path.join(tmp, 'web-api-token.txt');
    fs.writeFileSync(tokenFile, 'file-token', 'utf8');
    const service = new DashboardAccessService({
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
