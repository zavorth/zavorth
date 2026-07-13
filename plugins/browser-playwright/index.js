const path = require('node:path');
const { createRequire } = require('node:module');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const service = tryLoadBrowserService(workspace, logger);

  ctx.bindCapability('browser.status', async () => ({
    output: service
      ? {
        ok: true,
        available: true,
        wave: 'W5',
        engine: 'playwright',
        message: 'BrowserPlaywrightService loaded.',
        stats: typeof service.getStats === 'function' ? service.getStats() : null,
        tip: 'For CDP attach without Playwright, enable browser-cdp with CDP_URL.',
      }
      : {
        ok: true,
        available: false,
        wave: 'W5',
        engine: 'playwright',
        message: 'BrowserPlaywrightService not available.',
        setup: setupTips(),
        tip: 'Alternatively enable browser-cdp and set CDP_URL for Chrome remote debugging.',
      },
  }));

  ctx.bindCapability('browser.open', async ({ input }) => {
    try {
      const url = String((input && (input.url || input.href || input.target)) || '').trim();
      if (!url) {
        return { output: { ok: false, reason: 'url is required', setup: setupTips() } };
      }
      if (!service) {
        return {
          output: {
            ok: false,
            reason: 'playwright_service_missing',
            url,
            message: 'Install Playwright / ensure BrowserPlaywrightService is resolvable.',
            setup: setupTips(),
          },
        };
      }
      if (typeof service.navigate !== 'function') {
        return {
          output: {
            ok: false,
            reason: 'navigate_unavailable',
            setup: setupTips(),
          },
        };
      }
      const result = await service.navigate(url, {
        wait_until: (input && input.waitUntil) || 'load',
        timeout: Number((input && input.timeout) || 30000) || 30000,
      });
      return {
        output: {
          ok: true,
          url,
          result,
        },
      };
    } catch (error) {
      logger.warn('browser.open failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });
}

function setupTips() {
  return [
    'npm install playwright',
    'npx playwright install chromium',
    'Ensure src/services/plugins/BrowserPlaywrightService is built or resolvable from the monorepo.',
  ];
}

function tryLoadBrowserService(workspace, logger) {
  const req = createRequire(__filename);
  const candidates = [
    path.join(workspace, 'dist', 'services', 'plugins', 'BrowserPlaywrightService.js'),
    path.join(workspace, 'src', 'services', 'plugins', 'BrowserPlaywrightService.js'),
    path.join(workspace, 'src', 'services', 'plugins', 'BrowserPlaywrightService.ts'),
    path.resolve(__dirname, '../../dist/services/plugins/BrowserPlaywrightService.js'),
    path.resolve(__dirname, '../../src/services/plugins/BrowserPlaywrightService.js'),
    path.resolve(__dirname, '../../src/services/plugins/BrowserPlaywrightService.ts'),
  ];
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const mod = req(candidate);
      const Ctor = mod.BrowserPlaywrightService || mod.default;
      if (typeof Ctor === 'function') {
        return new Ctor({
          storageDir: path.join(workspace, 'data', 'runtime', 'playwright'),
        });
      }
    } catch {
      /* try next */
    }
  }
  logger.debug('BrowserPlaywrightService not resolved');
  return null;
}

module.exports = { register };
