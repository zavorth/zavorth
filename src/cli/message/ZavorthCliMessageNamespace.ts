import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  firstArg,
  readFlag,
  readFlags,
  readNumberFlag,
  stateDir,
  readArray,
  writeJson,
  appendJsonArray,
  idWithTime,
  runProcess,
  render,
  splitList,
  getEnv,
  isInside,
  ensureDir,
  sha256
} from '../ZavorthCliSharedHelpers.js';import { logger } from '../../logger.js';
import {
type ChannelAdapterMode,
  type ChannelAdapter,
  type MessageCompose,
  CHANNEL_ADAPTERS,
  resolveChannelAdapter,
  envPrefix,
  mergeDirectoryEntries,
  type JsonObject
} from './ZavorthCliMessageAdapters.js';

export { runPairing, runQr, redactPairingRecord, createPairingDraft } from './ZavorthCliMessagePairing.js';

function redact(value: string): string {
  return value ? '***' : '';
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    if (url.searchParams.has('api_key')) url.searchParams.set('api_key', '***');
    if (url.searchParams.has('token')) url.searchParams.set('token', '***');
    return url.toString();
  } catch (error: unknown) {logger.warn('[Zavorth Cli Message Namespace] search failed', error); return value; }
}

function redactMessageRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.message) item.message = redact(String(item.message));
  if (item.delivery) item.delivery = { ...((item.delivery || {}) as JsonObject), receipts: '***' };
  return item;
}

function sanitizeMessageRecord(value: unknown): JsonObject {
  return { ...((value || {}) as JsonObject) };
}

function sanitizeDelivery(value: JsonObject): JsonObject {
  return { ...value };
}

function formatMessageReceipt(value: unknown): string {
  const item = (value || {}) as JsonObject;
  return `- ${String(item.id)} | message ${String(item.messageId)} | ${String(item.channel)} | ${String(item.status)} | ${String(item.createdAt)}`;
}

function parseMessageCompose(args: string[]): MessageCompose {
  return {
    channel: readFlag(args, 'channel') || 'telegram',
    targets: splitList(readFlag(args, 'target') || readFlag(args, 'to') || ''),
    message: readFlag(args, 'message') || readFlag(args, 'text') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' '),
    attachments: splitList(readFlag(args, 'attachment') || readFlag(args, 'file') || ''),
    threadId: readFlag(args, 'thread') || readFlag(args, 'thread-id') || '',
    replyTo: readFlag(args, 'reply-to') || '',
    reaction: readFlag(args, 'reaction') || '',
    mentions: splitList(readFlag(args, 'mention') || ''),
  };
}

async function deliverMessageAdvanced(root: string, args: string[], compose: MessageCompose): Promise<JsonObject> {
  const adapter = resolveChannelAdapter(compose.channel);
  if (!args.includes('--deliver') && !args.includes('--yes')) {
    return { ok: true, dryRun: true, status: 'dry-run-success', targets: compose.targets };
  }
  await enforceChannelRateLimit(root, adapter.id);
  const start = Date.now();
  const results = [];
  const attachments = await resolveAttachments(compose.attachments);
  for (const target of compose.targets) {
    const res = await deliverMessage(root, adapter, target, compose.message, { ...compose, attachments });
    results.push(res);
  }
  const durationMs = Date.now() - start;
  const ok = results.every((r) => r.ok);
  return { ok, status: ok ? 'delivered' : 'partial-failure', results, durationMs };
}

async function enforceChannelRateLimit(root: string, channel: string) {
  // Simplificado ou mantido como original
  const limitFile = path.join(stateDir(root), 'rate-limits.json');
  const limits = await readArray(limitFile);
  const now = Date.now();
  const active = limits.filter((entry) => {
    const item = entry as JsonObject;
    return String(item.channel) === channel && Number(item.expiresAt) > now;
  });
  if (active.length >= 5) {
    const delay = Math.max(0, Math.min(5000, Number((active[0] as JsonObject).expiresAt) - now));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  limits.push({ channel, expiresAt: now + 3000 });
  await writeJson(limitFile, limits.slice(-50));
}

async function resolveAttachments(files: string[]): Promise<Array<{ file: string; bytes: number; sha256: string; contentBase64?: string }>> {
  const results = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      const stats = await fs.stat(file);
      const content = await fs.readFile(file);
      const hashVal = sha256(content);
      const contentBase64 = stats.size < 5 * 1024 * 1024 ? content.toString('base64') : undefined;
      results.push({ file, bytes: stats.size, sha256: hashVal, contentBase64 });
    } catch (error: unknown) {// Ignore file read errors for optional attachments.
      logger.warn('[Zavorth Cli Message Namespace] filesystem operation failed', error);
    }
  }
  return results;
}

