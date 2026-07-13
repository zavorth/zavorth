function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const keyPresent = Boolean(String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim());
    return {
      ok: true,
      provider: 'gemini',
      keyPresent,
      defaultModel: String(process.env.GEMINI_MODEL || 'gemini-2.0-flash'),
      message: keyPresent
        ? 'Gemini key present; complete available when network permission granted.'
        : 'Set GEMINI_API_KEY or GOOGLE_API_KEY to enable Gemini completions.',
      setup: keyPresent ? null : ['export GEMINI_API_KEY=...'],
    };
  }

  ctx.bindCapability('provider.gemini.status', async () => ({ output: statusPayload() }));

  ctx.bindProvider({
    id: 'gemini',
    capabilityId: 'provider.gemini.complete',
    name: 'gemini',
    label: 'Google Gemini',
    metadata: { wave: 'W1', pack: 'providers' },
    async complete(input) {
      const status = statusPayload();
      if (!status.keyPresent) {
        return { ...status, ok: false, message: 'GEMINI_API_KEY not set' };
      }
      const allowed = await ctx.requestPermission('network.external', 'Gemini generateContent');
      if (!allowed) {
        return { ok: false, message: 'network.external permission denied', blocked: true };
      }
      const prompt = String((input && (input.prompt || input.message || input.input)) || '').trim();
      if (!prompt) return { ok: false, message: 'prompt is required' };
      const model = String((input && input.model) || process.env.GEMINI_MODEL || 'gemini-2.0-flash');
      const apiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '');
      try {
        const path = `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const result = await postHttps('generativelanguage.googleapis.com', path, {
          contents: [{ role: 'user', parts: [{ text: prompt.slice(0, 32000) }] }],
        });
        const text = result?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || null;
        return { ok: Boolean(text), provider: 'gemini', model, text };
      } catch (error) {
        logger.warn('provider-gemini complete failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  logger.info('provider-gemini registered');
}

function postHttps(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const https = require('node:https');
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: 'POST',
        hostname,
        path,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-provider-gemini/1.0',
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
