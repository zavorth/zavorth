function register(ctx) {
  const logger = ctx.getLogger();

  ctx.bindCapability('search.status', async () => {
    const searx = Boolean(String(process.env.SEARXNG_URL || '').trim());
    const exa = Boolean(String(process.env.EXA_API_KEY || '').trim());
    return {
      output: {
        ok: true,
        backends: {
          searxng: { configured: searx },
          exa: { configured: exa },
          duckduckgoLite: { configured: true, note: 'fallback without key' },
        },
        preferred: searx ? 'searxng' : exa ? 'exa' : 'duckduckgo-lite',
        message:
          searx || exa
            ? 'At least one primary search backend is configured.'
            : 'No SEARXNG_URL or EXA_API_KEY; will try DuckDuckGo lite or return setup tips.',
        setup: setupTips(),
        note: 'Secret values are never returned — presence only.',
      },
    };
  });

  ctx.bindCapability('search.query', async ({ input }) => {
    try {
      const query = String((input && (input.query || input.q || input.text)) || '').trim();
      const limit = Math.max(1, Math.min(20, Number((input && input.limit) || 5) || 5));
      if (!query) {
        return {
          output: {
            ok: false,
            reason: 'query is required',
            setup: setupTips(),
          },
        };
      }

      const searx = await trySearxng(query, limit);
      if (searx) {
        return { output: searx };
      }

      const exa = await tryExa(query, limit);
      if (exa) {
        return { output: exa };
      }

      const ddg = await tryDuckDuckGoLite(query, limit);
      if (ddg) {
        return { output: ddg };
      }

      return {
        output: {
          ok: false,
          reason: 'no_backend_configured',
          query,
          results: [],
          setup: setupTips(),
        },
      };
    } catch (error) {
      logger.warn('search.query failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          reason: 'search_failed',
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });
}

function setupTips() {
  return [
    'Set SEARXNG_URL (e.g. http://127.0.0.1:8080) for a local SearXNG instance.',
    'Or set EXA_API_KEY for Exa search (https://exa.ai).',
    'Without a backend, web-search returns structured setup tips only.',
  ];
}

async function trySearxng(query, limit) {
  const base = String(process.env.SEARXNG_URL || '')
    .trim()
    .replace(/\/+$/u, '');
  if (!base) return null;
  try {
    const url = `${base}/search?q=${encodeURIComponent(query)}&format=json`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const results = (Array.isArray(data.results) ? data.results : []).slice(0, limit).map((item) => ({
      title: String(item.title || ''),
      url: String(item.url || item.link || ''),
      snippet: String(item.content || item.snippet || ''),
    }));
    return {
      ok: true,
      backend: 'searxng',
      query,
      results,
    };
  } catch {
    return null;
  }
}

async function tryExa(query, limit) {
  const apiKey = String(process.env.EXA_API_KEY || '').trim();
  if (!apiKey) return null;
  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ query, numResults: limit }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const results = (Array.isArray(data.results) ? data.results : []).slice(0, limit).map((item) => ({
      title: String(item.title || ''),
      url: String(item.url || ''),
      snippet: String(item.text || item.snippet || ''),
    }));
    return {
      ok: true,
      backend: 'exa',
      query,
      results,
    };
  } catch {
    return null;
  }
}

async function tryDuckDuckGoLite(query, limit) {
  try {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Zavorth-web-search/1.0',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const results = parseDdgLite(html, limit);
    if (results.length === 0) return null;
    return {
      ok: true,
      backend: 'duckduckgo-lite',
      query,
      results,
    };
  } catch {
    return null;
  }
}

function parseDdgLite(html, limit) {
  const results = [];
  const linkRe = /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu;
  let match = linkRe.exec(html);
  while (match && results.length < limit) {
    const href = String(match[1] || '').trim();
    const title = String(match[2] || '')
      .replace(/<[^>]+>/gu, '')
      .trim();
    if (href.startsWith('http') && title) {
      results.push({ title, url: href, snippet: '' });
    }
    match = linkRe.exec(html);
  }
  return results;
}

module.exports = { register };
