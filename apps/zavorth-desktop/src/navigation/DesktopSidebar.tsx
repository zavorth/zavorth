import type { DesktopPanel } from '../slashCommands';
import {
  AppWindow,
  Brand,
  Channels,
  Chat,
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

type SidebarItem = {
  panel: DesktopPanel;
  label: string;
  Icon: IconComponent;
  count?: number;
};

const items: SidebarItem[] = [
  { panel: 'chat', label: 'Chat', Icon: Chat },
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
}) {
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
        {projectScopes.map(scope => (
          <button
            className={`zvd-project-root ${props.workspaceScope.id === scope.id ? 'is-active' : ''}`}
            key={scope.id}
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
        ))}
        <button className="zvd-add-project" type="button" onClick={() => void props.onWorkspaceFolder()}>
          <Plus aria-hidden="true" size={16} stroke={1.9} />
          <span>Add folder</span>
        </button>

        {props.workspaceScope.kind === 'folder' && (
          <>
            <button className="zvd-project-card" type="button" onClick={() => props.onPanel('chat')}>
              <Core className="zvd-nav-icon" aria-hidden="true" size={17} stroke={1.75} />
              <span className="zvd-project-name">{props.workspaceScope.shortLabel}</span>
            </button>
            {!props.collapsed && props.workspaceScope.path && (
              <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
            <div className="zvd-thread-list">
              {projectThreads.map(thread => (
                <button type="button" key={thread.title} onClick={() => props.onPanel('chat')}>
                  <span>{thread.title}</span>
                  <small>{thread.age}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="zvd-sidebar-chats" aria-label="Chats without project">
        <p>Chats</p>
        <div className="zvd-thread-list">
          {chatThreads.map(thread => (
            <button
              type="button"
              key={thread.title}
              onClick={() => {
                props.onWorkspaceScope('chat');
                props.onPanel('chat');
              }}
            >
              <span>{thread.title}</span>
              <small>{thread.age}</small>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
