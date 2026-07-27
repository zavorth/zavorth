import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { spawnCommandLine } from '../security/SafeProcessExec.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { formatZavorthCertificationHelp } from './ZavorthCliCertificationCommands.js';
import { ZavorthOperationalReadinessService } from '../services/ZavorthOperationalReadinessService.js';
import { ZavorthNativeCapabilityCertificationService } from '../services/ZavorthNativeCapabilityCertificationService.js';
import { ZavorthProductExcellenceService } from '../services/ZavorthProductExcellenceService.js';
import {
  AutonomySchedulePlane,
  bindAutonomySchedulePlane,
} from '../services/AutonomySchedulePlane.js';
import { GoalLoopService } from '../services/GoalLoopService.js';
import { GoalLoopDaemonService } from '../services/GoalLoopDaemonService.js';
import { GoalLoopWorkerService } from '../services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../services/GoalPlaneService.js';
import { TaskBoardPlaneService } from '../services/TaskBoardPlaneService.js';
import { TaskPlaneService } from '../services/TaskPlaneService.js';
import { ZavorthHomePathService } from '../services/ZavorthHomePathService.js';
import { ZavorthBackgroundTaskService } from '../services/ZavorthBackgroundTaskService.js';
import { ZavorthCapabilityLifecycleService } from '../services/ZavorthCapabilityLifecycleService.js';
import { ZavorthCapabilityUsageSignalsService } from '../services/ZavorthCapabilityUsageSignalsService.js';
import { ZavorthCapabilityAtlasService } from '../services/ZavorthCapabilityAtlasService.js';
import { ZavorthDailyProductQuietAutonomyService } from '../services/ZavorthDailyProductQuietAutonomyService.js';
import { ZavorthActionGateway, type ZavorthActionOperation } from '../runtime/actions/index.js';
import {
  SessionContinuumService,
  resolveSessionContinuumStorePath,
} from '../services/SessionContinuumService.js';
import { ZavorthXaiRuntimeService } from '../services/ZavorthXaiRuntimeService.js';
import { ZavorthOperationalStateDbService } from '../services/ZavorthOperationalStateDbService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import { runSkills as runSkillsNamespace } from './skills/ZavorthCliSkillsNamespace.js';
import { runPlugins as runPluginsNamespace } from './plugins/ZavorthCliPluginsNamespace.js';
import { AgentRunService } from '../runtime/agent/AgentRunService.js';
import { TerminalPanel } from './presentation/TerminalPanel.js';
import { ChannelGatewayFactory } from '../gateways/ChannelGatewayFactory.js';
import { runCertify } from './certify/ZavorthCliCertifyNamespace.js';
import { runSandbox } from './sandbox/ZavorthCliSandboxNamespace.js';
import {
  firstArg,
  readFlag,
  readFlags,
  readNumberFlag,
  stateDir,
  ensureDir,
  readJson,
  readArray,
  writeJson,
  appendJsonArray,
  listJsonFiles,
  listAnyFiles,
  walkFiles,
  idWithTime,
  safeString,
  isInside,
  runProcess,
  sha256,
  render,
  normalizeRenderLines,
  resolvePanelType,
  terminalPanelWidth,
  text,
  splitList,
  getEnv,
  quoteEnv,
  mergeSingleEnvValue
} from './ZavorthCliSharedHelpers.js';
import type { ZavorthCapabilityUsageEventKind, ZavorthCapabilityUsageSurface } from '../contracts/ZavorthCapabilityUsageSignalsContract.js';
import type { ZavorthCapabilityAtlasCategory } from '../contracts/ZavorthCapabilityAtlasContract.js';
import type { ZavorthAppsSatelliteAction, ZavorthAppsSatelliteNodeKind } from '../contracts/ZavorthAppsSatelliteNodesContract.js';
import type { ZavorthTerminalBackendId } from '../contracts/runtime/ZavorthTerminalBackendsContract.js';
import type { SwarmScaleExecutionMode, SwarmScaleExecutionBackendId } from '../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';


type JsonObject = Record<string, unknown>;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

import {
  getPath,
  redact,
  redactUrl,
  sanitizeDelivery,
  sanitizeMessageRecord,
} from './ZavorthCliCommunicationValues.js';
import * as providerInference from './ZavorthCliProviderInferenceHelpers.js';
export type ChannelAdapterMode =
  | 'telegram-bot'
  | 'webhook'
  | 'bot-http'
  | 'matrix'
  | 'line'
  | 'signal-bridge'
  | 'local-bridge'
  | 'apple-bridge'
  | 'outbox';

