import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface IOSDevice {
  id: string;
  name: string;
  token: string;
  platform_version: string;
  app_version: string;
  registered_at: string;
  last_seen: string;
  push_enabled: boolean;
  widget_enabled: boolean;
  shortcuts_enabled: boolean;
  handoff_enabled: boolean;
}

export interface PushNotification {
  id: string;
  device_id: string;
  title: string;
  body: string;
  category: string;
  priority: 'normal' | 'high';
  sent_at: string;
  delivered: boolean;
  data: Record<string, unknown>;
}

export interface WidgetData {
  id: string;
  widget_type: string;
  title: string;
  content: string;
  updated_at: string;
  ttl_seconds: number;
  metadata: Record<string, unknown>;
}

export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, string>;
  created_at: string;
}

export class CompanionIOSService {
  private readonly storageDir: string;
  private devices: Map<string, IOSDevice> = new Map();
  private notifications: PushNotification[] = [];
  private widgets: Map<string, WidgetData> = new Map();
  private shortcuts: Map<string, ShortcutAction> = new Map();
  private readonly MAX_NOTIFICATIONS = 500;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'ios-companion');
    this.ensureStorageDir();
    this.loadData();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadData(): void {
    const devicesPath = path.join(this.storageDir, 'devices.json');
    const notificationsPath = path.join(this.storageDir, 'notifications.json');
    const widgetsPath = path.join(this.storageDir, 'widgets.json');
    const shortcutsPath = path.join(this.storageDir, 'shortcuts.json');

    if (fs.existsSync(devicesPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(devicesPath, 'utf-8'));
        for (const [id, dev] of Object.entries(data as Record<string, IOSDevice>)) this.devices.set(id, dev);
      } catch (error: unknown) {/* ignore */ logger.warn('[Companion I O S] JSON parse failed', error); }
    }
    if (fs.existsSync(notificationsPath)) {
      try { this.notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf-8')); } catch (error: unknown) {/* ignore */ logger.warn('[Companion I O S] JSON parse failed', error); }
    }
    if (fs.existsSync(widgetsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(widgetsPath, 'utf-8'));
        for (const [id, w] of Object.entries(data as Record<string, WidgetData>)) this.widgets.set(id, w);
      } catch (error: unknown) {/* ignore */ logger.warn('[Companion I O S] JSON parse failed', error); }
    }
    if (fs.existsSync(shortcutsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(shortcutsPath, 'utf-8'));
        for (const [id, s] of Object.entries(data as Record<string, ShortcutAction>)) this.shortcuts.set(id, s);
      } catch (error: unknown) {/* ignore */ logger.warn('[Companion I O S] JSON parse failed', error); }
    }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.dirty) return;
      this.dirty = false;
      try {
        if (!fs.existsSync(this.storageDir)) {
          fs.mkdirSync(this.storageDir, { recursive: true });
        }
        fs.writeFileSync(path.join(this.storageDir, 'devices.json'), JSON.stringify(Object.fromEntries(this.devices), null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'notifications.json'), JSON.stringify(this.notifications, null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'widgets.json'), JSON.stringify(Object.fromEntries(this.widgets), null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'shortcuts.json'), JSON.stringify(Object.fromEntries(this.shortcuts), null, 2), 'utf-8');
      } catch (error: unknown) {
        logger.warn('[DeferredFlush] deferred flush failed', error);
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public registerDevice(name: string, token: string, options?: { platform_version?: string; app_version?: string }): string {
    const id = `ios_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const device: IOSDevice = {
      id,
      name,
      token,
      platform_version: options?.platform_version || '17.0',
      app_version: options?.app_version || '1.0.0',
      registered_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      push_enabled: true,
      widget_enabled: true,
      shortcuts_enabled: true,
      handoff_enabled: true,
    };

    this.devices.set(id, device);
    this.scheduleFlush();
    return `iOS device registered: ${id} (${name})`;
  }

  public unregisterDevice(deviceId: string): string {
    if (!this.devices.has(deviceId)) return `Error: device "${deviceId}" not found.`;
    this.devices.delete(deviceId);
    this.scheduleFlush();
    return `Device "${deviceId}" unregistered.`;
  }

  public sendPushNotification(deviceId: string, title: string, body: string, options?: { category?: string; priority?: 'normal' | 'high'; data?: Record<string, unknown> }): string {
    const device = this.devices.get(deviceId);
    if (!device) return `Error: device "${deviceId}" not found.`;
    if (!device.push_enabled) return `Error: push notifications disabled for "${deviceId}".`;

    const notification: PushNotification = {
      id: `push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      device_id: deviceId,
      title,
      body,
      category: options?.category || 'general',
      priority: options?.priority || 'normal',
      sent_at: new Date().toISOString(),
      delivered: true,
      data: options?.data || {},
    };

    this.notifications.push(notification);
    if (this.notifications.length > this.MAX_NOTIFICATIONS) {
      this.notifications.splice(0, this.notifications.length - this.MAX_NOTIFICATIONS);
    }

    device.last_seen = new Date().toISOString();
    this.scheduleFlush();
    return `Push notification sent to ${device.name}: "${title}"`;
  }

  public broadcastPush(title: string, body: string, options?: { category?: string; priority?: 'normal' | 'high' }): string {
    let sent = 0;
    for (const device of this.devices.values()) {
      if (device.push_enabled) {
        this.sendPushNotification(device.id, title, body, options);
        sent++;
      }
    }
    return `Broadcast push sent to ${sent} device(s).`;
  }

  public updateWidget(widgetType: string, title: string, content: string, options?: { ttl_seconds?: number; metadata?: Record<string, unknown> }): string {
    const id = `widget_${widgetType}`;
    const widget: WidgetData = {
      id,
      widget_type: widgetType,
      title,
      content,
      updated_at: new Date().toISOString(),
      ttl_seconds: options?.ttl_seconds || 3600,
      metadata: options?.metadata || {},
    };

    this.widgets.set(id, widget);
    this.scheduleFlush();
    return `Widget "${widgetType}" updated: "${title}"`;
  }

  public getWidgetData(widgetType: string): WidgetData | null {
    const widget = this.widgets.get(`widget_${widgetType}`);
    if (!widget) return null;
    const age = (Date.now() - new Date(widget.updated_at).getTime()) / 1000;
    if (age > widget.ttl_seconds) return null;
    return widget;
  }

  public getWidgetDataAsString(widgetType: string): string {
    const widget = this.getWidgetData(widgetType);
    if (!widget) return `No widget data for "${widgetType}" or data expired.`;
    return [
      `Widget: ${widget.widget_type}`,
      `  Title: ${widget.title}`,
      `  Content: ${widget.content}`,
      `  Updated: ${widget.updated_at}`,
      `  TTL: ${widget.ttl_seconds}s`,
    ].join('\n');
  }

  public registerShortcut(name: string, description: string, parameters: Record<string, string>): string {
    const id = `shortcut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const shortcut: ShortcutAction = {
      id,
      name,
      description,
      parameters,
      created_at: new Date().toISOString(),
    };

    this.shortcuts.set(id, shortcut);
    this.scheduleFlush();
    return `Shortcut registered: ${id} (${name})`;
  }

  public removeShortcut(shortcutId: string): string {
    if (!this.shortcuts.has(shortcutId)) return `Error: shortcut "${shortcutId}" not found.`;
    this.shortcuts.delete(shortcutId);
    this.scheduleFlush();
    return `Shortcut "${shortcutId}" removed.`;
  }

  public listShortcuts(): string {
    if (this.shortcuts.size === 0) return 'No shortcuts registered.';

    const lines: string[] = [`iOS Shortcuts (${this.shortcuts.size}):`];
    for (const shortcut of this.shortcuts.values()) {
      const params = Object.keys(shortcut.parameters).join(', ');
      lines.push(`  ${shortcut.id}: ${shortcut.name} - ${shortcut.description}${params ? ` [${params}]` : ''}`);
    }
    return lines.join('\n');
  }

  public enableHandoff(deviceId: string): string {
    const device = this.devices.get(deviceId);
    if (!device) return `Error: device "${deviceId}" not found.`;
    device.handoff_enabled = true;
    this.scheduleFlush();
    return `Handoff enabled for ${device.name}.`;
  }

  public disableHandoff(deviceId: string): string {
    const device = this.devices.get(deviceId);
    if (!device) return `Error: device "${deviceId}" not found.`;
    device.handoff_enabled = false;
    this.scheduleFlush();
    return `Handoff disabled for ${device.name}.`;
  }

  public createHandoffPayload(activityType: string, userInfo: Record<string, unknown>): string {
    const payload = {
      activityType,
      userInfo,
      timestamp: new Date().toISOString(),
    };
    const filePath = path.join(this.storageDir, 'handoff_payload.json');
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return `Handoff payload created for activity "${activityType}".`;
  }

  public getDevice(deviceId: string): string {
    const device = this.devices.get(deviceId);
    if (!device) return `Error: device "${deviceId}" not found.`;

    return [
      `iOS Device: ${device.id}`,
      `  Name: ${device.name}`,
      `  Platform: iOS ${device.platform_version}`,
      `  App version: ${device.app_version}`,
      `  Push: ${device.push_enabled ? 'enabled' : 'disabled'}`,
      `  Widgets: ${device.widget_enabled ? 'enabled' : 'disabled'}`,
      `  Shortcuts: ${device.shortcuts_enabled ? 'enabled' : 'disabled'}`,
      `  Handoff: ${device.handoff_enabled ? 'enabled' : 'disabled'}`,
      `  Registered: ${device.registered_at}`,
      `  Last seen: ${device.last_seen}`,
    ].join('\n');
  }

  public listDevices(): string {
    if (this.devices.size === 0) return 'No iOS devices registered.';

    const lines: string[] = [`iOS Devices (${this.devices.size}):`];
    for (const device of this.devices.values()) {
      lines.push(`  ${device.id}: ${device.name} | iOS ${device.platform_version} | Last seen: ${device.last_seen.slice(0, 10)}`);
    }
    return lines.join('\n');
  }

  public getNotifications(limit: number = 20): string {
    if (this.notifications.length === 0) return 'No notifications sent.';

    const recent = this.notifications.slice(-limit);
    const lines: string[] = [`Recent notifications (${recent.length}):`];
    for (const notif of recent) {
      const device = this.devices.get(notif.device_id);
      lines.push(`  [${notif.priority}] ${device?.name || notif.device_id}: ${notif.title} - ${notif.body.slice(0, 50)}`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    const activeDevices = Array.from(this.devices.values()).filter((d) => {
      const age = (Date.now() - new Date(d.last_seen).getTime()) / (1000 * 60 * 60 * 24);
      return age < 30;
    }).length;

    return [
      `iOS Companion Stats:`,
      `  Devices: ${this.devices.size} registered, ${activeDevices} active (30d)`,
      `  Notifications sent: ${this.notifications.length}`,
      `  Widgets: ${this.widgets.size}`,
      `  Shortcuts: ${this.shortcuts.size}`,
      `  Push enabled devices: ${Array.from(this.devices.values()).filter((d) => d.push_enabled).length}`,
      `  Handoff enabled devices: ${Array.from(this.devices.values()).filter((d) => d.handoff_enabled).length}`,
    ].join('\n');
  }
}
