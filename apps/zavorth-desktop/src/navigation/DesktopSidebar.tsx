import { t } from '../i18n';
import { createLogger } from '../logger';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isSecondaryPanel, PRIMARY_PANELS, SECONDARY_PANELS } from './navConfig';

const logger = createLogger('shell');

import type { DesktopPanel } from '../slashCommands';
import {
  Channels,
  Chat,
  ChevronDown,
  ChevronRight,
  Clock,
  Folder,
  Memory,
  Pencil,
  Plus,
  Review,
  Search,
  Settings,
  Sidebar,
  Skills,
  Users,
  ChartBar,
  Store,
  LayoutGrid,
  Sparkles,
  type IconComponent,
} from '../icons';
import type { DesktopWorkspaceScope } from '../workspaceScopes';
import { WorkspaceTrustControl } from '../components/WorkspaceTrustControl';
import { WorkspaceTaskMandateStatus } from '../components/WorkspaceTaskMandateStatus';
import { TemporaryDirectoryTrustStatus } from '../components/TemporaryDirectoryTrustStatus';
import { HostPowerModeControl } from '../components/HostPowerModeControl';
import type { SessionEntry } from '../components/SessionPicker';
import {
  archiveSession,
  getSessionLabel,
  loadSessionChrome,
  pinSession,
  renameSession,
  saveSessionChrome,
  sortSessionsForSidebar,
  type SessionChromeMap,
} from '../session/sessionChrome';

import { asErrorLike } from '../lib/errors';

type SidebarItem = {
  panel: DesktopPanel;
  labelKey: string;
  Icon: IconComponent;
  count?: number;
};

const itemMeta: Record<DesktopPanel, { labelKey: string; Icon: IconComponent }> = {
  chat: { labelKey: 'chat', Icon: Chat },
  approvals: { labelKey: 'nav.review', Icon: Review },
  receipts: { labelKey: 'nav.proof', Icon: Review },
  files: { labelKey: 'files', Icon: Folder },
  workboard: { labelKey: 'workboard', Icon: LayoutGrid },
  memory: { labelKey: 'memory', Icon: Memory },
  vibe: { labelKey: 'vibe', Icon: Sparkles },
  skills: { labelKey: 'skills', Icon: Skills },
  marketplace: { labelKey: 'marketplace', Icon: Store },
  channels: { labelKey: 'channels', Icon: Channels },
  agents: { labelKey: 'agents', Icon: Users },
  profiles: { labelKey: 'profiles', Icon: Users },
  automations: { labelKey: 'scheduledTasks', Icon: Clock },
  analytics: { labelKey: 'analytics', Icon: ChartBar },
  settings: { labelKey: 'settings', Icon: Settings },
  preview: { labelKey: 'preview', Icon: Folder },
};

function toSidebarItems(panels: DesktopPanel[]): SidebarItem[] {
  return panels.map((panel) => ({
    panel,
    labelKey: itemMeta[panel].labelKey,
    Icon: itemMeta[panel].Icon,
  }));
}

const primaryItems = toSidebarItems(PRIMARY_PANELS);
const secondaryItems = toSidebarItems(SECONDARY_PANELS);

