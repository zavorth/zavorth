import { useState, useMemo, useCallback } from 'react';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import {
  IconWindow,
  IconPlus,
  IconX,
  IconMinus,
  IconMaximize,
  IconFocus,
  IconLayoutGrid,
  IconLayoutList,
  IconBookmark,
  IconDeviceFloppy,
  IconDownload,
  IconTrash,
  IconStack2,
  IconStackPop,
  IconSearch,
  IconChevronDown,
  IconChevronRight,
  IconSettings,
} from '@tabler/icons-react';

export type WindowState = 'focused' | 'minimized' | 'maximized' | 'normal' | 'hidden';

export interface ManagedWindow {
  id: string;
  title: string;
  state: WindowState;
  groupId?: string;
  presetId?: string;
  createdAt: string;
  lastFocused?: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface WindowGroup {
  id: string;
  name: string;
  color: string;
  windowIds: string[];
}

export interface WindowPreset {
  id: string;
  name: string;
  windowConfig: Omit<ManagedWindow, 'id' | 'createdAt' | 'lastFocused'>[];
  createdAt: string;
}

export interface WindowManagerPanelProps {
  windows: ManagedWindow[];
  groups: WindowGroup[];
  presets: WindowPreset[];
  focusedWindowId?: string;
  onWindowFocus?: (windowId: string) => void;
  onWindowClose?: (windowId: string) => void;
  onWindowMinimize?: (windowId: string) => void;
  onWindowMaximize?: (windowId: string) => void;
  onWindowRestore?: (windowId: string) => void;
  onWindowCreate?: (title: string, groupId?: string) => void;
  onGroupCreate?: (name: string) => void;
  onGroupDelete?: (groupId: string) => void;
  onWindowGroupAssign?: (windowId: string, groupId: string | undefined) => void;
  onPresetSave?: (name: string) => void;
  onPresetLoad?: (presetId: string) => void;
  onPresetDelete?: (presetId: string) => void;
}

const $searchQuery = atom('');
const $activeTab = atom<'windows' | 'groups' | 'presets'>('windows');
const $expandedGroups = atom<Set<string>>(new Set());

const STATE_ICONS: Record<WindowState, typeof IconWindow> = {
  focused: IconFocus,
  minimized: IconMinus,
  maximized: IconMaximize,
  normal: IconWindow,
  hidden: IconX,
};

const STATE_COLORS: Record<WindowState, string> = {
  focused: '#4ade80',
  minimized: '#71717a',
  maximized: '#60a5fa',
  normal: '#a1a1aa',
  hidden: '#52525b',
};

function generateId(): string {
  return `wm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function WindowStatusBadge({ state }: { state: WindowState }) {
  const Icon = STATE_ICONS[state];
  const color = STATE_COLORS[state];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '1px 6px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: `${color}18`,
        color,
      }}
    >
      <Icon size={9} />
      {state}
    </span>
  );
}

function WindowRow({
  window,
  isFocused,
  groups,
  onFocus,
  onClose,
  onMinimize,
  onRestore,
  onGroupAssign,
}: {
  window: ManagedWindow;
  isFocused: boolean;
  groups: WindowGroup[];
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onGroupAssign: (groupId: string | undefined) => void;
}) {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const group = groups.find(g => g.windowIds.includes(window.id));

  return (
    <div
      className={`zvd-wm-row ${isFocused ? 'zvd-wm-row--focused' : ''}`}
    >
      <div className="zvd-wm-row-main" onClick={onFocus}>
        <div className="zvd-wm-row-icon">
          <IconWindow size={14} style={{ color: isFocused ? '#4ade80' : '#71717a' }} />
        </div>
        <div className="zvd-wm-row-info">
          <span className="zvd-wm-row-title">{window.title}</span>
          <div className="zvd-wm-row-meta">
            <WindowStatusBadge state={window.state} />
            {group && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 500,
                  background: `${group.color}18`,
                  color: group.color,
                }}
              >
                <IconStack2 size={8} />
                {group.name}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="zvd-wm-row-actions">
        {window.state === 'minimized' ? (
          <button className="zvd-wm-icon-btn" onClick={onRestore} title="Restore">
            <IconDownload size={12} />
          </button>
        ) : (
          <button className="zvd-wm-icon-btn" onClick={onMinimize} title="Minimize">
            <IconMinus size={12} />
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <button
            className="zvd-wm-icon-btn"
            onClick={() => setShowGroupMenu(!showGroupMenu)}
            title="Assign to group"
          >
            <IconStack2 size={12} />
          </button>
          {showGroupMenu && (
            <div className="zvd-wm-group-menu">
              <button
                className="zvd-wm-group-menu-item"
                onClick={() => { onGroupAssign(undefined); setShowGroupMenu(false); }}
              >
                <IconStackPop size={10} />
                No group
              </button>
              {groups.map(g => (
                <button
                  key={g.id}
                  className={`zvd-wm-group-menu-item ${group?.id === g.id ? 'active' : ''}`}
                  onClick={() => { onGroupAssign(g.id); setShowGroupMenu(false); }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="zvd-wm-icon-btn zvd-wm-icon-btn--danger" onClick={onClose} title="Close">
          <IconX size={12} />
        </button>
      </div>
    </div>
  );
}

function GroupSection({
  groups,
  windows,
  onGroupDelete,
  onGroupCreate,
  expandedGroups,
  toggleExpand,
}: {
  groups: WindowGroup[];
  windows: ManagedWindow[];
  onGroupDelete: (id: string) => void;
  onGroupCreate: (name: string) => void;
  expandedGroups: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleCreate = () => {
    if (newName.trim()) {
      onGroupCreate(newName.trim());
      setNewName('');
      setShowForm(false);
    }
  };

  return (
    <div className="zvd-wm-section">
      <div className="zvd-wm-section-header">
        <span className="zvd-wm-section-title">Groups</span>
        <button className="zvd-wm-icon-btn" onClick={() => setShowForm(!showForm)} title="Create group">
          <IconPlus size={14} />
        </button>
      </div>
      {showForm && (
        <div className="zvd-wm-create-form">
          <input
            className="zvd-wm-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Group name"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button className="zvd-wm-icon-btn" onClick={handleCreate} disabled={!newName.trim()}>
            <IconDeviceFloppy size={12} />
          </button>
        </div>
      )}
      {groups.length === 0 && !showForm && (
        <div className="zvd-wm-empty">No groups created</div>
      )}
      {groups.map(group => {
        const isExpanded = expandedGroups.has(group.id);
        const groupWindows = windows.filter(w => w.groupId === group.id);
        return (
          <div key={group.id} className="zvd-wm-group">
            <div className="zvd-wm-group-header" onClick={() => toggleExpand(group.id)}>
              <span className="zvd-wm-group-expand">
                {isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
              </span>
              <span className="zvd-wm-group-color" style={{ background: group.color }} />
              <span className="zvd-wm-group-name">{group.name}</span>
              <span className="zvd-wm-group-count">{groupWindows.length}</span>
              <button
                className="zvd-wm-icon-btn zvd-wm-icon-btn--danger"
                onClick={e => { e.stopPropagation(); onGroupDelete(group.id); }}
                title="Delete group"
              >
                <IconTrash size={10} />
              </button>
            </div>
            {isExpanded && (
              <div className="zvd-wm-group-windows">
                {groupWindows.length === 0 ? (
                  <div className="zvd-wm-empty" style={{ padding: '8px 12px' }}>No windows in group</div>
                ) : (
                  groupWindows.map(w => (
                    <div key={w.id} className="zvd-wm-group-window-item">
                      <IconWindow size={10} style={{ color: STATE_COLORS[w.state] }} />
                      <span>{w.title}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PresetSection({
  presets,
  onPresetSave,
  onPresetLoad,
  onPresetDelete,
}: {
  presets: WindowPreset[];
  onPresetSave: (name: string) => void;
  onPresetLoad: (id: string) => void;
  onPresetDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSave = () => {
    if (newName.trim()) {
      onPresetSave(newName.trim());
      setNewName('');
      setShowForm(false);
    }
  };

  return (
    <div className="zvd-wm-section">
      <div className="zvd-wm-section-header">
        <span className="zvd-wm-section-title">Presets</span>
        <button className="zvd-wm-icon-btn" onClick={() => setShowForm(!showForm)} title="Save current layout">
          <IconBookmark size={14} />
        </button>
      </div>
      {showForm && (
        <div className="zvd-wm-create-form">
          <input
            className="zvd-wm-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Preset name"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button className="zvd-wm-icon-btn" onClick={handleSave} disabled={!newName.trim()}>
            <IconDeviceFloppy size={12} />
          </button>
        </div>
      )}
      {presets.length === 0 && !showForm && (
        <div className="zvd-wm-empty">No presets saved</div>
      )}
      {presets.map(preset => (
        <div key={preset.id} className="zvd-wm-preset">
          <div className="zvd-wm-preset-info">
            <IconBookmark size={12} style={{ color: '#facc15' }} />
            <div>
              <span className="zvd-wm-preset-name">{preset.name}</span>
              <span className="zvd-wm-preset-meta">{preset.windowConfig.length} windows</span>
            </div>
          </div>
          <div className="zvd-wm-preset-actions">
            <button className="zvd-wm-icon-btn" onClick={() => onPresetLoad(preset.id)} title="Load preset">
              <IconDownload size={12} />
            </button>
            <button className="zvd-wm-icon-btn zvd-wm-icon-btn--danger" onClick={() => onPresetDelete(preset.id)} title="Delete preset">
              <IconTrash size={10} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function WindowManagerPanel(props: WindowManagerPanelProps) {
  const searchQuery = useStore($searchQuery);
  const activeTab = useStore($activeTab);
  const expandedGroups = useStore($expandedGroups);

  const filteredWindows = useMemo(() => {
    if (!searchQuery.trim()) return props.windows;
    const q = searchQuery.toLowerCase();
    return props.windows.filter(
      w =>
        w.title.toLowerCase().includes(q) ||
        w.state.toLowerCase().includes(q) ||
        (w.groupId && props.groups.some(g => g.id === w.groupId && g.name.toLowerCase().includes(q)))
    );
  }, [props.windows, props.groups, searchQuery]);

  const windowStats = useMemo(() => {
    const total = props.windows.length;
    const byState: Record<WindowState, number> = { focused: 0, minimized: 0, maximized: 0, normal: 0, hidden: 0 };
    props.windows.forEach(w => { byState[w.state]++; });
    return { total, byState };
  }, [props.windows]);

  const toggleExpand = useCallback((groupId: string) => {
    const prev = $expandedGroups.get();
    const next = new Set(prev);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    $expandedGroups.set(next);
  }, []);

  const handleCreateWindow = () => {
    props.onWindowCreate?.(`Window ${props.windows.length + 1}`);
  };

  return (
    <div className="zvd-wm-panel">
      <style>{`
        .zvd-wm-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d0e12;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #e4e4e7;
        }

