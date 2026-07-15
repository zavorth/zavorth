const path = require('node:path');
const { createRequire } = require('node:module');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const service = tryLoadHoncho(workspace, logger);

  ctx.bindCapability('memory.honcho.status', async () => {
    const envKeyPresent = Boolean(String(process.env.HONCHO_API_KEY || process.env.MEMORY_HONCHO_API_KEY || '').trim());
    if (service) {
      return {
        output: {
          ok: true,
          configured: true,
          status: 'available',
          serviceLoaded: true,
          envKeyPresent,
          message: 'MemoryHonchoService loaded.',
          note: 'Env key presence is informational; values are never returned.',
        },
      };
    }
    return {
      output: {
        ok: true,
        configured: false,
        status: 'not_configured',
        serviceLoaded: false,
        envKeyPresent,
        message: 'MemoryHonchoService is not available from monorepo paths.',
        howToEnable: [
          'Ensure src/services/plugins/MemoryHonchoService is built or resolvable.',
          'Run from the Zavorth monorepo workspace so relative requires can resolve.',
          'Optional: HONCHO_API_KEY / MEMORY_HONCHO_API_KEY when using a remote Honcho backend.',
          'Or use memory-local / memory-file-journal / memory-vector-local for pure workspace stores.',
        ],
      },
    };
  });

  ctx.bindCapability('memory.honcho.profile', async ({ input }) => {
    try {
      if (!service) {
        return {
          output: {
            ok: false,
            status: 'not_configured',
            message: 'MemoryHonchoService unavailable',
          },
        };
      }
      const userId = String((input && (input.userId || input.id || input.key)) || 'default').trim();
      if (typeof service.getOrCreateProfile === 'function') {
        const profile = service.getOrCreateProfile(userId);
        return { output: { ok: true, profile } };
      }
      if (typeof service.getProfile === 'function') {
        return { output: { ok: true, profile: service.getProfile(userId) } };
      }
      return { output: { ok: false, message: 'No profile methods on service' } };
    } catch (error) {
      logger.warn('memory.honcho.profile failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('memory.honcho.search', async ({ input }) => {
    try {
      if (!service) {
        return {
          output: {
            ok: false,
            status: 'not_configured',
            items: [],
            message: 'MemoryHonchoService unavailable',
          },
        };
      }
      const userId = String((input && (input.userId || input.id)) || 'default').trim();
      const query = String((input && (input.query || input.q || input.text)) || '')
        .trim()
        .toLowerCase();
      const limit = Math.max(1, Math.min(50, Number((input && input.limit) || 10) || 10));
      const items = [];

      if (typeof service.getInsights === 'function') {
        items.push({ kind: 'insights', value: service.getInsights(userId) });
      }
      if (typeof service.getConversation === 'function') {
        items.push({ kind: 'conversation', value: service.getConversation(userId, limit) });
      }
      if (typeof service.getConversationHistory === 'function') {
        items.push({ kind: 'history', value: service.getConversationHistory(userId, limit) });
      }
      if (typeof service.getProfile === 'function') {
        items.push({ kind: 'profile', value: service.getProfile(userId) });
      }

      const filtered = query ? items.filter((item) => JSON.stringify(item).toLowerCase().includes(query)) : items;

      return {
        output: {
          ok: true,
          userId,
          query,
          items: filtered.slice(0, limit),
        },
      };
    } catch (error) {
      logger.warn('memory.honcho.search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          items: [],
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });
}

function tryLoadHoncho(workspace, logger) {
  const req = createRequire(__filename);
  const candidates = [
    path.join(workspace, 'dist', 'services', 'plugins', 'MemoryHonchoService.js'),
    path.join(workspace, 'src', 'services', 'plugins', 'MemoryHonchoService.js'),
    path.join(workspace, 'src', 'services', 'plugins', 'MemoryHonchoService.ts'),
    path.resolve(__dirname, '../../dist/services/plugins/MemoryHonchoService.js'),
    path.resolve(__dirname, '../../src/services/plugins/MemoryHonchoService.js'),
    path.resolve(__dirname, '../../src/services/plugins/MemoryHonchoService.ts'),
  ];
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const mod = req(candidate);
      const Ctor = mod.MemoryHonchoService || mod.default;
      if (typeof Ctor === 'function') {
        return new Ctor({ storageDir: path.join(workspace, 'data', 'runtime', 'honcho') });
      }
    } catch {
      /* try next */
    }
  }
  logger.debug('MemoryHonchoService not resolved; running not_configured mode');
  return null;
}

module.exports = { register };
