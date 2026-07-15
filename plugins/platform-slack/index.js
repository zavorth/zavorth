/**
 * platform-slack — soft-fail Slack Web API channel.
 * Never logs or returns token values — only presence booleans.
 */

function register(ctx) {
  const logger = ctx.getLogger();

  function resolveToken() {
    return String(process.env.SLACK_BOT_TOKEN || process.env.SLACK_TOKEN || '').trim();
  }

  function statusPayload() {
    const tokenPresent = Boolean(resolveToken());
    return {
      ok: true,
      platform: 'slack',
      tokenPresent,
      configured: tokenPresent,
      message: tokenPresent
        ? 'Slack bot token present; send available when network permission granted.'
        : 'Set SLACK_BOT_TOKEN or SLACK_TOKEN to enable Slack send.',
      setup: tokenPresent ? null : ['export SLACK_BOT_TOKEN=xoxb-...'],
    };
  }

  async function sendMessage(input) {
    const status = statusPayload();
    if (!status.tokenPresent) {
      return {
        ...status,
        ok: false,
        delivered: false,
        message: 'SLACK_BOT_TOKEN / SLACK_TOKEN not set',
      };
    }

    const allowed = await ctx.requestPermission('network.external', 'Slack Web API chat.postMessage');
    if (!allowed) {
      return {
        ok: false,
        delivered: false,
        blocked: true,
        platform: 'slack',
        message: 'network.external permission denied',
        reason: 'network.external not granted',
      };
    }

    const channel = input && (input.channel ?? input.channelId ?? input.channel_id ?? input.to);
    const text = String((input && (input.text || input.message || input.body || input.content)) || '').trim();

    if (channel === undefined || channel === null || String(channel).trim() === '') {
      return { ok: false, delivered: false, platform: 'slack', message: 'channel is required' };
    }
    if (!text) {
      return { ok: false, delivered: false, platform: 'slack', message: 'text (or message) is required' };
    }

    const token = resolveToken();
    try {
      const result = await postSlackChat(token, {
        channel: String(channel),
        text: text.slice(0, 4000),
      });
      const delivered = Boolean(result && result.ok === true);
      return {
        ok: delivered,
        delivered,
        platform: 'slack',
        channel: String(channel),
        ts: result?.ts ?? null,
        message: delivered ? 'Slack message sent' : 'Slack API returned ok=false',
      };
    } catch (error) {
      logger.warn('platform-slack send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        delivered: false,
        platform: 'slack',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  ctx.bindCapability('platform.slack.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.slack.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-slack.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.slack.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          delivered: false,
          platform: 'slack',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const channelSpec = {
    id: 'slack',
    capabilityId: 'platform.slack.send',
    label: 'Slack',
    metadata: { pack: 'platforms' },
    send: async (payload) => sendMessage(payload || {}),
  };

  if (typeof ctx.registerPlatform === 'function') {
    ctx.registerPlatform(channelSpec);
  } else {
    ctx.bindChannel(channelSpec);
  }

  logger.info('platform-slack registered');
}

function postSlackChat(token, body) {
  return new Promise((resolve, reject) => {
    const https = require('node:https');
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: 'POST',
        hostname: 'slack.com',
        port: 443,
        path: '/api/chat.postMessage',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-platform-slack/1.0',
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
            reject(new Error(`Slack HTTP ${status}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Slack request timed out'));
    });
    req.write(data);
    req.end();
  });
}

module.exports = { register };
