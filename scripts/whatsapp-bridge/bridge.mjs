#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chatIdToJid,
  extractTextFromBaileysMessage,
  jidToChatId,
  matchesAllowedUser,
  normalizePhoneId,
  parseAllowedUsers,
} from './allowlist.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArg(name, fallback = '') {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return fallback;
}

const PORT = Number(getArg('port', process.env.WHATSAPP_BRIDGE_PORT || '3910')) || 3910;
const HOST = getArg('host', process.env.WHATSAPP_BRIDGE_HOST || '127.0.0.1');
const SESSION_DIR = path.resolve(
  getArg('session', process.env.WHATSAPP_SESSION_DIR || path.join(process.cwd(), 'data', 'whatsapp-bridge', 'session')),
);
const STATUS_FILE = path.resolve(
  getArg('status-file', process.env.WHATSAPP_BRIDGE_STATUS_FILE || path.join(process.cwd(), 'data', 'runtime', 'whatsapp-bridge-status.json')),
);
const INBOUND_WEBHOOK = String(process.env.ZAVORTH_WHATSAPP_INBOUND_URL || process.env.WHATSAPP_INBOUND_WEBHOOK || '').trim();
const ALLOWED_USERS = parseAllowedUsers(process.env.WHATSAPP_ALLOWED_CHAT_IDS || process.env.WHATSAPP_ALLOWED_USERS || '');
const PAIR_ONLY = process.argv.includes('--pair-only');
const MAX_QUEUE = 500;

let SCRIPT_HASH = '';
try {
  SCRIPT_HASH = createHash('sha256').update(readFileSync(__filename)).digest('hex').slice(0, 16);
} catch {
  SCRIPT_HASH = 'unknown';
}

const state = {
  connection: 'starting',
  lastQr: null,
  lastQrAt: null,
  lastError: null,
  lastInboundAt: null,
  lastOutboundAt: null,
  connectedUser: null,
  startedAt: new Date().toISOString(),
  restarts: 0,
};

const inboundQueue = [];
const waiters = [];
let sock = null;
let sendQueue = Promise.resolve();

function log(...args) {
  console.log('[zavorth-whatsapp-bridge]', ...args);
}

function writeStatus() {
  try {
    mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
    const payload = {
      ...state,
      tier: 'T2',
      experimental: true,
      productionClaim: 'experimental',
      scriptHash: SCRIPT_HASH,
      port: PORT,
      host: HOST,
      sessionDir: SESSION_DIR,
      queueDepth: inboundQueue.length,
      allowedUsersConfigured: ALLOWED_USERS.length > 0,
      inboundWebhookConfigured: Boolean(INBOUND_WEBHOOK),
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(STATUS_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch (error) {
    log('failed to write status file:', error instanceof Error ? error.message : String(error));
  }
}

function enqueueInbound(message) {
  inboundQueue.push(message);
  while (inboundQueue.length > MAX_QUEUE) inboundQueue.shift();
  state.lastInboundAt = new Date().toISOString();
  writeStatus();
  while (waiters.length && inboundQueue.length) {
    const resolve = waiters.shift();
    resolve([inboundQueue.shift()]);
  }
  if (INBOUND_WEBHOOK) {
    forwardInbound(message).catch((error) => {
      log('inbound webhook failed:', error instanceof Error ? error.message : String(error));
    });
  }
}

async function forwardInbound(message) {
  const response = await fetch(INBOUND_WEBHOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error(`inbound webhook HTTP ${response.status}`);
  }
}

function takeMessages(timeoutMs = 25000) {
  if (inboundQueue.length) {
    return Promise.resolve([inboundQueue.shift()]);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const index = waiters.indexOf(resolver);
      if (index >= 0) waiters.splice(index, 1);
      resolve([]);
    }, timeoutMs);
    const resolver = (messages) => {
      clearTimeout(timer);
      resolve(messages);
    };
    waiters.push(resolver);
  });
}

function enqueueSend(fn) {
  const task = sendQueue.then(() => fn(), () => fn());
  sendQueue = task.catch(() => {});
  return task;
}