export type ChannelAdapter = {
  id: string;
  aliases?: string[];
  mode: ChannelAdapterMode;
  env: string[];
  webhookEnv?: string[];
  endpointEnv?: string[];
  scriptEnv?: string[];
  tokenEnv?: string[];
  targetEnv?: string[];
  outboxEnv?: string;
};

export type MessageCompose = {
  channel: string;
  targets: string[];
  message: string;
  attachments: string[];
  threadId: string;
  replyTo: string;
  reaction: string;
  mentions: string[];
};

export const CHANNEL_ADAPTERS: ChannelAdapter[] = [
  { id: 'telegram', mode: 'telegram-bot', env: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_DEFAULT_CHAT_ID'], targetEnv: ['TELEGRAM_DEFAULT_CHAT_ID'] },
  { id: 'discord', mode: 'webhook', env: ['DISCORD_WEBHOOK_URL'], webhookEnv: ['DISCORD_WEBHOOK_URL'] },
  { id: 'slack', mode: 'webhook', env: ['SLACK_WEBHOOK_URL'], webhookEnv: ['SLACK_WEBHOOK_URL'] },
  { id: 'whatsapp', mode: 'local-bridge', env: ['WHATSAPP_BRIDGE_URL or WHATSAPP_WEBHOOK_URL or WHATSAPP_OUTBOX_DIR'], endpointEnv: ['WHATSAPP_BRIDGE_URL'], webhookEnv: ['WHATSAPP_WEBHOOK_URL'], outboxEnv: 'WHATSAPP_OUTBOX_DIR' },
  { id: 'signal', mode: 'signal-bridge', env: ['SIGNAL_JSONRPC_URL or SIGNAL_CLI_PATH', 'SIGNAL_ACCOUNT_NUMBER', 'SIGNAL_ALLOWED_RECIPIENTS'], endpointEnv: ['SIGNAL_JSONRPC_URL'], scriptEnv: ['SIGNAL_CLI_PATH'], outboxEnv: 'SIGNAL_OUTBOX_DIR' },
  { id: 'imessage', mode: 'apple-bridge', env: ['IMESSAGE_BRIDGE_URL or IMESSAGE_SCRIPT_PATH or IMESSAGE_OUTBOX_DIR'], endpointEnv: ['IMESSAGE_BRIDGE_URL'], scriptEnv: ['IMESSAGE_SCRIPT_PATH'], outboxEnv: 'IMESSAGE_OUTBOX_DIR' },
  { id: 'matrix', mode: 'matrix', env: ['MATRIX_BASE_URL', 'MATRIX_ACCESS_TOKEN'], targetEnv: ['MATRIX_DEFAULT_ROOM_ID'] },
  { id: 'microsoft-teams', aliases: ['teams', 'msteams'], mode: 'webhook', env: ['TEAMS_WEBHOOK_URL or MSTEAMS_WEBHOOK_URL'], webhookEnv: ['TEAMS_WEBHOOK_URL', 'MSTEAMS_WEBHOOK_URL'] },
  { id: 'feishu', aliases: ['lark'], mode: 'webhook', env: ['FEISHU_WEBHOOK_URL or LARK_WEBHOOK_URL'], webhookEnv: ['FEISHU_WEBHOOK_URL', 'LARK_WEBHOOK_URL'] },
  { id: 'google-chat', aliases: ['gchat'], mode: 'webhook', env: ['GOOGLE_CHAT_WEBHOOK_URL'], webhookEnv: ['GOOGLE_CHAT_WEBHOOK_URL'] },
  { id: 'irc', mode: 'local-bridge', env: ['IRC_BRIDGE_URL or IRC_WEBHOOK_URL or IRC_OUTBOX_DIR'], endpointEnv: ['IRC_BRIDGE_URL'], webhookEnv: ['IRC_WEBHOOK_URL'], scriptEnv: ['IRC_SCRIPT_PATH'], outboxEnv: 'IRC_OUTBOX_DIR' },
  { id: 'zalo', mode: 'bot-http', env: ['ZALO_SEND_URL', 'ZALO_ACCESS_TOKEN'], endpointEnv: ['ZALO_SEND_URL'], tokenEnv: ['ZALO_ACCESS_TOKEN'] },
  { id: 'wecom', mode: 'webhook', env: ['WECOM_WEBHOOK_URL'], webhookEnv: ['WECOM_WEBHOOK_URL'] },
  { id: 'weixin', aliases: ['wechat'], mode: 'local-bridge', env: ['WEIXIN_BRIDGE_URL or WEIXIN_BRIDGE_SCRIPT or WEIXIN_OUTBOX_DIR'], endpointEnv: ['WEIXIN_BRIDGE_URL'], scriptEnv: ['WEIXIN_BRIDGE_SCRIPT'], outboxEnv: 'WEIXIN_OUTBOX_DIR' },
  { id: 'yuanbao', mode: 'local-bridge', env: ['YUANBAO_BRIDGE_URL or YUANBAO_BRIDGE_SCRIPT or YUANBAO_OUTBOX_DIR'], endpointEnv: ['YUANBAO_BRIDGE_URL'], scriptEnv: ['YUANBAO_BRIDGE_SCRIPT'], outboxEnv: 'YUANBAO_OUTBOX_DIR' },
  { id: 'sms', mode: 'bot-http', env: ['SMS_SEND_URL or SMS_API_BASE_URL', 'SMS_PROVIDER_TOKEN'], endpointEnv: ['SMS_SEND_URL', 'SMS_API_BASE_URL'], tokenEnv: ['SMS_PROVIDER_TOKEN'] },
  { id: 'home-assistant', mode: 'webhook', env: ['HOME_ASSISTANT_WEBHOOK_URL or HOME_ASSISTANT_URL'], webhookEnv: ['HOME_ASSISTANT_WEBHOOK_URL'], endpointEnv: ['HOME_ASSISTANT_URL'], tokenEnv: ['HOME_ASSISTANT_TOKEN'] },
  { id: 'voice-call', mode: 'local-bridge', env: ['VOICE_CALL_BRIDGE_URL or VOICE_CALL_BRIDGE_SCRIPT or VOICE_CALL_OUTBOX_DIR'], endpointEnv: ['VOICE_CALL_BRIDGE_URL'], scriptEnv: ['VOICE_CALL_BRIDGE_SCRIPT'], outboxEnv: 'VOICE_CALL_OUTBOX_DIR' },
  { id: 'google-meet', mode: 'local-bridge', env: ['GOOGLE_MEET_BRIDGE_URL or GOOGLE_MEET_BRIDGE_SCRIPT or GOOGLE_MEET_OUTBOX_DIR'], endpointEnv: ['GOOGLE_MEET_BRIDGE_URL'], scriptEnv: ['GOOGLE_MEET_BRIDGE_SCRIPT'], outboxEnv: 'GOOGLE_MEET_OUTBOX_DIR' },
  { id: 'line', mode: 'line', env: ['LINE_CHANNEL_ACCESS_TOKEN'], targetEnv: ['LINE_DEFAULT_TARGET_ID'] },
  { id: 'twitch', mode: 'local-bridge', env: ['TWITCH_BRIDGE_URL or TWITCH_WEBHOOK_URL or TWITCH_OUTBOX_DIR'], endpointEnv: ['TWITCH_BRIDGE_URL'], webhookEnv: ['TWITCH_WEBHOOK_URL'], scriptEnv: ['TWITCH_SCRIPT_PATH'], outboxEnv: 'TWITCH_OUTBOX_DIR' },
  { id: 'qq', mode: 'bot-http', env: ['QQ_BOT_WEBHOOK_URL or QQ_SEND_URL'], endpointEnv: ['QQ_SEND_URL'], webhookEnv: ['QQ_BOT_WEBHOOK_URL'] },
  { id: 'nextcloud-talk', aliases: ['nextcloud'], mode: 'webhook', env: ['NEXTCLOUD_TALK_WEBHOOK_URL'], webhookEnv: ['NEXTCLOUD_TALK_WEBHOOK_URL'] },
  { id: 'mattermost', mode: 'webhook', env: ['MATTERMOST_WEBHOOK_URL'], webhookEnv: ['MATTERMOST_WEBHOOK_URL'] },
  { id: 'synology-chat', aliases: ['synology'], mode: 'webhook', env: ['SYNOLOGY_CHAT_WEBHOOK_URL'], webhookEnv: ['SYNOLOGY_CHAT_WEBHOOK_URL'] },
  { id: 'clickclack', mode: 'webhook', env: ['CLICKCLACK_WEBHOOK_URL'], webhookEnv: ['CLICKCLACK_WEBHOOK_URL'] },
  { id: 'nostr', aliases: ['nost'], mode: 'local-bridge', env: ['NOSTR_BRIDGE_URL or NOSTR_OUTBOX_DIR'], endpointEnv: ['NOSTR_BRIDGE_URL'], outboxEnv: 'NOSTR_OUTBOX_DIR' },
];

export function parseMessageCompose(args: string[]): MessageCompose {
  const channel = readFlag(args, 'channel') || 'unknown';
  const target = readFlag(args, 'target') || readFlag(args, 'to') || '';
  const body = readFlag(args, 'message') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
  return {
    channel,
    targets: splitList(target),
    message: body,
    attachments: readFlags(args, 'attach').concat(readFlags(args, 'file')),
    threadId: readFlag(args, 'thread') || readFlag(args, 'thread-id') || '',
    replyTo: readFlag(args, 'reply-to') || readFlag(args, 'reply') || '',
    reaction: readFlag(args, 'reaction') || '',
    mentions: splitList(readFlag(args, 'mention') || readFlag(args, 'mentions') || ''),
  };
}

export async function deliverMessageAdvanced(root: string, args: string[], compose: MessageCompose): Promise<JsonObject> {
  if (!compose.message.trim() && compose.attachments.length === 0 && !compose.reaction) return { ok: false, reason: 'empty-message' };
  if (compose.attachments.length > 0 && !args.includes('--file-consent')) {
    return { ok: false, reason: 'file-consent-required', attachments: compose.attachments.map((file) => path.basename(file)) };
  }
  const rate = await enforceChannelRateLimit(root, compose.channel, args);
  if (!rate.ok) return rate;
  const attachmentRecords = args.includes('--file-consent')
    ? await resolveAttachments(root, compose.attachments)
    : [];
  const targets = compose.targets.length > 0 ? compose.targets : [''];
  const receipts: JsonObject[] = [];
  for (const target of targets) {
    const result = await deliverMessage(root, compose.channel, target, compose.message, args, {
      attachments: attachmentRecords,
      threadId: compose.threadId,
      replyTo: compose.replyTo,
      reaction: compose.reaction,
      mentions: compose.mentions,
    });
    receipts.push({ target: target || '<default>', ...result });
  }
  return {
    ok: receipts.every((receipt) => Boolean(receipt.ok)),
    channel: resolveChannelAdapter(compose.channel).id,
    targets: receipts.length,
    receipts,
    attachments: attachmentRecords.map((item) => ({ file: item.file, bytes: item.bytes, sha256: item.sha256 })),
  };
}

export async function enforceChannelRateLimit(root: string, channel: string, args: string[]): Promise<JsonObject> {
  const normalized = resolveChannelAdapter(channel).id;
  const limit = readNumberFlag(args, 'rate-limit') || Number(getEnv(`${providerInference.envPrefix(normalized)}_RATE_LIMIT_PER_MINUTE`) || 20);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true };
  const file = path.join(stateDir(root), 'message-rate-limits.json');
  const records = await readArray(file);
  const now = Date.now();
  const recent = records.filter((entry) => {
    const item = entry as JsonObject;
    return String(item.channel) === normalized && now - Number(item.at || 0) < 60_000;
  });
  if (recent.length >= limit) {
    return { ok: false, reason: 'channel-rate-limit-exceeded', channel: normalized, limitPerMinute: limit };
  }
  recent.push({ channel: normalized, at: now });
  await writeJson(file, records.filter((entry) => now - Number((entry as JsonObject).at || 0) < 60_000).concat([{ channel: normalized, at: now }]));
  return { ok: true };
}

