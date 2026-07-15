/**
 * Soft bridge to core ContextEngine (monorepo tryLoad).
 * Pure JS, soft-fail, never leaks secrets.
 */
const path = require('node:path');
const { createRequire } = require('node:module');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const service = tryLoadContextEngine(workspace, logger);

  function statusPayload() {
    if (service) {
      return {
        ok: true,
        available: true,
        status: 'available',
        pack: 'trust',
        message: 'ContextEngine loaded from monorepo path (soft bridge instance).',
        methods: listMethods(service),
        note: 'Bridge may use a local instance; live runtime DI is owned by bootstrap.',
      };
    }
    return {
      ok: true,
      available: false,
      status: 'not_configured',
      pack: 'trust',
      message: 'ContextEngine not resolvable from monorepo paths.',
      setup: setupTips(),
    };
  }

  async function snapshotPayload(input) {
    if (!service) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'ContextEngine unavailable',
        setup: setupTips(),
      };
    }
    try {
      if (typeof service.getSnapshot === 'function') {
        const snapshot = await service.getSnapshot(input || {});
        return { ok: true, kind: 'getSnapshot', snapshot: sanitizeSoft(snapshot) };
      }
      if (typeof service.getState === 'function') {
        const state = await service.getState(input || {});
        return { ok: true, kind: 'getState', state: sanitizeSoft(state) };
      }
      if (typeof service.summarize === 'function') {
        const summary = await service.summarize(input || {});
        return { ok: true, kind: 'summarize', summary: sanitizeSoft(summary) };
      }
      if (typeof service.getStats === 'function') {
        const stats = service.getStats();
        return {
          ok: true,
          kind: 'getStats',
          snapshot: { stats: sanitizeSoft(stats) },
          note: 'No getSnapshot/getState/summarize; returned getStats as soft snapshot.',
        };
      }
      return {
        ok: false,
        status: 'not_configured',
        message: 'Loaded module has no getSnapshot/getState/summarize/getStats.',
        setup: setupTips(),
      };
    } catch (error) {
      logger.warn('context.engine.snapshot failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function recallPayload(input) {
    if (!service) {
      return {
        ok: false,
        status: 'not_configured',
        items: [],
        message: 'ContextEngine unavailable',
        setup: setupTips(),
      };
    }
    const query = String((input && (input.query || input.q || input.text || input.message)) || '').trim();
    if (!query) {
      return { ok: false, items: [], message: 'query is required' };
    }
    try {
      if (typeof service.recall === 'function') {
        const result = await service.recall(query, input && input.userId);
        return { ok: true, kind: 'recall', query, result: sanitizeSoft(result) };
      }
      if (typeof service.search === 'function') {
        const result = await service.search(query, input || {});
        return { ok: true, kind: 'search', query, result: sanitizeSoft(result) };
      }
      if (typeof service.find === 'function') {
        const result = await service.find(query, input || {});
        return { ok: true, kind: 'find', query, result: sanitizeSoft(result) };
      }
      return {
        ok: false,
        status: 'not_configured',
        items: [],
        query,
        message: 'Loaded engine has no recall/search/find methods.',
        setup: setupTips(),
      };
    } catch (error) {
      logger.warn('context.engine.recall failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        items: [],
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function statsPayload() {
    if (!service) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'ContextEngine unavailable',
        setup: setupTips(),
      };
    }
    try {
      const stats = typeof service.getStats === 'function' ? service.getStats() : null;
      const improvement = typeof service.getImprovementStats === 'function' ? service.getImprovementStats() : null;
      const cache = typeof service.getCacheStats === 'function' ? service.getCacheStats() : null;
      if (!stats && !improvement && !cache) {
        return {
          ok: false,
          status: 'not_configured',
          message: 'No stats methods on loaded engine.',
        };
      }
      return {
        ok: true,
        stats: sanitizeSoft(stats),
        improvement: sanitizeSoft(improvement),
        cache: sanitizeSoft(cache),
      };
    } catch (error) {
      logger.warn('context.engine.stats failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  ctx.bindCapability('context.engine.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('context.engine.recall', async ({ input }) => ({
    output: await recallPayload(input || {}),
  }));

  ctx.bindCapability('context.engine.stats', async () => ({
    output: statsPayload(),
  }));

  const snapshotHandler = async (input) => snapshotPayload(input || {});

  if (typeof ctx.registerContextEngine === 'function') {
    ctx.registerContextEngine({
      kind: 'context_engine',
      id: 'core-bridge',
      capabilityId: 'context.engine.snapshot',
      label: 'Core Context Engine Bridge',
      metadata: { pack: 'trust' },
      handler: snapshotHandler,
    });
  } else {
    ctx.bindCapability('context.engine.snapshot', async ({ input }) => ({
      output: await snapshotHandler(input || {}),
    }));
  }

  logger.info('context-engine-bridge registered', {
    available: Boolean(service),
  });
}

function setupTips() {
  return [
    'Run from the Zavorth monorepo workspace so relative requires can resolve.',
    'Ensure dist/context-engine/ContextEngine.js is built (npm run build) or src paths are resolvable.',
    'Soft bridge only — live engine attachment is owned by bootstrap/context-engine runtime.',
  ];
}

function listMethods(service) {
  if (!service || typeof service !== 'object') return [];
  const names = [
    'getSnapshot',
    'getState',
    'summarize',
    'getStats',
    'getImprovementStats',
    'getCacheStats',
    'recall',
    'search',
    'find',
    'pushEvent',
    'clearSession',
  ];
  return names.filter((name) => typeof service[name] === 'function');
}

/**
 * Shallow sanitize: drop keys that look like secrets.
 */
function sanitizeSoft(value) {
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeSoft(item));
  }
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    const lower = String(key).toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('secret') ||
      lower.includes('apikey') ||
      lower.includes('api_key') ||
      lower.includes('token') ||
      lower.includes('authorization')
    ) {
      out[key] = '[redacted]';
      continue;
    }
    if (val && typeof val === 'object') {
      out[key] = sanitizeSoft(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function tryLoadContextEngine(workspace, logger) {
  const req = createRequire(__filename);
  const candidates = [
    path.join(workspace, 'dist', 'context-engine', 'ContextEngine.js'),
    path.join(workspace, 'dist', 'services', 'context-engine', 'ContextEngine.js'),
    path.join(workspace, 'src', 'context-engine', 'ContextEngine.js'),
    path.join(workspace, 'src', 'context-engine', 'index.js'),
    path.resolve(__dirname, '../../dist/context-engine/ContextEngine.js'),
    path.resolve(__dirname, '../../dist/services/context-engine/ContextEngine.js'),
    path.resolve(__dirname, '../../src/context-engine/ContextEngine.js'),
    path.resolve(__dirname, '../../src/context-engine/index.js'),
  ];

  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const mod = req(candidate);
      const Ctor = mod.ContextEngine || mod.default;
      if (typeof Ctor === 'function') {
        try {
          return new Ctor({});
        } catch (error) {
          logger.debug('ContextEngine construct failed', {
            candidate,
            error: error instanceof Error ? error.message : String(error),
          });
          // Module resolved but instance failed — expose static surface if any.
          if (mod && typeof mod === 'object') {
            return mod;
          }
        }
      }
      if (mod && typeof mod === 'object' && (mod.getStats || mod.getSnapshot || mod.recall)) {
        return mod;
      }
    } catch {
      /* try next */
    }
  }

  logger.debug('ContextEngine not resolved; running not_configured mode');
  return null;
}

module.exports = { register };
