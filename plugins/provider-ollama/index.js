/**
 * Soft-fail Ollama Provider plugin (OpenAI-compatible HTTP).
 */
function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const baseUrl = String(
      process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434/v1',
    ).trim();
    return {
      ok: true,
      provider: 'ollama',
      keyPresent: true,
      baseUrlHost: safeHost(baseUrl),
      defaultModel: String(process.env.OLLAMA_MODEL || 'llama3.2'),
      message: 'Ollama endpoint ready; complete available when network.local permission granted.',
      setup: null,
    };
  }

  ctx.bindCapability('provider.ollama.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindProvider({
    id: 'ollama',
    capabilityId: 'provider.ollama.complete',
    name: 'ollama',
    label: 'Ollama (local)',
    metadata: { pack: 'providers' },
    async complete(input) {
      const status = statusPayload();

      const allowed = await ctx.requestPermission('network.local', 'Ollama (local) chat completion');
      if (!allowed) {
        return { ok: false, message: 'network.local permission denied', blocked: true };
      }
      const prompt = String((input && (input.prompt || input.message || input.input)) || '').trim();
      if (!prompt) {
        return { ok: false, message: 'prompt is required' };
      }
      const model = String((input && input.model) || process.env.OLLAMA_MODEL || 'llama3.2');
      const baseUrl = String(
        process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434/v1',
      ).replace(/\/$/u, '');
      const apiKey = String('').trim();
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
          provider: 'ollama',
          model,
          text,
          usage: result?.usage || null,
        };
      } catch (error) {
        logger.warn('provider-ollama complete failed', {
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

  logger.info('provider-ollama registered');
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
      'User-Agent': 'zavorth-provider-ollama/1.0',
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