async function deliverMessage(root: string, adapter: ChannelAdapter, target: string, message: string, meta: {
  attachments?: Array<{ file: string; bytes: number; sha256: string; contentBase64?: string }>;
  threadId?: string;
  replyTo?: string;
  reaction?: string;
  mentions?: string[];
} = {}): Promise<JsonObject> {
  const webhookUrl = getFirstEnv(adapter.webhookEnv || []);
  if (webhookUrl) {
    const payload = channelWebhookPayload(adapter.id, message, target, meta);
    const response = await fetch(redactUrl(webhookUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok, status: response.status, mode: 'webhook' };
  }
  const endpointUrl = getFirstEnv(adapter.endpointEnv || []);
  if (endpointUrl) {
    const payload = channelWebhookPayload(adapter.id, message, target, meta);
    const headers = channelEndpointHeaders(adapter);
    const response = await fetch(redactUrl(endpointUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return { ok: response.ok, status: response.status, mode: 'endpoint' };
  }
  const script = getFirstEnv(adapter.scriptEnv || []);
  if (script) {
    const result = await runChannelScript(script, adapter, target, message);
    return { ok: result.exitCode === 0, status: result.exitCode, mode: 'script' };
  }
  if (adapter.id === 'telegram') {
    const token = getEnv('TELEGRAM_BOT_TOKEN');
    const chatId = target || getEnv('TELEGRAM_DEFAULT_CHAT_ID');
    if (!token || !chatId) return { ok: false, reason: 'missing-telegram-credentials' };
    if (meta.attachments && meta.attachments.length > 0) {
      const docRes = await sendTelegramDocument(token, chatId, message, meta.attachments[0]);
      if (docRes.ok) return docRes;
    }
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        reply_to_message_id: meta.replyTo ? Number(meta.replyTo) : undefined,
      }),
    });
    return { ok: response.ok, status: response.status, mode: 'telegram-direct' };
  }
  const outboxDir = getEnv(adapter.outboxEnv || '');
  if (outboxDir) {
    return await writeChannelOutbox(outboxDir, adapter.id, target, message, meta);
  }
  return { ok: false, reason: 'no-configured-transport-mode-for-adapter' };
}

async function readChannelMessages(channel: string, args: string[]): Promise<{ lines: string[]; payload: JsonObject }> {
  // Mock or lightweight local channel reader.
  return { lines: ['Read channel messages bypassed: run in interactive shell mode.'], payload: { ok: true } };
}

async function lookupChannelDirectory(channel: string, query: string): Promise<JsonObject[]> {
  return [];
}

