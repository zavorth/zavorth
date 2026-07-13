function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const keyPresent = Boolean(String(process.env.ANTHROPIC_API_KEY || '').trim());
    return {
      ok: true,
      provider: 'anthropic',
      keyPresent,
      defaultModel: String(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'),
      message: keyPresent
        ? 'ANTHROPIC_API_KEY present; complete available when network permission granted.'
        : 'Set ANTHROPIC_API_KEY to enable Claude completions.',
      setup: keyPresent ? null : ['export ANTHROPIC_API_KEY=...'],
    };
  }

  ctx.bindCapability('provider.anthropic.status', async () => ({ output: statusPayload() }));

  ctx.bindProvider({
    id: 'anthropic',
    capabilityId: 'provider.anthropic.complete',
    name: 'anthropic',
    label: 'Anthropic Claude',
    metadata: { wave: 'W1', pack: 'providers' },
    async complete(input) {
      const status = statusPayload();
      if (!status.keyPresent) {
        return { ...status, ok: false, message: 'ANTHROPIC_API_KEY not set' };
      }
      const allowed = await ctx.requestPermission('network.external', 'Anthropic Messages completion');
      if (!allowed) {
        return { ok: false, message: 'network.external permission denied', blocked: true };
      }
      const prompt = String((input && (input.prompt || input.message || input.input)) || '').trim();
      if (!prompt) return { ok: false, message: 'prompt is required' };
      const model = String((input && input.model) || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514');
      const apiKey = String(process.env.ANTHROPIC_API_KEY || '');
      try {
        const result = await postAnthropic({
          model,
          max_tokens: Math.min(2048, Number((input && input.maxTokens) || 512) || 512),
          messages: [{ role: 'user', content: prompt.slice(0, 32000) }],
        }, apiKey);
        const text = extractAnthropicText(result);
        return { ok: Boolean(text), provider: 'anthropic', model, text, usage: result?.usage || null };
      } catch (error) {
        logger.warn('provider-anthropic complete failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  logger.info('provider-anthropic registered');
}

function extractAnthropicText(result) {
  const content = result?.content;
  if (!Array.isArray(content)) return null;
  const parts = content.filter((c) => c && c.type === 'text').map((c) => c.text);
  return parts.join('') || null;
}

function postAnthropic(body, apiKey) {
  return new Promise((resolve, reject) => {
    const https = require('node:https');
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-provider-anthropic/1.0',
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