        .zvd-wm-header {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .zvd-wm-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zvd-wm-header-icon {
          color: var(--zvd-accent, #d86b2a);
          display: flex;
          align-items: center;
        }

        .zvd-wm-header h2 {
          margin: 0;
          font-size: 13px;
          font-weight: 650;
        }

        .zvd-wm-header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .zvd-wm-stats-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          font-size: 10px;
          color: #71717a;
        }

        .zvd-wm-stat {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .zvd-wm-stat-value {
          font-weight: 700;
          color: #a1a1aa;
        }

        .zvd-wm-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .zvd-wm-tab {
          flex: 1;
          padding: 8px 12px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: #71717a;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.15s;
        }

        .zvd-wm-tab:hover {
          color: #a1a1aa;
        }

        .zvd-wm-tab.active {
          color: var(--zvd-accent, #d86b2a);
          border-bottom-color: var(--zvd-accent, #d86b2a);
        }

        .zvd-wm-tab-count {
          font-size: 9px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.06);
          padding: 1px 5px;
          border-radius: 8px;
          min-width: 16px;
          text-align: center;
        }

        .zvd-wm-tab.active .zvd-wm-tab-count {
          background: rgba(241, 106, 33, 0.2);
          color: var(--zvd-accent, #d86b2a);
        }

        .zvd-wm-search {
          position: relative;
          padding: 8px 14px;
        }

        .zvd-wm-search-icon {
          position: absolute;
          left: 24px;
          top: 50%;
          transform: translateY(-50%);
          color: #52525b;
          pointer-events: none;
        }

        .zvd-wm-search-input {
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 6px 10px 6px 30px;
          color: #e4e4e7;
          font-size: 11px;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
        }

        .zvd-wm-search-input:focus {
          border-color: var(--zvd-accent, #d86b2a);
        }

        .zvd-wm-search-input::placeholder {
          color: #52525b;
        }

        .zvd-wm-body {
          flex: 1;
          overflow-y: auto;
          padding: 0;
        }

        .zvd-wm-body::-webkit-scrollbar {
          width: 4px;
        }

        .zvd-wm-body::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 2px;
        }

        .zvd-wm-list {
          display: flex;
          flex-direction: column;
        }

        .zvd-wm-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          transition: background 0.1s;
        }

        .zvd-wm-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .zvd-wm-row--focused {
          background: rgba(74, 222, 128, 0.04);
          border-left: 2px solid #4ade80;
        }

        .zvd-wm-row-main {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
          cursor: pointer;
        }

        .zvd-wm-row-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }

        .zvd-wm-row-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .zvd-wm-row-title {
          font-size: 11px;
          font-weight: 500;
          color: #e4e4e7;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .zvd-wm-row-meta {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .zvd-wm-row-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .zvd-wm-icon-btn {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          width: 22px;
          height: 22px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s;
        }

        .zvd-wm-icon-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #e4e4e7;
        }

        .zvd-wm-icon-btn--danger:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .zvd-wm-icon-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .zvd-wm-create-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: calc(100% - 28px);
          margin: 10px 14px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #71717a;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .zvd-wm-create-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--zvd-accent, #d86b2a);
          color: var(--zvd-accent, #d86b2a);
        }

        .zvd-wm-section {
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .zvd-wm-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
        }

        .zvd-wm-section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #71717a;
        }

