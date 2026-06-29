import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';

export interface WindowConfig {
  id: string;
  title: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  url?: string;
  group?: string;
  resizable?: boolean;
  alwaysOnTop?: boolean;
  webPreferences?: Record<string, unknown>;
}

export interface WindowInfo {
  id: string;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
  group?: string;
  focused: boolean;
  visible: boolean;
}

export interface WindowMessage {
  from: string;
  to: string;
  channel: string;
  data: unknown;
}

export interface WindowPreset {
  name: string;
  windows: WindowConfig[];
}

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  private windowConfigs: Map<string, WindowConfig> = new Map();
  private groups: Map<string, Set<string>> = new Map();
  private stateKey = 'zavorth-window-state';
  private presetsKey = 'zavorth-window-presets';

  createWindow(config: WindowConfig): BrowserWindow {
    const options: BrowserWindowConstructorOptions = {
      width: config.width,
      height: config.height,
      x: config.x,
      y: config.y,
      title: config.title,
      resizable: config.resizable ?? true,
      alwaysOnTop: config.alwaysOnTop ?? false,
      webPreferences: config.webPreferences ?? {},
    };

    const win = new BrowserWindow(options);

    if (config.url) {
      win.loadURL(config.url);
    }

    win.on('closed', () => {
      this.cleanupWindow(config.id);
    });

    this.windows.set(config.id, win);
    this.windowConfigs.set(config.id, config);

    if (config.group) {
      this.addToGroup(config.id, config.group);
    }

    return win;
  }

  closeWindow(windowId: string): void {
    const win = this.windows.get(windowId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  }

  closeAllWindows(): void {
    for (const [id, win] of this.windows) {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
    this.windows.clear();
    this.windowConfigs.clear();
    this.groups.clear();
  }

  getWindow(windowId: string): WindowInfo | null {
    const win = this.windows.get(windowId);
    if (!win || win.isDestroyed()) {
      return null;
    }

    const bounds = win.getBounds();
    return {
      id: windowId,
      title: win.getTitle(),
      bounds,
      group: this.windowConfigs.get(windowId)?.group,
      focused: win.isFocused(),
      visible: win.isVisible(),
    };
  }

  listWindows(): WindowInfo[] {
    const windows: WindowInfo[] = [];
    for (const [id] of this.windows) {
      const info = this.getWindow(id);
      if (info) {
        windows.push(info);
      }
    }
    return windows;
  }

  focusWindow(windowId: string): void {
    const win = this.windows.get(windowId);
    if (win && !win.isDestroyed()) {
      win.focus();
    }
  }

  minimizeWindow(windowId: string): void {
    const win = this.windows.get(windowId);
    if (win && !win.isDestroyed()) {
      win.minimize();
    }
  }

  maximizeWindow(windowId: string): void {
    const win = this.windows.get(windowId);
    if (win && !win.isDestroyed()) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  }

  sendMessage(message: WindowMessage): void {
    const win = this.windows.get(message.to);
    if (win && !win.isDestroyed()) {
      win.webContents.send(message.channel, {
        from: message.from,
        data: message.data,
      });
    }
  }

  groupWindows(windowIds: string[], groupName: string): void {
    for (const id of windowIds) {
      this.addToGroup(id, groupName);
    }
  }

  ungroupWindows(windowIds: string[]): void {
    for (const id of windowIds) {
      this.removeFromGroup(id);
    }
  }

  getWindowsByGroup(groupName: string): WindowInfo[] {
    const groupWindows = this.groups.get(groupName);
    if (!groupWindows) {
      return [];
    }

    const windows: WindowInfo[] = [];
    for (const id of groupWindows) {
      const info = this.getWindow(id);
      if (info) {
        windows.push(info);
      }
    }
    return windows;
  }

  saveState(): void {
    const states: Record<string, WindowConfig> = {};

    for (const [id, config] of this.windowConfigs) {
      const win = this.windows.get(id);
      if (win && !win.isDestroyed()) {
        const bounds = win.getBounds();
        states[id] = {
          ...config,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        };
      }
    }

    localStorage.setItem(this.stateKey, JSON.stringify(states));
  }

  loadState(): WindowConfig[] {
    const statesJson = localStorage.getItem(this.stateKey);
    if (!statesJson) {
      return [];
    }

    const states = JSON.parse(statesJson) as Record<string, WindowConfig>;
    return Object.values(states);
  }

  savePreset(name: string): void {
    const preset: WindowPreset = {
      name,
      windows: Array.from(this.windowConfigs.values()),
    };

    const presets = this.getPresetsFromStorage();
    const existingIndex = presets.findIndex((p) => p.name === name);

    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }

    localStorage.setItem(this.presetsKey, JSON.stringify(presets));
  }

  loadPreset(name: string): WindowConfig[] {
    const presets = this.getPresetsFromStorage();
    const preset = presets.find((p) => p.name === name);
    return preset ? preset.windows : [];
  }

  listPresets(): WindowPreset[] {
    return this.getPresetsFromStorage();
  }

  private addToGroup(windowId: string, groupName: string): void {
    if (!this.groups.has(groupName)) {
      this.groups.set(groupName, new Set());
    }
    this.groups.get(groupName)!.add(windowId);

    const config = this.windowConfigs.get(windowId);
    if (config) {
      config.group = groupName;
    }
  }

  private removeFromGroup(windowId: string): void {
    const config = this.windowConfigs.get(windowId);
    if (config?.group) {
      const groupWindows = this.groups.get(config.group);
      if (groupWindows) {
        groupWindows.delete(windowId);
        if (groupWindows.size === 0) {
          this.groups.delete(config.group);
        }
      }
      config.group = undefined;
    }
  }

  private cleanupWindow(windowId: string): void {
    this.removeFromGroup(windowId);
    this.windows.delete(windowId);
    this.windowConfigs.delete(windowId);
  }

  private getPresetsFromStorage(): WindowPreset[] {
    const presetsJson = localStorage.getItem(this.presetsKey);
    if (!presetsJson) {
      return [];
    }
    return JSON.parse(presetsJson) as WindowPreset[];
  }
}