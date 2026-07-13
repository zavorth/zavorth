const https = require('node:https');

function register(ctx) {
  const logger = ctx.getLogger();

  function resolveConfiguredUrl() {
    return String(
      process.env.ZAVORTH_PLATFORM_WEBHOOK_URL || process.env.PLATFORM_WEBHOOK_URL || '',
    ).trim();
  }

  function statusPayload() {
    const urlConfigured = Boolean(resolveConfiguredUrl());
    return {
      ok: true,
      channel: 'webhook',
      // Never return URL values — presence only.
      urlConfigured,
      ready: urlConfigured,
      message: urlConfigured
        ? 'Webhook URL configured; send available when network.external is granted.'
        : 'Set ZAVORTH_PLATFORM_WEBHOOK_URL or PLATFORM_WEBHOOK_URL to enable default deliver.',
      setup: urlConfigured
        ? null
        : [
            'export ZAVORTH_PLATFORM_WEBHOOK_URL=https://...  # or PLATFORM_WEBHOOK_URL',
            'Optional per-call input.url (HTTPS public hosts only)',
          ],
    };
  }

  function resolveTargetUrl(input) {
    const override = input && input.url ? String(input.url).trim() : '';
    if (override) {
      if (!isSafeWebhookUrl(override)) {
        return {
          ok: false,
          url: null,
          error: 'Webhook URL rejected (HTTPS only; public hosts only; no localhost/private)',
        };
      }
      return { ok: true, url: override, source: 'input' };
    }
    const configured = resolveConfiguredUrl();
    if (!configured) {
      return {
        ok: false,
        url: null,
        error:
          'No webhook URL configured (ZAVORTH_PLATFORM_WEBHOOK_URL / PLATFORM_WEBHOOK_URL) and no input.url',
      };
    }
    if (!isSafeWebhookUrl(configured)) {
      return {
        ok: false,
        url: null,
        error: 'Configured webhook URL rejected (HTTPS only; public hosts only)',
      };
    }
    return { ok: true, url: configured, source: 'env' };
  }

  function buildBody(input) {
    const text = String(
      (input && (input.text || input.message || input.body || input.content)) || '',
    ).trim();
    const title = input && input.title != null ? String(input.title).trim().slice(0, 200) : null;
    const severity =
      input && input.severity != null
        ? String(input.severity).toLowerCase().slice(0, 20)
        : null;
    const extra =
      input && input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
        ? input.payload
        : null;

    // Slack-style { text } with optional metadata; raw extra payload merged last.
    const body = {
      text: text || (title ? title : ''),
    };
    if (title) body.title = title;
    if (severity) body.severity = severity;
    if (extra) Object.assign(body, extra);
    // Prefer explicit text/title/severity over colliding keys in payload.
    if (text) body.text = text;
    if (title) body.title = title;
    if (severity) body.severity = severity;
    return body;
  }

  async function sendMessage(input) {
    const payload = input || {};
    const target = resolveTargetUrl(payload);
    if (!target.ok) {
      return {
        ok: false,
        delivered: false,
        channel: 'webhook',
        message: target.error,
        setup: statusPayload().setup,
      };
    }

    const body = buildBody(payload);
    if (!String(body.text || '').trim() && !payload.payload) {
      return {
        ok: false,
        delivered: false,
        channel: 'webhook',
        message: 'text (or title/payload) is required',
      };
    }

    const allowed = await ctx.requestPermission(
      'network.external',
      'POST JSON to platform webhook URL',
    );
    if (!allowed) {
      return {
        ok: false,
        delivered: false,
        channel: 'webhook',
        blocked: true,
        message: 'network.external permission denied',
        reason: 'network.external not granted',
      };
    }

    try {
      const result = await postJson(target.url, body);
      return {
        ok: true,
        delivered: true,
        channel: 'webhook',
        source: target.source,
        status: result.status,
        // Never return the webhook URL value.
        message: `Webhook delivered (HTTP ${result.status})`,
      };
    } catch (error) {
      logger.warn('platform-webhook send failed', { error: errMsg(error) });
      return {
        ok: false,
        delivered: false,
        channel: 'webhook',
        message: errMsg(error),
      };
    }
  }

  ctx.bindCapability('platform.webhook.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.webhook.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-webhook.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.webhook.send failed', { error: errMsg(error) });
      return { output: { ok: false, delivered: false, message: errMsg(error) } };
    }
  });

  ctx.bindChannel({
    id: 'webhook',
    capabilityId: 'platform.webhook.send',
    label: 'Webhook',
    metadata: { wave: 'W2', pack: 'platform' },
    send: async (payload) => sendMessage(payload || {}),
  });

  logger.info('platform-webhook registered');
}

/**
 * SSRF-safe webhook URL checks (same spirit as notify-outbox):
 * https only; block localhost, loopback, *.local, private IPv4, link-local metadata.
 */
function isSafeWebhookUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host.endsWith('.local')) return false;
    // Block obvious private IPv4
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/u.test(host)) return false;
    if (host === '0.0.0.0' || host === '169.254.169.254') return false;
    return true;
  } catch {
    return false;
  }
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    if (parsed.protocol !== 'https:') {
      reject(new Error('HTTPS only'));
      return;
    }
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-platform-webhook/1.0',
        },
        timeout: 15000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const status = res.statusCode || 0;
          const raw = Buffer.concat(chunks).toString('utf8');
          if (status >= 200 && status < 300) {
            resolve({ status, body: raw });
          } else {
            reject(new Error(`Webhook HTTP ${status}: ${raw.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Webhook request timed out'));
    });
    req.write(data);
    req.end();
  });
}

function errMsg(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = { register };
