function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const key = String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || '').trim();
    return {
      ok: true,
      provider: 'xai',
      keyPresent: Boolean(key),
      defaultModel: String(process.env.XAI_MODEL || 'grok-2-latest'),
      message: key
        ? 'xAI key present; complete available when network permission granted.'
        : 'Set XAI_API_KEY or GROK_API_KEY to enable Grok completions.',
      setup: key ? null : ['export XAI_API_KEY=...'],
    };
  }

  ctx.bindCapability('provider.xai.status', async () => ({ output: statusPayload() }));

  ctx.bindProvider({
    id: 'xai',
    capabilityId: 'provider.xai.complete',
    name: 'xai',
    label: 'xAI Grok',
    metadata: { wave: 'W1', pack: 'providers' },
    async complete(input) {
      const status = statusPayload();
      if (!status.keyPresent) {
        return { ...status, ok: false, message: 'XAI_API_KEY not set' };
      }
      const allowed = await ctx.requestPermission('network.external', 'xAI Grok chat completion');
      if (!allowed) {
        return { ok: false, message: 'network.external permission denied', blocked: true };
      }
      const prompt = String((input && (input.prompt || input.message || input.input)) || '').trim();
      if (!prompt) return { ok: false, message: 'prompt is required' };
      const model = String((input && input.model) || process.env.XAI_MODEL || 'grok-2-latest');
      const apiKey = String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || '');
      try {
        const result = await postJson('https://api.x.ai/v1/chat/completions', {
          model,
          messages: [{ role: 'user', content: prompt.slice(0, 32000) }],
          max_tokens: Math.min(2048, Number((input && input.maxTokens) || 512) || 512),
        }, apiKey);
        const text = result?.choices?.[0]?.message?.content || null;
        return { ok: Boolean(text), provider: 'xai', model, text, usage: result?.usage || null };
      } catch (error) {
        logger.warn('provider-xai complete failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  logger.info('provider-xai registered');
}

function postJson(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    const https = require('node:https');
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = https.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        path: parsed.pathname,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-provider-xai/1.0',
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
