import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'alert';
  title: string;
  message: string;
  channel: 'internal' | 'email' | 'sms' | 'push' | 'webhook';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  created_at: string;
  sent_at: string | null;
  read_at: string | null;
  metadata: Record<string, unknown>;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'webhook';
  enabled: boolean;
  config: Record<string, unknown>;
}

export class NotificationCenterService {
  private readonly storageDir: string;
  private notifications: Notification[] = [];
  private channels: Map<string, NotificationChannel> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'notifications');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadData();
    this.initDefaultChannels();
  }

  private loadData(): void {
    try {
      const n = path.join(this.storageDir, 'notifications.json');
      if (fs.existsSync(n)) this.notifications = JSON.parse(fs.readFileSync(n, 'utf-8'));
    } catch (error: unknown) {/* ignore */ logger.warn('[Notification Center] JSON parse failed', error); }
    try {
      const c = path.join(this.storageDir, 'channels.json');
      if (fs.existsSync(c)) {
        const data = JSON.parse(fs.readFileSync(c, 'utf-8'));
        if (Array.isArray(data)) for (const ch of data) this.channels.set(ch.id, ch);
      }
    } catch (error: unknown) {/* ignore */ logger.warn('[Notification Center] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'notifications.json'), JSON.stringify(this.notifications.slice(-1000), null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'channels.json'), JSON.stringify(Array.from(this.channels.values()), null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  private initDefaultChannels(): void {
    if (this.channels.size > 0) return;
    const defaults: Array<Omit<NotificationChannel, 'config'>> = [
      { id: 'internal', name: 'Internal', type: 'push', enabled: true },
      { id: 'email', name: 'Email', type: 'email', enabled: false },
      { id: 'sms', name: 'SMS', type: 'sms', enabled: false },
      { id: 'webhook', name: 'Webhook', type: 'webhook', enabled: false },
    ];
    for (const d of defaults) {
      this.channels.set(d.id, { ...d, config: {} });
    }
    this.scheduleFlush();
  }

  public send(title: string, message: string, options?: {
    type?: Notification['type'];
    channel?: Notification['channel'];
    priority?: Notification['priority'];
    metadata?: Record<string, unknown>;
  }): string {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const notification: Notification = {
      id, title, message,
      type: options?.type || 'info',
      channel: options?.channel || 'internal',
      priority: options?.priority || 'medium',
      status: 'pending',
      created_at: new Date().toISOString(),
      sent_at: null, read_at: null,
      metadata: options?.metadata || {},
    };

    this.notifications.push(notification);

    // Auto-send based on channel
    const channel = this.channels.get(notification.channel);
    if (channel && channel.enabled) {
      notification.status = 'sent';
      notification.sent_at = new Date().toISOString();
    } else {
      notification.status = 'sent';
      notification.sent_at = new Date().toISOString();
    }

    this.scheduleFlush();
    return `Notification sent: "${title}" (${notification.channel})`;
  }

  public markAsRead(notificationId: string): string {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (!notification) return `Error: notification "${notificationId}" not found.`;
    notification.status = 'read';
    notification.read_at = new Date().toISOString();
    this.scheduleFlush();
    return `Notification "${notification.title}" marked as read.`;
  }

  public getUnread(): string {
    const unread = this.notifications.filter((n) => n.status !== 'read');
    if (unread.length === 0) return 'No unread notifications.';
    return ['Unread Notifications:', ...unread.slice(0, 10).map((n) => `  [${n.priority}] ${n.title}: ${n.message.slice(0, 50)}`)].join('\n');
  }

  public getByType(type: Notification['type']): string {
    const filtered = this.notifications.filter((n) => n.type === type);
    if (filtered.length === 0) return `No ${type} notifications.`;
    return [`${type} Notifications:`, ...filtered.slice(0, 10).map((n) => `  ${n.title}: ${n.message.slice(0, 50)}`)].join('\n');
  }

  public getByPriority(priority: Notification['priority']): string {
    const filtered = this.notifications.filter((n) => n.priority === priority);
    if (filtered.length === 0) return `No ${priority} priority notifications.`;
    return [`${priority} Priority Notifications:`, ...filtered.slice(0, 10).map((n) => `  ${n.title}: ${n.message.slice(0, 50)}`)].join('\n');
  }

  public addChannel(name: string, type: NotificationChannel['type'], config: Record<string, unknown> = {}): string {
    const id = `channel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.channels.set(id, { id, name, type, enabled: true, config });
    this.scheduleFlush();
    return `Channel "${name}" added (${id})`;
  }

  public enableChannel(channelId: string): string {
    const channel = this.channels.get(channelId);
    if (!channel) return `Error: channel "${channelId}" not found.`;
    channel.enabled = true;
    this.scheduleFlush();
    return `Channel "${channel.name}" enabled.`;
  }

  public disableChannel(channelId: string): string {
    const channel = this.channels.get(channelId);
    if (!channel) return `Error: channel "${channelId}" not found.`;
    channel.enabled = false;
    this.scheduleFlush();
    return `Channel "${channel.name}" disabled.`;
  }

  public listChannels(): string {
    if (this.channels.size === 0) return 'No channels configured.';
    const lines: string[] = ['Notification Channels:'];
    for (const [, ch] of this.channels) {
      const icon = ch.enabled ? '✅' : '❌';
      lines.push(`  ${icon} ${ch.id}: ${ch.name} (${ch.type})`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    const total = this.notifications.length;
    const unread = this.notifications.filter((n) => n.status !== 'read').length;
    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const n of this.notifications) {
      byType[n.type] = (byType[n.type] || 0) + 1;
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
    }
    return [
      'Notification Stats:',
      `  Total: ${total}`,
      `  Unread: ${unread}`,
      `  Channels: ${this.channels.size}`,
      '  By type:',
      ...Object.entries(byType).map(([t, c]) => `    ${t}: ${c}`),
      '  By priority:',
      ...Object.entries(byPriority).map(([p, c]) => `    ${p}: ${c}`),
    ].join('\n');
  }

  public clearOld(days: number = 30): string {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const before = this.notifications.length;
    this.notifications = this.notifications.filter((n) => new Date(n.created_at) > cutoff);
    const removed = before - this.notifications.length;
    this.scheduleFlush();
    return `Cleared ${removed} notifications older than ${days} days.`;
  }
}