export async function runMessage(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  if (action === 'status') {
    const statuses = CHANNEL_ADAPTERS.map((adapter) => channelStatus(adapter.id));
    const readiness = statuses.map((status) => {
      const suffix = status.configured ? status.mode : `missing (${status.required.join(' or ')})`;
      return `${status.id}: ${suffix}`;
    });
    return render(args, 'Zavorth message', readiness, { channels: Object.fromEntries(statuses.map((status) => [status.id, status])) });
  }
  const file = path.join(stateDir(root), 'messages.json');
  const messages = await readArray(file);
  if (action === 'retry') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = messages.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth message', [`No message found for retry id: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--deliver') && !args.includes('--yes')) {
      return render(args, 'Zavorth message', [`Retry preview: ${id}`, 'Add --deliver --yes to retry delivery.'], { dryRun: true, message: redactMessageRecord(selected) });
    }
    const retryArgs = [
      'send',
      '--channel', String(selected.channel || ''),
      '--target', String(selected.target || ''),
      '--message', String(selected.message || ''),
      '--deliver',
      '--yes',
      ...((selected.threadId ? ['--thread', String(selected.threadId)] : [])),
      ...((selected.replyTo ? ['--reply-to', String(selected.replyTo)] : [])),
    ];
    const retry = await deliverMessageAdvanced(root, retryArgs, {
      channel: String(selected.channel || ''),
      targets: splitList(String(selected.target || '')),
      message: String(selected.message || ''),
      attachments: (selected.attachments as string[] | undefined) || [],
      threadId: String(selected.threadId || ''),
      replyTo: String(selected.replyTo || ''),
      reaction: String(selected.reaction || ''),
      mentions: splitList(String(selected.mentions || '')),
    });
    selected.status = retry.ok ? 'delivered' : 'delivery-failed';
    selected.retryCount = Number(selected.retryCount || 0) + 1;
    selected.lastRetryAt = new Date().toISOString();
    selected.delivery = retry;
    await writeJson(file, messages);
    return render(args, 'Zavorth message', [`Retry ${selected.status}: ${id}`], { message: redactMessageRecord(selected), retry });
  }
  if (action === 'receipts' || action === 'receipt') {
    const id = args[1] || readFlag(args, 'id') || '';
    const receipts = await readArray(path.join(stateDir(root), 'receipts', 'messages.json'));
    const selected = id ? receipts.filter((entry) => String((entry as JsonObject).messageId) === id || String((entry as JsonObject).id) === id) : receipts;
    return render(args, 'Zavorth message evidence', selected.length ? selected.slice(-20).map(formatMessageReceipt) : ['No message evidence recorded yet.'], { receipts: selected });
  }
  if (action === 'manage') {
    const pending = messages.filter((entry) => ['delivery-failed', 'draft', 'delivery-requested'].includes(String((entry as JsonObject).status)));
    return render(args, 'Zavorth message manage', pending.length ? pending.map((entry) => {
      const item = entry as JsonObject;
      return `- ${String(item.id)} | ${String(item.channel)} | ${String(item.status)} | retries ${String(item.retryCount || 0)}`;
    }) : ['No message drafts or failed deliveries need attention.'], { messages: pending.map(redactMessageRecord) });
  }
  if (action === 'list' || action === 'read') {
    if (action === 'read' && args.includes('--live')) {
      if (!args.includes('--yes')) return render(args, 'Zavorth message', ['Live read requires --yes.'], { ok: false });
      const channel = readFlag(args, 'channel') || 'telegram';
      const result = await readChannelMessages(channel, args);
      return render(args, 'Zavorth message', result.lines, result.payload);
    }
    if (action === 'read') {
      const id = args[1];
      const message = messages.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
      if (!message) return render(args, 'Zavorth message', [`No message found for id: ${id || '<missing>'}`], { ok: false });
      return render(args, 'Zavorth message', [
        `id: ${String(message.id)}`,
        `channel: ${String(message.channel)}`,
        `target: ${String(message.target)}`,
        `status: ${String(message.status)}`,
        `message: ${redact(String(message.message || ''))}`,
      ], { message: { ...message, message: redact(String(message.message || '')) } });
    }
    return render(args, 'Zavorth message', messages.length ? messages.map((message) => `- ${String((message as JsonObject).id)} | ${String((message as JsonObject).channel)} | ${String((message as JsonObject).status)}`) : ['No message drafts recorded yet.'], { messages: messages.map(redactMessageRecord) });
  }
  const compose = parseMessageCompose(args);
  const draft = {
    id: idWithTime('message'),
    channel: compose.channel,
    target: compose.targets.join(','),
    message: compose.message,
    attachments: compose.attachments,
    threadId: compose.threadId || null,
    replyTo: compose.replyTo || null,
    reaction: compose.reaction || null,
    mentions: compose.mentions,
    status: args.includes('--deliver') ? 'delivery-requested' : 'draft',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  if (args.includes('--deliver')) {
    const delivery = await deliverMessageAdvanced(root, args, compose);
    draft.status = delivery.ok ? 'delivered' : 'delivery-failed';
    (draft as JsonObject).delivery = delivery;
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'messages.json'), {
      id: idWithTime('message-receipt'),
      messageId: draft.id,
      channel: compose.channel,
      targets: compose.targets,
      status: draft.status,
      delivery,
      createdAt: new Date().toISOString(),
    });
  }
  messages.push(draft);
  await writeJson(file, messages);
  return render(args, 'Zavorth message', [`Created ${draft.status}: ${draft.id}`, 'No secret or message body was printed in full.'], { draft: redactMessageRecord(draft) });
}