async function startSocket() {
  const baileys = await import('@whiskeysockets/baileys');
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
  } = baileys;
  const Boom = (await import('@hapi/boom')).Boom || (await import('@hapi/boom')).default?.Boom;
  const qrcode = (await import('qrcode-terminal')).default || await import('qrcode-terminal');

  mkdirSync(SESSION_DIR, { recursive: true });
  const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    logger: (await import('pino')).default({ level: 'silent' }),
    markOnlineOnConnect: false,
    getMessage: async () => ({ conversation: '' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      state.connection = 'qr';
      state.lastQr = qr;
      state.lastQrAt = new Date().toISOString();
      state.lastError = null;
      writeStatus();
      log('Scan QR with WhatsApp → Linked Devices');
      try {
        qrcode.generate(qr, { small: true });
      } catch {
        log('QR string:', qr);
      }
    }

    if (connection === 'close') {
      const statusCode = Boom
        ? new Boom(lastDisconnect?.error)?.output?.statusCode
        : lastDisconnect?.error?.output?.statusCode;
      state.connection = 'disconnected';
      state.lastError = `disconnect:${statusCode || 'unknown'}`;
      writeStatus();
      if (statusCode === DisconnectReason.loggedOut) {
        log('Logged out. Delete session dir and pair again.');
        process.exit(1);
      }
      state.restarts += 1;
      setTimeout(() => {
        startSocket().catch((error) => {
          state.lastError = error instanceof Error ? error.message : String(error);
          writeStatus();
          log('reconnect failed:', state.lastError);
        });
      }, statusCode === 515 ? 1000 : 3000);
    }

    if (connection === 'open') {
      state.connection = 'connected';
      state.lastQr = null;
      state.lastError = null;
      state.connectedUser = sock?.user
        ? { id: sock.user.id || null, name: sock.user.name || sock.user.verifiedName || null }
        : null;
      writeStatus();
      log('Connected');
      if (PAIR_ONLY) {
        setTimeout(() => process.exit(0), 1500);
      }
    }
  });

  sock.ev.on('messages.upsert', async (upsert) => {
    if (!upsert || upsert.type !== 'notify') return;
    for (const msg of upsert.messages || []) {
      if (!msg?.message || msg.key?.fromMe) continue;
      const remoteJid = String(msg.key.remoteJid || '');
      if (!remoteJid || remoteJid === 'status@broadcast') continue;
      const text = extractTextFromBaileysMessage(msg.message);
      if (!text) continue;
      const sender = normalizePhoneId(msg.key.participant || remoteJid);
      if (!matchesAllowedUser(sender, ALLOWED_USERS)) {
        log('ignored unauthorized sender');
        continue;
      }
      enqueueInbound({
        id: msg.key.id || randomUUID(),
        messageId: msg.key.id || null,
        from: sender,
        sender,
        chatId: jidToChatId(remoteJid),
        to: jidToChatId(remoteJid),
        text,
        body: text,
        isGroup: remoteJid.endsWith('@g.us'),
        timestamp: msg.messageTimestamp || Date.now(),
        provider: 'baileys',
        tier: 'T2',
      });
    }
  });
}

async function handleSend(body) {
  if (!sock || state.connection !== 'connected') {
    return { ok: false, status: 503, error: `bridge not connected (${state.connection})` };
  }
  const chatId = String(body.chatId || body.to || body.target || '').trim();
  const text = String(body.text || body.message || body.body || '').trim();
  if (!chatId || !text) {
    return { ok: false, status: 400, error: 'chatId/to and text/message are required' };
  }
  const jid = chatIdToJid(chatId);
  if (!jid) {
    return { ok: false, status: 400, error: 'invalid chatId' };
  }
  try {
    const result = await enqueueSend(() => sock.sendMessage(jid, { text }));
    state.lastOutboundAt = new Date().toISOString();
    writeStatus();
    return {
      ok: true,
      status: 200,
      messageId: result?.key?.id || null,
      chatId: jid,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.lastError = message;
    writeStatus();
    return { ok: false, status: 500, error: message };
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function createHttpServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, state.connection === 'connected' ? 200 : 503, {
          ok: state.connection === 'connected',
          connection: state.connection,
          scriptHash: SCRIPT_HASH,
          experimental: true,
          tier: 'T2',
          queueDepth: inboundQueue.length,
          connectedUser: state.connectedUser,
          lastError: state.lastError,
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/status') {
        sendJson(res, 200, {
          ...state,
          scriptHash: SCRIPT_HASH,
          experimental: true,
          tier: 'T2',
          queueDepth: inboundQueue.length,
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/qr') {
        sendJson(res, state.lastQr ? 200 : 404, {
          ok: Boolean(state.lastQr),
          qr: state.lastQr,
          updatedAt: state.lastQrAt,
          connection: state.connection,
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/messages') {
        const timeoutMs = Math.min(Math.max(Number(url.searchParams.get('timeout') || 25000), 1000), 60000);
        const messages = await takeMessages(timeoutMs);
        sendJson(res, 200, { ok: true, messages });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/send') {
        const body = await readJson(req);
        const result = await handleSend(body);
        sendJson(res, result.status || (result.ok ? 200 : 500), result);
        return;
      }
      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

async function main() {
  mkdirSync(SESSION_DIR, { recursive: true });
  mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  writeStatus();

  const server = createHttpServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, () => {
      log(`listening on http://${HOST}:${PORT}`);
      log(`session=${SESSION_DIR}`);
      log('experimental T2 Baileys bridge — not production Cloud API');
      resolve();
    });
  });

  try {
    await startSocket();
  } catch (error) {
    state.connection = 'error';
    state.lastError = error instanceof Error ? error.message : String(error);
    writeStatus();
    log('failed to start Baileys socket:', state.lastError);
    log('Install bridge deps: cd scripts/whatsapp-bridge && npm install');
    if (!existsSync(path.join(__dirname, 'node_modules', '@whiskeysockets', 'baileys'))) {
      process.exitCode = 2;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