export async function resolveAttachments(root: string, attachments: string[]): Promise<Array<{ file: string; absolutePath: string; bytes: number; sha256: string; contentBase64?: string }>> {
  const records: Array<{ file: string; absolutePath: string; bytes: number; sha256: string; contentBase64?: string }> = [];
  for (const file of attachments) {
    const absolutePath = path.resolve(root, file);
    if (!isInside(root, absolutePath) || !existsSync(absolutePath)) continue;
    const raw = await fs.readFile(absolutePath);
    records.push({
      file: path.relative(root, absolutePath),
      absolutePath,
      bytes: raw.byteLength,
      sha256: sha256(raw),
      contentBase64: raw.byteLength <= 5_000_000 ? raw.toString('base64') : undefined,
    });
  }
  return records;
}

export async function deliverMessage(
  root: string,
  channel: string,
  target: string,
  message: string,
  args: string[],
  meta: {
    attachments?: Array<{ file: string; bytes: number; sha256: string; contentBase64?: string }>;
    threadId?: string;
    replyTo?: string;
    reaction?: string;
    mentions?: string[];
  } = {},
): Promise<JsonObject> {
  if (!message.trim() && !(meta.attachments || []).length && !meta.reaction) return { ok: false, reason: 'empty-message' };
  const adapter = resolveChannelAdapter(channel);
  const normalized = adapter.id;
  const text = message.trim() || `[${(meta.attachments || []).length} attachment(s)]`;
  try {
    if (normalized === 'telegram') {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = target || readFlag(args, 'chat-id') || process.env.TELEGRAM_DEFAULT_CHAT_ID;
      if (!token || !chatId) return { ok: false, reason: 'missing-telegram-token-or-chat-id' };
      if ((meta.attachments || []).length > 0) {
        const attachmentReceipts: JsonObject[] = [];
        for (const attachment of meta.attachments || []) {
          const fileResult = await sendTelegramDocument(token, chatId, text, attachment);
          attachmentReceipts.push(fileResult);
        }
        return { ok: attachmentReceipts.every((receipt) => Boolean(receipt.ok)), channel: 'telegram', attachments: attachmentReceipts };
      }
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: meta.replyTo || undefined }),
      });
      return { ok: response.ok, status: response.status, channel: 'telegram' };
    }
    if (normalized === 'matrix') {
      const baseUrl = getEnv('MATRIX_BASE_URL')?.replace(/\/$/u, '');
      const token = getEnv('MATRIX_ACCESS_TOKEN');
      const roomId = target || readFlag(args, 'room-id') || getEnv('MATRIX_DEFAULT_ROOM_ID');
      if (!baseUrl || !token || !roomId) return { ok: false, reason: 'missing-matrix-base-url-token-or-room-id' };
      const txnId = idWithTime('zavorth');
      const response = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ msgtype: 'm.text', body: text, 'm.relates_to': meta.replyTo ? { 'm.in_reply_to': { event_id: meta.replyTo } } : undefined }),
      });
      return { ok: response.ok, status: response.status, channel: normalized };
    }
    if (normalized === 'line') {
      const token = getEnv('LINE_CHANNEL_ACCESS_TOKEN');
      const recipient = target || readFlag(args, 'to') || getEnv('LINE_DEFAULT_TARGET_ID');
      if (!token || !recipient) return { ok: false, reason: 'missing-line-token-or-target' };
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: recipient, messages: [{ type: 'text', text }] }),
      });
      return { ok: response.ok, status: response.status, channel: normalized };
    }
    const webhook = readFlag(args, 'webhook-url') || providerInference.getFirstEnv(adapter.webhookEnv || []);
    if (webhook) {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(channelWebhookPayload(normalized, text, target, meta)),
      });
      return { ok: response.ok, status: response.status, channel: normalized, mode: 'webhook' };
    }
    const endpoint = providerInference.getFirstEnv(adapter.endpointEnv || []);
    if (endpoint) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: channelEndpointHeaders(adapter),
        body: JSON.stringify({ channel: normalized, target, recipients: target ? [target] : [], text, message: text, threadId: meta.threadId || null, replyTo: meta.replyTo || null, reaction: meta.reaction || null, mentions: meta.mentions || [], attachments: safeAttachmentMetadata(meta.attachments || []) }),
      });
      return { ok: response.ok, status: response.status, channel: normalized, mode: adapter.mode };
    }
    const script = providerInference.getFirstEnv(adapter.scriptEnv || []);
    if (script) {
      const result = await runChannelScript(script, adapter, target, text);
      return { ok: result.exitCode === 0, channel: normalized, mode: adapter.mode, exitCode: result.exitCode, durationMs: result.durationMs };
    }
    const outboxDir = getEnv(adapter.outboxEnv || '') || path.join(stateDir(root), 'outbox', normalized);
    if (adapter.outboxEnv && outboxDir) {
      const receipt = await writeChannelOutbox(outboxDir, normalized, target, text, meta);
      return { ok: true, channel: normalized, mode: 'outbox', receipt };
    }
    return { ok: false, reason: `missing-channel-config:${normalized}`, required: adapter.env };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[Zavorth Cli Live Namespaces] filesystem check failed', error);
    return { ok: false, reason: error instanceof Error ? err.message : String(error) };
  }
}

