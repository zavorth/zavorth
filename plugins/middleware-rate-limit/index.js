/**
 * Wave 6 — In-memory sliding window rate limit (soft guidance).
 * Emits events; never hard-throws. block=true still soft-fails (log only).
 */
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const configDir = path.join(workspace, '.zavorth', 'middleware-rate-limit');
  const configPath = path.join(configDir, 'config.json');

  /** @type {Map<string, number[]>} key -> timestamps (ms) */
  const windows = new Map();

  let config = loadConfig(configPath, logger);

  function prune(key, now) {
    const windowMs = Math.max(1, Number(config.windowMs) || DEFAULT_WINDOW_MS);
    const hits = windows.get(key) || [];
    const kept = hits.filter((ts) => now - ts < windowMs);
    if (kept.length === 0) {
      windows.delete(key);
    } else {
      windows.set(key, kept);
    }
    return kept;
  }

  function checkKey(key, options) {
    const now = Date.now();
    const limit = Math.max(1, Number(config.limit) || DEFAULT_LIMIT);
    const windowMs = Math.max(1, Number(config.windowMs) || DEFAULT_WINDOW_MS);
    const resolvedKey = String(key || 'default');
    const hits = prune(resolvedKey, now);
    const count = hits.length;
    const allowed = count < limit;

    if (options && options.consume && allowed) {
      hits.push(now);
      windows.set(resolvedKey, hits);
    }

    const finalCount = (windows.get(resolvedKey) || hits).length;
    return {
      ok: true,
      key: resolvedKey,
      allowed,
      remaining: Math.max(0, limit - finalCount),
      count: options && options.consume ? finalCount : count,
      limit,
      windowMs,
      block: Boolean(config.block),
    };
  }

  function statusPayload() {
    const now = Date.now();
    const counts = {};
    for (const key of [...windows.keys()]) {
      const kept = prune(key, now);
      if (kept.length > 0) {
        counts[key] = kept.length;
      }
    }
    return {
      ok: true,
      wave: 'W6',
      pack: 'trust',
      limit: Math.max(1, Number(config.limit) || DEFAULT_LIMIT),
      windowMs: Math.max(1, Number(config.windowMs) || DEFAULT_WINDOW_MS),
      block: Boolean(config.block),
      counts,
      configPath,
      message: 'In-memory sliding window. Soft guidance only unless block=true (still log-only).',
    };
  }

  function configurePayload(input) {
    const next = { ...config };
    if (input && input.limit != null) {
      const n = Number(input.limit);
      if (Number.isFinite(n) && n >= 1) {
        next.limit = Math.floor(n);
      }
    }
    if (input && (input.windowMs != null || input.window != null)) {
      const n = Number(input.windowMs != null ? input.windowMs : input.window);
      if (Number.isFinite(n) && n >= 1) {
        next.windowMs = Math.floor(n);
      }
    }
    if (input && typeof input.block === 'boolean') {
      next.block = input.block;
    }
    config = next;
    const saved = saveConfig(configPath, configDir, config, logger);
    return {
      ok: true,
      config,
      saved,
      configPath,
      message: saved
        ? 'Rate limit config updated and persisted.'
        : 'Rate limit config updated in memory (persist soft-failed).',
    };
  }

  ctx.bindCapability('middleware.ratelimit.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('middleware.ratelimit.configure', async ({ input }) => {
    try {
      return { output: configurePayload(input || {}) };
    } catch (error) {
      logger.warn('middleware.ratelimit.configure failed', {
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

  ctx.bindCapability('middleware.ratelimit.check', async ({ input }) => {
    try {
      const key = String((input && (input.key || input.id || input.name)) || 'default');
      const result = checkKey(key, { consume: false });
      return {
        output: {
          ok: true,
          allowed: result.allowed,
          remaining: result.remaining,
          count: result.count,
          limit: result.limit,
          windowMs: result.windowMs,
          key: result.key,
        },
      };
    } catch (error) {
      logger.warn('middleware.ratelimit.check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          allowed: true,
          remaining: 0,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const beforeExecute = async ({ context }) => {
    try {
      const ctxObj = context || {};
      const key = String(
        ctxObj.toolName
          || ctxObj.tool
          || ctxObj.name
          || (ctxObj.input && (ctxObj.input.toolName || ctxObj.input.tool))
          || 'tool',
      );
      const result = checkKey(key, { consume: true });
      if (result.allowed) {
        return;
      }

      const payload = {
        key: result.key,
        limit: result.limit,
        windowMs: result.windowMs,
        count: result.count,
        remaining: result.remaining,
        block: result.block,
        guidance: 'Rate limit exceeded for tool invocations (soft). Consider slowing down.',
        at: new Date().toISOString(),
      };

      logger.warn('middleware.rate_limit.exceeded', {
        key: payload.key,
        count: payload.count,
        limit: payload.limit,
        block: payload.block,
      });

      try {
        ctx.emit({
          type: 'middleware.rate_limit.exceeded',
          payload,
        });
      } catch {
        /* emit is best-effort */
      }

      // Even when config.block === true: soft-fail only (log/guidance). Never throw/hard-block.
      if (result.block) {
        logger.info('rate limit block mode is soft-only; tool not hard-blocked', {
          key: result.key,
        });
      }
    } catch (error) {
      logger.warn('tool.before_execute rate limit failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  if (typeof ctx.registerMiddleware === 'function') {
    ctx.registerMiddleware('tool.before_execute', beforeExecute);
  } else if (typeof ctx.registerHook === 'function') {
    ctx.registerHook('tool.before_execute', beforeExecute);
  } else {
    logger.warn('middleware-rate-limit: no registerMiddleware/registerHook available');
  }

  logger.info('middleware-rate-limit registered', {
    limit: config.limit,
    windowMs: config.windowMs,
    block: Boolean(config.block),
  });
}

function loadConfig(configPath, logger) {
  const defaults = {
    limit: DEFAULT_LIMIT,
    windowMs: DEFAULT_WINDOW_MS,
    block: false,
  };
  try {
    if (!fs.existsSync(configPath)) {
      return defaults;
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      limit: Math.max(1, Number(parsed.limit) || DEFAULT_LIMIT),
      windowMs: Math.max(1, Number(parsed.windowMs) || DEFAULT_WINDOW_MS),
      block: Boolean(parsed.block),
    };
  } catch (error) {
    if (logger && typeof logger.debug === 'function') {
      logger.debug('middleware-rate-limit config load soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return defaults;
  }
}

function saveConfig(configPath, configDir, config, logger) {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(
      configPath,
      `${JSON.stringify(
        {
          limit: Math.max(1, Number(config.limit) || DEFAULT_LIMIT),
          windowMs: Math.max(1, Number(config.windowMs) || DEFAULT_WINDOW_MS),
          block: Boolean(config.block),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    return true;
  } catch (error) {
    logger.warn('middleware-rate-limit config save soft-failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

module.exports = { register };
