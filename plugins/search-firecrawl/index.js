/**
 * Firecrawl extract/scrape (soft-fail).
 * Presence-only status; never returns secret values.
 * SSRF: scrape targets must be HTTPS public URLs (no localhost/private).
 */
const https = require('node:https');
const http = require('node:http');

const DEFAULT_BASE = 'https://api.firecrawl.dev';
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const keyPresent = Boolean(apiKey());
    const base = resolveBaseUrl();
    return {
      ok: true,
      pack: 'search',
      backend: 'firecrawl',
      keyPresent,
      baseUrlHost: base.ok ? safeHost(base.url) : null,
      message: keyPresent
        ? 'FIRECRAWL_API_KEY present; scrape/search available when network.external is granted.'
        : 'Set FIRECRAWL_API_KEY to enable Firecrawl scrape/extract.',
      setup: keyPresent
        ? null
        : [
            'export FIRECRAWL_API_KEY=... (https://firecrawl.dev)',
            'optional: FIRECRAWL_BASE_URL (default https://api.firecrawl.dev)',
            'Grant network.external for HTTP calls',
            'Scrape targets must be public HTTPS URLs',
          ],
      note: 'Secret values are never returned — presence only.',
    };
  }

  async function scrape(input) {
    const status = statusPayload();
    const payload = input || {};
    const url = String(payload.url || payload.href || payload.target || '').trim();
    if (!url) {
      return {
        ok: false,
        backend: 'firecrawl',
        message: 'url is required',
        setup: status.setup,
      };
    }

    if (!isPublicHttpsUrl(url)) {
      return {
        ok: false,
        backend: 'firecrawl',
        blocked: true,
        message: 'Scrape target rejected (HTTPS public hosts only; no localhost/private addresses)',
        tip: 'Pass a public https:// URL. Local and private networks are blocked (SSRF).',
      };
    }

    if (!status.keyPresent) {
      return {
        ok: false,
        backend: 'firecrawl',
        status: 'not_configured',
        message: 'FIRECRAWL_API_KEY not set',
        setup: status.setup,
      };
    }

    const base = resolveBaseUrl();
    if (!base.ok) {
      return {
        ok: false,
        backend: 'firecrawl',
        message: base.error,
        setup: status.setup,
      };
    }

    const allowed = await ctx.requestPermission('network.external', 'Firecrawl scrape API');
    if (!allowed) {
      return {
        ok: false,
        backend: 'firecrawl',
        blocked: true,
        message: 'network.external permission denied',
        setup: status.setup,
      };
    }

    const formats = normalizeFormats(payload.formats);
    const body = {
      url,
      formats,
    };

    try {
      const data = await postJson(`${base.url}/v1/scrape`, body, apiKey());
      return normalizeScrapeResult(data, url);
    } catch (error) {
      logger.warn('search.firecrawl.scrape failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softHttpError(error, status.setup);
    }
  }

  async function search(input) {
    const status = statusPayload();
    const payload = input || {};
    const q = String(payload.query || payload.q || payload.text || '').trim();
    if (!q) {
      return {
        ok: false,
        backend: 'firecrawl',
        results: [],
        message: 'query|q is required',
        setup: status.setup,
      };
    }

    const limit = normalizeLimit(payload.limit ?? payload.numResults);

    if (!status.keyPresent) {
      return {
        ok: false,
        backend: 'firecrawl',
        results: [],
        status: 'not_configured',
        message: 'FIRECRAWL_API_KEY not set',
        tip: 'Prefer search.firecrawl.scrape for known URLs after setting FIRECRAWL_API_KEY.',
        setup: status.setup,
      };
    }

    const base = resolveBaseUrl();
    if (!base.ok) {
      return {
        ok: false,
        backend: 'firecrawl',
        results: [],
        message: base.error,
        setup: status.setup,
      };
    }

    const allowed = await ctx.requestPermission('network.external', 'Firecrawl search API');
    if (!allowed) {
      return {
        ok: false,
        backend: 'firecrawl',
        results: [],
        blocked: true,
        message: 'network.external permission denied',
        setup: status.setup,
      };
    }

    // Soft-try /v1/search when the API/account supports it.
    try {
      const data = await postJson(
        `${base.url}/v1/search`,
        {
          query: q.slice(0, 2000),
          limit,
        },
        apiKey(),
      );
      const results = normalizeSearchResults(data, limit);
      return {
        ok: true,
        backend: 'firecrawl',
        query: q,
        results,
        message: results.length
          ? `Firecrawl search returned ${results.length} result(s)`
          : 'Firecrawl search returned no results',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('search.firecrawl.search soft-failed', {
        error: message.slice(0, 240),
      });
      return {
        ok: false,
        backend: 'firecrawl',
        results: [],
        query: q,
        message: `Firecrawl search unavailable: ${redactSecrets(message).slice(0, 240)}`,
        tip: 'Use search.firecrawl.scrape with a known public HTTPS URL for extract/crawl instead of search.',
        setup: [
          'Confirm your Firecrawl plan supports POST /v1/search',
          'Or scrape a known URL via search.firecrawl.scrape',
          'export FIRECRAWL_API_KEY=...',
        ],
      };
    }
  }

  ctx.bindCapability('search.firecrawl.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('search.firecrawl.scrape', async ({ input }) => {
    try {
      return { output: await scrape(input || {}) };
    } catch (error) {
      logger.warn('search.firecrawl.scrape capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error, statusPayload().setup) };
    }
  });

  ctx.bindCapability('search.firecrawl.search', async ({ input }) => {
    try {
      return { output: await search(input || {}) };
    } catch (error) {
      logger.warn('search.firecrawl.search capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ...softHttpError(error, statusPayload().setup),
          results: [],
          tip: 'Use search.firecrawl.scrape with a known public HTTPS URL.',
        },
      };
    }
  });

  // Optional specialized registrar when host supports web search providers.
  if (typeof ctx.registerWebSearchProvider === 'function') {
    try {
      ctx.registerWebSearchProvider({
        kind: 'web_search',
        id: 'firecrawl',
        capabilityId: 'search.firecrawl.search',
        label: 'Firecrawl Search',
        metadata: { pack: 'search', backend: 'firecrawl' },
        handler: async (input) => {
          try {
            return await search(input || {});
          } catch (error) {
            logger.warn('search.firecrawl.search specialized handler failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            return {
              ...softHttpError(error, statusPayload().setup),
              results: [],
              tip: 'Use search.firecrawl.scrape with a known public HTTPS URL.',
            };
          }
        },
      });
    } catch (error) {
      logger.warn('registerWebSearchProvider soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('search-firecrawl registered');
}

function apiKey() {
  return String(process.env.FIRECRAWL_API_KEY || '').trim();
}

/**
 * Default host is HTTPS-only (api.firecrawl.dev).
 * Custom FIRECRAWL_BASE_URL must be HTTPS and public (no localhost/private).
 */
function resolveBaseUrl() {
  const raw = String(process.env.FIRECRAWL_BASE_URL || '').trim();
  if (!raw) {
    return { ok: true, url: DEFAULT_BASE };
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') {
      return { ok: false, error: 'FIRECRAWL_BASE_URL must use https' };
    }
    if (!isPublicHost(u.hostname)) {
      return {
        ok: false,
        error: 'FIRECRAWL_BASE_URL host is not allowed (no localhost/private addresses)',
      };
    }
    return { ok: true, url: raw.replace(/\/+$/u, '') };
  } catch {
    return { ok: false, error: 'Invalid FIRECRAWL_BASE_URL' };
  }
}

function normalizeLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

function normalizeFormats(formats) {
  if (Array.isArray(formats) && formats.length > 0) {
    return formats
      .map((f) => String(f).trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  if (typeof formats === 'string' && formats.trim()) {
    return [formats.trim()];
  }
  return ['markdown'];
}

function normalizeScrapeResult(data, url) {
  const success = data && (data.success === true || data.data != null || data.markdown != null);
  const payload = data && data.data != null ? data.data : data || {};
  const markdown =
    payload.markdown != null ? String(payload.markdown) : data && data.markdown != null ? String(data.markdown) : null;
  const html = payload.html != null ? String(payload.html) : data && data.html != null ? String(data.html) : null;
  const title = (payload.metadata && payload.metadata.title) || (data && data.metadata && data.metadata.title) || null;
  const textSnippet = markdown
    ? markdown.slice(0, 2000)
    : html
      ? html
          .replace(/<[^>]+>/gu, ' ')
          .replace(/\s+/gu, ' ')
          .trim()
          .slice(0, 2000)
      : null;

  return {
    ok: Boolean(success || markdown || html || textSnippet),
    backend: 'firecrawl',
    url,
    title: title ? String(title) : null,
    markdown: markdown ? markdown.slice(0, 50000) : null,
    html: html ? html.slice(0, 50000) : null,
    snippet: textSnippet,
    metadata: sanitizeResult(payload.metadata || (data && data.metadata) || null),
    message: markdown || html || textSnippet ? 'Scrape complete' : 'Firecrawl returned no extractable content',
  };
}

function normalizeSearchResults(data, limit) {
  const list = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];
  return list.slice(0, limit).map((item) => ({
    title: String((item && (item.title || item.name)) || ''),
    url: String((item && (item.url || item.link)) || ''),
    snippet: String(
      (item && (item.description || item.snippet || item.markdown || item.text || item.content)) || '',
    ).slice(0, 1000),
  }));
}

/**
 * SSRF-safe scrape target: HTTPS only; public hosts only.
 */
function isPublicHttpsUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    return isPublicHost(u.hostname);
  } catch {
    return false;
  }
}

function isPublicHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  if (host.endsWith('.local')) return false;
  // Block obvious private IPv4
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/u.test(host)) return false;
  if (host === '0.0.0.0' || host === '169.254.169.254') return false;
  // Coarse IPv6 ULA / link-local block when hostname is a raw address
  if (host.includes(':')) {
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
      return false;
    }
    if (host === '::1') return false;
  }
  return true;
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function softHttpError(error, setup) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    backend: 'firecrawl',
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

function sanitizeResult(result) {
  if (result == null) return null;
  if (typeof result !== 'object') return result;
  const clone = Array.isArray(result) ? result.slice() : { ...result };
  if (!Array.isArray(clone)) {
    for (const k of Object.keys(clone)) {
      if (/api[_-]?key|authorization|secret|password/iu.test(k)) {
        delete clone[k];
      }
    }
  }
  return clone;
}

function postJson(url, body, bearerToken) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      reject(new Error('Only http(s) URLs are supported'));
      return;
    }
    // API base must stay public (defense in depth alongside resolveBaseUrl).
    if (!isPublicHost(parsed.hostname)) {
      reject(new Error('Target host is not allowed (no localhost/private addresses)'));
      return;
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = lib.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${bearerToken}`,
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-search-firecrawl/1.0',
        },
        timeout: 60000,
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
