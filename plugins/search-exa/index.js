/**
 * Wave 5 — Dedicated Exa search (soft-fail).
 * Presence-only status; never returns secret values.
 * Complements web-search, which may also try Exa as one of several backends.
 */
const https = require('node:https');

const EXA_SEARCH_URL = 'https://api.exa.ai/search';
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const keyPresent = Boolean(apiKey());
    return {
      ok: true,
      wave: 'W5',
      pack: 'search',
      backend: 'exa',
      keyPresent,
      baseUrlHost: 'api.exa.ai',
      message: keyPresent
        ? 'EXA_API_KEY present; query available when network.external is granted.'
        : 'Set EXA_API_KEY to enable dedicated Exa search.',
      setup: keyPresent
        ? null
        : [
            'export EXA_API_KEY=... (https://exa.ai)',
            'Grant network.external for HTTP calls',
            'Optional: web-search also tries Exa when the key is set',
          ],
      note: 'Secret values are never returned — presence only.',
    };
  }

  async function query(input) {
    const status = statusPayload();
    const payload = input || {};
    const q = String(payload.query || payload.q || payload.text || '').trim();
    if (!q) {
      return {
        ok: false,
        backend: 'exa',
        results: [],
        message: 'query|q is required',
        setup: status.setup,
      };
    }

    const limit = normalizeLimit(payload.limit ?? payload.numResults);

    if (!status.keyPresent) {
      return {
        ok: false,
        backend: 'exa',
        results: [],
        status: 'not_configured',
        message: 'EXA_API_KEY not set',
        setup: status.setup,
      };
    }

    const allowed = await ctx.requestPermission(
      'network.external',
      'Exa search API query',
    );
    if (!allowed) {
      return {
        ok: false,
        backend: 'exa',
        results: [],
        blocked: true,
        message: 'network.external permission denied',
        setup: status.setup,
      };
    }

    try {
      const body = {
        query: q.slice(0, 2000),
        numResults: limit,
        type: 'auto',
      };
      // Request short text snippets when Exa supports contents.
      if (payload.contents !== false) {
        body.contents = { text: { maxCharacters: 500 } };
      }

      const data = await postJson(EXA_SEARCH_URL, body, apiKey());
      const results = normalizeResults(data, limit);
      return {
        ok: true,
        backend: 'exa',
        query: q,
        results,
        message: results.length
          ? `Exa returned ${results.length} result(s)`
          : 'Exa returned no results',
      };
    } catch (error) {
      logger.warn('search.exa.query failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softHttpError(error, status.setup);
    }
  }

  ctx.bindCapability('search.exa.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('search.exa.query', async ({ input }) => {
    try {
      return { output: await query(input || {}) };
    } catch (error) {
      logger.warn('search.exa.query capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error, statusPayload().setup) };
    }
  });

  // Specialized registrar (Wave 0) — records web_search binding when host supports it.
  if (typeof ctx.registerWebSearchProvider === 'function') {
    try {
      ctx.registerWebSearchProvider({
        kind: 'web_search',
        id: 'exa',
        capabilityId: 'search.exa.query',
        label: 'Exa Search',
        metadata: { wave: 'W5', pack: 'search', backend: 'exa' },
        handler: async (input) => {
          try {
            return await query(input || {});
          } catch (error) {
            logger.warn('search.exa.query specialized handler failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            return softHttpError(error, statusPayload().setup);
          }
        },
      });
    } catch (error) {
      logger.warn('registerWebSearchProvider soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('search-exa registered');
}

function apiKey() {
  return String(process.env.EXA_API_KEY || '').trim();
}

function normalizeLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

function normalizeResults(data, limit) {
  const list = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  return list.slice(0, limit).map((item) => ({
    title: String((item && item.title) || ''),
    url: String((item && (item.url || item.link)) || ''),
    snippet: String(
      (item && (item.text || item.snippet || item.summary || item.content)) || '',
    ).slice(0, 1000),
  }));
}

function softHttpError(error, setup) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    backend: 'exa',
    results: [],
    message: redactSecrets(message).slice(0, 400),
    setup: setup || null,
  };
}

function redactSecrets(text) {
  let out = String(text || '');
  const key = apiKey();
  if (key && out.includes(key)) {
    out = out.split(key).join('[redacted]');
  }
  return out;
}

function postJson(url, body, key) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    if (parsed.protocol !== 'https:') {
      reject(new Error('Only HTTPS is supported for Exa'));
      return;
    }
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': key,
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-search-exa/1.0',
        },
        timeout: 20000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`HTTP ${status}: ${redactSecrets(raw).slice(0, 240)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('request timed out'));
    });
    req.write(data);
    req.end();
  });
}

module.exports = { register };
