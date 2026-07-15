/**
 * platform-matrix — soft-fail Matrix Client-Server API channel.
 * Never logs or returns token / homeserver values — only presence booleans.
 */

function register(ctx) {
  const logger = ctx.getLogger();

  function resolveHomeserver() {
    return String(process.env.MATRIX_HOMESERVER || process.env.MATRIX_BASE_URL || '')
      .trim()
      .replace(/\/$/u, '');
  }

  function resolveToken() {
    return String(process.env.MATRIX_ACCESS_TOKEN || '').trim();
  }

  function statusPayload() {
    const homeserverPresent = Boolean(resolveHomeserver());
    const tokenPresent = Boolean(resolveToken());
    const configured = homeserverPresent && tokenPresent;
    return {
      ok: true,
      platform: 'matrix',
      tokenPresent,
      configured,
      homeserverPresent,
      message: configured
        ? 'Matrix homeserver + access token present; send available when network permission granted.'
        : 'Set MATRIX_HOMESERVER (or MATRIX_BASE_URL) and MATRIX_ACCESS_TOKEN.',
      setup: configured
        ? null
        : [
            'export MATRIX_HOMESERVER=https://matrix.example.com  # or MATRIX_BASE_URL',
            'export MATRIX_ACCESS_TOKEN=...',
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
        message: 'MATRIX_HOMESERVER / MATRIX_ACCESS_TOKEN not fully configured',
      };
    }

    const allowed = await ctx.requestPermission('network.external', 'Matrix Client-Server room message send');
    if (!allowed) {
      return {
        ok: false,
        delivered: false,
        blocked: true,
        platform: 'matrix',
        message: 'network.external permission denied',
        reason: 'network.external not granted',
      };
    }

    const roomId =
      input && (input.roomId ?? input.room_id ?? input.room ?? input.to ?? process.env.MATRIX_DEFAULT_ROOM_ID);
    const text = String((input && (input.text || input.message || input.body || input.content)) || '').trim();

    if (roomId === undefined || roomId === null || String(roomId).trim() === '') {
      return { ok: false, delivered: false, platform: 'matrix', message: 'roomId (or room_id) is required' };
    }
    if (!text) {
      return { ok: false, delivered: false, platform: 'matrix', message: 'text (or message) is required' };
    }

    const base = resolveHomeserver();
    const token = resolveToken();
    const txnId = `zavorth-${Date.now()}`;
    const path = `/_matrix/client/v3/rooms/${encodeURIComponent(String(roomId))}/send/m.room.message/${encodeURIComponent(txnId)}`;

    try {
      let parsedBase;
      try {
        parsedBase = new URL(base);
      } catch {
        return {
          ok: false,
          delivered: false,
          platform: 'matrix',
          message: 'MATRIX_HOMESERVER / MATRIX_BASE_URL is not a valid URL',
        };
      }
      if (parsedBase.protocol !== 'https:') {
        return {
          ok: false,
          delivered: false,
          platform: 'matrix',
          message: 'Matrix homeserver must be HTTPS',
        };
      }

      const result = await putJson(
        `${parsedBase.origin}${path}`,
        { msgtype: 'm.text', body: text.slice(0, 4000) },
        token,
      );
      const eventId = result && result.event_id ? String(result.event_id) : null;
      const delivered = Boolean(eventId);
      return {
        ok: delivered,
        delivered,
        platform: 'matrix',
        roomId: String(roomId),
        eventId,
        message: delivered ? 'Matrix message sent' : 'Matrix API returned no event_id',
      };
    } catch (error) {
      logger.warn('platform-matrix send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        delivered: false,
        platform: 'matrix',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  ctx.bindCapability('platform.matrix.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('platform.matrix.send', async ({ input }) => {
    try {
      const result = await sendMessage(input || {});
      return {
        output: result,
        receipts: result.ok ? ['platform-matrix.receipt'] : [],
      };
    } catch (error) {
      logger.warn('platform.matrix.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          delivered: false,
          platform: 'matrix',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const channelSpec = {
    id: 'matrix',
    capabilityId: 'platform.matrix.send',
    label: 'Matrix',
    metadata: { pack: 'platforms' },
    send: async (payload) => sendMessage(payload || {}),
  };

  if (typeof ctx.registerPlatform === 'function') {
    ctx.registerPlatform(channelSpec);
  } else {
    ctx.bindChannel(channelSpec);
  }

  logger.info('platform-matrix registered');
}

function putJson(url, body, accessToken) {
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
      reject(new Error('HTTPS only for outbound Matrix requests'));
      return;
    }
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: 'PUT',
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-platform-matrix/1.0',
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
            reject(new Error(`Matrix HTTP ${status}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Matrix request timed out'));
    });
    req.write(data);
    req.end();
  });
}

module.exports = { register };
