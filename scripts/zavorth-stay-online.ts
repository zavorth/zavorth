#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { ZavorthStayOnlineService, type ZavorthStayOnlineSnapshot } from '../src/services/ZavorthStayOnlineService.js';

type NotifyChannel = 'terminal' | 'telegram';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write([
      'Zavorth Stay Online',
      '',
      'Usage:',
      '  zavorth stay-online',
      '  zavorth stay-online --watch --interval=60s',
      '  zavorth stay-online --watch --notify-telegram',
      '  zavorth stay-online --watch --max-checks=3 --interval=10s',
      '',
      'Options:',
      '  --json                Print snapshots as JSON lines.',
      '  --offline             Do not refresh provider live proof.',
      '  --refresh-providers   Refresh provider live proof explicitly.',
      '  --notify-telegram     Send changes and alerts to Telegram.',
      '                        Uses learned chat ids; TELEGRAM_ALLOWED_USER_IDS only authorizes inbound users.',
      '  --notify-terminal     Print only relevant notification changes in watch mode.',
      '  --notify-ok-every=N   Send a periodic OK every N checks.',
      '  --notify-start-ok     Also notify when the first check is healthy.',
      '  --notify-warnings     Also send repeated warning updates; critical changes always notify.',
      '  --notify-cooldown=N   Minimum time between repeated notifications, default 30m.',
      '  --verbose             Print the full report every check; watch mode prints compact lines by default.',
      '',
    ].join('\n'));
    return;
  }
  const service = new ZavorthStayOnlineService();
  const watch = args.includes('--watch') || args.includes('watch');
  const asJson = args.includes('--json');
  const requirePass = args.includes('--require-pass') || args.includes('--strict');
  const intervalMs = readDurationMsFlag(args, 'interval') || readDurationMsFlag(args, 'every') || 60_000;
  const maxChecks = readNumberFlag(args, 'max-checks');
  const writeSnapshot = !args.includes('--no-write');
  const notifyChannels = resolveNotifyChannels(args);
  const notifyOkEvery = readNumberFlag(args, 'notify-ok-every');
  const notifyReadyOnStart = args.includes('--notify-start-ok') || args.includes('--notify-ready-on-start');
  const notifyWarnings = args.includes('--notify-warnings') || args.includes('--notify-attention');
  const notifyCooldownMs = readDurationMsFlag(args, 'notify-cooldown') || 30 * 60_000;
  const refreshProviders = args.includes('--refresh-providers') && !args.includes('--offline');
  const verbose = args.includes('--verbose') || args.includes('--full');
  let previous: ZavorthStayOnlineSnapshot | null = readPreviousSnapshot(service.snapshotPath);
  let latest: ZavorthStayOnlineSnapshot | null = null;
  let stopped = false;
  const lockPath = path.join(path.dirname(service.snapshotPath), 'zavorth-stay-online.lock.json');
  const notificationStatePath = path.join(path.dirname(service.snapshotPath), 'zavorth-stay-online-notifications.json');
  let ownsLock = false;

  if (watch && !args.includes('--no-lock')) {
    const existing = readLock(lockPath);
    if (existing && existing.pid !== process.pid && isProcessAlive(existing.pid)) {
      process.stdout.write(`[stay-online] watcher ja esta ativo no PID ${existing.pid}. Lock: ${lockPath}\n`);
      return;
    }
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, `${JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      intervalMs,
      notifyTelegram: notifyChannels.includes('telegram'),
      command: 'zavorth stay-online --watch',
    }, null, 2)}\n`, 'utf8');
    ownsLock = true;
  }

  process.once('SIGINT', () => {
    stopped = true;
  });
  process.once('SIGTERM', () => {
    stopped = true;
  });

  for (let sequence = 1; !stopped; sequence += 1) {
    const snapshot = await service.buildSnapshot({
      refreshProviders,
      writeSnapshot,
      intervalMs,
      sequence,
      userId: readFlexibleStringFlag(args, 'user-id') || 'operator',
      sessionId: readFlexibleStringFlag(args, 'session-id') || 'stay-online',
      workspaceHint: readFlexibleStringFlag(args, 'workspace') || process.cwd(),
    });
    latest = snapshot;

    const notification = service.buildNotification({
      previous,
      current: snapshot,
      notifyOkEvery,
      notifyReadyOnStart,
      notifyWarnings,
    });

    if (asJson) {
      process.stdout.write(`${JSON.stringify(snapshot)}\n`);
    } else if (watch && !verbose) {
      if (notification.shouldNotify) {
        process.stdout.write(`[stay-online] ${notification.compactLogLine}\n`);
      }
    } else {
      process.stdout.write(service.renderCli(snapshot));
    }

    if (notification.shouldNotify) {
      const delivery = resolveNotificationDelivery(notificationStatePath, snapshot, notification, notifyCooldownMs);
      if (delivery.shouldSend) {
        await publishNotification(notification.message, notifyChannels);
        writeNotificationState(notificationStatePath, {
          signature: delivery.signature,
          sentAt: new Date().toISOString(),
          reason: notification.reason,
          status: snapshot.status,
        });
      } else if (notifyChannels.includes('terminal') && verbose) {
        process.stdout.write(`[stay-online] notification suppressed: ${delivery.reason}\n`);
      }
    }
    previous = snapshot;

    if (!watch || (maxChecks !== null && sequence >= maxChecks)) {
      break;
    }

    await delay(intervalMs);
  }

  if (latest && (latest.status === 'blocked' || (requirePass && latest.status !== 'ready'))) {
    process.exitCode = 1;
  }
  if (ownsLock) {
    clearOwnedLock(lockPath);
  }
}

