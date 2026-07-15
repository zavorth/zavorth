/**
 * platform-telegram — soft-fail Telegram Bot API channel.
 * Never logs or returns token values — only presence booleans.
 */

function register(ctx) {
 const logger = ctx.getLogger();

 function statusPayload() {
 const tokenPresent = Boolean(String(process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').trim());
 return {
 ok: true,
 platform: 'telegram',
 tokenPresent,
 message: tokenPresent
 ? 'Telegram bot token present; send available when network permission granted.'
 : 'Set TELEGRAM_BOT_TOKEN or TELEGRAM_TOKEN to enable Telegram send.',
 setup: tokenPresent ? null : ['export TELEGRAM_BOT_TOKEN=...'],
 };
 }

 function resolveToken() {
 return String(process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').trim();
 }

 async function sendMessage(input) {
 const status = statusPayload();
 if (!status.tokenPresent) {
 return {
 ...status,
 ok: false,
 delivered: false,
 message: 'TELEGRAM_BOT_TOKEN / TELEGRAM_TOKEN not set',
 };
 }

 const allowed = await ctx.requestPermission('network.external', 'Telegram Bot API sendMessage');
 if (!allowed) {
 return {
 ok: false,
 delivered: false,
 blocked: true,
 message: 'network.external permission denied',
 reason: 'network.external not granted',
 };
 }

 const chatId = input && (input.chatId ?? input.chat_id ?? input.to);
 const text = String((input && (input.text || input.message || input.body || input.content)) || '').trim();

 if (chatId === undefined || chatId === null || String(chatId).trim() === '') {
 return { ok: false, delivered: false, message: 'chatId (or chat_id) is required' };
 }
 if (!text) {
 return { ok: false, delivered: false, message: 'text (or message) is required' };
 }

 const token = resolveToken();
 // Path segment only; token never appears in logs/return values.
 const path = `/bot${token}/sendMessage`;

 try {
 const result = await postJson(`https://api.telegram.org${path}`, {
 chat_id: chatId,
 text: text.slice(0, 4096),
 });
 const delivered = Boolean(result && result.ok === true);
 return {
 ok: delivered,
 delivered,
 platform: 'telegram',
 chatId: String(chatId),
 messageId: result?.result?.message_id ?? null,
 message: delivered ? 'Telegram message sent' : 'Telegram API returned ok=false',
 };
 } catch (error) {
 logger.warn('platform-telegram send failed', {
 error: error instanceof Error ? error.message : String(error),
 });
 return {
 ok: false,
 delivered: false,
 platform: 'telegram',
 message: error instanceof Error ? error.message : String(error),
 };
 }
 }

 ctx.bindCapability('platform.telegram.status', async () => ({
 output: statusPayload(),
 }));

 ctx.bindCapability('platform.telegram.send', async ({ input }) => {
 try {
 const result = await sendMessage(input || {});
 return {
 output: result,
 receipts: result.ok ? ['platform-telegram.receipt'] : [],
 };
 } catch (error) {
 logger.warn('platform.telegram.send failed', {
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
 id: 'telegram',
 capabilityId: 'platform.telegram.send',
 label: 'Telegram',
 metadata: { pack: 'platforms' },
 send: async (payload) => sendMessage(payload || {}),
 };

 if (typeof ctx.registerPlatform === 'function') {
 ctx.registerPlatform(channelSpec);
 } else {
 ctx.bindChannel(channelSpec);
 }

 logger.info('platform-telegram registered');
}

function postJson(url, body) {
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
 reject(new Error('HTTPS only for outbound Telegram requests'));
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
 'Content-Length': Buffer.byteLength(data),
 'User-Agent': 'zavorth-platform-telegram/1.0',
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
 // Avoid echoing body slices that might include request context.
 reject(new Error(`Telegram HTTP ${status}`));
 }
 });
 },
 );
 req.on('error', reject);
 req.on('timeout', () => {
 req.destroy();
 reject(new Error('Telegram request timed out'));
 });
 req.write(data);
 req.end();
 });
}

module.exports = { register };
