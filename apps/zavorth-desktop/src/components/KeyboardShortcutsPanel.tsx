import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IconSearch, IconX, IconKeyboard } from '@tabler/icons-react';

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Command Palette' },
      { keys: ['Ctrl', 'B'], description: 'Toggle Sidebar' },
      { keys: ['Ctrl', 'J'], description: 'Toggle Terminal' },
      { keys: ['Ctrl', ','], description: 'Open Settings' },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { keys: ['Enter'], description: 'Send Message' },
      { keys: ['Shift', 'Enter'], description: 'New Line' },
      { keys: ['Ctrl', 'Enter'], description: 'Execute Command' },
      { keys: ['↑', '↓'], description: 'Navigate History' },
    ],
  },
  {
    title: 'Terminal',
    shortcuts: [
      { keys: ['Ctrl', 'J'], description: 'Toggle Terminal' },
      { keys: ['Ctrl', 'C'], description: 'Interrupt Process' },
      { keys: ['Ctrl', 'L'], description: 'Clear Terminal' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show Shortcuts' },
      { keys: ['Esc'], description: 'Close Panel' },
      { keys: ['Ctrl', 'Q'], description: 'Quit Application' },
    ],
  },
];

function KbdChip({ label }: { label: string }) {
  return (
    <kbd className="zvd-kbd-chip">{label}</kbd>
  );
}

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Filtered groups based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return SHORTCUT_GROUPS;
    const query = searchQuery.toLowerCase();
    return SHORTCUT_GROUPS.map(group => ({
      ...group,
      shortcuts: group.shortcuts.filter(
        s =>
          s.description.toLowerCase().includes(query) ||
          s.keys.some(k => k.toLowerCase().includes(query))
      ),
    })).filter(g => g.shortcuts.length > 0);
  }, [searchQuery]);

  // Focus trap: keep Tab cycling inside the panel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  // Register global keydown + auto-focus search
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    searchRef.current?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="zvd-shortcuts-overlay" onClick={onClose}>
      <style>{`
        .zvd-shortcuts-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f5f5f7;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          animation: zvdShortcutsFadeIn 200ms ease;
        }
        .zvd-shortcuts-panel {
          background: #18181a;
          border: 1px solid #27272a;
          border-radius: 16px;
          width: 95%;
          max-width: 640px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 30px 60px rgba(0,0,0,0.6);
          overflow: hidden;
          animation: zvdShortcutsPopUp 250ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .zvd-shortcuts-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid #27272a;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .zvd-shortcuts-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .zvd-shortcuts-header-left h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 650;
        }
        .zvd-shortcuts-header-icon {
          color: var(--zvd-accent, #d86b2a);
          display: flex;
          align-items: center;
        }
        .zvd-shortcuts-close {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 150ms ease;
        }
        .zvd-shortcuts-close:hover {
          background: #27272a;
          color: #fff;
        }
        .zvd-shortcuts-search-wrapper {
          position: relative;
          padding: 16px 24px;
        }
        .zvd-shortcuts-search-icon {
          position: absolute;
          left: 34px;
          top: 50%;
          transform: translateY(-50%);
          color: #71717a;
          pointer-events: none;
        }
        .zvd-shortcuts-search-input {
          background: #202022;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 10px 12px 10px 36px;
          color: #fff;
          font-size: 13px;
          width: 100%;
          outline: none;
          transition: border-color 150ms;
        }
        .zvd-shortcuts-search-input:focus {
          border-color: var(--zvd-accent, #d86b2a);
        }
        .zvd-shortcuts-search-input::placeholder {
          color: #52525b;
        }
        .zvd-shortcuts-body {
          flex: 1;
          overflow-y: auto;
          padding: 0 24px 24px;
        }
        .zvd-shortcuts-body::-webkit-scrollbar {
          width: 4px;
        }
        .zvd-shortcuts-body::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 2px;
        }
        .zvd-shortcuts-group {
          margin-bottom: 24px;
        }
        .zvd-shortcuts-group:last-child {
          margin-bottom: 0;
        }
        .zvd-shortcuts-group-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #71717a;
          margin-bottom: 10px;
        }
        .zvd-shortcuts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .zvd-shortcuts-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 8px;
          transition: background 100ms ease;
        }
        .zvd-shortcuts-row:hover {
          background: #1f1f23;
        }
        .zvd-shortcuts-desc {
          font-size: 13px;
          color: #d4d4d8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .zvd-shortcuts-keys {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .zvd-kbd-chip {
          background: #27272a;
          border: 1px solid #3f3f46;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          font-family: inherit;
          color: #a1a1aa;
          line-height: 1.4;
          min-width: 20px;
          text-align: center;
        }
        .zvd-shortcuts-empty {
          text-align: center;
          padding: 32px 0;
          color: #52525b;
          font-size: 13px;
        }
        @media (max-width: 520px) {
          .zvd-shortcuts-grid {
            grid-template-columns: 1fr;
          }
          .zvd-shortcuts-panel {
            max-height: 90vh;
          }
        }
        @media (prefers-color-scheme: light) {
          .zvd-shortcuts-overlay {
            color: #18181a;
          }
          .zvd-shortcuts-panel {
            background: #fff;
            border-color: #e4e4e7;
            box-shadow: 0 30px 60px rgba(0,0,0,0.15);
          }
          .zvd-shortcuts-header {
            border-color: #e4e4e7;
          }
          .zvd-shortcuts-search-input {
            background: #f4f4f5;
            border-color: #e4e4e7;
            color: #18181a;
          }
          .zvd-shortcuts-search-input::placeholder {
            color: #a1a1aa;
          }
          .zvd-shortcuts-row:hover {
            background: #f4f4f5;
          }
          .zvd-shortcuts-desc {
            color: #27272a;
          }
          .zvd-kbd-chip {
            background: #f4f4f5;
            border-color: #d4d4d8;
            color: #52525b;
          }
          .zvd-shortcuts-group-title {
            color: #71717a;
          }
          .zvd-shortcuts-close {
            color: #a1a1aa;
          }
          .zvd-shortcuts-close:hover {
            background: #f4f4f5;
            color: #18181a;
          }
          .zvd-shortcuts-empty {
            color: #a1a1aa;
          }
        }
        @keyframes zvdShortcutsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zvdShortcutsPopUp {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div
        ref={panelRef}
        className="zvd-shortcuts-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        onClick={e => e.stopPropagation()}
      >
        <div className="zvd-shortcuts-header">
          <div className="zvd-shortcuts-header-left">
            <span className="zvd-shortcuts-header-icon">
              <IconKeyboard size={20} />
            </span>
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button className="zvd-shortcuts-close" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        <div className="zvd-shortcuts-search-wrapper">
          <IconSearch size={14} className="zvd-shortcuts-search-icon" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search shortcuts..."
            className="zvd-shortcuts-search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search shortcuts"
          />
        </div>

        <div className="zvd-shortcuts-body">
          {filteredGroups.length === 0 ? (
            <div className="zvd-shortcuts-empty">No shortcuts match your search.</div>
          ) : (
            filteredGroups.map(group => (
              <div key={group.title} className="zvd-shortcuts-group">
                <div className="zvd-shortcuts-group-title">{group.title}</div>
                <div className="zvd-shortcuts-grid">
                  {group.shortcuts.map((shortcut, idx) => (
                    <div key={idx} className="zvd-shortcuts-row">
                      <span className="zvd-shortcuts-desc">{shortcut.description}</span>
                      <span className="zvd-shortcuts-keys">
                        {shortcut.keys.map((key, ki) => (
                          <span key={ki} style={{ display: 'contents' }}>
                            {ki > 0 && <span style={{ color: '#52525b', fontSize: '10px' }}>+</span>}
                            <KbdChip label={key} />
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
