/**
 * platform-teams — soft-fail Microsoft Teams channel.
 * Never logs or returns webhook URL / secret values — only presence booleans.
 */

function present(...keys) {
  return keys.some((k) => Boolean(String(process.env[k] || '').trim()));
}

function register(ctx) {
  const logger = ctx.getLogger();

  function resolveWebhookUrl() {
    return String(
      process.env.TEAMS_WEBHOOK_URL || process.env.MSTEAMS_WEBHOOK_URL || process.env.MICROSOFT_TEAMS_WEBHOOK_URL || '',
    ).trim();
  }

  function statusPayload() {
    const webhookPresent = Boolean(resolveWebhookUrl());
    const appCredsPresent =
      present('TEAMS_APP_ID', 'MICROSOFT_TEAMS_APP_ID') &&
      present('TEAMS_APP_PASSWORD', 'TEAMS_CLIENT_SECRET', 'MICROSOFT_TEAMS_CLIENT_SECRET');
    const tokenPresent = webhookPresent || appCredsPresent || present('MICROSOFT_TEAMS_TOKEN', 'TEAMS_TOKEN');
    const configured = webhookPresent || appCredsPresent;
    return {
      ok: true,
      platform: 'teams',
      tokenPresent,
      configured,
      webhookPresent,
      appCredsPresent,
      message: configured
        ? 'Teams webhook or app credentials present; send available when network permission granted.'
        : 'Set TEAMS_WEBHOOK_URL (or MICROSOFT_TEAMS_WEBHOOK_URL / MSTEAMS_WEBHOOK_URL) or Teams app credentials.',
      setup: configured
        ? null
        : [
            'export TEAMS_WEBHOOK_URL=https://...  # preferred for soft send',
            '# or MICROSOFT_TEAMS_WEBHOOK_URL / MSTEAMS_WEBHOOK_URL / TEAMS_APP_ID + secret',
          ],
    };
  }

  function isSafeWebhookUrl(raw) {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:') return false;
      const host = u.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
      if (host.endsWith('.local')) return false;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/u.test(host)) return false;
      if (host === '0.0.0.0' || host === '169.254.169.254') return false;
      return true;
    } catch {
      return false;
    }
  }

  async function sendMessage(input) {
    const status = statusPayload();
    if (!status.configured) {
      return {
        ...status,
        ok: false,
        delivered: false,
        message: 'TEAMS_WEBHOOK_URL / MICROSOFT_TEAMS_* not configured',
      };
    }

    const text = String((input && (input.text || input.message || input.body || input.content)) || '').trim();
    const title = input && input.title != null ? String(input.title).trim().slice(0, 200) : null;

    if (!text) {
      return { ok: false, delivered: false, platform: 'teams', message: 'text (or message) is required' };
    }

    const allowed = await ctx.requestPermission('network.external', 'Microsoft Teams outbound send');
    if (!allowed) {
      return {
        ok: false,
        delivered: false,
        blocked: true,
        platform: 'teams',
        message: 'network.external permission denied',
        reason: 'network.external not granted',
      };
    }

    const webhook = resolveWebhookUrl();
    if (!webhook) {
      // App-creds path: soft stub only (no Graph client in this plugin).
      logger.info('platform-teams soft send accepted (app-creds stub)');
      return {
        ok: true,
        delivered: false,
        stub: true,
        platform: 'teams',
        message:
          'Teams soft send accepted (app credentials present, permission granted). Live Graph delivery is deferred.',
      };
    }

    if (!isSafeWebhookUrl(webhook)) {
      return {
        ok: false,
        delivered: false,
        platform: 'teams',
        message: 'Teams webhook URL rejected (HTTPS public hosts only)',
      };
    }

    const body = title
      ? { '@type': 'MessageCard', summary: title, title, text: text.slice(0, 4000) }
      : { text: text.slice(0, 4000) };

    try {
      const result = await postJson(webhook, body);
      return {
        ok: true,
        delivered: true,
        platform: 'teams',
        status: result.status,
        // Never return the webhook URL value.
        message: `Teams webhook delivered (HTTP ${result.status})`,
      };
    } catch (error) {
      logger.warn('platform-teams send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        delivered: false,
        platform: 'teams',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  ctx.bindCapability('platform.teams.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.teams.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-teams.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.teams.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          delivered: false,
          platform: 'teams',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const channelSpec = {
    id: 'teams',
    capabilityId: 'platform.teams.send',
    label: 'Microsoft Teams',
    metadata: { pack: 'platforms' },
    send: async (payload) => sendMessage(payload || {}),
  };

  if (typeof ctx.registerPlatform === 'function') {
    ctx.registerPlatform(channelSpec);
  } else {
    ctx.bindChannel(channelSpec);
  }

  logger.info('platform-teams registered');
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const https = require('node:https');
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    if (parsed.protocol !== 'https:') {
      reject(new Error('HTTPS only for Teams webhook'));
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
          'User-Agent': 'zavorth-platform-teams/1.0',
        },
        timeout: 20000,
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
            reject(new Error(`Teams HTTP ${status}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Teams request timed out'));
    });
    req.write(data);
    req.end();
  });
}

module.exports = { register };
