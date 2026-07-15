/**
 * platform-signal — soft-fail Signal channel.
 * Never logs or returns token / account values — only presence booleans.
 */

function present(...keys) {
  return keys.some((k) => Boolean(String(process.env[k] || '').trim()));
}

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const tokenPresent = present('SIGNAL_BRIDGE_TOKEN', 'SIGNAL_TOKEN', 'SIGNAL_ACCESS_TOKEN', 'SIGNAL_ACCOUNT_NUMBER');
    const transportPresent = present('SIGNAL_JSONRPC_URL', 'SIGNAL_CLI_PATH', 'SIGNAL_BRIDGE_URL');
    const accountPresent = present('SIGNAL_ACCOUNT_NUMBER');
    const configured = tokenPresent && (transportPresent || accountPresent);
    return {
      ok: true,
      platform: 'signal',
      tokenPresent,
      configured,
      transportPresent,
      accountPresent,
      message: configured
        ? 'Signal credentials/transport present; send available when permission granted.'
        : 'Set SIGNAL_* credentials (e.g. SIGNAL_ACCOUNT_NUMBER + SIGNAL_JSONRPC_URL / SIGNAL_BRIDGE_TOKEN).',
      setup: configured
        ? null
        : [
            'export SIGNAL_ACCOUNT_NUMBER=+15555550123',
            'export SIGNAL_JSONRPC_URL=unix:///tmp/signal-cli.sock  # or SIGNAL_CLI_PATH / SIGNAL_BRIDGE_TOKEN',
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
        message: 'SIGNAL_* configuration incomplete',
      };
    }

    const to = String((input && (input.to || input.recipient || input.number || input.phone)) || '').trim();
    const text = String((input && (input.text || input.message || input.body || input.content)) || '').trim();

    if (!to) {
      return { ok: false, delivered: false, platform: 'signal', message: 'to (or recipient/number) is required' };
    }
    if (!text) {
      return { ok: false, delivered: false, platform: 'signal', message: 'text (or message) is required' };
    }

    const netAllowed = await ctx.requestPermission('network.external', 'Signal outbound send');
    if (!netAllowed) {
      const channelAllowed = await ctx.requestPermission('channel.send', 'Signal channel send');
      if (!channelAllowed) {
        return {
          ok: false,
          delivered: false,
          blocked: true,
          platform: 'signal',
          message: 'network.external / channel.send permission denied',
          reason: 'permission not granted',
        };
      }
    }

    // Soft send: prove config + permission without exposing secrets or spawning signal-cli here.
    logger.info('platform-signal soft send accepted');
    return {
      ok: true,
      delivered: false,
      stub: true,
      platform: 'signal',
      to,
      message:
        'Signal soft send accepted (credentials present, permission granted). Live signal-cli delivery is deferred to the channel runtime.',
    };
  }

  ctx.bindCapability('platform.signal.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.signal.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-signal.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.signal.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          delivered: false,
          platform: 'signal',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const channelSpec = {
    id: 'signal',
    capabilityId: 'platform.signal.send',
    label: 'Signal',
    metadata: { pack: 'platforms' },
    send: async (payload) => sendMessage(payload || {}),
  };

  if (typeof ctx.registerPlatform === 'function') {
    ctx.registerPlatform(channelSpec);
  } else {
    ctx.bindChannel(channelSpec);
  }

  logger.info('platform-signal registered');
}

module.exports = { register };