export async function readChannelMessages(channel: string, args: string[]): Promise<{ lines: string[]; payload: JsonObject }> {
  const normalized = channel.toLowerCase();
  try {
    if (normalized === 'telegram') {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return { lines: ['Telegram token is missing.'], payload: { ok: false, reason: 'missing-telegram-token' } };
      const limit = readNumberFlag(args, 'limit') || 5;
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates...limit=${limit}`);
      const data = await response.json() as { ok?: boolean; result?: Array<JsonObject> };
      const updates = Array.isArray(data.result) ? data.result.slice(-limit) : [];
      return {
        lines: updates.length
          ? updates.map((update) => {
              const message = (update.message || update.edited_message || {}) as JsonObject;
              const from = (message.from || {}) as JsonObject;
              return `- ${String(update.update_id)} | ${String(from.username || from.id || 'unknown')} | ${redact(String(message.text || '<non-text>'))}`;
            })
          : ['No Telegram updates returned.'],
        payload: { ok: response.ok && data.ok !== false, channel: 'telegram', count: updates.length },
      };
    }
    if (['matrix'].includes(normalized)) {
      const baseUrl = getEnv('MATRIX_BASE_URL')?.replace(/\/$/u, '');
      const token = getEnv('MATRIX_ACCESS_TOKEN');
      const roomId = readFlag(args, 'room-id') || getEnv('MATRIX_DEFAULT_ROOM_ID');
      if (!baseUrl || !token || !roomId) return { lines: ['Matrix base URL, access token or room id is missing.'], payload: { ok: false, reason: 'missing-matrix-base-url-token-or-room-id' } };
      const limit = readNumberFlag(args, 'limit') || 5;
      const response = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages...dir=b&limit=${limit}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await response.json() as { chunk?: Array<JsonObject> };
      const events = Array.isArray(data.chunk) ? data.chunk.slice(0, limit) : [];
      return {
        lines: events.length
          ? events.map((event) => {
              const content = (event.content || {}) as JsonObject;
              return `- ${String(event.event_id || event.origin_server_ts || 'event')} | ${redact(String(content.body || '<non-text>'))}`;
            })
          : ['No Matrix messages returned.'],
        payload: { ok: response.ok, channel: 'matrix', count: events.length },
      };
    }
    return { lines: [`Live read is not available for ${channel} yet.`], payload: { ok: false, reason: `unsupported-live-read:${channel}` } };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[Zavorth Cli Live Namespaces] load operation failed', error);
    return { lines: [`Live read failed: ${error instanceof Error ? err.message : String(error)}`], payload: { ok: false, reason: error instanceof Error ? err.message : String(error) } };
  }
}

export async function lookupChannelDirectory(channel: string, kind: 'self' | 'peers' | 'groups', args: string[]): Promise<{ lines: string[]; payload: JsonObject; entries: JsonObject[] }> {
  const normalized = resolveChannelAdapter(channel).id;
  try {
    if (normalized === 'telegram') {
      const token = getEnv('TELEGRAM_BOT_TOKEN');
      if (!token) return { lines: ['Telegram token is missing.'], payload: { ok: false, reason: 'missing-telegram-token' }, entries: [] };
      if (kind === 'self') {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json() as { ok?: boolean; result?: JsonObject };
        const bot = data.result || {};
        const entry = {
          id: 'telegram:self',
          channel: 'telegram',
          externalId: String(bot.id || ''),
          label: String(bot.username || bot.first_name || 'Telegram bot'),
          kind: 'self',
          source: 'telegram.getMe',
          syncedAt: new Date().toISOString(),
        };
        return { lines: [formatDirectoryEntry(entry)], payload: { ok: response.ok && data.ok !== false, entry }, entries: [entry] };
      }
      const limit = readNumberFlag(args, 'limit') || 50;
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates...limit=${limit}`);
      const data = await response.json() as { ok?: boolean; result?: Array<JsonObject> };
      const updates = Array.isArray(data.result) ? data.result : [];
      const map = new Map<string, JsonObject>();
      for (const update of updates) {
        const message = (update.message || update.edited_message || update.channel_post || {}) as JsonObject;
        const chat = (message.chat || {}) as JsonObject;
        const type = String(chat.type || '');
        const directoryKind = ['group', 'supergroup', 'channel'].includes(type) ? 'group' : 'peer';
        if ((kind === 'groups' && directoryKind !== 'group') || (kind === 'peers' && directoryKind !== 'peer')) continue;
        const externalId = String(chat.id || '');
        if (!externalId) continue;
        map.set(externalId, {
          id: `telegram:${externalId}`,
          channel: 'telegram',
          externalId,
          label: String(chat.title || chat.username || chat.first_name || externalId),
          kind: directoryKind,
          source: 'telegram.getUpdates',
          syncedAt: new Date().toISOString(),
        });
      }
      const entries = Array.from(map.values());
      return {
        lines: entries.length ? entries.map(formatDirectoryEntry) : ['No Telegram directory entries returned. Send a message to the bot first, then retry.'],
        payload: { ok: response.ok && data.ok !== false, count: entries.length, entries },
        entries,
      };
    }
    if (normalized === 'matrix') {
      const baseUrl = getEnv('MATRIX_BASE_URL')?.replace(/\/$/u, '');
      const token = getEnv('MATRIX_ACCESS_TOKEN');
      if (!baseUrl || !token) return { lines: ['Matrix base URL or access token is missing.'], payload: { ok: false, reason: 'missing-matrix-base-url-or-token' }, entries: [] };
      if (kind === 'self') {
        const response = await fetch(`${baseUrl}/_matrix/client/v3/account/whoami`, { headers: { authorization: `Bearer ${token}` } });
        const data = await response.json() as JsonObject;
        const entry = { id: `matrix:${String(data.user_id || 'self')}`, channel: 'matrix', externalId: String(data.user_id || ''), label: String(data.user_id || 'Matrix user'), kind: 'self', source: 'matrix.whoami', syncedAt: new Date().toISOString() };
        return { lines: [formatDirectoryEntry(entry)], payload: { ok: response.ok, entry }, entries: [entry] };
      }
      const response = await fetch(`${baseUrl}/_matrix/client/v3/joined_rooms`, { headers: { authorization: `Bearer ${token}` } });
      const data = await response.json() as { joined_rooms?: string[] };
      const entries = (data.joined_rooms || []).map((roomId) => ({ id: `matrix:${roomId}`, channel: 'matrix', externalId: roomId, label: roomId, kind: 'group', source: 'matrix.joined_rooms', syncedAt: new Date().toISOString() }));
      return { lines: entries.length ? entries.map(formatDirectoryEntry) : ['No Matrix rooms returned.'], payload: { ok: response.ok, count: entries.length, entries }, entries };
    }
    return { lines: [`Live directory lookup is not available for ${channel} yet. Use zavorth directory add to store trusted IDs locally.`], payload: { ok: false, reason: `unsupported-live-directory:${channel}` }, entries: [] };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[Zavorth Cli Live Namespaces] load operation failed', error);
    return { lines: [`Live directory lookup failed: ${error instanceof Error ? err.message : String(error)}`], payload: { ok: false, reason: error instanceof Error ? err.message : String(error) }, entries: [] };
  }
}

