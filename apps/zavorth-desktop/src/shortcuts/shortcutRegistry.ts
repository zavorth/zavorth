export type ShortcutActionId =
  | 'commandPalette.open'
  | 'sidebar.toggle'
  | 'terminal.toggle'
  | 'settings.open'
  | 'message.send'
  | 'message.newLine'
  | 'command.execute'
  | 'history.previous'
  | 'history.next'
  | 'terminal.interrupt'
  | 'terminal.clear'
  | 'shortcuts.open'
  | 'panel.close'
  | 'app.quit';

export type ShortcutBinding = {
  actionId: ShortcutActionId;
  group: string;
  description: string;
  keys: string[];
  configurable: boolean;
};

export const SHORTCUT_STORAGE_KEY = 'zvd:keyboard-shortcuts:v1';

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  binding('commandPalette.open', 'Navigation', 'Command Palette', ['Ctrl', 'K']),
  binding('sidebar.toggle', 'Navigation', 'Toggle Sidebar', ['Ctrl', 'B']),
  binding('terminal.toggle', 'Navigation', 'Toggle Terminal', ['Ctrl', 'J']),
  binding('settings.open', 'Navigation', 'Open Settings', ['Ctrl', ',']),
  binding('message.send', 'Chat', 'Send Message', ['Enter']),
  binding('message.newLine', 'Chat', 'New Line', ['Shift', 'Enter']),
  binding('command.execute', 'Chat', 'Execute Command', ['Ctrl', 'Enter']),
  binding('history.previous', 'Chat', 'Navigate History Up', ['ArrowUp']),
  binding('history.next', 'Chat', 'Navigate History Down', ['ArrowDown']),
  binding('terminal.interrupt', 'Terminal', 'Interrupt Process', ['Ctrl', 'C']),
  binding('terminal.clear', 'Terminal', 'Clear Terminal', ['Ctrl', 'L']),
  binding('shortcuts.open', 'General', 'Show Shortcuts', ['?']),
  binding('panel.close', 'General', 'Close Panel', ['Esc']),
  binding('app.quit', 'General', 'Quit Application', ['Ctrl', 'Q']),
];

export function loadShortcutBindings(storage?: Pick<Storage, 'getItem'> | null): ShortcutBinding[] {
  if (!storage) {
    return DEFAULT_SHORTCUTS;
  }
  try {
    const raw = storage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SHORTCUTS;
    }
    const overrides = JSON.parse(raw) as Record<string, string[]>;
    return DEFAULT_SHORTCUTS.map(shortcut => ({
      ...shortcut,
      keys: normalizeShortcutKeys(overrides[shortcut.actionId] || shortcut.keys),
    }));
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export function saveShortcutBinding(
  actionId: ShortcutActionId,
  keys: string[],
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): ShortcutBinding[] {
  const normalized = normalizeShortcutKeys(keys);
  if (!storage || normalized.length === 0) {
    return loadShortcutBindings(storage);
  }
  const current = loadShortcutBindings(storage);
  const overrides = Object.fromEntries(
    current.map(shortcut => [shortcut.actionId, shortcut.keys]),
  ) as Record<string, string[]>;
  overrides[actionId] = normalized;
  storage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(overrides));
  return loadShortcutBindings(storage);
}

export function resetShortcutBindings(storage?: Pick<Storage, 'removeItem'> | null): ShortcutBinding[] {
  storage?.removeItem(SHORTCUT_STORAGE_KEY);
  return DEFAULT_SHORTCUTS;
}

export function groupShortcutBindings(bindings: ShortcutBinding[]): Array<{ title: string; shortcuts: ShortcutBinding[] }> {
  const groups = new Map<string, ShortcutBinding[]>();
  for (const shortcut of bindings) {
    const current = groups.get(shortcut.group) || [];
    current.push(shortcut);
    groups.set(shortcut.group, current);
  }
  return Array.from(groups.entries()).map(([title, shortcuts]) => ({ title, shortcuts }));
}

export function shortcutLabel(keys: string[]): string {
  return normalizeShortcutKeys(keys).join(' + ');
}

export function normalizeShortcutKeys(keys: string[] | string): string[] {
  const rawKeys = Array.isArray(keys) ? keys : String(keys || '').split('+');
  const normalized = rawKeys
    .map(key => key.trim())
    .filter(Boolean)
    .map(normalizeKeyName);
  return Array.from(new Set(normalized));
}

function binding(
  actionId: ShortcutActionId,
  group: string,
  description: string,
  keys: string[],
): ShortcutBinding {
  return { actionId, group, description, keys, configurable: true };
}

function normalizeKeyName(key: string): string {
  const lower = key.toLowerCase();
  if (lower === 'control') return 'Ctrl';
  if (lower === 'cmd' || lower === 'command' || lower === 'meta') return 'Meta';
  if (lower === 'option') return 'Alt';
  if (lower === 'escape') return 'Esc';
  if (lower === 'arrowup') return 'ArrowUp';
  if (lower === 'arrowdown') return 'ArrowDown';
  if (lower === 'arrowleft') return 'ArrowLeft';
  if (lower === 'arrowright') return 'ArrowRight';
  if (lower.length === 1) return key.toUpperCase();
  return `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}
