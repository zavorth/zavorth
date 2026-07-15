/**
 * platform-email — soft-fail SMTP/EMAIL channel.
 * Status reports presence only; send is a permission-gated soft stub.
 * Never logs or returns secret values.
 */

function envPresent(...keys) {
  return keys.some((k) => Boolean(String(process.env[k] || '').trim()));
}

function register(ctx) {
  const logger = ctx.getLogger();

  function statusPayload() {
    const hostPresent = envPresent('EMAIL_SMTP_HOST', 'SMTP_HOST');
    const userPresent = envPresent('EMAIL_SMTP_USER', 'SMTP_USER');
    const passPresent = envPresent('EMAIL_SMTP_PASS', 'SMTP_PASS');
    const tokenPresent = passPresent || envPresent('EMAIL_API_KEY', 'EMAIL_TOKEN');
    const configured = hostPresent && userPresent && passPresent;
    return {
      ok: true,
      platform: 'email',
      tokenPresent,
      configured,
      hostPresent,
      userPresent,
      // Never return host/user/pass values.
      message: configured
        ? 'SMTP credentials present; send available when network/channel permission granted.'
        : 'Set EMAIL_SMTP_HOST (or SMTP_HOST), EMAIL_SMTP_USER, and EMAIL_SMTP_PASS to enable email send.',
      setup: configured
        ? null
        : [
            'export EMAIL_SMTP_HOST=smtp.example.com  # or SMTP_HOST',
            'export EMAIL_SMTP_USER=you@example.com   # or SMTP_USER',
            'export EMAIL_SMTP_PASS=...               # or SMTP_PASS',
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
        message: 'EMAIL/SMTP configuration incomplete',
      };
    }

    const to = String((input && (input.to || input.recipient || input.email)) || '').trim();
    const text = String((input && (input.text || input.message || input.body || input.content)) || '').trim();
    const subject = String((input && (input.subject || input.title)) || 'Zavorth')
      .trim()
      .slice(0, 200);

    if (!to) {
      return { ok: false, delivered: false, platform: 'email', message: 'to (or recipient) is required' };
    }
    if (!text) {
      return { ok: false, delivered: false, platform: 'email', message: 'text (or message/body) is required' };
    }

    const netAllowed = await ctx.requestPermission('network.external', 'SMTP outbound email send');
    if (!netAllowed) {
      const channelAllowed = await ctx.requestPermission('channel.send', 'Email channel send');
      if (!channelAllowed) {
        return {
          ok: false,
          delivered: false,
          blocked: true,
          platform: 'email',
          message: 'network.external / channel.send permission denied',
          reason: 'permission not granted',
        };
      }
    }

    // Soft stub: configuration + permission proven; live SMTP relay is deferred.
    logger.info('platform-email soft send accepted (stub)');
    return {
      ok: true,
      delivered: false,
      stub: true,
      platform: 'email',
      to,
      subject,
      message:
        'Email send stub accepted (credentials present, permission granted). Live SMTP delivery is not performed by this plugin.',
    };
  }

  ctx.bindCapability('platform.email.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.email.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-email.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.email.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          delivered: false,
          platform: 'email',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const channelSpec = {
    id: 'email',
    capabilityId: 'platform.email.send',
    label: 'Email',
    metadata: { pack: 'platforms' },
    send: async (payload) => sendMessage(payload || {}),
  };

  if (typeof ctx.registerPlatform === 'function') {
    ctx.registerPlatform(channelSpec);
  } else {
    ctx.bindChannel(channelSpec);
  }

  logger.info('platform-email registered');
}

module.exports = { register };
