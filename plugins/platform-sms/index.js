/**
 * platform-sms — soft-fail Twilio-style SMS channel.
 * Never logs or returns SID / auth token values — only presence booleans.
 */

function register(ctx) {
  const logger = ctx.getLogger();

  function resolveSid() {
    return String(process.env.TWILIO_ACCOUNT_SID || process.env.SMS_ACCOUNT_SID || '').trim();
  }

  function resolveAuthToken() {
    return String(process.env.TWILIO_AUTH_TOKEN || process.env.SMS_AUTH_TOKEN || '').trim();
  }

  function resolveFrom() {
    return String(process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || '').trim();
  }

  function statusPayload() {
    const sidPresent = Boolean(resolveSid());
    const tokenPresent = Boolean(resolveAuthToken());
    const fromPresent = Boolean(resolveFrom());
    const configured = sidPresent && tokenPresent;
    return {
      ok: true,
      platform: 'sms',
      tokenPresent,
      configured,
      sidPresent,
      fromPresent,
      message: configured
        ? 'Twilio SID + auth token present; send available when network permission granted.'
        : 'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN (optional TWILIO_FROM_NUMBER).',
      setup: configured
        ? null
        : [
            'export TWILIO_ACCOUNT_SID=AC...',
            'export TWILIO_AUTH_TOKEN=...',
            'export TWILIO_FROM_NUMBER=+1...  # optional default From',
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
        message: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set',
      };
    }

    const to = String((input && (input.to || input.phone || input.recipient)) || '')
      .trim()
      .replace(/[^\d+]/gu, '');
    const text = String((input && (input.text || input.message || input.body || input.content)) || '').trim();
    const from = String((input && (input.from || input.fromNumber || input.from_number)) || '').trim() || resolveFrom();

    if (!to) {
      return { ok: false, delivered: false, platform: 'sms', message: 'to (or phone) is required' };
    }
    if (!text) {
      return { ok: false, delivered: false, platform: 'sms', message: 'text (or message) is required' };
    }
    if (!from) {
      return {
        ok: false,
        delivered: false,
        platform: 'sms',
        message: 'from number missing; set TWILIO_FROM_NUMBER or pass from',
      };
    }

    const allowed = await ctx.requestPermission('network.external', 'Twilio SMS Messages API send');
    if (!allowed) {
      return {
        ok: false,
        delivered: false,
        blocked: true,
        platform: 'sms',
        message: 'network.external permission denied',
        reason: 'network.external not granted',
      };
    }

    const sid = resolveSid();
    const auth = resolveAuthToken();
    // Soft-fail live path: attempt Twilio REST; never echo auth material.
    try {
      const result = await postTwilioMessage(sid, auth, {
        To: to,
        From: from,
        Body: text.slice(0, 1600),
      });
      const messageSid = result && result.sid ? String(result.sid) : null;
      const delivered = Boolean(messageSid);
      return {
        ok: delivered,
        delivered,
        platform: 'sms',
        to,
        messageSid,
        message: delivered ? 'SMS message sent' : 'Twilio API returned no message sid',
      };
    } catch (error) {
      logger.warn('platform-sms send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        delivered: false,
        platform: 'sms',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  ctx.bindCapability('platform.sms.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.sms.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-sms.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.sms.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          delivered: false,
          platform: 'sms',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const channelSpec = {
    id: 'sms',
    capabilityId: 'platform.sms.send',
    label: 'SMS',
    metadata: { pack: 'platforms' },
    send: async (payload) => sendMessage(payload || {}),
  };

  if (typeof ctx.registerPlatform === 'function') {
    ctx.registerPlatform(channelSpec);
  } else {
    ctx.bindChannel(channelSpec);
  }

  logger.info('platform-sms registered');
}

function postTwilioMessage(accountSid, authToken, fields) {
  return new Promise((resolve, reject) => {
    const https = require('node:https');
    const body = new URLSearchParams(fields).toString();
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const path = `/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.twilio.com',
        port: 443,
        path,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'zavorth-platform-sms/1.0',
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
              resolve(raw ? JSON.parse(raw) : {});
            } catch (error) {
              reject(error);
            }
          } else {
            // Status only — avoid returning bodies that might echo request context.
            reject(new Error(`Twilio HTTP ${status}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Twilio request timed out'));
    });
    req.write(body);
    req.end();
  });
}

module.exports = { register };
