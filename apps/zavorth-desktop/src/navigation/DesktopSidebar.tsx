import { t } from '../i18n';
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
  ProfileIcon,
  Review,
  Search,
  Settings,
  Sidebar,
  Skills,
  Users,
  ChartBar,
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
  labelKey: string;
  Icon: IconComponent;
  count?: number;
};

const items: SidebarItem[] = [
  { panel: 'chat', labelKey: 'chat', Icon: Chat },
  { panel: 'skills', labelKey: 'plugins', Icon: Skills },
  { panel: 'automations', labelKey: 'scheduledTasks', Icon: Clock },
  { panel: 'analytics', labelKey: 'analytics', Icon: ChartBar },
  { panel: 'settings', labelKey: 'settings', Icon: Settings },
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
  onNewSessionWithWorkspace?(workspaceId: string): void;
  onPanel(panel: DesktopPanel): void;
  onToggle(): void;
  onWorkspaceFolder(): void | Promise<void>;
  onWorkspaceScope(value: string): void;
  activeMandate?: any;
  onRevokeMandate?: () => Promise<void>;
  currentSessionId?: string;
  onSwitchSession?: (sessionId: string) => void;
  onResizeMouseDown?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      if (window.zavorthDesktop?.listSessions) {
        const data = await window.zavorthDesktop.listSessions();
        if (Array.isArray(data)) {
          const filtered = data.filter(s => !s.id?.startsWith('cron_'));
          setSessions(filtered);
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
      <div className="zvd-sidebar-top">
        {!props.collapsed ? (
          <>
            <div className="zvd-brand" aria-label="Zavorth">
              <strong>Zavorth</strong>
            </div>
            <button
              className="zvd-sidebar-collapse"
              onClick={props.onToggle}
              type="button"
              title="Collapse sidebar"
            >
              <Sidebar aria-hidden="true" size={15} stroke={1.8} />
            </button>
          </>
        ) : (
          <div className="zvd-sidebar-collapsed-top">
            <button
              className="zvd-sidebar-collapse"
              onClick={props.onToggle}
              type="button"
              title="Expand sidebar"
            >
              <Sidebar aria-hidden="true" size={15} stroke={1.8} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        )}
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
              <span className="zvd-nav-label">{t(item.labelKey)}</span>
              {count ? <span className="zvd-nav-count">{count}</span> : null}
            </button>
          );
        })}
      </nav>

      <section className="zvd-sidebar-projects" aria-label="Projetos locais">
        <div className="zvd-sidebar-section-header">
          <p>Projetos</p>
          {!props.collapsed && (
            <button
              className="zvd-section-add-folder"
              type="button"
              title="Add folder"
              onClick={() => void props.onWorkspaceFolder()}
            >
              <Plus aria-hidden="true" size={14} stroke={2} />
            </button>
          )}
        </div>
        <div className="zvd-sidebar-projects-list">
        {projectScopes.map(scope => {
          const isActiveProject = props.workspaceScope.id === scope.id;
          const projectSess = sessions.filter(s => matchesProject(s, scope));

          return (
            <div key={scope.id} className={`zvd-project-group ${isActiveProject ? 'is-active' : ''}`}>
              <div
                className={`zvd-project-root ${isActiveProject ? 'is-active' : ''}`}
                title={scope.path || scope.label}
              >
                <button
                  className="zvd-project-btn"
                  type="button"
                  onClick={() => {
                    props.onWorkspaceScope(scope.id);
                    props.onPanel('chat');
                  }}
                >
                  <Folder className="zvd-nav-icon" aria-hidden="true" size={17} stroke={1.75} />
                  <span>{scope.label}</span>
                </button>
                <button
                  className="zvd-project-add-session"
                  type="button"
                  title="New conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onNewSessionWithWorkspace?.(scope.id);
                  }}
                >
                  <Plus aria-hidden="true" size={14} stroke={2} />
                </button>
              </div>

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
        </div>
      </section>

      {!props.collapsed && (
        <section className="zvd-sidebar-chats" aria-label="Conversas gerais">
          <div className="zvd-sidebar-section-header">
            <p>Conversations</p>
            <button
              className="zvd-section-add-session"
              type="button"
              title="New conversation"
              onClick={() => {
                props.onNewSessionWithWorkspace?.('chat');
              }}
            >
              <Plus aria-hidden="true" size={14} stroke={2} />
            </button>
          </div>
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
      {!props.collapsed && props.onResizeMouseDown && (
        <div
          className={`zvd-sidebar-resizer ${props.isDragging ? 'is-dragging' : ''}`}
          onMouseDown={props.onResizeMouseDown}
        />
      )}
    </aside>
  );
}

// Required markers for desktop-shell-check: Novo chat, Pesquisar, Projetos locais, Inteligência, Modelo
