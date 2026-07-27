import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WindowManager } from '../../../apps/zavorth-desktop/src/lib/WindowManager';

const mockBounds = { x: 100, y: 100, width: 800, height: 600 };

const createMockBrowserWindow = () => {
  const win = {
    loadURL: jest.fn() as jest.MockedFunction<() => void>,
    close: jest.fn() as jest.MockedFunction<() => void>,
    focus: jest.fn() as jest.MockedFunction<() => void>,
    minimize: jest.fn() as jest.MockedFunction<() => void>,
    maximize: jest.fn() as jest.MockedFunction<() => void>,
    unmaximize: jest.fn() as jest.MockedFunction<() => void>,
    isDestroyed: jest.fn().mockReturnValue(false) as jest.MockedFunction<() => boolean>,
    isFocused: jest.fn().mockReturnValue(false) as jest.MockedFunction<() => boolean>,
    isVisible: jest.fn().mockReturnValue(true) as jest.MockedFunction<() => boolean>,
    isMaximized: jest.fn().mockReturnValue(false) as jest.MockedFunction<() => boolean>,
    getBounds: jest.fn().mockReturnValue(mockBounds) as jest.MockedFunction<() => typeof mockBounds>,
    getTitle: jest.fn().mockReturnValue('Test Window') as jest.MockedFunction<() => string>,
    webContents: {
      send: jest.fn() as jest.MockedFunction<(channel: string, data: unknown) => void>,
    },
    on: jest.fn() as jest.MockedFunction<(event: string, callback: () => void) => void>,
  };
  return win;
};

let mockBrowserWindows: ReturnType<typeof createMockBrowserWindow>[];
let nextMockWinIndex: number;

jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => {
    const mockWin = createMockBrowserWindow();
    mockBrowserWindows.push(mockWin);
    return mockWin;
  }),
}));

