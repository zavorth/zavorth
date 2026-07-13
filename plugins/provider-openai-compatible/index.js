/**
 * Wave 1 — OpenAI-compatible provider plugin (soft-fail).
 */
function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const keyPresent = Boolean(String(process.env.OPENAI_API_KEY || '').trim());
    const baseUrl = String(process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').trim();
    return {
      ok: true,
      provider: 'openai-compatible',
      keyPresent,
      baseUrlHost: safeHost(baseUrl),
      defaultModel: String(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
      message: keyPresent
        ? 'OPENAI_API_KEY present; complete available when network permission granted.'
        : 'Set OPENAI_API_KEY (and optional OPENAI_BASE_URL) to enable completions.',
      setup: keyPresent ? null : ['export OPENAI_API_KEY=...', 'optional: OPENAI_BASE_URL for OpenRouter/local'],
    };
  }

  ctx.bindCapability('provider.openai_compatible.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindProvider({
    id: 'openai-compatible',
    capabilityId: 'provider.openai_compatible.complete',
    name: 'openai-compatible',
    label: 'OpenAI Compatible',
    metadata: { wave: 'W1', pack: 'providers' },
    async complete(input) {
      const status = statusPayload();
      if (!status.keyPresent) {
        return { ...status, ok: false, message: 'OPENAI_API_KEY not set' };
      }
      const allowed = await ctx.requestPermission('network.external', 'OpenAI-compatible chat completion');
      if (!allowed) {
        return { ok: false, message: 'network.external permission denied', blocked: true };
      }
      const prompt = String((input && (input.prompt || input.message || input.input)) || '').trim();
      if (!prompt) {
        return { ok: false, message: 'prompt is required' };
      }
      const model = String((input && input.model) || process.env.OPENAI_MODEL || 'gpt-4o-mini');
      const baseUrl = String(process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/u, '');
      try {
        const result = await postJson(`${baseUrl}/chat/completions`, {
          model,
          messages: [{ role: 'user', content: prompt.slice(0, 32000) }],
          max_tokens: Math.min(2048, Number((input && input.maxTokens) || 512) || 512),
        }, String(process.env.OPENAI_API_KEY || ''));
        const text = result?.choices?.[0]?.message?.content || null;
        return {
          ok: Boolean(text),
          provider: 'openai-compatible',
          model,
          text,
          usage: result?.usage || null,
        };
      } catch (error) {
        logger.warn('openai-compatible complete failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          setup: status.setup,
        };
      }
    },
  });

  logger.info('provider-openai-compatible registered');
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function postJson(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      reject(new Error('Only http(s) base URLs are supported'));
      return;
    }
    const lib = parsed.protocol === 'https:' ? require('node:https') : require('node:http');
    const data = JSON.stringify(body);
    const req = lib.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-provider-openai-compatible/1.0',
        },
        timeout: 60000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 240)}`));
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
