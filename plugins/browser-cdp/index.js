/**
 * Browser CDP soft attach (pure JS, no Playwright).
 * Presence-only status; never returns full CDP URL secrets.
 * Localhost attach is intentional for local browser debugging.
 */
function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const cdp = resolveCdpBase();
    if (!cdp.configured) {
      return {
        ok: true,
        pack: 'browser',
        configured: false,
        host: null,
        isLocal: false,
        message: 'CDP not configured. Set CDP_URL or BROWSER_CDP_URL to attach to Chrome.',
        setup: setupTips(),
        note: 'Values are never returned — presence / host only.',
      };
    }
    if (cdp.invalid || !cdp.base) {
      return {
        ok: true,
        pack: 'browser',
        configured: true,
        host: null,
        isLocal: false,
        invalid: true,
        message: 'CDP_URL / BROWSER_CDP_URL is set but is not a valid URL.',
        setup: setupTips(),
        note: 'Values are never returned — presence / host only.',
      };
    }
    return {
      ok: true,
      pack: 'browser',
      configured: true,
      host: cdp.host,
      isLocal: cdp.isLocal,
      message: cdp.isLocal
        ? `CDP configured at local host ${cdp.host}; version/targets/navigate available when network.local is granted.`
        : `CDP configured at host ${cdp.host}; version/targets/navigate available when network.external is granted.`,
      setup: setupTips(),
      note: 'Values are never returned — presence / host only. Localhost CDP is intentional.',
    };
  }

  async function ensureCdpReady(actionLabel) {
    const cdp = resolveCdpBase();
    if (!cdp.configured) {
      return {
        ready: false,
        result: {
          ok: false,
          status: 'not_configured',
          reason: 'not_configured',
          message: 'CDP not configured (set CDP_URL or BROWSER_CDP_URL)',
          setup: setupTips(),
        },
      };
    }
    if (cdp.invalid || !cdp.base) {
      return {
        ready: false,
        result: {
          ok: false,
          status: 'invalid_cdp_url',
          reason: 'invalid_cdp_url',
          message: 'CDP_URL / BROWSER_CDP_URL is not a valid http(s) URL',
          setup: setupTips(),
        },
      };
    }

    // Localhost is allowed for CDP attach only (intentional local browser debugging).
    const permKind = cdp.isLocal ? 'network.local' : 'network.external';
    if (typeof ctx.requestPermission === 'function') {
      const allowed = await ctx.requestPermission(
        permKind,
        `browser-cdp ${actionLabel} via CDP HTTP (${cdp.host || 'host'})`,
      );
      if (!allowed) {
        return {
          ready: false,
          result: {
            ok: false,
            blocked: true,
            reason: `${permKind}_denied`,
            message: `${permKind} permission denied`,
            host: cdp.host,
            setup: setupTips(),
          },
        };
      }
    }

    return { ready: true, cdp };
  }

  async function version() {
    const gate = await ensureCdpReady('version');
    if (!gate.ready) return gate.result;

    try {
      const data = await cdpGetJson(gate.cdp.base, '/json/version');
      return {
        ok: true,
        host: gate.cdp.host,
        isLocal: gate.cdp.isLocal,
        version: {
          Browser: data.Browser || data.browser || null,
          'Protocol-Version': data['Protocol-Version'] || data.protocolVersion || null,
          'User-Agent': data['User-Agent'] || data.userAgent || null,
          'V8-Version': data['V8-Version'] || data.v8Version || null,
          'WebKit-Version': data['WebKit-Version'] || data.webKitVersion || null,
          webSocketDebuggerUrl: data.webSocketDebuggerUrl ? redactWsHost(data.webSocketDebuggerUrl) : null,
        },
        message: 'CDP /json/version ok',
      };
    } catch (error) {
      logger.warn('browser.cdp.version soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softHttpError(error, setupTips(), gate.cdp.host);
    }
  }

  async function targets() {
    const gate = await ensureCdpReady('targets');
    if (!gate.ready) return gate.result;

    try {
      const data = await cdpGetJson(gate.cdp.base, '/json/list');
      const list = Array.isArray(data) ? data : [];
      const mapped = list.map((item) => ({
        id: item && item.id != null ? String(item.id) : null,
        title: item && item.title != null ? String(item.title) : '',
        type: item && item.type != null ? String(item.type) : '',
        url: item && item.url != null ? String(item.url) : '',
      }));
      return {
        ok: true,
        host: gate.cdp.host,
        isLocal: gate.cdp.isLocal,
        count: mapped.length,
        targets: mapped,
        message: `CDP /json/list returned ${mapped.length} target(s)`,
      };
    } catch (error) {
      logger.warn('browser.cdp.targets soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softHttpError(error, setupTips(), gate.cdp.host);
    }
  }

  /**
   * HTTP-only navigate: open a new tab via GET/PUT {cdp}/json/new?{url}.
   * WebSocket Page.navigate is intentionally avoided (no extra deps).
   * Optional targetId is recorded but cannot drive page.navigate without WS.
   */
  async function navigate(input) {
    const payload = input || {};
    const url = String(payload.url || payload.href || payload.target || '').trim();
    const targetId =
      payload.targetId != null ? String(payload.targetId).trim() : payload.id != null ? String(payload.id).trim() : '';

    if (!url) {
      return {
        ok: false,
        reason: 'url_required',
        message: 'url is required',
        setup: setupTips(),
      };
    }
    if (!isHttpUrl(url)) {
      return {
        ok: false,
        reason: 'invalid_url',
        message: 'url must be an absolute http(s) URL',
        setup: setupTips(),
      };
    }

    const gate = await ensureCdpReady('navigate');
    if (!gate.ready) return gate.result;

    try {
      // Prefer existing page target when targetId is given: activate it (HTTP-only),
      // then still open/navigate via /json/new because full Page.navigate needs WS.
      if (targetId) {
        try {
          await cdpGetText(gate.cdp.base, `/json/activate/${encodeURIComponent(targetId)}`);
        } catch {
          /* soft: activate is best-effort */
        }
      }

      const opened = await openNewTab(gate.cdp.base, url);
      return {
        ok: true,
        host: gate.cdp.host,
        isLocal: gate.cdp.isLocal,
        method: 'http_json_new',
        url,
        targetId: targetId || null,
        note: targetId
          ? 'targetId activate was best-effort; navigation used HTTP /json/new (no WebSocket).'
          : 'Opened via CDP HTTP /json/new (no WebSocket / Playwright).',
        target: opened
          ? {
              id: opened.id != null ? String(opened.id) : null,
              title: opened.title != null ? String(opened.title) : '',
              type: opened.type != null ? String(opened.type) : '',
              url: opened.url != null ? String(opened.url) : url,
            }
          : null,
        message: 'CDP navigate soft-ok via /json/new',
      };
    } catch (error) {
      logger.warn('browser.cdp.navigate soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softHttpError(error, setupTips(), gate.cdp.host);
    }
  }

  ctx.bindCapability('browser.cdp.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('browser.cdp.version', async () => {
    try {
      return { output: await version() };
    } catch (error) {
      logger.warn('browser.cdp.version capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error, setupTips()) };
    }
  });

  ctx.bindCapability('browser.cdp.targets', async () => {
    try {
      return { output: await targets() };
    } catch (error) {
      logger.warn('browser.cdp.targets capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error, setupTips()) };
    }
  });

  ctx.bindCapability('browser.cdp.navigate', async ({ input }) => {
    try {
      return { output: await navigate(input || {}) };
    } catch (error) {
      logger.warn('browser.cdp.navigate capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error, setupTips()) };
    }
  });

  // Specialized registrar — records browser binding when host supports it.
  if (typeof ctx.registerBrowserProvider === 'function') {
    try {
      ctx.registerBrowserProvider({
        id: 'browser-cdp',
        capabilityId: 'browser.cdp.navigate',
        kind: 'browser',
        label: 'Browser CDP',
        metadata: { pack: 'browser', softFail: true, transport: 'cdp-http' },
        handler: async (input) => {
          try {
            return await navigate(input || {});
          } catch (error) {
            logger.warn('browser.cdp.navigate specialized handler failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            return softHttpError(error, setupTips());
          }
        },
      });
    } catch (error) {
      logger.warn('registerBrowserProvider soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('browser-cdp registered');
}

function setupTips() {
  return [
    'Start Chrome with remote debugging, e.g. chrome --remote-debugging-port=9222',
    'Set CDP_URL=http://127.0.0.1:9222 (or BROWSER_CDP_URL)',
    'Grant network.local for localhost CDP (or network.external for remote hosts)',
    'No Playwright required — this plugin uses CDP HTTP endpoints only',
  ];
}

function resolveCdpBase() {
  const raw = String(process.env.CDP_URL || process.env.BROWSER_CDP_URL || '').trim();
  if (!raw) {
    return { configured: false, base: null, host: null, isLocal: false, invalid: false };
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { configured: true, base: null, host: null, isLocal: false, invalid: true };
    }
    // Keep origin (+ optional path prefix) without trailing slash; never expose secrets elsewhere.
    const base = `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}`.replace(/\/+$/u, '');
    return {
      configured: true,
      base,
      host: parsed.host,
      isLocal: isLocalHost(parsed.hostname),
      invalid: false,
    };
  } catch {
    return { configured: true, base: null, host: null, isLocal: false, invalid: true };
  }
}

function isLocalHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/^\[|\]$/gu, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0' || h.endsWith('.localhost');
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function softHttpError(error, setup, host) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    reason: 'cdp_http_failed',
    host: host || null,
    message: String(message).slice(0, 400),
    setup: setup || setupTips(),
  };
}

/** Redact full WS debugger URL down to host-only hint (no secrets / full path). */
function redactWsHost(wsUrl) {
  try {
    return { host: new URL(wsUrl).host, present: true };
  } catch {
    return { host: null, present: Boolean(wsUrl) };
  }
}

async function openNewTab(base, url) {
  // Classic Chrome DevTools HTTP: GET /json/new?http://example.com
  // Some builds prefer PUT; try GET first, then PUT.
  const path = `/json/new?${url}`;
  try {
    return await cdpRequestJson(base, path, 'GET');
  } catch (getError) {
    try {
      return await cdpRequestJson(base, path, 'PUT');
    } catch {
      // Re-throw original GET error context if PUT also fails.
      throw getError;
    }
  }
}

async function cdpGetJson(base, path) {
  return cdpRequestJson(base, path, 'GET');
}

async function cdpGetText(base, path) {
  const response = await cdpFetch(base, path, 'GET');
  return response.text;
}

async function cdpRequestJson(base, path, method) {
  const response = await cdpFetch(base, path, method);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${String(response.text || '').slice(0, 200)}`);
  }
  const text = String(response.text || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Some CDP endpoints return plain text; surface lightly.
    return { raw: text.slice(0, 500) };
  }
}

async function cdpFetch(base, path, method) {
  const url = `${String(base).replace(/\/+$/u, '')}${path.startsWith('/') ? path : `/${path}`}`;
  if (typeof fetch === 'function') {
    const response = await fetch(url, {
      method: method || 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'zavorth-browser-cdp/1.0',
      },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });
    const text = await response.text();
    return { status: response.status || 0, text };
  }

  // Fallback without global fetch (older Node).
  return cdpHttpLegacy(url, method || 'GET');
}

function cdpHttpLegacy(url, method) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reject(new Error('Only http(s) CDP URLs are supported'));
      return;
    }
    const lib = parsed.protocol === 'https:' ? require('node:https') : require('node:http');
    const req = lib.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'zavorth-browser-cdp/1.0',
        },
        timeout: 10000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('CDP request timed out'));
    });
    req.end();
  });
}

module.exports = { register };