        .zvd-wm-create-form {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 14px 10px;
        }

        .zvd-wm-input {
          flex: 1;
          background: #090a0d;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 5px 8px;
          color: #e4e4e7;
          font-size: 11px;
          outline: none;
        }

        .zvd-wm-input:focus {
          border-color: var(--zvd-accent, #d86b2a);
        }

        .zvd-wm-empty {
          text-align: center;
          padding: 16px 14px;
          color: #52525b;
          font-size: 11px;
        }

        .zvd-wm-group {
          border-top: 1px solid rgba(255, 255, 255, 0.03);
        }

        .zvd-wm-group-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .zvd-wm-group-header:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .zvd-wm-group-expand {
          display: flex;
          color: #52525b;
        }

        .zvd-wm-group-color {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .zvd-wm-group-name {
          font-size: 11px;
          font-weight: 500;
          color: #d4d4d8;
          flex: 1;
        }

        .zvd-wm-group-count {
          font-size: 9px;
          font-weight: 600;
          color: #71717a;
          background: rgba(255, 255, 255, 0.04);
          padding: 1px 6px;
          border-radius: 8px;
        }

        .zvd-wm-group-windows {
          padding: 0 14px 6px 30px;
        }

        .zvd-wm-group-window-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 0;
          font-size: 10px;
          color: #a1a1aa;
        }

        .zvd-wm-group-menu {
          position: absolute;
          top: 100%;
          right: 0;
          z-index: 100;
          background: #18181a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 4px;
          min-width: 140px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .zvd-wm-group-menu-item {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 5px 8px;
          background: none;
          border: none;
          border-radius: 4px;
          color: #a1a1aa;
          font-size: 10px;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }

        .zvd-wm-group-menu-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .zvd-wm-group-menu-item.active {
          background: rgba(74, 222, 128, 0.1);
          color: #4ade80;
        }

        .zvd-wm-preset {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
        }

        .zvd-wm-preset-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zvd-wm-preset-name {
          font-size: 11px;
          font-weight: 500;
          color: #d4d4d8;
          display: block;
        }

        .zvd-wm-preset-meta {
          font-size: 9px;
          color: #52525b;
          display: block;
        }

        .zvd-wm-preset-actions {
          display: flex;
          gap: 2px;
        }

        .zvd-wm-footer {
          padding: 8px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .zvd-wm-footer-info {
          font-size: 9px;
          color: #52525b;
        }

        @media (prefers-color-scheme: light) {
          .zvd-wm-panel {
            background: #fff;
            color: #18181a;
          }
          .zvd-wm-header {
            border-color: #e4e4e7;
          }
          .zvd-wm-stats-bar {
            background: rgba(0, 0, 0, 0.02);
            border-color: #e4e4e7;
          }
          .zvd-wm-tabs {
            border-color: #e4e4e7;
          }
          .zvd-wm-tab {
            color: #71717a;
          }
          .zvd-wm-tab:hover {
            color: #18181a;
          }
          .zvd-wm-search-input {
            background: #f4f4f5;
            border-color: #e4e4e7;
            color: #18181a;
          }
          .zvd-wm-search-input::placeholder {
            color: #a1a1aa;
          }
          .zvd-wm-row-title {
            color: #18181a;
          }
          .zvd-wm-row {
            border-color: rgba(0, 0, 0, 0.04);
          }
          .zvd-wm-row:hover {
            background: rgba(0, 0, 0, 0.02);
          }
          .zvd-wm-row--focused {
            background: rgba(74, 222, 128, 0.06);
          }
          .zvd-wm-create-btn {
            border-color: #d4d4d8;
            color: #71717a;
          }
          .zvd-wm-create-btn:hover {
            border-color: var(--zvd-accent, #d86b2a);
            color: var(--zvd-accent, #d86b2a);
          }
          .zvd-wm-section-header {
            border-color: #e4e4e7;
          }
          .zvd-wm-group {
            border-color: rgba(0, 0, 0, 0.04);
          }
          .zvd-wm-group-name {
            color: #27272a;
          }
          .zvd-wm-group-menu {
            background: #fff;
            border-color: #e4e4e7;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          }
          .zvd-wm-group-menu-item {
            color: #52525b;
          }
          .zvd-wm-group-menu-item:hover {
            background: #f4f4f5;
          }
          .zvd-wm-group-menu-item.active {
            background: rgba(74, 222, 128, 0.1);
            color: #16a34a;
          }
          .zvd-wm-input {
            background: #f4f4f5;
            border-color: #e4e4e7;
            color: #18181a;
          }
          .zvd-wm-preset-name {
            color: #18181a;
          }
          .zvd-wm-footer {
            border-color: #e4e4e7;
          }
          .zvd-wm-footer-info {
            color: #a1a1aa;
          }
          .zvd-wm-icon-btn {
            color: #71717a;
          }
          .zvd-wm-icon-btn:hover {
            background: #f4f4f5;
            color: #18181a;
          }
          .zvd-wm-icon-btn--danger:hover {
            background: rgba(239, 68, 68, 0.1);
            color: #dc2626;
          }
        }
      `}</style>

      <div className="zvd-wm-header">
        <div className="zvd-wm-header-left">
          <span className="zvd-wm-header-icon">
            <IconLayoutList size={16} />
          </span>
          <h2>Window Manager</h2>
        </div>
      </div>

      <div className="zvd-wm-stats-bar">
        <div className="zvd-wm-stat">
          <IconWindow size={10} />
          <span className="zvd-wm-stat-value">{windowStats.total}</span>
          windows
        </div>
        <span style={{ color: '#3f3f46' }}>|</span>
        <div className="zvd-wm-stat">
          <IconFocus size={10} style={{ color: '#4ade80' }} />
          <span className="zvd-wm-stat-value">{windowStats.byState.focused}</span>
          focused
        </div>
        <div className="zvd-wm-stat">
          <IconMinus size={10} style={{ color: '#71717a' }} />
          <span className="zvd-wm-stat-value">{windowStats.byState.minimized}</span>
          minimized
        </div>
        <div className="zvd-wm-stat">
          <IconLayoutGrid size={10} style={{ color: '#60a5fa' }} />
          <span className="zvd-wm-stat-value">{windowStats.byState.maximized}</span>
          maximized
        </div>
        <span style={{ color: '#3f3f46' }}>|</span>
        <div className="zvd-wm-stat">
          <IconStack2 size={10} />
          <span className="zvd-wm-stat-value">{props.groups.length}</span>
          groups
        </div>
      </div>

      <div className="zvd-wm-tabs">
        {(['windows', 'groups', 'presets'] as const).map(tab => (
          <button
            key={tab}
            className={`zvd-wm-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => $activeTab.set(tab)}
          >
            {tab === 'windows' && <IconWindow size={12} />}
            {tab === 'groups' && <IconStack2 size={12} />}
            {tab === 'presets' && <IconBookmark size={12} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="zvd-wm-tab-count">
              {tab === 'windows' ? props.windows.length
                : tab === 'groups' ? props.groups.length
                : props.presets.length}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'windows' && (
        <>
          <div className="zvd-wm-search">
            <IconSearch size={12} className="zvd-wm-search-icon" />
            <input
              type="text"
              placeholder="Search windows..."
              className="zvd-wm-search-input"
              value={searchQuery}
              onChange={e => $searchQuery.set(e.target.value)}
            />
          </div>
          <div className="zvd-wm-body">
            {filteredWindows.length === 0 ? (
              <div className="zvd-wm-empty">
                {props.windows.length === 0 ? 'No windows open' : 'No windows match your search'}
              </div>
            ) : (
              <div className="zvd-wm-list">
                {filteredWindows.map(w => (
                  <WindowRow
                    key={w.id}
                    window={w}
                    isFocused={w.id === props.focusedWindowId}
                    groups={props.groups}
                    onFocus={() => props.onWindowFocus?.(w.id)}
                    onClose={() => props.onWindowClose?.(w.id)}
                    onMinimize={() => props.onWindowMinimize?.(w.id)}
                    onRestore={() => props.onWindowRestore?.(w.id)}
                    onGroupAssign={groupId => props.onWindowGroupAssign?.(w.id, groupId)}
                  />
                ))}
              </div>
            )}
            <button className="zvd-wm-create-btn" onClick={handleCreateWindow}>
              <IconPlus size={12} />
              New Window
            </button>
          </div>
        </>
      )}

      {activeTab === 'groups' && (
        <div className="zvd-wm-body">
          <GroupSection
            groups={props.groups}
            windows={props.windows}
            onGroupDelete={props.onGroupDelete || (() => {})}
            onGroupCreate={props.onGroupCreate || (() => {})}
            expandedGroups={expandedGroups}
            toggleExpand={toggleExpand}
          />
        </div>
      )}

      {activeTab === 'presets' && (
        <div className="zvd-wm-body">
          <PresetSection
            presets={props.presets}
            onPresetSave={props.onPresetSave || (() => {})}
            onPresetLoad={props.onPresetLoad || (() => {})}
            onPresetDelete={props.onPresetDelete || (() => {})}
          />
        </div>
      )}

      <div className="zvd-wm-footer">
        <span className="zvd-wm-footer-info">
          {windowStats.total} window{windowStats.total !== 1 ? 's' : ''} · {props.groups.length} group{props.groups.length !== 1 ? 's' : ''} · {props.presets.length} preset{props.presets.length !== 1 ? 's' : ''}
        </span>
        <button className="zvd-wm-icon-btn" title="Window manager settings">
          <IconSettings size={12} />
        </button>
      </div>
    </div>
  );
}

export default WindowManagerPanel;
