/**
 * platform-discord — Wave 2 soft-fail Discord Bot REST channel.
 * Never logs or returns token values — only presence booleans.
 */

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const tokenPresent = Boolean(String(process.env.DISCORD_BOT_TOKEN || '').trim());
    return {
      ok: true,
      platform: 'discord',
      tokenPresent,
      message: tokenPresent
        ? 'Discord bot token present; send available when network permission granted.'
        : 'Set DISCORD_BOT_TOKEN to enable Discord send.',
      setup: tokenPresent ? null : ['export DISCORD_BOT_TOKEN=...'],
    };
  }

  function resolveToken() {
    return String(process.env.DISCORD_BOT_TOKEN || '').trim();
  }

  async function sendMessage(input) {
    const status = statusPayload();
    if (!status.tokenPresent) {
      return {
        ...status,
        ok: false,
        delivered: false,
        message: 'DISCORD_BOT_TOKEN not set',
      };
    }

    const allowed = await ctx.requestPermission(
      'network.external',
      'Discord REST channel message create',
    );
    if (!allowed) {
      return {
        ok: false,
        delivered: false,
        blocked: true,
        message: 'network.external permission denied',
        reason: 'network.external not granted',
      };
    }

    const channelId = input && (input.channelId ?? input.channel_id ?? input.to);
    const content = String(
      (input && (input.content || input.text || input.message || input.body)) || '',
    ).trim();

    if (channelId === undefined || channelId === null || String(channelId).trim() === '') {
      return { ok: false, delivered: false, message: 'channelId is required' };
    }
    if (!content) {
      return { ok: false, delivered: false, message: 'content (or text/message) is required' };
    }

    const token = resolveToken();
    const path = `/api/v10/channels/${encodeURIComponent(String(channelId))}/messages`;

    try {
      const result = await postJson(
        `https://discord.com${path}`,
        { content: content.slice(0, 2000) },
        token,
      );
      const messageId = result && result.id ? String(result.id) : null;
      const delivered = Boolean(messageId);
      return {
        ok: delivered,
        delivered,
        platform: 'discord',
        channelId: String(channelId),
        messageId,
        message: delivered ? 'Discord message sent' : 'Discord API returned no message id',
      };
    } catch (error) {
      logger.warn('platform-discord send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        delivered: false,
        platform: 'discord',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  ctx.bindCapability('platform.discord.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.discord.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-discord.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.discord.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          delivered: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const channelSpec = {
    id: 'discord',
    capabilityId: 'platform.discord.send',
    label: 'Discord',
    metadata: { wave: 'W2', pack: 'platforms' },
    send: async (payload) => sendMessage(payload || {}),
  };

  if (typeof ctx.registerPlatform === 'function') {
    ctx.registerPlatform(channelSpec);
  } else {
    ctx.bindChannel(channelSpec);
  }

  logger.info('platform-discord registered');
}

function postJson(url, body, botToken) {
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
      reject(new Error('HTTPS only for outbound Discord requests'));
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
          Authorization: `Bot ${botToken}`,
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-platform-discord/1.0',
        },
        timeout: 20000,
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
            // Status only — avoid returning response bodies that might leak context.
            reject(new Error(`Discord HTTP ${status}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Discord request timed out'));
    });
    req.write(data);
    req.end();
  });
}

module.exports = { register };
