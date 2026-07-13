/**
 * Wave 4 — Media vision / image describe (soft-fail).
 * Presence-only status; never returns secret values.
 * Truncates huge base64 strings in logs.
 */
const http = require('node:http');
const https = require('node:https');

const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';
const DEFAULT_VISION_MODEL = 'gpt-4o-mini';
const DEFAULT_PROMPT = 'Describe this image in detail.';
const MAX_IMAGE_PAYLOAD_CHARS = 8_000_000;
const LOG_TRUNCATE = 120;

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const openaiKeyPresent = Boolean(openaiKey());
    const xaiKeyPresent = Boolean(xaiKey());
    const anthropicKeyPresent = Boolean(anthropicKey());
    const baseUrl = openaiBaseUrl();
    const backends = [
      {
        id: 'openai',
        keyPresent: openaiKeyPresent,
        baseUrlHost: safeHost(baseUrl),
        describeSupported: true,
      },
      {
        id: 'xai',
        keyPresent: xaiKeyPresent,
        baseUrlHost: 'api.x.ai',
        describeSupported: false,
        note: 'Key presence only; describe currently uses OpenAI-compatible vision.',
      },
      {
        id: 'anthropic',
        keyPresent: anthropicKeyPresent,
        baseUrlHost: 'api.anthropic.com',
        describeSupported: false,
        note: 'Key presence only; describe currently uses OpenAI-compatible vision.',
      },
    ];
    return {
      ok: true,
      wave: 'W4',
      pack: 'media',
      backends,
      openaiKeyPresent,
      xaiKeyPresent,
      anthropicKeyPresent,
      defaultModel: String(
        process.env.VISION_MODEL || process.env.OPENAI_MODEL || DEFAULT_VISION_MODEL,
      ),
      message: openaiKeyPresent
        ? 'OPENAI_API_KEY present; describe available when network.external is granted.'
        : 'Set OPENAI_API_KEY to enable vision describe (XAI/Anthropic presence reported only).',
      setup: openaiKeyPresent
        ? null
        : [
            'export OPENAI_API_KEY=... (required for media.vision.describe)',
            'optional: OPENAI_BASE_URL, VISION_MODEL / OPENAI_MODEL',
            'Optional presence: XAI_API_KEY, ANTHROPIC_API_KEY',
            'Grant network.external for HTTP calls',
          ],
      note: 'Values are never returned — presence only.',
    };
  }

  async function describe(input) {
    const payload = input || {};
    const imageRef = resolveImageRef(payload);
    if (!imageRef) {
      return {
        ok: false,
        message: 'imageUrl|url|image is required',
      };
    }

    const status = statusPayload();
    if (!status.openaiKeyPresent) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'OPENAI_API_KEY not set',
        setup: status.setup,
      };
    }

    const allowed = await ctx.requestPermission(
      'network.external',
      'media vision describe via OpenAI-compatible chat',
    );
    if (!allowed) {
      return {
        ok: false,
        blocked: true,
        message: 'network.external permission denied',
        setup: status.setup,
      };
    }

    const prompt = String(
      payload.prompt || payload.question || payload.text || DEFAULT_PROMPT,
    ).trim() || DEFAULT_PROMPT;
    const model = String(
      payload.model ||
        process.env.VISION_MODEL ||
        process.env.OPENAI_MODEL ||
        DEFAULT_VISION_MODEL,
    ).trim();

    const imageUrl = imageRef.url;
    logger.info('media.vision.describe request', {
      model,
      imageKind: imageRef.kind,
      imagePreview: truncateForLog(imageUrl),
      promptPreview: prompt.slice(0, LOG_TRUNCATE),
    });

    const base = openaiBaseUrl().replace(/\/+$/u, '');
    const body = {
      model,
      max_tokens: Math.min(2048, Number(payload.maxTokens) || 512) || 512,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt.slice(0, 8000) },
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    };

    try {
      const result = await postJson(
        `${base}/chat/completions`,
        body,
        openaiKey(),
        'zavorth-media-vision/1.0',
      );
      const text = result?.choices?.[0]?.message?.content || null;
      return {
        ok: Boolean(text),
        provider: 'openai',
        model,
        text,
        description: text,
        usage: result?.usage || null,
        message: text ? 'Image described' : 'Vision API returned empty content',
      };
    } catch (error) {
      logger.warn('media.vision.describe failed', {
        error: error instanceof Error ? error.message : String(error),
        imagePreview: truncateForLog(imageUrl),
      });
      return softHttpError(error, status.setup);
    }
  }

  ctx.bindCapability('media.vision.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('media.vision.describe', async ({ input }) => {
    try {
      return { output: await describe(input || {}) };
    } catch (error) {
      logger.warn('media.vision.describe capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error, statusPayload().setup) };
    }
  });

  logger.info('media-vision registered');
}

function resolveImageRef(payload) {
  const raw = payload.imageUrl || payload.url || payload.image || payload.image_url || payload.src;
  if (raw == null) return null;

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const nested =
      raw.url || raw.imageUrl || raw.data || raw.b64_json || raw.base64 || raw.b64;
    if (nested == null) return null;
    return resolveImageRef({ image: nested });
  }

  const value = String(raw).trim();
  if (!value) return null;

  if (value.length > MAX_IMAGE_PAYLOAD_CHARS) {
    return null;
  }

  // data:image/...;base64,... or bare base64
  if (/^data:image\//iu.test(value)) {
    return { kind: 'data_url', url: value };
  }
  if (/^https?:\/\//iu.test(value)) {
    return { kind: 'http_url', url: value };
  }
  // Treat long non-URL strings as raw base64 → wrap as PNG data URL
  if (value.length > 64 && !/\s/u.test(value) && /^[A-Za-z0-9+/=\r\n]+$/u.test(value)) {
    const compact = value.replace(/\s+/gu, '');
    return {
      kind: 'base64',
      url: `data:image/png;base64,${compact}`,
    };
  }
  // Short relative / file-like refs — still pass through for gateways that accept them
  if (value.length <= 4096) {
    return { kind: 'ref', url: value };
  }
  return null;
}

function openaiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim();
}

function xaiKey() {
  return String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || '').trim();
}

function anthropicKey() {
  return String(process.env.ANTHROPIC_API_KEY || '').trim();
}

function openaiBaseUrl() {
  return String(
    process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || OPENAI_DEFAULT_BASE,
  ).trim();
}

function truncateForLog(value) {
  const s = String(value || '');
  if (s.length <= LOG_TRUNCATE) return s;
  // Prefer not to dump huge base64 into logs
  if (/^data:image\//iu.test(s) || s.length > 500) {
    const prefix = s.slice(0, 48);
    return `${prefix}…[truncated ${s.length} chars]`;
  }
  return `${s.slice(0, LOG_TRUNCATE)}…`;
}

function softHttpError(error, setup) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    message: redactSecrets(message).slice(0, 400),
    setup: setup || null,
  };
}

function redactSecrets(text) {
  let out = String(text || '');
  for (const key of [openaiKey(), xaiKey(), anthropicKey()]) {
    if (key && out.includes(key)) {
      out = out.split(key).join('[redacted]');
    }
  }
  return out;
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function postJson(url, body, apiKey, userAgent) {
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
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': userAgent || 'zavorth-media-vision/1.0',
        },
        timeout: 120000,
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
            // Truncate error bodies; never echo huge base64 blobs
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
