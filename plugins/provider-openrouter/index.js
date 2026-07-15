/**
 * Soft-fail OpenRouter Provider plugin (OpenAI-compatible HTTP).
 */
function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const key = String(process.env.OPENROUTER_API_KEY || '').trim();
    const keyPresent = Boolean(key);
    const baseUrl = String(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').trim();
    return {
      ok: true,
      provider: 'openrouter',
      keyPresent,
      baseUrlHost: safeHost(baseUrl),
      defaultModel: String(process.env.OPENROUTER_MODEL || 'openrouter/auto'),
      message: keyPresent
        ? 'OPENROUTER_API_KEY present; complete available when network.external permission granted.'
        : 'Set OPENROUTER_API_KEY to enable completions.',
      setup: keyPresent ? null : ['export OPENROUTER_API_KEY=...'],
    };
  }

  ctx.bindCapability('provider.openrouter.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindProvider({
    id: 'openrouter',
    capabilityId: 'provider.openrouter.complete',
    name: 'openrouter',
    label: 'OpenRouter',
    metadata: { pack: 'providers' },
    async complete(input) {
      const status = statusPayload();
      if (!status.keyPresent) {
        return { ...status, ok: false, message: 'OPENROUTER_API_KEY not set' };
      }
      const allowed = await ctx.requestPermission('network.external', 'OpenRouter chat completion');
      if (!allowed) {
        return { ok: false, message: 'network.external permission denied', blocked: true };
      }
      const prompt = String((input && (input.prompt || input.message || input.input)) || '').trim();
      if (!prompt) {
        return { ok: false, message: 'prompt is required' };
      }
      const model = String((input && input.model) || process.env.OPENROUTER_MODEL || 'openrouter/auto');
      const baseUrl = String(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/u, '');
      const apiKey = String(process.env.OPENROUTER_API_KEY || '').trim();
      try {
        const result = await postJson(
          `${baseUrl}/chat/completions`,
          {
            model,
            messages: [{ role: 'user', content: prompt.slice(0, 32000) }],
            max_tokens: Math.min(2048, Number((input && input.maxTokens) || 512) || 512),
          },
          apiKey,
          { 'HTTP-Referer': 'https://zavorth.local', 'X-Title': 'Zavorth' },
        );
        const text = result?.choices?.[0]?.message?.content || null;
        return {
          ok: Boolean(text),
          provider: 'openrouter',
          model,
          text,
          usage: result?.usage || null,
        };
      } catch (error) {
        logger.warn('provider-openrouter complete failed', {
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

  logger.info('provider-openrouter registered');
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function postJson(url, body, apiKey, extraHeaders) {
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
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'User-Agent': 'zavorth-provider-openrouter/1.0',
      ...(extraHeaders || {}),
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const req = lib.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers,
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