export async function runDirectory(root: string, args: string[]) {
  const file = path.join(stateDir(root), 'directory.json');
  const existing = await readArray(file);
  const action = firstArg(args, 'list');
  if (action === 'add') {
    const channel = readFlag(args, 'channel') || 'telegram';
    const externalId = readFlag(args, 'id') || '';
    const label = readFlag(args, 'label') || 'unspecified-directory-entry';
    if (!externalId) return render(args, 'Zavorth directory', ['Missing external id. Usage: zavorth directory add --id <ID>'], { ok: false });
    const entry = {
      id: idWithTime('directory'),
      channel: resolveChannelAdapter(channel).id,
      externalId,
      label,
      kind: 'peer' as const,
      source: 'operator-added',
      syncedAt: new Date().toISOString(),
    };
    const updated = mergeDirectoryEntries(existing, [entry]);
    await writeJson(file, updated);
    return render(args, 'Zavorth directory add', [`Added directory entry: ${String(entry.id)} | ${String(entry.label)}`], { entry });
  }
  return render(args, 'Zavorth directory', existing.length ? existing.map(formatDirectoryEntry) : ['No directory entries stored yet.'], { entries: existing });
}

function formatDirectoryEntry(value: unknown): string {
  const item = (value || {}) as JsonObject;
  return `- ${String(item.channel || 'channel')} | ${String(item.kind || 'entry')} | ${String(item.label || item.externalId || item.id || 'unknown')} | ${String(item.externalId || item.id || '')}`;
}

function channelStatus(channel: string): { id: string; configured: boolean; mode: ChannelAdapterMode | 'outbox-ready'; required: string[] } {
  const adapter = resolveChannelAdapter(channel);
  if (adapter.id === 'telegram') {
    return { id: adapter.id, configured: Boolean(getEnv('TELEGRAM_BOT_TOKEN')), mode: adapter.mode, required: adapter.env };
  }
  if (adapter.id === 'matrix') {
    return { id: adapter.id, configured: Boolean(getEnv('MATRIX_BASE_URL') && getEnv('MATRIX_ACCESS_TOKEN')), mode: adapter.mode, required: adapter.env };
  }
  if (adapter.id === 'line') {
    return { id: adapter.id, configured: Boolean(getEnv('LINE_CHANNEL_ACCESS_TOKEN')), mode: adapter.mode, required: adapter.env };
  }
  if (adapter.id === 'signal') {
    return {
      id: adapter.id,
      configured: Boolean((getEnv('SIGNAL_JSONRPC_URL') || getEnv('SIGNAL_CLI_PATH')) && getEnv('SIGNAL_ACCOUNT_NUMBER') && getEnv('SIGNAL_ALLOWED_RECIPIENTS')),
      mode: adapter.mode,
      required: adapter.env,
    };
  }
  const configured = Boolean(
    getFirstEnv(adapter.webhookEnv || [])
    || getFirstEnv(adapter.endpointEnv || [])
    || getFirstEnv(adapter.scriptEnv || [])
    || getEnv(adapter.outboxEnv || ''),
  );
  return { id: adapter.id, configured, mode: configured ? adapter.mode : 'outbox-ready', required: adapter.env };
}

