/**
 * Wave 3 — mem0 remote memory backend (soft-fail).
 * Presence-only status; never returns secret values.
 */
const http = require('node:http');
const https = require('node:https');

const DEFAULT_BASE = 'https://api.mem0.ai';

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const keyPresent = Boolean(apiKey());
    const resolved = resolveBaseUrl();
    const baseHost = resolved.ok ? safeHost(resolved.url) : null;
    const defaultUserConfigured = Boolean(defaultUserId());
    return {
      ok: true,
      backend: 'mem0',
      keyPresent,
      baseHost,
      baseUrlOk: resolved.ok,
      defaultUserConfigured,
      message: !resolved.ok
        ? resolved.error
        : keyPresent
          ? 'MEM0_API_KEY present; add/search available when network.external is granted.'
          : 'Set MEM0_API_KEY (and optional MEM0_BASE_URL / MEM0_USER_ID) to enable remote memory.',
      setup: keyPresent && resolved.ok
        ? null
        : [
            'export MEM0_API_KEY=...',
            'optional: MEM0_BASE_URL (default host api.mem0.ai)',
            'optional: MEM0_USER_ID default user scope',
            'Grant network.external for HTTP calls',
          ],
    };
  }

  async function ensureHttpReady(actionLabel) {
    const status = statusPayload();
    if (!status.keyPresent) {
      return {
        ready: false,
        result: {
          ok: false,
          status: 'not_configured',
          message: 'MEM0_API_KEY not set',
          setup: status.setup,
        },
      };
    }
    const resolved = resolveBaseUrl();
    if (!resolved.ok) {
      return {
        ready: false,
        result: {
          ok: false,
          status: 'invalid_base_url',
          message: resolved.error,
          setup: status.setup,
        },
      };
    }
    const allowed = await ctx.requestPermission(
      'network.external',
      `mem0 ${actionLabel}`,
    );
    if (!allowed) {
      return {
        ready: false,
        result: {
          ok: false,
          blocked: true,
          message: 'network.external permission denied',
          setup: status.setup,
        },
      };
    }
    return { ready: true, baseUrl: resolved.url, apiKey: apiKey() };
  }

  async function addMemory(input) {
    const gate = await ensureHttpReady('add memory');
    if (!gate.ready) return gate.result;

    const payload = input || {};
    const userId = resolveUserId(payload);
    let messages = Array.isArray(payload.messages) ? payload.messages : null;

    if (!messages || messages.length === 0) {
      const text = String(
        payload.text || payload.content || payload.value || payload.message || '',
      ).trim();
      if (!text) {
        return {
          ok: false,
          message: 'text|content|value or messages is required',
        };
      }
      messages = [{ role: 'user', content: text.slice(0, 32000) }];
    } else {
      messages = messages
        .filter((m) => m && (m.content != null || m.text != null))
        .map((m) => ({
          role: String(m.role || 'user'),
          content: String(m.content != null ? m.content : m.text).slice(0, 32000),
        }));
      if (messages.length === 0) {
        return { ok: false, message: 'messages must include content' };
      }
    }

    const body = { messages, user_id: userId };
    if (payload.metadata && typeof payload.metadata === 'object') {
      body.metadata = payload.metadata;
    }

    try {
      const result = await httpJson(
        'POST',
        `${gate.baseUrl}/v1/memories/`,
        body,
        gate.apiKey,
      );
      return {
        ok: true,
        backend: 'mem0',
        userId,
        result: sanitizeResult(result),
      };
    } catch (error) {
      logger.warn('memory.mem0.add failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softHttpError(error);
    }
  }

  async function searchMemory(input) {
    const gate = await ensureHttpReady('search memory');
    if (!gate.ready) return { ...gate.result, items: [] };

    const payload = input || {};
    const query = String(payload.query || payload.q || payload.text || '').trim();
    if (!query) {
      return { ok: false, items: [], message: 'query is required' };
    }
    const userId = resolveUserId(payload);
    const limit = Math.max(1, Math.min(50, Number(payload.limit) || 10) || 10);

    const body = {
      query: query.slice(0, 4000),
      user_id: userId,
      limit,
    };

    try {
      const result = await httpJson(
        'POST',
        `${gate.baseUrl}/v1/memories/search/`,
        body,
        gate.apiKey,
      );
      const items = normalizeSearchItems(result, limit);
      return {
        ok: true,
        backend: 'mem0',
        userId,
        query,
        count: items.length,
        items,
      };
    } catch (error) {
      logger.warn('memory.mem0.search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { ...softHttpError(error), items: [] };
    }
  }

  async function getMemory(input) {
    const gate = await ensureHttpReady('get memory');
    if (!gate.ready) return { ...gate.result, value: null, items: [] };

    const payload = input || {};
    const id = String(
      payload.id || payload.memoryId || payload.key || payload.memory_id || '',
    ).trim();
    const userId = resolveUserId(payload);
    const limit = Math.max(1, Math.min(50, Number(payload.limit) || 20) || 20);

    try {
      if (id) {
        const result = await httpJson(
          'GET',
          `${gate.baseUrl}/v1/memories/${encodeURIComponent(id)}/`,
          null,
          gate.apiKey,
        );
        return {
          ok: true,
          backend: 'mem0',
          id,
          found: true,
          value: sanitizeResult(result),
          items: [],
        };
      }

      // Soft list by user when no id — GET /v1/memories/?user_id=
      const qs = new URLSearchParams({
        user_id: userId,
        page_size: String(limit),
      });
      const result = await httpJson(
        'GET',
        `${gate.baseUrl}/v1/memories/?${qs.toString()}`,
        null,
        gate.apiKey,
      );
      const items = normalizeListItems(result, limit);
      return {
        ok: true,
        backend: 'mem0',
        userId,
        found: items.length > 0,
        value: null,
        count: items.length,
        items,
      };
    } catch (error) {
      logger.warn('memory.mem0.get failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Soft-fail: get is optional; return a clear soft message on 4xx/network issues.
      return {
        ...softHttpError(error),
        value: null,
        items: [],
        message:
          error instanceof Error
            ? `mem0 get unavailable: ${error.message}`
            : 'mem0 get unavailable',
      };
    }
  }

  ctx.bindCapability('memory.mem0.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('memory.mem0.add', async ({ input }) => {
    try {
      return { output: await addMemory(input || {}) };
    } catch (error) {
      logger.warn('memory.mem0.add capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error) };
    }
  });

  ctx.bindCapability('memory.mem0.search', async ({ input }) => {
    try {
      return { output: await searchMemory(input || {}) };
    } catch (error) {
      logger.warn('memory.mem0.search capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: { ...softHttpError(error), items: [] } };
    }
  });

  ctx.bindCapability('memory.mem0.get', async ({ input }) => {
    try {
      return { output: await getMemory(input || {}) };
    } catch (error) {
      logger.warn('memory.mem0.get capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ...softHttpError(error),
          value: null,
          items: [],
        },
      };
    }
  });

  ctx.bindMemoryBackend({
    id: 'memory-mem0',
    capabilityId: 'memory.mem0.search',
    label: 'mem0 remote memory',
    metadata: { wave: 'W3', pack: 'memory', remote: true },
    write: async (input) => addMemory(input || {}),
    search: async (input) => searchMemory(input || {}),
    read: async (input) => {
      const payload = input || {};
      const hasId = Boolean(
        payload.id || payload.memoryId || payload.key || payload.memory_id,
      );
      if (hasId || !(payload.query || payload.q || payload.text)) {
        return getMemory(payload);
      }
      return searchMemory(payload);
    },
  });

  logger.info('memory-mem0 registered');
}

function apiKey() {
  return String(process.env.MEM0_API_KEY || '').trim();
}

function defaultUserId() {
  return String(process.env.MEM0_USER_ID || '').trim();
}

function resolveUserId(input) {
  // Prefer explicit user fields only — never treat memory id/key as user_id.
  const explicit = String(
    (input && (input.userId || input.user_id)) || '',
  ).trim();
  if (explicit) return explicit;
  return defaultUserId() || 'default';
}

/**
 * Default host is HTTPS-only (api.mem0.ai).
 * Custom MEM0_BASE_URL may be http(s) but must not target localhost/private hosts.
 */
function resolveBaseUrl() {
  const raw = String(process.env.MEM0_BASE_URL || '').trim();
  if (!raw) {
    return { ok: true, url: DEFAULT_BASE };
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return { ok: false, error: 'MEM0_BASE_URL must use http or https' };
    }
    if (!isPublicHost(u.hostname)) {
      return {
        ok: false,
        error: 'MEM0_BASE_URL host is not allowed (no localhost/private addresses)',
      };
    }
    return { ok: true, url: raw.replace(/\/+$/u, '') };
  } catch {
    return { ok: false, error: 'Invalid MEM0_BASE_URL' };
  }
}

function isPublicHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  if (host.endsWith('.local')) return false;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/u.test(host)) return false;
  if (host === '0.0.0.0' || host === '169.254.169.254') return false;
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    // Coarse IPv6 ULA / link-local block when hostname is a raw address
    if (host.includes(':')) return false;
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