export async function createPairingDraft(root: string, input: { channel: string; target: string; label: string; ttlMinutes: number }): Promise<JsonObject> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttlMinutes * 60_000).toISOString();
  const code = createHash('sha256').update(`${root}:${input.channel}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 10).toUpperCase();
  const id = idWithTime('pairing');
  const uri = `zavorth://pair...pairing=${encodeURIComponent(id)}&channel=${encodeURIComponent(input.channel)}&code=${encodeURIComponent(code)}`;
  const record = {
    id,
    channel: resolveChannelAdapter(input.channel).id,
    target: input.target || null,
    label: input.label,
    status: 'pending',
    code,
    codeHash: hashPairingCode(code),
    uri,
    createdAt: now.toISOString(),
    expiresAt,
    ttlMinutes: input.ttlMinutes,
  };
  const file = path.join(stateDir(root), 'pairings.json');
  const pairings = await readArray(file);
  const { code: _code, uri: _uri, ...storedRecord } = record;
  pairings.push(storedRecord);
  await writeJson(file, pairings);
  return record;
}

export async function renderTerminalQr(value: string): Promise<string> {
  try {
    const loader = Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ default?: { toString?: unknown }; toString?: unknown }>;
    const module = await loader('qrcode');
    const toString = (module.toString || module.default?.toString) as ((text: string, options: JsonObject) => Promise<string>) | undefined;
    if (!toString) return '';
    return (await toString(value, { type: 'terminal', small: true, margin: 1 })).trim();
  } catch (error: unknown) {logger.warn('[Zavorth Cli Live Namespaces] load operation failed', error); return ''; }
}

