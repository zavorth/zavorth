import fs from 'fs';
import os from 'os';
import path from 'path';
import { WebConsoleAssetService } from '../../src/domain/surface/presentation/web-console/WebConsoleAssetService.js';

describe('WebConsoleAssetService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('serves the canonical dashboard shell at /dashboard and root', () => {
    const service = new WebConsoleAssetService(process.cwd());
    for (const route of ['/', '/zavorthControl']) {
      const response = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const writeJson = jest.fn();

      expect(service.handleStaticRoute(route, response as any, writeJson)).toBe(true);
      expect(response.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      const html = String(response.end.mock.calls[0][0] || '');
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('Zavorth');
      expect(writeJson).not.toHaveBeenCalled();
    }
  });

  it('serves /dashboard directly as the final-user dashboard surface', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-control-removed-'));
    tempDirs.push(root);

    const service = new WebConsoleAssetService(root);
    const response = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };
    const writeJson = jest.fn();

    expect(service.handleStaticRoute('/zavorthControl', response as any, writeJson)).toBe(true);
    expect(response.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    expect(response.end).toHaveBeenCalled();
    expect(String(response.end.mock.calls[0][0] || '')).toContain('Zavorth');
    expect(writeJson).not.toHaveBeenCalled();
  });
  it('keeps Dashboard fixture review behind a dev/test flag', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-review-gate-'));
    tempDirs.push(root);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousReviewEnabled = process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED;
    const previousExperimental = process.env.ZAVORTH_COMMAND_CENTER_EXPERIMENTAL;

    try {
      process.env.NODE_ENV = 'test';
      delete process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED;
      delete process.env.ZAVORTH_COMMAND_CENTER_EXPERIMENTAL;

      const service = new WebConsoleAssetService(root);
      const blockedResponse = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const blockedJson = jest.fn();

      expect(service.handleStaticRoute('/dashboard/review', blockedResponse as any, blockedJson)).toBe(true);
      expect(blockedResponse.writeHead).toHaveBeenCalledWith(302, {
        Location: '/zavorthControl',
        'Cache-Control': 'no-store',
      });
      expect(blockedResponse.end).toHaveBeenCalled();
      expect(blockedJson).not.toHaveBeenCalled();

      process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED = 'true';
      const allowedResponse = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const allowedJson = jest.fn();

      expect(service.handleStaticRoute('/dashboard/review', allowedResponse as any, allowedJson)).toBe(true);
      expect(allowedJson).not.toHaveBeenCalled();
      expect(allowedResponse.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      expect(String(allowedResponse.end.mock.calls[0][0])).toContain('Dashboard Review');
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousReviewEnabled === undefined) {
        delete process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED;
      } else {
        process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED = previousReviewEnabled;
      }
      if (previousExperimental === undefined) {
        delete process.env.ZAVORTH_COMMAND_CENTER_EXPERIMENTAL;
      } else {
        process.env.ZAVORTH_COMMAND_CENTER_EXPERIMENTAL = previousExperimental;
      }
    }
  });

  it('retires /app and points operators to /dashboard', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-assets-legacy-'));
    tempDirs.push(root);

    const service = new WebConsoleAssetService(root);
    const response = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };
    const writeJson = jest.fn();

    expect(service.handleStaticRoute('/app', response as any, writeJson)).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(response, expect.objectContaining({
      ok: false,
      dashboardUrl: '/zavorthControl',
    }), 410);
    expect(response.end).not.toHaveBeenCalled();
  });

  it('retires /app even when the old legacy flag is present', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-assets-legacy-enabled-'));
    tempDirs.push(root);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousLegacyFlag = process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;

    try {
      process.env.NODE_ENV = 'test';
      process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = '1';
      const service = new WebConsoleAssetService(root);
      const response = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const writeJson = jest.fn();

      expect(service.handleStaticRoute('/app', response as any, writeJson)).toBe(true);
      expect(writeJson).toHaveBeenCalledWith(response, expect.objectContaining({
        ok: false,
        dashboardUrl: '/zavorthControl',
      }), 410);
      expect(response.end).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousLegacyFlag === undefined) {
        delete process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
      } else {
        process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = previousLegacyFlag;
      }
    }
  });

  it('does not serve the retired /app.js runtime shell script', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-assets-script-'));
    tempDirs.push(root);

    const previousNodeEnv = process.env.NODE_ENV;
    const previousLegacyFlag = process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
    try {
      process.env.NODE_ENV = 'test';
      process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = '1';
      const service = new WebConsoleAssetService(root);
      const response = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const writeJson = jest.fn();

      expect(service.handleStaticRoute('/app.js', response as any, writeJson)).toBe(true);
      expect(writeJson).toHaveBeenCalledWith(response, { error: 'Not found' }, 404);
      expect(response.end).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousLegacyFlag === undefined) {
        delete process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
      } else {
        process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = previousLegacyFlag;
      }
    }
  });

  it('does not serve the retired /styles.css runtime shell styles', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-assets-styles-'));
    tempDirs.push(root);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousLegacyFlag = process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
    try {
      process.env.NODE_ENV = 'test';
      process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = '1';

      const service = new WebConsoleAssetService(root);
      const response = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const writeJson = jest.fn();

      expect(service.handleStaticRoute('/styles.css', response as any, writeJson)).toBe(true);
      expect(writeJson).toHaveBeenCalledWith(response, { error: 'Not found' }, 404);
      expect(response.end).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousLegacyFlag === undefined) {
        delete process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
      } else {
        process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = previousLegacyFlag;
      }
    }
  });

  it('keeps file preview inside the workspace and truncates oversized text files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-preview-'));
    tempDirs.push(root);
    const service = new WebConsoleAssetService(root);
    const insideFile = path.join(root, 'notes.md');
    fs.writeFileSync(insideFile, 'a'.repeat(6500));

    const preview = service.readPreviewFile('notes.md');
    expect(preview.path).toBe('notes.md');
    expect(preview.content).toHaveLength(6000);
    expect(preview.truncated).toBe(true);

    const outsideFile = path.join(os.tmpdir(), `zavorth-web-preview-outside-${Date.now()}.md`);
    fs.writeFileSync(outsideFile, 'blocked');
    try {
      expect(() => service.readPreviewFile(outsideFile)).toThrow('Esse file esta fora do workspace do Zavorth.');
    } finally {
      if (fs.existsSync(outsideFile)) {
        fs.rmSync(outsideFile, { force: true });
      }
    }
  });
});
