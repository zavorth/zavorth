import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, Trash2 } from '../icons';

export type SessionEntry = {
  id: string;
  label: string;
  createdAt: string;
  messageCount: number;
  surface: string;
  lastMessage: string;
};

export interface SessionPickerProps {
  currentSessionId?: string;
  onSwitch: (sessionId: string) => void;
  onNewSession: () => void;
}

export function SessionPicker({ currentSessionId, onSwitch, onNewSession }: SessionPickerProps) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (window.zavorthDesktop?.listSessions) {
        const data = await window.zavorthDesktop.listSessions();
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch {
      setError('Could not load sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const filtered = sessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.label.toLowerCase().includes(q) ||
      s.surface.toLowerCase().includes(q) ||
      s.lastMessage.toLowerCase().includes(q)
    );
  });

  const formatTime = (iso: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="session-picker">
      <div className="session-picker-header">
        <span className="session-picker-title">Sessions</span>
        <div className="session-picker-actions">
          <button
            className="session-picker-btn"
            onClick={() => void loadSessions()}
            disabled={loading}
            title="Refresh"
            type="button"
          >
            <RefreshCw size={14} stroke={2} />
          </button>
          <button
            className="session-picker-btn session-picker-btn-new"
            onClick={onNewSession}
            title="New session"
            type="button"
          >
            +
          </button>
        </div>
      </div>

      <div className="session-picker-search">
        <Search size={13} stroke={2} />
        <input
          type="text"
          placeholder="Filter sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="session-picker-search-input"
        />
      </div>

      {error && <div className="session-picker-error">{error}</div>}

      <div className="session-picker-list">
        {loading && sessions.length === 0 && (
          <div className="session-picker-empty">Loading...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="session-picker-empty">No sessions found.</div>
        )}
        {filtered.map((session) => (
          <button
            key={session.id}
            className={`session-picker-item ${session.id === currentSessionId ? 'active' : ''}`}
            onClick={() => onSwitch(session.id)}
            type="button"
          >
            <div className="session-picker-item-header">
              <span className="session-picker-item-label">{session.label || session.id}</span>
              {session.surface && (
                <span className="session-picker-item-surface">{session.surface}</span>
              )}
            </div>
            <div className="session-picker-item-meta">
              <span>{formatTime(session.createdAt)}</span>
              {session.messageCount > 0 && (
                <span>{session.messageCount} msgs</span>
              )}
            </div>
            {session.lastMessage && (
              <div className="session-picker-item-preview">{session.lastMessage.slice(0, 80)}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
