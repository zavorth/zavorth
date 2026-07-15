/**
 * Media image generation (soft-fail).
 * Presence-only status; never returns secret values.
 */
const http = require('node:http');
const https = require('node:https');

const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';
const XAI_IMAGES_URL = 'https://api.x.ai/v1/images/generations';
const DEFAULT_SIZE = '1024x1024';
const DEFAULT_MODEL = 'dall-e-3';

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const openaiKeyPresent = Boolean(openaiKey());
    const xaiKeyPresent = Boolean(xaiKey());
    const baseUrl = openaiBaseUrl();
    const backends = [
      {
        id: 'openai',
        keyPresent: openaiKeyPresent,
        baseUrlHost: safeHost(baseUrl),
        preferred: true,
      },
      {
        id: 'xai',
        keyPresent: xaiKeyPresent,
        baseUrlHost: 'api.x.ai',
        preferred: false,
      },
    ];
    const anyKey = openaiKeyPresent || xaiKeyPresent;
    return {
      ok: true,
      pack: 'media',
      backends,
      openaiKeyPresent,
      xaiKeyPresent,
      defaultModel: String(process.env.IMAGE_GEN_MODEL || DEFAULT_MODEL),
      message: anyKey
        ? 'Image backend key(s) present; generate available when network.external is granted.'
        : 'Set OPENAI_API_KEY (preferred) or XAI_API_KEY / GROK_API_KEY to enable image generation.',
      setup: anyKey
        ? null
        : [
            'export OPENAI_API_KEY=... (preferred; optional OPENAI_BASE_URL, IMAGE_GEN_MODEL)',
            'or export XAI_API_KEY=... / GROK_API_KEY=... for xAI image gen',
            'Grant network.external for HTTP calls',
          ],
      note: 'Values are never returned — presence only.',
    };
  }

  async function generate(input) {
    const payload = input || {};
    const prompt = String(payload.prompt || payload.text || payload.input || '').trim();
    if (!prompt) {
      return { ok: false, message: 'prompt is required' };
    }

    const preferred = String(payload.provider || '')
      .trim()
      .toLowerCase();
    const openaiPresent = Boolean(openaiKey());
    const xaiPresent = Boolean(xaiKey());
    const status = statusPayload();

    let provider = null;
    if (preferred === 'openai' || preferred === 'openai-compatible') {
      provider = openaiPresent ? 'openai' : null;
    } else if (preferred === 'xai' || preferred === 'grok') {
      provider = xaiPresent ? 'xai' : null;
    } else if (openaiPresent) {
      provider = 'openai';
    } else if (xaiPresent) {
      provider = 'xai';
    }

    if (!provider) {
      return {
        ok: false,
        status: 'not_configured',
        message: preferred ? `No API key for provider "${preferred}"` : 'No image generation API key configured',
        setup: status.setup,
      };
    }

    const allowed = await ctx.requestPermission('network.external', `media image generate via ${provider}`);
    if (!allowed) {
      return {
        ok: false,
        blocked: true,
        message: 'network.external permission denied',
        setup: status.setup,
      };
    }

    const size = normalizeSize(payload.size);
    const n = Math.max(1, Math.min(4, Number(payload.n) || 1) || 1);
    const model = String(payload.model || process.env.IMAGE_GEN_MODEL || DEFAULT_MODEL).trim();

    try {
      if (provider === 'openai') {
        return await generateOpenAI({ prompt, size, n, model });
      }
      return await generateXai({ prompt, size, n, model });
    } catch (error) {
      logger.warn('media.image.generate failed', {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
      return softHttpError(error, status.setup);
    }
  }

  async function generateOpenAI({ prompt, size, n, model }) {
    const base = openaiBaseUrl().replace(/\/+$/u, '');
    const body = {
      prompt: prompt.slice(0, 4000),
      n,
      size,
      response_format: 'b64_json',
    };
    if (model) body.model = model;

    const result = await postJson(`${base}/images/generations`, body, openaiKey(), 'zavorth-media-image-gen/1.0');
    return normalizeImageResult(result, 'openai', model);
  }

  async function generateXai({ prompt, size, n, model }) {
    const body = {
      prompt: prompt.slice(0, 4000),
      n,
      size,
    };
    // Soft model field — some xAI gateways accept it; ignore if rejected via soft-fail.
    if (model) body.model = model;

    try {
      const result = await postJson(XAI_IMAGES_URL, body, xaiKey(), 'zavorth-media-image-gen/1.0');
      return normalizeImageResult(result, 'xai', model);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('media.image.generate xAI attempt soft-failed', {
        error: message.slice(0, 240),
      });
      return {
        ok: false,
        provider: 'xai',
        message: `xAI image generation unavailable: ${redactSecrets(message).slice(0, 240)}`,
        setup: [
          'Confirm XAI_API_KEY / GROK_API_KEY is valid for image generation',
          'Endpoint soft-tried: https://api.x.ai/v1/images/generations',
          'Prefer OPENAI_API_KEY for stable OpenAI Images API',
        ],
      };
    }
  }

  ctx.bindCapability('media.image.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('media.image.generate', async ({ input }) => {
    try {
      return { output: await generate(input || {}) };
    } catch (error) {
      logger.warn('media.image.generate capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { output: softHttpError(error, statusPayload().setup) };
    }
  });

  // Specialized registrar — records image_gen binding when host supports it.
  // May re-bind the same capabilityId; semantics stay soft-fail generate.
  if (typeof ctx.registerImageGenProvider === 'function') {
    try {
      ctx.registerImageGenProvider({
        id: 'media-image-gen',
        capabilityId: 'media.image.generate',
        label: 'Media Image Gen',
        metadata: { pack: 'media' },
        handler: async (input) => {
          try {
            return await generate(input || {});
          } catch (error) {
            logger.warn('media.image.generate specialized handler failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            return softHttpError(error, statusPayload().setup);
          }
        },
      });
    } catch (error) {
      logger.warn('registerImageGenProvider soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('media-image-gen registered');
}

function openaiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim();
}

function xaiKey() {
  return String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || '').trim();
}

function openaiBaseUrl() {
  return String(process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || OPENAI_DEFAULT_BASE).trim();
}

function normalizeSize(size) {
  const raw = String(size || DEFAULT_SIZE).trim();
  if (/^\d{2,4}x\d{2,4}$/u.test(raw)) return raw;
  return DEFAULT_SIZE;
}

function normalizeImageResult(result, provider, model) {
  const items = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : result ? [result] : [];
  const first = items[0] || {};
  const url = first.url || result?.url || null;
  const b64 = first.b64_json || first.b64 || first.base64 || result?.b64_json || null;
  const revisedPrompt = first.revised_prompt || null;

  if (!url && !b64) {
    return {
      ok: false,
      provider,
      model,
      message: 'Image API returned no url or b64_json',
    };
  }

  const out = {
    ok: true,
    provider,
    model,
    message: 'Image generated',
  };
  if (url) out.url = String(url);
  if (b64) out.b64_json = String(b64);
  if (revisedPrompt) out.revised_prompt = String(revisedPrompt);
  if (items.length > 1) {
    out.count = items.length;
    out.items = items.map((item) => ({
      url: item && item.url ? String(item.url) : null,
      b64_json:
        item && (item.b64_json || item.b64 || item.base64) ? String(item.b64_json || item.b64 || item.base64) : null,
    }));
  }
  return out;
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
  for (const key of [openaiKey(), xaiKey()]) {
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
          'User-Agent': userAgent || 'zavorth-media-image-gen/1.0',
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