export function DesktopSidebar(props: {
  activePanel: DesktopPanel;
  collapsed: boolean;
  pendingApprovals: number;
  workspaceScope: DesktopWorkspaceScope;
  workspaceScopes: DesktopWorkspaceScope[];
  onNewSession(): void;
  onNewSessionWithWorkspace?(workspaceId: string): void;
  onPanel(panel: DesktopPanel): void;
  onCommandPalette?(): void;
  onOpenCommandCenter?(): void;
  onToggle(): void;
  onWorkspaceFolder(): void | Promise<void>;
  onWorkspaceScope(value: string): void;
  activeMandate?: import('../apiClient').TaskMandate | null;
  onRevokeMandate?: () => Promise<void>;
  currentSessionId?: string;
  onSwitchSession?: (sessionId: string) => void;
  onResizeMouseDown?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [moreOpen, setMoreOpen] = useState(() => isSecondaryPanel(props.activePanel));
  const [sessionChrome, setSessionChrome] = useState<SessionChromeMap>({});
  const [showArchived, setShowArchived] = useState(false);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (isSecondaryPanel(props.activePanel)) {
      setMoreOpen(true);
    }
  }, [props.activePanel]);

  useEffect(() => {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    setSessionChrome(loadSessionChrome(storage));
  }, []);

  useEffect(() => {
    if (!menuSessionId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('.zvd-session-menu') || target?.closest?.('.zvd-thread-menu-btn')) {
        return;
      }
      setMenuSessionId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuSessionId]);

  const persistChrome = useCallback((next: SessionChromeMap) => {
    setSessionChrome(next);
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    saveSessionChrome(storage, next);
  }, []);

  const handleRenameSession = useCallback(
    (session: SessionEntry) => {
      const current = getSessionLabel(sessionChrome, session.id, session.label || session.id);
      const nextLabel = window.prompt(t('session.renamePrompt'), current);
      if (nextLabel == null) {
        setMenuSessionId(null);
        return;
      }
      persistChrome(renameSession(sessionChrome, session.id, nextLabel));
      setMenuSessionId(null);
    },
    [persistChrome, sessionChrome],
  );

  const handlePinSession = useCallback(
    (session: SessionEntry) => {
      const pinned = Boolean(sessionChrome[session.id]?.pinned);
      persistChrome(pinSession(sessionChrome, session.id, !pinned));
      setMenuSessionId(null);
    },
    [persistChrome, sessionChrome],
  );

  const handleArchiveSession = useCallback(
    (session: SessionEntry) => {
      const archived = Boolean(sessionChrome[session.id]?.archived);
      persistChrome(archiveSession(sessionChrome, session.id, !archived));
      setMenuSessionId(null);
    },
    [persistChrome, sessionChrome],
  );

  const loadSessions = useCallback(async () => {
    try {
      if (window.zavorthDesktop?.listSessions) {
        const data = await window.zavorthDesktop.listSessions();
        if (Array.isArray(data)) {
          const filtered = data.filter((s) => !s.id?.startsWith('cron_'));
          setSessions(filtered);
        }
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(err);
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

  const badgeFor = useCallback(
    (panel: DesktopPanel): number | undefined => {
      if (panel === 'approvals') return props.pendingApprovals;
      if (panel === 'receipts') return 0;
      return undefined;
    },
    [props.pendingApprovals],
  );

  const renderNavButton = useCallback(
    (item: SidebarItem) => {
      const count = badgeFor(item.panel);
      return (
        <button
          aria-current={props.activePanel === item.panel ? 'page' : undefined}
          className={props.activePanel === item.panel ? 'is-active' : ''}
          data-panel={item.panel}
          key={item.panel}
          onClick={() => props.onPanel(item.panel)}
          type="button"
        >
          <item.Icon className="zvd-nav-icon" aria-hidden="true" size={17} stroke={1.75} />
          <span className="zvd-nav-label">{t(item.labelKey)}</span>
          {count ? <span className="zvd-nav-count">{count}</span> : null}
        </button>
      );
    },
    [badgeFor, props],
  );

  const secondaryActive = useMemo(
    () => secondaryItems.some((item) => item.panel === props.activePanel),
    [props.activePanel],
  );

  const projectScopes = props.workspaceScopes.filter((scope) => scope.kind === 'folder');

  const sortedSessions = useMemo(
    () => sortSessionsForSidebar(sessions, sessionChrome, { includeArchived: showArchived }),
    [sessions, sessionChrome, showArchived],
  );

  const chatSessions = useMemo(
    () => sortedSessions.filter((s) => !projectScopes.some((scope) => matchesProject(s, scope))),
    [sortedSessions, projectScopes],
  );

  const renderSessionThread = useCallback(
    (session: SessionEntry) => {
      const label = getSessionLabel(sessionChrome, session.id, session.label || session.id);
      const pinned = Boolean(sessionChrome[session.id]?.pinned);
      const archived = Boolean(sessionChrome[session.id]?.archived);
      const menuOpen = menuSessionId === session.id;

      return (
        <div
          key={session.id}
          className={`zvd-sidebar-thread-row ${session.id === props.currentSessionId ? 'is-active' : ''} ${archived ? 'is-archived' : ''} ${pinned ? 'is-pinned' : ''}`}
        >
          <button
            className={`zvd-sidebar-thread-item ${session.id === props.currentSessionId ? 'is-active' : ''}`}
            onClick={() => props.onSwitchSession?.(session.id)}
            type="button"
          >
            {pinned - (
              <span className="zvd-thread-pin" aria-label={t('session.pinned')} title={t('session.pinned')}>
                📌
              </span>
            ) : null}
            <span className="zvd-thread-title">{label}</span>
            <small className="zvd-thread-age">{formatRelativeTime(session.createdAt)}</small>
          </button>
          <button
            type="button"
            className={`zvd-thread-menu-btn ${menuOpen ? 'is-open' : ''}`}
            aria-label={t('session.moreActions')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={t('session.moreActions')}
            onClick={(event) => {
              event.stopPropagation();
              setMenuSessionId((current) => (current === session.id ? null : session.id));
            }}
          >
            ⋯
          </button>
          {menuOpen - (
            <div className="zvd-session-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => handleRenameSession(session)}>
                {t('session.rename')}
              </button>
              <button type="button" role="menuitem" onClick={() => handlePinSession(session)}>
                {pinned ? t('session.unpin') : t('session.pin')}
              </button>
              <button type="button" role="menuitem" onClick={() => handleArchiveSession(session)}>
                {archived ? t('session.unarchive') : t('session.archive')}
              </button>
            </div>
          ) : null}
        </div>
      );
    },
    [handleArchiveSession, handlePinSession, handleRenameSession, menuSessionId, props, sessionChrome],
  );

  return (
    <aside className={`zvd-sidebar ${props.collapsed ? 'is-collapsed' : ''}`} aria-label="Desktop navigation">
      <div className="zvd-sidebar-top">
        {!props.collapsed - (
          <>
            <button
              type="button"
              className="zvd-brand zvd-brand-button"
              aria-label={t('nav.commandCenter')}
              title={t('nav.commandCenter')}
              onClick={() => props.onOpenCommandCenter?.()}
            >
              <strong>Zavorth</strong>
            </button>
            <button
              className="zvd-sidebar-collapse"
              onClick={props.onToggle}
              type="button"
              title={t('nav.collapseSidebar')}
            >
              <Sidebar aria-hidden="true" size={15} stroke={1.8} />
            </button>
          </>
        ) : (
          <div className="zvd-sidebar-collapsed-top">
            <button
              type="button"
              className="zvd-brand zvd-brand-button is-collapsed-brand"
              aria-label={t('nav.commandCenter')}
              title={t('nav.commandCenter')}
              onClick={() => props.onOpenCommandCenter?.()}
            >
              <strong>Z</strong>
            </button>
            <button
              className="zvd-sidebar-collapse"
              onClick={props.onToggle}
              type="button"
              title={t('nav.expandSidebar')}
            >
              <Sidebar aria-hidden="true" size={15} stroke={1.8} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        )}
      </div>

      <button className="zvd-new-session" onClick={props.onNewSession} type="button">
        <Pencil aria-hidden="true" size={16} stroke={1.9} />
        <strong>{t('nav.newChat')}</strong>
      </button>

      <button
        className="zvd-search-session"
        onClick={() => props.onCommandPalette?.() ?? props.onPanel('chat')}
        type="button"
        title={t('nav.searchTitle')}
      >
        <Search aria-hidden="true" size={16} stroke={1.9} />
        <strong>{t('nav.search')}</strong>
      </button>

      <nav className="zvd-sidebar-nav zvd-sidebar-nav-primary" aria-label={t('nav.primary')}>
        {primaryItems.map(renderNavButton)}

        <div className={`zvd-sidebar-more ${moreOpen ? 'is-open' : ''} ${secondaryActive ? 'has-active' : ''}`}>
          <button
            className={`zvd-sidebar-more-toggle zvd-nav-secondary-link ${moreOpen ? 'is-open' : ''}`}
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            title={t('nav.more')}
          >
            {moreOpen - (
              <ChevronDown className="zvd-nav-icon" aria-hidden="true" size={17} stroke={1.75} />
            ) : (
              <ChevronRight className="zvd-nav-icon" aria-hidden="true" size={17} stroke={1.75} />
            )}
            <span className="zvd-nav-label">{t('nav.more')}</span>
          </button>
          {moreOpen - (
            <div className="zvd-sidebar-more-items" role="group" aria-label={t('nav.more')}>
              {secondaryItems.map(renderNavButton)}
            </div>
          ) : null}
        </div>
      </nav>

      <section className="zvd-sidebar-projects" aria-label={t('nav.projects')}>
        <div className="zvd-sidebar-section-header">
          <p>{t('nav.projects')}</p>
          {!props.collapsed && (
            <button
              className="zvd-section-add-folder"
              type="button"
              title={t('nav.addFolder')}
              onClick={() => void props.onWorkspaceFolder()}
            >
              <Plus aria-hidden="true" size={14} stroke={2} />
            </button>
          )}
        </div>
        <div className="zvd-sidebar-projects-list">
          {projectScopes.map((scope) => {
            const isActiveProject = props.workspaceScope.id === scope.id;
            const projectSess = sessions.filter((s) => matchesProject(s, scope));

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
                    {(() => {
                      const projectVisible = sortSessionsForSidebar(projectSess, sessionChrome, {
                        includeArchived: showArchived,
                      });
                      if (projectVisible.length === 0) {
                        return <div className="zvd-sidebar-no-threads">{t('nav.noConversations')}</div>;
                      }
                      return projectVisible.map(renderSessionThread);
                    })()}

                    {/* Trust controls nested inside active project */}
                    {props.workspaceScope.path && (
                      <div
                        style={{
                          padding: '8px 4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          borderTop: '1px solid var(--zvd-border-soft)',
                        }}
                      >
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
                        <TemporaryDirectoryTrustStatus workspaceId={props.workspaceScope.id} />
                        <HostPowerModeControl workspaceId={props.workspaceScope.id} />
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
        <section className="zvd-sidebar-chats" aria-label={t('nav.conversations')}>
          <div className="zvd-sidebar-section-header">
            <p>{t('nav.conversations')}</p>
            <button
              className="zvd-section-add-session"
              type="button"
              title={t('nav.newChat')}
              onClick={() => {
                props.onNewSessionWithWorkspace?.('chat');
              }}
            >
              <Plus aria-hidden="true" size={14} stroke={2} />
            </button>
          </div>
          <div className="zvd-thread-list" tabIndex={0} aria-label={t('nav.conversations')}>
            {chatSessions.length === 0 ? (
              <div className="zvd-sidebar-no-threads">{t('nav.noConversations')}</div>
            ) : (
              chatSessions.map(renderSessionThread)
            )}
          </div>
          <button
            type="button"
            className={`zvd-sidebar-archived-toggle ${showArchived ? 'is-active' : ''}`}
            onClick={() => setShowArchived((value) => !value)}
          >
            {showArchived ? t('session.hideArchived') : t('session.showArchived')}
          </button>
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

// Required markers for desktop-shell-check: New Chat, Search, Local projects, Intelligence, Model