function readLock(lockPath: string): { pid: number } | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { pid?: unknown };
    const pid = Number(parsed.pid || 0);
    return Number.isFinite(pid) && pid > 0 ? { pid } : null;
  } catch {
    return null;
  }
}

function readPreviousSnapshot(snapshotPath: string): ZavorthStayOnlineSnapshot | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as ZavorthStayOnlineSnapshot;
    return parsed?.surface === 'zavorth-stay-online' ? parsed : null;
  } catch {
    return null;
  }
}

function clearOwnedLock(lockPath: string): void {
  const lock = readLock(lockPath);
  if (lock?.pid !== process.pid) {
    return;
  }
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // best-effort lock cleanup
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function resolveNotifyChannels(args: string[]): NotifyChannel[] {
  const channels = new Set<NotifyChannel>();
  if (args.includes('--notify-terminal')) {
    channels.add('terminal');
  }
  if (
    args.includes('--notify-telegram')
    || args.includes('--telegram')
    || String(process.env.ZAVORTH_STAY_ONLINE_NOTIFY || '').toLowerCase().includes('telegram')
  ) {
    channels.add('telegram');
  }
  return [...channels];
}

function resolveNotificationDelivery(
  statePath: string,
  snapshot: ZavorthStayOnlineSnapshot,
  notification: ReturnType<ZavorthStayOnlineService['buildNotification']>,
  cooldownMs: number,
): { shouldSend: boolean; signature: string; reason: string } {
  if (notification.reason === 'quiet') {
    return { shouldSend: false, signature: '', reason: 'quiet' };
  }
  const signature = notificationSignature(snapshot, notification.reason);
  const previous = readNotificationState(statePath);
  const previousTime = previous?.sentAt ? Date.parse(previous.sentAt) : 0;
  const now = Date.now();
  if (
    previous?.signature === signature
    && Number.isFinite(previousTime)
    && previousTime > 0
    && now - previousTime < cooldownMs
  ) {
    return { shouldSend: false, signature, reason: 'cooldown' };
  }
  return { shouldSend: true, signature, reason: 'send' };
}

function notificationSignature(
  snapshot: ZavorthStayOnlineSnapshot,
  reason: ReturnType<ZavorthStayOnlineService['buildNotification']>['reason'],
): string {
  return [
    reason,
    snapshot.status,
    snapshot.remoteReady ? 'remote-ready' : 'remote-not-ready',
    `required=${snapshot.summary.requiredBlocked}`,
    `providerFailed=${snapshot.summary.providerLiveFailed}`,
    `keepalive=${snapshot.summary.keepaliveOk ? 'ok' : 'not-ok'}`,
    snapshot.alerts.map((alert) => `${alert.id}:${alert.severity}:${alert.command || ''}`).join('|'),
  ].join(';');
}

function readNotificationState(statePath: string): {
  signature?: string;
  sentAt?: string;
  reason?: string;
  status?: string;
} | null {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeNotificationState(
  statePath: string,
  state: { signature: string; sentAt: string; reason: string; status: string },
): void {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  } catch {
    // best-effort notification dedupe
  }
}

async function publishNotification(message: string, channels: NotifyChannel[]): Promise<void> {
  if (channels.includes('terminal')) {
    process.stdout.write(`[stay-online notification]\n${message}\n`);
  }
  if (channels.includes('telegram')) {
    await publishTelegram(message);
  }
}

async function publishTelegram(message: string): Promise<void> {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatIds = resolveTelegramNotificationChatIds();
  if (!token || chatIds.length === 0 || typeof globalThis.fetch !== 'function') {
    process.stdout.write('[stay-online] Telegram notification skipped: bot token or chat ids missing.\n');
    return;
  }

  await Promise.all(chatIds.map(async (chatId) => {
    try {
      const response = await globalThis.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          disable_web_page_preview: true,
        }),
      });
      if (!response.ok) {
        process.stdout.write(`[stay-online] Telegram notification failed for chat ${maskChatId(chatId)}: HTTP ${response.status}\n`);
      }
    } catch (error) {
      process.stdout.write(`[stay-online] Telegram notification failed for chat ${maskChatId(chatId)}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }));
}

function resolveTelegramNotificationChatIds(): string[] {
  const explicit = parseList(process.env.ZAVORTH_STAY_ONLINE_NOTIFY_CHAT_IDS || '');
  if (explicit.length > 0) {
    return explicit;
  }

  const registry = readAuthorizedTelegramChatIds();
  if (registry.length > 0) {
    return registry;
  }

  return parseList(process.env.TELEGRAM_ALLOWED_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '');
}

function readAuthorizedTelegramChatIds(): string[] {
  try {
    const registryPath = path.join(process.cwd(), 'data', 'runtime', 'telegram-authorized-chats.json');
    const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { chats?: Array<{ chatId?: unknown }> };
    return Array.from(new Set((parsed.chats || [])
      .map((chat) => String(chat.chatId || '').trim())
      .filter((chatId) => /^-?\d+$/.test(chatId))));
  } catch {
    return [];
  }
}

function parseList(value: string): string[] {
  return String(value || '')
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter((entry) => /^-?\d+$/.test(entry) || /^@[a-zA-Z0-9_]{5,}$/.test(entry));
}

function maskChatId(value: string): string {
  return value.length <= 4 ? '***' : `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(1, ms)));
}

function readNumberFlag(argv: string[], name: string): number | null {
  const raw = readFlexibleStringFlag(argv, name);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function readDurationMsFlag(argv: string[], name: string): number | null {
  const raw = readFlexibleStringFlag(argv, name);
  if (!raw) return null;
  const match = raw.trim().match(/^(\d+)(ms|s|m|h)?$/i);
  if (!match) return readNumberFlag(argv, name);
  const value = Number(match[1]);
  const unit = String(match[2] || 'ms').toLowerCase();
  const factor = unit === 'h' ? 60 * 60 * 1000 : unit === 'm' ? 60 * 1000 : unit === 's' ? 1000 : 1;
  return Number.isFinite(value) ? value * factor : null;
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

main().catch((error) => {
  console.error('[zavorth-stay-online] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
