const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const { randomUUID } = require('node:crypto');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const storePath = path.join(workspace, '.zavorth', 'notify-outbox', 'outbox.json');

  function ensureStore() {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(storePath)) {
      fs.writeFileSync(
        storePath,
        `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`,
        'utf8',
      );
    }
  }

  function readStore() {
    try {
      ensureStore();
      const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      return { version: 1, items: Array.isArray(raw.items) ? raw.items : [] };
    } catch {
      return { version: 1, items: [] };
    }
  }

  function writeStore(store) {
    ensureStore();
    fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }

  function webhookConfig() {
    const slack = String(process.env.SLACK_WEBHOOK_URL || '').trim();
    const discord = String(process.env.DISCORD_WEBHOOK_URL || '').trim();
    const generic = String(process.env.ZAVORTH_NOTIFY_WEBHOOK_URL || '').trim();
    return {
      slackConfigured: Boolean(slack),
      discordConfigured: Boolean(discord),
      genericConfigured: Boolean(generic),
      // Never return URL values.
      anyConfigured: Boolean(slack || discord || generic),
      preferred: slack ? 'slack' : discord ? 'discord' : generic ? 'generic' : null,
    };
  }

  function resolveWebhookUrl(channel) {
    const ch = String(channel || '').toLowerCase();
    if (ch === 'slack') return String(process.env.SLACK_WEBHOOK_URL || '').trim() || null;
    if (ch === 'discord') return String(process.env.DISCORD_WEBHOOK_URL || '').trim() || null;
    const slack = String(process.env.SLACK_WEBHOOK_URL || '').trim();
    if (slack) return slack;
    const discord = String(process.env.DISCORD_WEBHOOK_URL || '').trim();
    if (discord) return discord;
    const generic = String(process.env.ZAVORTH_NOTIFY_WEBHOOK_URL || '').trim();
    return generic || null;
  }

  ctx.bindCapability('notify.status', async () => {
    try {
      const store = readStore();
      const pending = store.items.filter((i) => i.status === 'pending').length;
      const delivered = store.items.filter((i) => i.status === 'delivered').length;
      const failed = store.items.filter((i) => i.status === 'failed').length;
      return {
        output: {
          ok: true,
          storePath,
          total: store.items.length,
          pending,
          delivered,
          failed,
          webhook: webhookConfig(),
          message: webhookConfig().anyConfigured
            ? 'Outbox ready; webhook configured for deliver.'
            : 'Outbox ready locally. Set SLACK_WEBHOOK_URL or DISCORD_WEBHOOK_URL to enable deliver.',
        },
        artifacts: [storePath],
      };
    } catch (error) {
      logger.warn('notify.status failed', { error: errMsg(error) });
      return { output: { ok: false, message: errMsg(error) } };
    }
  });

  ctx.bindCapability('notify.enqueue', async ({ input }) => {
    try {
      const title = String((input && (input.title || input.subject)) || '').trim();
      const body = String((input && (input.body || input.message || input.text)) || '').trim();
      if (!title && !body) {
        return { output: { ok: false, message: 'title or body is required' } };
      }
      const store = readStore();
      const item = {
        id: randomUUID(),
        title: (title || body.slice(0, 80)).slice(0, 200),
        body: body.slice(0, 4000),
        channel: String((input && input.channel) || 'local').slice(0, 40),
        severity: String((input && input.severity) || 'info').toLowerCase().slice(0, 20),
        status: 'pending',
        createdAt: new Date().toISOString(),
        deliveredAt: null,
        lastError: null,
      };
      store.items.unshift(item);
      // Cap store growth
      store.items = store.items.slice(0, 500);
      writeStore(store);
      return {
        output: {
          ok: true,
          item,
          pending: store.items.filter((i) => i.status === 'pending').length,
          storePath,
        },
        artifacts: [storePath],
        receipts: ['notify-outbox.receipt'],
      };
    } catch (error) {
      logger.warn('notify.enqueue failed', { error: errMsg(error) });
      return { output: { ok: false, message: errMsg(error) } };
    }
  });

  ctx.bindCapability('notify.list', async ({ input }) => {
    try {
      const limit = Math.max(1, Math.min(100, Number((input && input.limit) || 30) || 30));
      const status = input && input.status ? String(input.status).toLowerCase() : null;
      const store = readStore();
      let items = store.items.slice();
      if (status) {
        items = items.filter((i) => i.status === status);
      }
      items = items.slice(0, limit);
      return {
        output: {
          ok: true,
          count: items.length,
          items,
          storePath,
        },
        artifacts: [storePath],
      };
    } catch (error) {
      logger.warn('notify.list failed', { error: errMsg(error) });
      return { output: { ok: false, items: [], message: errMsg(error) } };
    }
  });

  ctx.bindCapability('notify.deliver', async ({ input }) => {
    try {
      const allowed = await ctx.requestPermission(
        'network.external',
        'Deliver notification via configured HTTPS webhook',
      );
      if (!allowed) {
        return {
          output: {
            ok: false,
            message: 'Permission denied for webhook deliver',
            reason: 'network.external not granted',
          },
        };
      }

      const store = readStore();
      const deliverAll = Boolean(input && (input.all === true || input.mode === 'all'));
      const id = input && (input.id || input.notificationId) ? String(input.id || input.notificationId) : null;
      let targets = [];
      if (deliverAll) {
        targets = store.items.filter((i) => i.status === 'pending');
      } else if (id) {
        targets = store.items.filter((i) => i.id === id);
      } else {
        targets = store.items.filter((i) => i.status === 'pending').slice(0, 1);
      }

      if (targets.length === 0) {
        return { output: { ok: false, message: 'No pending notifications to deliver', delivered: [] } };
      }

      const results = [];
      for (const item of targets) {
        const url = resolveWebhookUrl(item.channel);
        if (!url) {
          item.status = 'failed';
          item.lastError = 'No webhook URL configured (SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL / ZAVORTH_NOTIFY_WEBHOOK_URL)';
          results.push({ id: item.id, ok: false, error: item.lastError });
          continue;
        }
        if (!isSafeWebhookUrl(url)) {
          item.status = 'failed';
          item.lastError = 'Webhook URL rejected (HTTPS only; public hosts only)';
          results.push({ id: item.id, ok: false, error: item.lastError });
          continue;
        }
        try {
          const payload = buildPayload(url, item);
          await postJson(url, payload);
          item.status = 'delivered';
          item.deliveredAt = new Date().toISOString();
          item.lastError = null;
          results.push({ id: item.id, ok: true });
        } catch (error) {
          item.status = 'failed';
          item.lastError = errMsg(error);
          results.push({ id: item.id, ok: false, error: item.lastError });
        }
      }
      writeStore(store);
      const okCount = results.filter((r) => r.ok).length;
      return {
        output: {
          ok: okCount > 0,
          delivered: results,
          okCount,
          failCount: results.length - okCount,
          message: okCount > 0 ? `Delivered ${okCount} notification(s)` : 'Deliver failed for all targets',
        },
        artifacts: [storePath],
        receipts: ['notify-outbox.receipt'],
      };
    } catch (error) {
      logger.warn('notify.deliver failed', { error: errMsg(error) });
      return { output: { ok: false, message: errMsg(error) } };
    }
  });

  logger.info('notify-outbox registered', { workspace, storePath });
}

function buildPayload(url, item) {
  const text = `*${item.title}*\n${item.body || ''}`.trim();
  // Discord webhooks expect { content }; Slack incoming webhooks accept { text }.
  if (/discord(?:app)?\.com\/api\/webhooks/iu.test(url)) {
    return { content: text.slice(0, 1900) };
  }
  return {
    text: text.slice(0, 3500),
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: text.slice(0, 2900) },
      },
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
    // Block obvious private IPv4
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/u.test(host)) return false;
    if (host === '0.0.0.0' || host === '169.254.169.254') return false;
    return true;
  } catch {
    return false;
  }
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    const data = JSON.stringify(body);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'zavorth-notify-outbox/1.0',
        },
        timeout: 15000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) {
            resolve({ status, body: Buffer.concat(chunks).toString('utf8') });
          } else {
            reject(new Error(`Webhook HTTP ${status}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Webhook request timed out'));
    });
    req.write(data);
    req.end();
  });
}

function errMsg(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = { register };
