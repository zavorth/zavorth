import { useCallback, useEffect, useState } from 'react';
import type { DesktopPanel } from '../slashCommands';
import {
  AppWindow,
  Brand,
  Channels,
  Chat,
  Clock,
  Core,
  Folder,
  Memory,
  Pencil,
  Plus,
  Review,
  Search,
  Settings,
  Skills,
  type IconComponent,
} from '../icons';
import type { DesktopWorkspaceScope } from '../workspaceScopes';
import { WorkspaceTrustControl } from '../components/WorkspaceTrustControl';
import { WorkspaceTaskMandateStatus } from '../components/WorkspaceTaskMandateStatus';
import { TemporaryDirectoryTrustStatus } from '../components/TemporaryDirectoryTrustStatus';
import { HostPowerModeControl } from '../components/HostPowerModeControl';
import { SessionPicker, type SessionEntry } from '../components/SessionPicker';

type SidebarItem = {
  panel: DesktopPanel;
  label: string;
  Icon: IconComponent;
  count?: number;
};

const items: SidebarItem[] = [
  { panel: 'chat', label: 'Chat', Icon: Chat },
  { panel: 'files', label: 'Files', Icon: Folder },
  { panel: 'approvals', label: 'Review', Icon: Review },
  { panel: 'memory', label: 'Memory', Icon: Memory },
  { panel: 'skills', label: 'Plugins', Icon: Skills },
  { panel: 'channels', label: 'Channels', Icon: Channels },
  { panel: 'settings', label: 'Settings', Icon: Settings },
];

const chatThreads = [
  { title: 'Calculate allowed absences', age: '1w' },
  { title: 'Suggest site animations', age: '2w' },
  { title: 'Install hatch-pet skill', age: '3w' },
  { title: 'Prepare bootloader maintenance', age: '4w' },
];

const projectThreads = [
  { title: 'Review Zavorth desktop baseline', age: '8 min' },
  { title: 'Build a minimal AI hub', age: '21 h' },
  { title: 'Review desktop interaction model', age: '21 h' },
  { title: 'Validate dashboard changes', age: '5 d' },
];