function channelWebhookPayload(channel: string, message: string, target: string, meta: { attachments?: Array<{ file: string; bytes: number; sha256: string }>; threadId?: string; replyTo?: string; reaction?: string; mentions?: string[] } = {}): JsonObject {
  const rich = { threadId: meta.threadId || null, replyTo: meta.replyTo || null, reaction: meta.reaction || null, mentions: meta.mentions || [], attachments: safeAttachmentMetadata(meta.attachments || []) };
  if (channel === 'discord') return { content: message, ...rich };
  if (channel === 'slack' || channel === 'google-chat' || channel === 'mattermost' || channel === 'synology-chat' || channel === 'clickclack' || channel === 'nextcloud-talk') {
    return { text: message, ...rich };
  }
  if (channel === 'feishu') return { msg_type: 'text', content: { text: message }, ...rich };
  if (channel === 'wecom') return { msgtype: 'text', text: { content: message }, ...rich };
  return { source: 'zavorth', channel, target, text: message, message, ...rich };
}

function channelEndpointHeaders(adapter: ChannelAdapter): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = getFirstEnv(adapter.tokenEnv || []);
  if (token) headers.authorization = `Bearer ${token}`;
  if (adapter.id === 'signal' && getEnv('SIGNAL_BRIDGE_TOKEN')) headers.authorization = `Bearer ${getEnv('SIGNAL_BRIDGE_TOKEN')}`;
  if (adapter.id === 'imessage' && getEnv('IMESSAGE_BRIDGE_TOKEN')) headers.authorization = `Bearer ${getEnv('IMESSAGE_BRIDGE_TOKEN')}`;
  return headers;
}

async function writeChannelOutbox(outboxDir: string, channel: string, target: string, message: string, meta: {
  attachments?: Array<{ file: string; bytes: number; sha256: string }>;
  threadId?: string;
  replyTo?: string;
  reaction?: string;
  mentions?: string[];
} = {}): Promise<JsonObject> {
  await ensureDir(outboxDir);
  const id = idWithTime(`${channel}-outbox`);
  const file = path.join(outboxDir, `${id}.json`);
  const receipt = {
    id,
    channel,
    target: target || null,
    message,
    threadId: meta.threadId || null,
    replyTo: meta.replyTo || null,
    reaction: meta.reaction || null,
    mentions: meta.mentions || [],
    attachments: safeAttachmentMetadata(meta.attachments || []),
    status: 'queued-for-bridge',
    createdAt: new Date().toISOString(),
  };
  await writeJson(file, receipt);
  return { id, file, status: 'queued-for-bridge' };
}

async function sendTelegramDocument(token: string, chatId: string, caption: string, attachment: { file: string; contentBase64?: string }): Promise<JsonObject> {
  if (!attachment.contentBase64) return { ok: false, file: attachment.file, reason: 'attachment-too-large-for-cli-upload' };
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('caption', caption);
  const bytes = Buffer.from(attachment.contentBase64, 'base64');
  form.set('document', new Blob([bytes]), path.basename(attachment.file));
  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  return { ok: response.ok, status: response.status, file: attachment.file };
}

function safeAttachmentMetadata(attachments: Array<{ file: string; bytes: number; sha256: string }>): JsonObject[] {
  return attachments.map((attachment) => ({
    file: attachment.file,
    bytes: attachment.bytes,
    sha256: attachment.sha256,
  }));
}

async function runChannelScript(script: string, adapter: ChannelAdapter, target: string, message: string): Promise<{ exitCode: number; durationMs: number }> {
  if (adapter.id === 'signal') {
    const account = getEnv('SIGNAL_ACCOUNT_NUMBER');
    const recipients = splitList(target || getEnv('SIGNAL_ALLOWED_RECIPIENTS') || '');
    if (!account || recipients.length === 0) return { exitCode: 1, durationMs: 0 };
    const result = await runProcess(script, ['-u', account, 'send', '-m', message, ...recipients], process.cwd(), 30000);
    return { exitCode: result.exitCode, durationMs: result.durationMs };
  }
  const recipients = target ? [target] : splitList(getEnv(`${envPrefix(adapter.id)}_DEFAULT_RECIPIENTS`) || '');
  const result = await runProcess(script, [
    '--channel',
    adapter.id,
    '--recipients',
    recipients.join(','),
    '--message',
    message,
  ], process.cwd(), 30000);
  return { exitCode: result.exitCode, durationMs: result.durationMs };
}

function getFirstEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return undefined;
}
