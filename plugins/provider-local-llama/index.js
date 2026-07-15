/**
 * Soft-fail Local Llama Provider plugin (OpenAI-compatible HTTP).
 */
function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const configuredBase = String(process.env.LOCAL_LLM_BASE_URL || process.env.LOCAL_LLM_URL || '').trim();
    const baseUrl = String(
      process.env.LOCAL_LLM_BASE_URL || process.env.LOCAL_LLM_URL || 'http://127.0.0.1:8080/v1',
    ).trim();
    const keyPresent = Boolean(configuredBase);
    return {
      ok: true,
      provider: 'local-llama',
      keyPresent,
      baseUrlHost: safeHost(baseUrl),
      defaultModel: String(process.env.LOCAL_LLM_MODEL || 'local-model'),
      message: keyPresent
        ? 'LOCAL_LLM_BASE_URL present; complete available when network.local permission granted.'
        : 'Set LOCAL_LLM_BASE_URL to enable local OpenAI-compatible completions.',
      setup: keyPresent
        ? null
        : ['export LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1', 'optional: LOCAL_LLM_API_KEY, LOCAL_LLM_MODEL'],
    };
  }

  ctx.bindCapability('provider.local_llama.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindProvider({
    id: 'local-llama',
    capabilityId: 'provider.local_llama.complete',
    name: 'local-llama',
    label: 'Local Llama (OpenAI-compat)',
    metadata: { pack: 'providers' },
    async complete(input) {
      const status = statusPayload();
      if (!status.keyPresent) {
        return { ...status, ok: false, message: 'LOCAL_LLM_BASE_URL not set' };
      }
      const allowed = await ctx.requestPermission('network.local', 'Local Llama (OpenAI-compat) chat completion');
      if (!allowed) {
        return { ok: false, message: 'network.local permission denied', blocked: true };
      }
      const prompt = String((input && (input.prompt || input.message || input.input)) || '').trim();
      if (!prompt) {
        return { ok: false, message: 'prompt is required' };
      }
      const model = String((input && input.model) || process.env.LOCAL_LLM_MODEL || 'local-model');
      const baseUrl = String(
        process.env.LOCAL_LLM_BASE_URL || process.env.LOCAL_LLM_URL || 'http://127.0.0.1:8080/v1',
      ).replace(/\/$/u, '');
      const apiKey = String(process.env.LOCAL_LLM_API_KEY || '').trim();
      try {
        const result = await postJson(
          `${baseUrl}/chat/completions`,
          {
            model,
            messages: [{ role: 'user', content: prompt.slice(0, 32000) }],
            max_tokens: Math.min(2048, Number((input && input.maxTokens) || 512) || 512),
          },
          apiKey,
          undefined,
        );
        const text = result?.choices?.[0]?.message?.content || null;
        return {
          ok: Boolean(text),
          provider: 'local-llama',
          model,
          text,
          usage: result?.usage || null,
        };
      } catch (error) {
        logger.warn('provider-local-llama complete failed', {
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

  logger.info('provider-local-llama registered');
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
      'User-Agent': 'zavorth-provider-local-llama/1.0',
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