export function hashPairingCode(code: string): string {
  return createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');
}

export function pairingExpired(pairing: JsonObject): boolean {
  const expiresAt = Date.parse(String(pairing.expiresAt || ''));
  return Number.isFinite(expiresAt) && expiresAt < Date.now();
}

export function redactPairingRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.code) item.code = redact(String(item.code));
  if (item.codeHash) item.codeHash = '***';
  if (item.uri) item.uri = String(item.uri).replace(/code=[^&]+/u, 'code=***');
  return item;
}

export function formatDirectoryEntry(value: unknown): string {
  const item = (value || {}) as JsonObject;
  return `- ${String(item.channel || 'channel')} | ${String(item.kind || 'entry')} | ${String(item.label || item.externalId || item.id || 'unknown')} | ${String(item.externalId || item.id || '')}`;
}

export function mergeDirectoryEntries(existing: unknown[], incoming: JsonObject[]): JsonObject[] {
  const map = new Map<string, JsonObject>();
  for (const entry of existing) {
    const item = entry as JsonObject;
    map.set(`${String(item.channel)}:${String(item.externalId || item.id)}`, item);
  }
  for (const item of incoming) {
    map.set(`${String(item.channel)}:${String(item.externalId || item.id)}`, item);
  }
  return Array.from(map.values());
}

