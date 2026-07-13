const https = require('node:https');

function register(ctx) {
  const logger = ctx.getLogger();

  function resolveToken() {
    return String(
      process.env.WHATSAPP_TOKEN ||
        process.env.WHATSAPP_CLOUD_TOKEN ||
        process.env.META_WHATSAPP_TOKEN ||
        '',
    ).trim();
  }

  function resolvePhoneNumberId(input) {
    const fromInput =
      input && (input.phoneNumberId || input.phone_number_id)
        ? String(input.phoneNumberId || input.phone_number_id).trim()
        : '';
    if (fromInput) return fromInput;
    return String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  }

  function statusPayload() {
    const tokenPresent = Boolean(resolveToken());
    const phoneNumberIdPresent = Boolean(String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim());
    const ready = tokenPresent && phoneNumberIdPresent;
    return {
      ok: true,
      channel: 'whatsapp',
      tokenPresent,
      phoneNumberIdPresent,
      ready,
      // Never return token or phone number id values — presence only.
      message: ready
        ? 'WhatsApp credentials present; send available when network.external is granted.'
        : 'Set WHATSAPP_TOKEN (or WHATSAPP_CLOUD_TOKEN / META_WHATSAPP_TOKEN) and WHATSAPP_PHONE_NUMBER_ID.',
      setup: ready
        ? null
        : [
            'export WHATSAPP_TOKEN=...   # or WHATSAPP_CLOUD_TOKEN / META_WHATSAPP_TOKEN',
            'export WHATSAPP_PHONE_NUMBER_ID=...',
          ],
    };
  }

  async function sendMessage(input) {
    const status = statusPayload();
    const token = resolveToken();
    const phoneNumberId = resolvePhoneNumberId(input || {});

    if (!token) {
      return {
        ok: false,
        delivered: false,
        channel: 'whatsapp',
        message: 'WhatsApp token not set (WHATSAPP_TOKEN / WHATSAPP_CLOUD_TOKEN / META_WHATSAPP_TOKEN)',
        setup: status.setup,
      };
    }
    if (!phoneNumberId) {
      return {
        ok: false,
        delivered: false,
        channel: 'whatsapp',
        message: 'phoneNumberId missing; set WHATSAPP_PHONE_NUMBER_ID or pass phoneNumberId',
        setup: status.setup,
      };
    }

    const allowed = await ctx.requestPermission(
      'network.external',
      'Send message via WhatsApp Cloud API',
    );
    if (!allowed) {
      return {
        ok: false,
        delivered: false,
        channel: 'whatsapp',
        blocked: true,
        message: 'network.external permission denied',
        reason: 'network.external not granted',
      };
    }

    const to = String((input && (input.to || input.phone || input.recipient)) || '')
      .trim()
      .replace(/[^\d+]/gu, '');
    const text = String(
      (input && (input.text || input.message || input.body || input.content)) || '',
    ).trim();

    if (!to) {
      return { ok: false, delivered: false, channel: 'whatsapp', message: 'to/phone is required' };
    }
    if (!text) {
      return {
        ok: false,
        delivered: false,
        channel: 'whatsapp',
        message: 'text/message/body is required',
      };
    }

    const path = `/v19.0/${encodeURIComponent(phoneNumberId)}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text.slice(0, 4096) },
    };

    try {
      const result = await postWhatsApp(path, token, body);
      const messageId =
        result && Array.isArray(result.messages) && result.messages[0]
          ? result.messages[0].id
          : null;
      return {
        ok: true,
        delivered: true,
        channel: 'whatsapp',
        to,
        messageId,
        // Do not echo token or full API secrets.
        message: messageId ? `WhatsApp message sent (${messageId})` : 'WhatsApp message sent',
      };
    } catch (error) {
      logger.warn('platform-whatsapp send failed', { error: errMsg(error) });
      return {
        ok: false,
        delivered: false,
        channel: 'whatsapp',
        message: errMsg(error),
      };
    }
  }

  ctx.bindCapability('platform.whatsapp.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.whatsapp.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-whatsapp.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.whatsapp.send failed', { error: errMsg(error) });
      return { output: { ok: false, delivered: false, message: errMsg(error) } };
    }
  });

  ctx.bindChannel({
    id: 'whatsapp',
    capabilityId: 'platform.whatsapp.send',
    label: 'WhatsApp',
    metadata: { wave: 'W2', pack: 'platform' },
    send: async (payload) => sendMessage(payload || {}),
  });

  logger.info('platform-whatsapp registered');
}

function postWhatsApp(apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: 'POST',
        hostname: 'graph.facebook.com',
        path: apiPath,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Authorization: `Bearer ${token}`,
          'User-Agent': 'zavorth-platform-whatsapp/1.0',
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
            // Never include Authorization material; API error bodies are safe to truncate.
            reject(new Error(`WhatsApp HTTP ${status}: ${raw.slice(0, 240)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('WhatsApp request timed out'));
    });
    req.write(data);
    req.end();
  });
}

function errMsg(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = { register };