export function DesktopSidebar(props: {
  activePanel: DesktopPanel;
  collapsed: boolean;
  pendingApprovals: number;
  workspaceScope: DesktopWorkspaceScope;
  workspaceScopes: DesktopWorkspaceScope[];
  onNewSession(): void;
  onPanel(panel: DesktopPanel): void;
  onToggle(): void;
  onWorkspaceFolder(): void | Promise<void>;
  onWorkspaceScope(value: string): void;
  activeMandate?: any;
  onRevokeMandate?: () => Promise<void>;
  currentSessionId?: string;
  onSwitchSession?: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      if (window.zavorthDesktop?.listSessions) {
        const data = await window.zavorthDesktop.listSessions();
        if (Array.isArray(data)) {
          setSessions(data);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions, props.currentSessionId, props.workspaceScope.id]);

  const formatRelativeTime = (iso: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      if (diffMs < 0) return 'now';

      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;

      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d`;
    } catch {
      return '';
    }
  };

  const matchesProject = (session: SessionEntry, scope: DesktopWorkspaceScope) => {
    if (!session.surface) return false;
    const surfaceLower = session.surface.toLowerCase();
    const labelLower = scope.label.toLowerCase();
    const idLower = scope.id.toLowerCase();
    const pathLower = scope.path?.toLowerCase() || '';

    return (
      surfaceLower === labelLower ||
      surfaceLower === idLower ||
      (pathLower && (surfaceLower.includes(pathLower) || pathLower.includes(surfaceLower)))
    );
  };

  const projectScopes = props.workspaceScopes.filter(scope => scope.kind === 'folder');
  return (
    <aside className={`zvd-sidebar ${props.collapsed ? 'is-collapsed' : ''}`} aria-label="Desktop navigation">
      <div className="zvd-window-menu" aria-label="Application menu">
        <button className="zvd-sidebar-toggle" aria-label="Toggle sidebar" onClick={props.onToggle} type="button">
          <AppWindow aria-hidden="true" size={16} stroke={1.8} />
        </button>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Window</span>
        <span>Help</span>
      </div>

      <div className="zvd-sidebar-top">
        <div className="zvd-brand" aria-label="Zavorth">
          <Brand aria-hidden="true" size={18} stroke={1.9} />
          <strong>Zavorth</strong>
        </div>
      </div>

      <button className="zvd-new-session" onClick={props.onNewSession} type="button">
        <Pencil aria-hidden="true" size={16} stroke={1.9} />
        <strong>Novo chat</strong>
      </button>

      <button className="zvd-search-session" onClick={() => props.onPanel('chat')} type="button">
        <Search aria-hidden="true" size={16} stroke={1.9} />
        <strong>Pesquisar</strong>
      </button>

      <nav className="zvd-sidebar-nav" aria-label="Primary">
        {items.map(item => {
          const count = item.panel === 'approvals' ? props.pendingApprovals : item.count;
          return (
            <button
              aria-current={props.activePanel === item.panel ? 'page' : undefined}
              className={props.activePanel === item.panel ? 'is-active' : ''}
              key={item.panel}
              onClick={() => props.onPanel(item.panel)}
              type="button"
            >
              <item.Icon className="zvd-nav-icon" aria-hidden="true" size={17} stroke={1.75} />
              <span className="zvd-nav-label">{item.label}</span>
              {count ? <span className="zvd-nav-count">{count}</span> : null}
            </button>
          );
        })}
      </nav>

      <section className="zvd-sidebar-projects" aria-label="Projetos locais">
        <p>Projetos</p>
        {projectScopes.map(scope => {
          const isActiveProject = props.workspaceScope.id === scope.id;
          const projectSess = sessions.filter(s => matchesProject(s, scope));

          return (
            <div key={scope.id} className={`zvd-project-group ${isActiveProject ? 'is-active' : ''}`}>
              <button
                className={`zvd-project-root ${isActiveProject ? 'is-active' : ''}`}
                type="button"
                onClick={() => {
                  props.onWorkspaceScope(scope.id);
                  props.onPanel('chat');
                }}
                title={scope.path || scope.label}
              >
                <Folder className="zvd-nav-icon" aria-hidden="true" size={17} stroke={1.75} />
                <span>{scope.label}</span>
              </button>

              {isActiveProject && !props.collapsed && (
                <div className="zvd-project-sub-sessions">
                  {projectSess.length === 0 ? (
                    <div className="zvd-sidebar-no-threads">No conversations yet</div>
                  ) : (
                    projectSess.map(session => (
                      <button
                        key={session.id}
                        className={`zvd-sidebar-thread-item ${session.id === props.currentSessionId ? 'is-active' : ''}`}
                        onClick={() => props.onSwitchSession?.(session.id)}
                        type="button"
                      >
                        <span className="zvd-thread-title">{session.label || session.id}</span>
                        <small className="zvd-thread-age">{formatRelativeTime(session.createdAt)}</small>
                      </button>
                    ))
                  )}

                  {/* Trust controls nested inside active project */}
                  {props.workspaceScope.path && (
                    <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--zvd-border-soft)' }}>
                      <WorkspaceTrustControl
                        workspaceId={props.workspaceScope.id}
                        workspaceRoot={props.workspaceScope.path}
                      />
                      {props.activeMandate !== undefined && (
                        <WorkspaceTaskMandateStatus
                          activeMandate={props.activeMandate}
                          onRevoke={props.onRevokeMandate || (async () => {})}
                        />
                      )}
                      <TemporaryDirectoryTrustStatus
                        workspaceId={props.workspaceScope.id}
                      />
                      <HostPowerModeControl
                        workspaceId={props.workspaceScope.id}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button className="zvd-add-project" type="button" onClick={() => void props.onWorkspaceFolder()}>
          <Plus aria-hidden="true" size={16} stroke={1.9} />
          <span>Add folder</span>
        </button>
      </section>

      {!props.collapsed && (
        <section className="zvd-sidebar-chats" aria-label="Conversas gerais">
          <p>Conversations</p>
          <div className="zvd-thread-list">
            {sessions.filter(s => !projectScopes.some(scope => matchesProject(s, scope))).length === 0 ? (
              <div className="zvd-sidebar-no-threads">No conversations yet</div>
            ) : (
              sessions
                .filter(s => !projectScopes.some(scope => matchesProject(s, scope)))
                .map(session => (
                  <button
                    key={session.id}
                    className={`zvd-sidebar-thread-item ${session.id === props.currentSessionId ? 'is-active' : ''}`}
                    onClick={() => props.onSwitchSession?.(session.id)}
                    type="button"
                  >
                    <span className="zvd-thread-title">{session.label || session.id}</span>
                    <small className="zvd-thread-age">{formatRelativeTime(session.createdAt)}</small>
                  </button>
                ))
            )}
          </div>
        </section>
      )}
    </aside>
  );
}