describe('WindowManager', () => {
  let manager: WindowManager;
  let store: Record<string, string>;
  let mockGetItem: jest.MockedFunction<(key: string) => string | null>;
  let mockSetItem: jest.MockedFunction<(key: string, value: string) => void>;

  beforeEach(() => {
    manager = new WindowManager();
    mockBrowserWindows = [];
    nextMockWinIndex = 0;
    store = {};

    mockGetItem = jest.fn((key: string) => store[key] || null);
    mockSetItem = jest.fn((key: string, value: string) => {
      store[key] = value;
    });

    globalThis.localStorage = {
      getItem: mockGetItem,
      setItem: mockSetItem,
      removeItem: jest.fn((key: string) => { delete store[key]; }),
      clear: jest.fn(() => { Object.keys(store).forEach(key => delete store[key]); }),
      get length() { return Object.keys(store).length; },
      key: jest.fn((index: number) => Object.keys(store)[index] || null),
    };

    jest.clearAllMocks();
    mockBrowserWindows = [];
  });

  describe('Create and close windows', () => {
    it('creates a window with given config', () => {
      const win = manager.createWindow({
        id: 'win-1',
        title: 'Main Window',
        width: 1024,
        height: 768,
      });

      expect(win).toBeDefined();
      expect(mockBrowserWindows[0]).toBeDefined();
      expect(mockBrowserWindows[0].loadURL).not.toHaveBeenCalled();
    });

    it('creates a window with URL', () => {
      manager.createWindow({
        id: 'win-1',
        title: 'Window',
        width: 800,
        height: 600,
        url: 'https://example.com',
      });

      expect(mockBrowserWindows[0].loadURL).toHaveBeenCalledWith('https://example.com');
    });

    it('creates a window with custom options', () => {
      manager.createWindow({
        id: 'win-1',
        title: 'Window',
        width: 800,
        height: 600,
        resizable: false,
        alwaysOnTop: true,
        x: 50,
        y: 50,
        webPreferences: { contextIsolation: true },
      });

      const { BrowserWindow } = require('electron');
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          resizable: false,
          alwaysOnTop: true,
          x: 50,
          y: 50,
          webPreferences: { contextIsolation: true },
        })
      );
    });

    it('closes a window', () => {
      manager.createWindow({
        id: 'win-1',
        title: 'Window',
        width: 800,
        height: 600,
      });

      manager.closeWindow('win-1');
      expect(mockBrowserWindows[0].close).toHaveBeenCalled();
    });

    it('closes all windows', () => {
      manager.createWindow({ id: 'win-1', title: 'group-1', width: 800, height: 600 });
      manager.createWindow({ id: 'win-2', title: 'group-2', width: 800, height: 600 });

      manager.closeAllWindows();

      expect(mockBrowserWindows[0].close).toHaveBeenCalled();
      expect(mockBrowserWindows[1].close).toHaveBeenCalled();
    });

    it('does not throw when closing already destroyed window', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      mockBrowserWindows[0].isDestroyed.mockReturnValue(true);

      expect(() => manager.closeWindow('win-1')).not.toThrow();
      expect(mockBrowserWindows[0].close).not.toHaveBeenCalled();
    });
  });

  describe('Track window state', () => {
    it('returns window info for existing window', () => {
      manager.createWindow({
        id: 'win-1',
        title: 'Window',
        width: 800,
        height: 600,
        group: 'main',
      });

      const info = manager.getWindow('win-1');
      expect(info).not.toBeNull();
      expect(info!.id).toBe('win-1');
      expect(info!.group).toBe('main');
      expect(info!.bounds).toEqual(mockBounds);
    });

    it('returns null for non-existent window', () => {
      expect(manager.getWindow('non-existent')).toBeNull();
    });

    it('lists all windows', () => {
      manager.createWindow({ id: 'win-1', title: 'group-1', width: 800, height: 600 });
      manager.createWindow({ id: 'win-2', title: 'group-2', width: 800, height: 600 });

      const windows = manager.listWindows();
      expect(windows).toHaveLength(2);
      expect(windows.map(w => w.id)).toEqual(expect.arrayContaining(['win-1', 'win-2']));
    });

    it('returns empty list when no windows exist', () => {
      expect(manager.listWindows()).toEqual([]);
    });

    it('returns focused state', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      mockBrowserWindows[0].isFocused.mockReturnValue(true);

      const info = manager.getWindow('win-1');
      expect(info!.focused).toBe(true);
    });

    it('returns visible state', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      mockBrowserWindows[0].isVisible.mockReturnValue(false);

      const info = manager.getWindow('win-1');
      expect(info!.visible).toBe(false);
    });

    it('returns null for destroyed window', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      mockBrowserWindows[0].isDestroyed.mockReturnValue(true);

      expect(manager.getWindow('win-1')).toBeNull();
    });
  });

  describe('Group windows', () => {
    it('creates a window with a group', () => {
      manager.createWindow({
        id: 'win-1',
        title: 'W',
        width: 800,
        height: 600,
        group: 'editors',
      });

      const groupWindows = manager.getWindowsByGroup('editors');
      expect(groupWindows).toHaveLength(1);
      expect(groupWindows[0].id).toBe('win-1');
    });

    it('groups multiple windows', () => {
      manager.createWindow({ id: 'win-1', title: 'group-1', width: 800, height: 600 });
      manager.createWindow({ id: 'win-2', title: 'group-2', width: 800, height: 600 });
      manager.createWindow({ id: 'win-3', title: 'group-3', width: 800, height: 600 });

      manager.groupWindows(['win-1', 'win-2', 'win-3'], 'panel');

      const groupWindows = manager.getWindowsByGroup('panel');
      expect(groupWindows).toHaveLength(3);
    });

    it('returns empty array for non-existent group', () => {
      expect(manager.getWindowsByGroup('non-existent')).toEqual([]);
    });

    it('ungroups windows', () => {
      manager.createWindow({ id: 'win-1', title: 'group-1', width: 800, height: 600 });
      manager.createWindow({ id: 'win-2', title: 'group-2', width: 800, height: 600 });
      manager.groupWindows(['win-1', 'win-2'], 'panel');
      manager.ungroupWindows(['win-1']);

      const groupWindows = manager.getWindowsByGroup('panel');
      expect(groupWindows).toHaveLength(1);
      expect(groupWindows[0].id).toBe('win-2');
    });

    it('removes group when last window is ungrouped', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      manager.groupWindows(['win-1'], 'panel');
      manager.ungroupWindows(['win-1']);

      expect(manager.getWindowsByGroup('panel')).toEqual([]);
    });
  });

  describe('Save/load window state', () => {
    it('saves window state to localStorage', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      manager.saveState();

      expect(mockSetItem).toHaveBeenCalledWith(
        'zavorth-window-state',
        expect.any(String)
      );
    });

    it('loads saved window state', () => {
      const savedState = {
        'win-1': { id: 'win-1', title: 'W', width: 800, height: 600, x: 100, y: 100 },
      };
      mockGetItem.mockReturnValueOnce(JSON.stringify(savedState));

      const configs = manager.loadState();
      expect(configs).toHaveLength(1);
      expect(configs[0].id).toBe('win-1');
    });

    it('returns empty array when no saved state', () => {
      mockGetItem.mockReturnValueOnce(null);

      expect(manager.loadState()).toEqual([]);
    });
  });

  describe('Save/load presets', () => {
    it('saves a preset', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      manager.savePreset('default');

      expect(mockSetItem).toHaveBeenCalledWith(
        'zavorth-window-presets',
        expect.stringContaining('default')
      );
    });

    it('loads a preset by name', () => {
      const presets = [
        {
          name: 'default',
          windows: [{ id: 'win-1', title: 'W', width: 800, height: 600 }],
        },
      ];
      mockGetItem.mockReturnValueOnce(JSON.stringify(presets));

      const configs = manager.loadPreset('default');
      expect(configs).toHaveLength(1);
      expect(configs[0].id).toBe('win-1');
    });

    it('returns empty array for non-existent preset', () => {
      mockGetItem.mockReturnValueOnce(null);

      expect(manager.loadPreset('non-existent')).toEqual([]);
    });

    it('lists all presets', () => {
      const presets = [
        { name: 'preset-1', windows: [] },
        { name: 'preset-2', windows: [] },
      ];
      mockGetItem.mockReturnValueOnce(JSON.stringify(presets));

      const listed = manager.listPresets();
      expect(listed).toHaveLength(2);
    });

    it('overwrites existing preset with same name', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      manager.savePreset('default');
      manager.savePreset('default');

      const calls = mockSetItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      const presets = JSON.parse(lastCall[1]);
      expect(presets).toHaveLength(1);
    });
  });

  describe('Send messages between windows', () => {
    it('sends a message to a window', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });

      manager.sendMessage({
        from: 'sender',
        to: 'win-1',
        channel: 'test-channel',
        data: { value: 42 },
      });

      expect(mockBrowserWindows[0].webContents.send).toHaveBeenCalledWith('test-channel', {
        from: 'sender',
        data: { value: 42 },
      });
    });

    it('does not throw when sending to non-existent window', () => {
      expect(() => {
        manager.sendMessage({
          from: 'sender',
          to: 'non-existent',
          channel: 'test',
          data: null,
        });
      }).not.toThrow();
    });
  });

  describe('Focus/minimize/maximize', () => {
    it('focuses a window', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      manager.focusWindow('win-1');

      expect(mockBrowserWindows[0].focus).toHaveBeenCalled();
    });

    it('minimizes a window', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      manager.minimizeWindow('win-1');

      expect(mockBrowserWindows[0].minimize).toHaveBeenCalled();
    });

    it('maximizes a window', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      manager.maximizeWindow('win-1');

      expect(mockBrowserWindows[0].maximize).toHaveBeenCalled();
    });

    it('unmaximizes a window that is already maximized', () => {
      manager.createWindow({ id: 'win-1', title: 'W', width: 800, height: 600 });
      mockBrowserWindows[0].isMaximized.mockReturnValue(true);

      manager.maximizeWindow('win-1');

      expect(mockBrowserWindows[0].unmaximize).toHaveBeenCalled();
      expect(mockBrowserWindows[0].maximize).not.toHaveBeenCalled();
    });

    it('does not throw when operating on non-existent window', () => {
      expect(() => manager.focusWindow('non-existent')).not.toThrow();
      expect(() => manager.minimizeWindow('non-existent')).not.toThrow();
      expect(() => manager.maximizeWindow('non-existent')).not.toThrow();
    });
  });

  describe('Handle non-existent windows', () => {
    it('closeWindow does not throw for non-existent id', () => {
      expect(() => manager.closeWindow('non-existent')).not.toThrow();
    });

    it('getWindow returns null for non-existent id', () => {
      expect(manager.getWindow('non-existent')).toBeNull();
    });

    it('focusWindow does not throw for non-existent id', () => {
      expect(() => manager.focusWindow('non-existent')).not.toThrow();
    });

    it('minimizeWindow does not throw for non-existent id', () => {
      expect(() => manager.minimizeWindow('non-existent')).not.toThrow();
    });

    it('maximizeWindow does not throw for non-existent id', () => {
      expect(() => manager.maximizeWindow('non-existent')).not.toThrow();
    });

    it('sendMessage does not throw for non-existent id', () => {
      expect(() => {
        manager.sendMessage({
          from: 'sender',
          to: 'non-existent',
          channel: 'test',
          data: null,
        });
      }).not.toThrow();
    });
  });
});
