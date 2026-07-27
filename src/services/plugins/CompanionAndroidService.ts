import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface AndroidDevice {
  id: string;
  name: string;
  token: string;
  android_version: string;
  app_version: string;
  registered_at: string;
  last_seen: string;
  push_enabled: boolean;
  widget_enabled: boolean;
  tasker_enabled: boolean;
  quick_settings_enabled: boolean;
}

export interface AndroidNotification {
  id: string;
  device_id: string;
  title: string;
  body: string;
  channel: string;
  priority: 'low' | 'default' | 'high';
  sent_at: string;
  delivered: boolean;
  data: Record<string, unknown>;
}

export interface AndroidWidget {
  id: string;
  widget_type: string;
  title: string;
  content: string;
  layout_type: 'list' | 'card' | 'chart' | 'shortcut';
  updated_at: string;
  ttl_seconds: number;
  metadata: Record<string, unknown>;
}

export interface TaskerProfile {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  actions: Array<{ type: string; params: Record<string, unknown> }>;
  enabled: boolean;
  created_at: string;
}

export interface QuickSettingsTile {
  id: string;
  label: string;
  icon: string;
  action: string;
  state: 'active' | 'inactive';
  created_at: string;
}

export class CompanionAndroidService {
  private readonly storageDir: string;
  private devices: Map<string, AndroidDevice> = new Map();
  private notifications: AndroidNotification[] = [];
  private widgets: Map<string, AndroidWidget> = new Map();
  private taskerProfiles: Map<string, TaskerProfile> = new Map();
  private tiles: Map<string, QuickSettingsTile> = new Map();
  private readonly MAX_NOTIFICATIONS = 500;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'android-companion');
    this.ensureStorageDir();
    this.loadData();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadData(): void {
    const files = ['devices.json', 'notifications.json', 'widgets.json', 'tasker.json', 'tiles.json'];
    const keys = ['devices', 'notifications', 'widgets', 'tasker', 'tiles'] as const;

    for (let i = 0; i < files.length; i++) {
      const filePath = path.join(this.storageDir, files[i]);
      if (!fs.existsSync(filePath)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        switch (keys[i]) {
          case 'devices':
            for (const [id, d] of Object.entries(data as Record<string, AndroidDevice>)) this.devices.set(id, d);
            break;
          case 'notifications':
            this.notifications = data as AndroidNotification[];
            break;
          case 'widgets':
            for (const [id, w] of Object.entries(data as Record<string, AndroidWidget>)) this.widgets.set(id, w);
            break;
          case 'tasker':
            for (const [id, p] of Object.entries(data as Record<string, TaskerProfile>)) this.taskerProfiles.set(id, p);
            break;
          case 'tiles':
            for (const [id, t] of Object.entries(data as Record<string, QuickSettingsTile>)) this.tiles.set(id, t);
            break;
        }
      } catch (error: unknown) {/* ignore */ logger.warn('[Companion Android] operation failed', error); }
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
        fs.writeFileSync(path.join(this.storageDir, 'tasker.json'), JSON.stringify(Object.fromEntries(this.taskerProfiles), null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'tiles.json'), JSON.stringify(Object.fromEntries(this.tiles), null, 2), 'utf-8');
      } catch (error: unknown) {
        logger.warn('[DeferredFlush] deferred flush failed', error);
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public registerDevice(name: string, token: string, options?: { android_version?: string; app_version?: string }): string {
    const id = `android_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const device: AndroidDevice = {
      id,
      name,
      token,
      android_version: options?.android_version || '14',
      app_version: options?.app_version || '1.0.0',
      registered_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      push_enabled: true,
      widget_enabled: true,
      tasker_enabled: true,
      quick_settings_enabled: true,
    };

    this.devices.set(id, device);
    this.scheduleFlush();
    return `Android device registered: ${id} (${name})`;
  }

  public unregisterDevice(deviceId: string): string {
    if (!this.devices.has(deviceId)) return `Error: device "${deviceId}" not found.`;
    this.devices.delete(deviceId);
    this.scheduleFlush();
    return `Device "${deviceId}" unregistered.`;
  }

  public sendNotification(deviceId: string, title: string, body: string, options?: { channel?: string; priority?: 'low' | 'default' | 'high'; data?: Record<string, unknown> }): string {
    const device = this.devices.get(deviceId);
    if (!device) return `Error: device "${deviceId}" not found.`;
    if (!device.push_enabled) return `Error: push notifications disabled for "${deviceId}".`;

    const notification: AndroidNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      device_id: deviceId,
      title,
      body,
      channel: options?.channel || 'general',
      priority: options?.priority || 'default',
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
    return `Notification sent to ${device.name}: "${title}"`;
  }

  public broadcastNotification(title: string, body: string, options?: { channel?: string; priority?: 'low' | 'default' | 'high' }): string {
    let sent = 0;
    for (const device of this.devices.values()) {
      if (device.push_enabled) {
        this.sendNotification(device.id, title, body, options);
        sent++;
      }
    }
    return `Broadcast notification sent to ${sent} device(s).`;
  }

  public updateWidget(widgetType: string, title: string, content: string, options?: { layout_type?: 'list' | 'card' | 'chart' | 'shortcut'; ttl_seconds?: number; metadata?: Record<string, unknown> }): string {
    const id = `widget_${widgetType}`;
    const widget: AndroidWidget = {
      id,
      widget_type: widgetType,
      title,
      content,
      layout_type: options?.layout_type || 'card',
      updated_at: new Date().toISOString(),
      ttl_seconds: options?.ttl_seconds || 3600,
      metadata: options?.metadata || {},
    };

    this.widgets.set(id, widget);
    this.scheduleFlush();
    return `Widget "${widgetType}" updated: "${title}" (layout: ${widget.layout_type})`;
  }

  public getWidgetData(widgetType: string): string {
    const widget = this.widgets.get(`widget_${widgetType}`);
    if (!widget) return `No widget data for "${widgetType}".`;
    const age = (Date.now() - new Date(widget.updated_at).getTime()) / 1000;
    if (age > widget.ttl_seconds) return `Widget "${widgetType}" data expired.`;

    return [
      `Widget: ${widget.widget_type}`,
      `  Title: ${widget.title}`,
      `  Content: ${widget.content}`,
      `  Layout: ${widget.layout_type}`,
      `  Updated: ${widget.updated_at}`,
      `  TTL: ${widget.ttl_seconds}s`,
    ].join('\n');
  }

  public createTaskerProfile(name: string, description: string, triggers: string[], actions: Array<{ type: string; params: Record<string, unknown> }>): string {
    const id = `tasker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const profile: TaskerProfile = {
      id,
      name,
      description,
      triggers,
      actions,
      enabled: true,
      created_at: new Date().toISOString(),
    };

    this.taskerProfiles.set(id, profile);
    this.scheduleFlush();
    return `Tasker profile created: ${id} (${name}) with ${triggers.length} triggers and ${actions.length} actions.`;
  }

  public toggleTaskerProfile(profileId: string, enabled: boolean): string {
    const profile = this.taskerProfiles.get(profileId);
    if (!profile) return `Error: Tasker profile "${profileId}" not found.`;
    profile.enabled = enabled;
    this.scheduleFlush();
    return `Tasker profile "${profile.name}" ${enabled ? 'enabled' : 'disabled'}.`;
  }

  public removeTaskerProfile(profileId: string): string {
    if (!this.taskerProfiles.has(profileId)) return `Error: Tasker profile "${profileId}" not found.`;
    this.taskerProfiles.delete(profileId);
    this.scheduleFlush();
    return `Tasker profile "${profileId}" removed.`;
  }

  public listTaskerProfiles(): string {
    if (this.taskerProfiles.size === 0) return 'No Tasker profiles.';

    const lines: string[] = [`Tasker Profiles (${this.taskerProfiles.size}):`];
    for (const profile of this.taskerProfiles.values()) {
      const status = profile.enabled ? '[ON]' : '[OFF]';
      lines.push(`  ${status} ${profile.id}: ${profile.name} - ${profile.description}`);
      lines.push(`    Triggers: ${profile.triggers.join(', ')}`);
    }
    return lines.join('\n');
  }

  public registerQuickSettingsTile(label: string, icon: string, action: string): string {
    const id = `tile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tile: QuickSettingsTile = {
      id,
      label,
      icon,
      action,
      state: 'inactive',
      created_at: new Date().toISOString(),
    };

    this.tiles.set(id, tile);
    this.scheduleFlush();
    return `Quick Settings tile registered: ${id} (${label})`;
  }

  public removeQuickSettingsTile(tileId: string): string {
    if (!this.tiles.has(tileId)) return `Error: tile "${tileId}" not found.`;
    this.tiles.delete(tileId);
    this.scheduleFlush();
    return `Quick Settings tile "${tileId}" removed.`;
  }

  public toggleTile(tileId: string): string {
    const tile = this.tiles.get(tileId);
    if (!tile) return `Error: tile "${tileId}" not found.`;
    tile.state = tile.state === 'active' ? 'inactive' : 'active';
    this.scheduleFlush();
    return `Tile "${tile.label}" is now ${tile.state}.`;
  }

  public listTiles(): string {
    if (this.tiles.size === 0) return 'No Quick Settings tiles.';

    const lines: string[] = [`Quick Settings Tiles (${this.tiles.size}):`];
    for (const tile of this.tiles.values()) {
      const icon = tile.state === 'active' ? '[ON]' : '[OFF]';
      lines.push(`  ${icon} ${tile.id}: ${tile.label} (${tile.icon}) -> ${tile.action}`);
    }
    return lines.join('\n');
  }

  public getDevice(deviceId: string): string {
    const device = this.devices.get(deviceId);
    if (!device) return `Error: device "${deviceId}" not found.`;

    return [
      `Android Device: ${device.id}`,
      `  Name: ${device.name}`,
      `  Android: ${device.android_version}`,
      `  App version: ${device.app_version}`,
      `  Push: ${device.push_enabled ? 'enabled' : 'disabled'}`,
      `  Widgets: ${device.widget_enabled ? 'enabled' : 'disabled'}`,
      `  Tasker: ${device.tasker_enabled ? 'enabled' : 'disabled'}`,
      `  Quick Settings: ${device.quick_settings_enabled ? 'enabled' : 'disabled'}`,
      `  Registered: ${device.registered_at}`,
      `  Last seen: ${device.last_seen}`,
    ].join('\n');
  }

  public listDevices(): string {
    if (this.devices.size === 0) return 'No Android devices registered.';

    const lines: string[] = [`Android Devices (${this.devices.size}):`];
    for (const device of this.devices.values()) {
      lines.push(`  ${device.id}: ${device.name} | Android ${device.android_version} | Last seen: ${device.last_seen.slice(0, 10)}`);
    }
    return lines.join('\n');
  }

  public getNotifications(limit: number = 20): string {
    if (this.notifications.length === 0) return 'No notifications sent.';

    const recent = this.notifications.slice(-limit);
    const lines: string[] = [`Recent notifications (${recent.length}):`];
    for (const notif of recent) {
      const device = this.devices.get(notif.device_id);
      lines.push(`  [${notif.priority}] ${device?.name || notif.device_id}: ${notif.title} ? ${notif.body.slice(0, 50)}`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    const activeDevices = Array.from(this.devices.values()).filter((d) => {
      const age = (Date.now() - new Date(d.last_seen).getTime()) / (1000 * 60 * 60 * 24);
      return age < 30;
    }).length;

    const activeTiles = Array.from(this.tiles.values()).filter((t) => t.state === 'active').length;
    const enabledProfiles = Array.from(this.taskerProfiles.values()).filter((p) => p.enabled).length;

    return [
      `Android Companion Stats:`,
      `  Devices: ${this.devices.size} registered, ${activeDevices} active (30d)`,
      `  Notifications sent: ${this.notifications.length}`,
      `  Widgets: ${this.widgets.size}`,
      `  Tasker profiles: ${this.taskerProfiles.size} (${enabledProfiles} enabled)`,
      `  Quick Settings tiles: ${this.tiles.size} (${activeTiles} active)`,
      `  Push enabled devices: ${Array.from(this.devices.values()).filter((d) => d.push_enabled).length}`,
    ].join('\n');
  }
}
