/**
 * platform-imessage — soft-fail iMessage / mac-bridge channel.
 * Soft status is primary; send is a permission-gated stub.
 * Never logs or returns bridge token values.
 */

function present(...keys) {
  return keys.some((k) => Boolean(String(process.env[k] || '').trim()));
}

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const tokenPresent = present('IMESSAGE_BRIDGE_TOKEN', 'IMESSAGE_TOKEN', 'IMESSAGE_ACCESS_TOKEN');
    const bridgePresent = present(
      'IMESSAGE_BRIDGE_URL',
      'IMESSAGE_BRIDGE_SCRIPT',
      'IMESSAGE_NODE_ID',
      'IMESSAGE_ENABLED',
    );
    const macBridge =
      String(process.env.IMESSAGE_BRIDGE_MODE || '')
        .trim()
        .toLowerCase() === 'mac-bridge' || present('IMESSAGE_BRIDGE_SCRIPT', 'IMESSAGE_NODE_ID');
    const configured = tokenPresent || bridgePresent;
    return {
      ok: true,
      platform: 'imessage',
      tokenPresent,
      configured,
      bridgePresent,
      macBridge,
      message: configured
        ? 'iMessage bridge / token presence detected; soft status ready.'
        : 'Set IMESSAGE_* (e.g. IMESSAGE_BRIDGE_URL, IMESSAGE_BRIDGE_SCRIPT, or IMESSAGE_BRIDGE_TOKEN).',
      setup: configured
        ? null
        : [
            'export IMESSAGE_ENABLED=true',
            'export IMESSAGE_BRIDGE_MODE=mac-bridge',
            'export IMESSAGE_BRIDGE_SCRIPT=...  # or IMESSAGE_BRIDGE_URL / IMESSAGE_BRIDGE_TOKEN',
          ],
    };
  }

  async function sendMessage(input) {
    const status = statusPayload();
    if (!status.configured) {
      return {
        ...status,
        ok: false,
        delivered: false,
        message: 'IMESSAGE_* / mac-bridge not configured',
      };
    }

    const to = String((input && (input.to || input.recipient || input.phone)) || '').trim();
    const text = String((input && (input.text || input.message || input.body || input.content)) || '').trim();

    if (!to) {
      return { ok: false, delivered: false, platform: 'imessage', message: 'to (or recipient) is required' };
    }
    if (!text) {
      return { ok: false, delivered: false, platform: 'imessage', message: 'text (or message) is required' };
    }

    const netAllowed = await ctx.requestPermission('network.external', 'iMessage mac-bridge send');
    if (!netAllowed) {
      const channelAllowed = await ctx.requestPermission('channel.send', 'iMessage channel send');
      if (!channelAllowed) {
        return {
          ok: false,
          delivered: false,
          blocked: true,
          platform: 'imessage',
          message: 'network.external / channel.send permission denied',
          reason: 'permission not granted',
        };
      }
    }

    logger.info('platform-imessage soft send accepted (stub)');
    return {
      ok: true,
      delivered: false,
      stub: true,
      platform: 'imessage',
      to,
      message:
        'iMessage soft send accepted (bridge presence detected, permission granted). Live mac-bridge delivery is deferred.',
    };
  }

  ctx.bindCapability('platform.imessage.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.imessage.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-imessage.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.imessage.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          delivered: false,
          platform: 'imessage',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const channelSpec = {
    id: 'imessage',
    capabilityId: 'platform.imessage.send',
    label: 'iMessage',
    metadata: { pack: 'platforms' },
    send: async (payload) => sendMessage(payload || {}),
  };

  if (typeof ctx.registerPlatform === 'function') {
    ctx.registerPlatform(channelSpec);
  } else {
    ctx.bindChannel(channelSpec);
  }

  logger.info('platform-imessage registered');
}

module.exports = { register };