function softHttpError(error) {
  const message = error instanceof Error ? error.message : String(error);
  // Never echo API keys if they somehow appear in error text.
  const redacted = redactSecrets(message);
  return {
    ok: false,
    message: redacted.slice(0, 400),
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
  // Shallow clone; drop any accidental secret-like fields from responses.
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

function normalizeSearchItems(result, limit) {
  if (!result) return [];
  const list = Array.isArray(result)
    ? result
    : Array.isArray(result.results)
      ? result.results
      : Array.isArray(result.memories)
        ? result.memories
        : Array.isArray(result.data)
          ? result.data
          : [];
  return list.slice(0, limit).map((item, index) => ({
    id: item && (item.id || item.memory_id) != null ? String(item.id || item.memory_id) : null,
    memory: item && (item.memory != null ? item.memory : item.text != null ? item.text : item.content),
    score: item && item.score != null ? item.score : null,
    metadata: item && item.metadata != null ? item.metadata : null,
    raw: sanitizeResult(item),
    index,
  }));
}

function normalizeListItems(result, limit) {
  if (!result) return [];
  const list = Array.isArray(result)
    ? result
    : Array.isArray(result.results)
      ? result.results
      : Array.isArray(result.memories)
        ? result.memories
        : Array.isArray(result.data)
          ? result.data
          : [];
  return list.slice(0, limit).map((item, index) => sanitizeResult({
    id: item && (item.id || item.memory_id) != null ? String(item.id || item.memory_id) : null,
    memory: item && (item.memory != null ? item.memory : item.text != null ? item.text : item.content),
    metadata: item && item.metadata != null ? item.metadata : null,
    index,
  }));
}

function httpJson(method, url, body, bearerToken) {
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
    if (!isPublicHost(parsed.hostname)) {
      reject(new Error('Target host is not allowed (no localhost/private addresses)'));
      return;
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${bearerToken}`,
      'User-Agent': 'zavorth-memory-mem0/1.0',
    };
    if (data != null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = lib.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers,
        timeout: 30000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) {
            if (!raw.trim()) {
              resolve(null);
              return;
            }
            try {
              resolve(JSON.parse(raw));
            } catch (error) {
              reject(error);
            }
          } else {
            // Soft 4xx/5xx — do not include secrets; truncate body.
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
    if (data != null) req.write(data);
    req.end();
  });
}

module.exports = { register };