export function isChannelConfigured(channel: string): boolean {
  return channelStatus(channel).configured;
}

export function resolveChannelAdapter(channel: string): ChannelAdapter {
  const normalized = String(channel || 'unknown').trim().toLowerCase();
  return CHANNEL_ADAPTERS.find((adapter) => {
    return adapter.id === normalized || (adapter.aliases || []).includes(normalized);
  }) || {
    id: normalized,
    mode: 'outbox',
    env: [`${providerInference.envPrefix(normalized)}_WEBHOOK_URL or ${providerInference.envPrefix(normalized)}_OUTBOX_DIR`],
    webhookEnv: [`${providerInference.envPrefix(normalized)}_WEBHOOK_URL`],
    outboxEnv: `${providerInference.envPrefix(normalized)}_OUTBOX_DIR`,
  };
}

export function channelStatus(channel: string): { id: string; configured: boolean; mode: ChannelAdapterMode | 'outbox-ready'; required: string[] } {
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
    providerInference.getFirstEnv(adapter.webhookEnv || [])
    || providerInference.getFirstEnv(adapter.endpointEnv || [])
    || providerInference.getFirstEnv(adapter.scriptEnv || [])
    || getEnv(adapter.outboxEnv || ''),
  );
  return { id: adapter.id, configured, mode: configured ? adapter.mode : 'outbox-ready', required: adapter.env };
}

