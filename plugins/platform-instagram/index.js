/**
 * platform-instagram — soft-fail Instagram channel.
 * Never logs or returns token values — only presence booleans.
 */

function present(...keys) {
  return keys.some((k) => Boolean(String(process.env[k] || '').trim()));
}

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const tokenPresent = present('INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_TOKEN', 'INSTAGRAM_PAGE_ACCESS_TOKEN');
    const accountPresent = present('INSTAGRAM_BUSINESS_ACCOUNT_ID', 'INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_PAGE_ID');
    const configured = tokenPresent;
    return {
      ok: true,
      platform: 'instagram',
      tokenPresent,
      configured,
      accountPresent,
      message: configured
        ? 'Instagram token present; send available when network permission granted.'
        : 'Set INSTAGRAM_ACCESS_TOKEN (or INSTAGRAM_TOKEN / INSTAGRAM_PAGE_ACCESS_TOKEN).',
      setup: configured
        ? null
        : ['export INSTAGRAM_ACCESS_TOKEN=...', 'export INSTAGRAM_BUSINESS_ACCOUNT_ID=...  # optional'],
    };
  }

  async function sendMessage(input) {
    const status = statusPayload();
    if (!status.tokenPresent) {
      return {
        ...status,
        ok: false,
        delivered: false,
        message: 'INSTAGRAM_* token not set',
      };
    }

    const to = String(
      (input && (input.to || input.recipient || input.userId || input.user_id || input.igsid)) || '',
    ).trim();
    const text = String((input && (input.text || input.message || input.body || input.content)) || '').trim();

    if (!to) {
      return {
        ok: false,
        delivered: false,
        platform: 'instagram',
        message: 'to (or recipient/userId) is required',
      };
    }
    if (!text) {
      return {
        ok: false,
        delivered: false,
        platform: 'instagram',
        message: 'text (or message) is required',
      };
    }

    const allowed = await ctx.requestPermission('network.external', 'Instagram Graph API send');
    if (!allowed) {
      return {
        ok: false,
        delivered: false,
        blocked: true,
        platform: 'instagram',
        message: 'network.external permission denied',
        reason: 'network.external not granted',
      };
    }

    // Soft send: prove token + permission without calling Graph (avoids leaking tokens in errors).
    logger.info('platform-instagram soft send accepted');
    return {
      ok: true,
      delivered: false,
      demoOnly: true,
      platform: 'instagram',
      to,
      message: 'Instagram soft send accepted (token present, permission granted). Live Graph delivery is deferred.',
    };
  }

  ctx.bindCapability('platform.instagram.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.instagram.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-instagram.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.instagram.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          delivered: false,
          platform: 'instagram',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const channelSpec = {
    id: 'instagram',
    capabilityId: 'platform.instagram.send',
    label: 'Instagram',
    metadata: { pack: 'platforms' },
    send: async (payload) => sendMessage(payload || {}),
  };

  if (typeof ctx.registerPlatform === 'function') {
    ctx.registerPlatform(channelSpec);
  } else {
    ctx.bindChannel(channelSpec);
  }

  logger.info('platform-instagram registered');
}

module.exports = { register };