export function channelWebhookPayload(channel: string, message: string, target: string, meta: { attachments?: Array<{ file: string; bytes: number; sha256: string }>; threadId?: string; replyTo?: string; reaction?: string; mentions?: string[] } = {}): JsonObject {
  const rich = { threadId: meta.threadId || null, replyTo: meta.replyTo || null, reaction: meta.reaction || null, mentions: meta.mentions || [], attachments: safeAttachmentMetadata(meta.attachments || []) };
  if (channel === 'discord') return { content: message, ...rich };
  if (channel === 'slack' || channel === 'google-chat' || channel === 'mattermost' || channel === 'synology-chat' || channel === 'clickclack' || channel === 'nextcloud-talk') {
    return { text: message, ...rich };
  }
  if (channel === 'feishu') return { msg_type: 'text', content: { text: message }, ...rich };
  if (channel === 'wecom') return { msgtype: 'text', text: { content: message }, ...rich };
  return { source: 'zavorth', channel, target, text: message, message, ...rich };
}

export function channelEndpointHeaders(adapter: ChannelAdapter): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = providerInference.getFirstEnv(adapter.tokenEnv || []);
  if (token) headers.authorization = `Bearer ${token}`;
  if (adapter.id === 'signal' && getEnv('SIGNAL_BRIDGE_TOKEN')) headers.authorization = `Bearer ${getEnv('SIGNAL_BRIDGE_TOKEN')}`;
  if (adapter.id === 'imessage' && getEnv('IMESSAGE_BRIDGE_TOKEN')) headers.authorization = `Bearer ${getEnv('IMESSAGE_BRIDGE_TOKEN')}`;
  return headers;
}

export async function writeChannelOutbox(outboxDir: string, channel: string, target: string, message: string, meta: {
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

export async function sendTelegramDocument(token: string, chatId: string, caption: string, attachment: { file: string; contentBase64?: string }): Promise<JsonObject> {
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

export function safeAttachmentMetadata(attachments: Array<{ file: string; bytes: number; sha256: string }>): JsonObject[] {
  return attachments.map((attachment) => ({
    file: attachment.file,
    bytes: attachment.bytes,
    sha256: attachment.sha256,
  }));
}

export async function runChannelScript(script: string, adapter: ChannelAdapter, target: string, message: string): Promise<{ exitCode: number; durationMs: number }> {
  if (adapter.id === 'signal') {
    const account = getEnv('SIGNAL_ACCOUNT_NUMBER');
    const recipients = splitList(target || getEnv('SIGNAL_ALLOWED_RECIPIENTS') || '');
    if (!account || recipients.length === 0) return { exitCode: 1, durationMs: 0 };
    const result = await runProcess(script, ['-u', account, 'send', '-m', message, ...recipients], process.cwd(), 30000);
    return { exitCode: result.exitCode, durationMs: result.durationMs };
  }
  const recipients = target ? [target] : splitList(getEnv(`${providerInference.envPrefix(adapter.id)}_DEFAULT_RECIPIENTS`) || '');
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
