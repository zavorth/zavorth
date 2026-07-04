import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { apiRequest, type ApprovalItem, type ChatMessage, type RuntimeCapabilitiesSnapshot, type ToolItem } from '../apiClient';
import { buildGitLiteSnapshot, type GitLiteSnapshot } from '../dev/gitLite';
import type { BootEvent, FileExplorerNode, RuntimeStatus } from '../global';
import { t } from '../i18n';
import { AppWindow, Core, Folder, Refresh, Search, Terminal, X } from '../icons';
import type { DesktopPanel } from '../slashCommands';
import { WebPreviewView } from '../views/WebPreviewView';
import type { DesktopWorkspaceScope } from '../workspaceScopes';
import { PtyTerminalPanel } from './PtyTerminalPanel';
import {
  RIGHT_RAIL_TABS,
  buildGitRailSummary,
  type RightRailTab,
} from './rightRail';

export function DesktopRightRail(props: {
  activePanel: DesktopPanel;
  activeTab: RightRailTab;
  approvals: ApprovalItem[];
  events: BootEvent[];
  messages: ChatMessage[];
  open: boolean;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  status: RuntimeStatus;
  tools: ToolItem[];
  width: number;
  workspaceScope: DesktopWorkspaceScope;
  onClose(): void;
  onOpenWorkspace(): void | Promise<void>;
  onPanel(panel: DesktopPanel): void;
  onResizeMouseDown(event: MouseEvent): void;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onSubmit(value?: string): void | Promise<void>;
  onTab(tab: RightRailTab): void;
}) {
  if (!props.open) {
    return null;
  }

  const tabMeta = RIGHT_RAIL_TABS.find(tab => tab.id === props.activeTab) || RIGHT_RAIL_TABS[0];

  return (
    <aside className="zvd-right-rail" aria-label={t('workspaceSideRail')} style={{ width: props.width }}>
      <button
        aria-label="Resize side rail"
        className="zvd-right-rail-resize-handle"
        onMouseDown={props.onResizeMouseDown}
        type="button"
      />
      <header className="zvd-right-rail-header">
        <div>
          <span className="zvd-right-rail-eyebrow">{t('shell')}</span>
          <strong>{t(tabMeta.titleKey)}</strong>
        </div>
        <button aria-label={t('closeSideRail')} className="zvd-right-rail-icon" onClick={props.onClose} type="button">
          <X aria-hidden="true" size={15} stroke={1.9} />
        </button>
      </header>

      <nav className="zvd-right-rail-tabs" aria-label={t('sideRailSections')}>
        {RIGHT_RAIL_TABS.map(tab => (
          <button
            aria-label={t(tab.titleKey)}
            className={props.activeTab === tab.id ? 'is-active' : ''}
            key={tab.id}
            onClick={() => props.onTab(tab.id)}
            title={t(tab.titleKey)}
            type="button"
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <section className="zvd-right-rail-body">
        {props.activeTab === 'activity' && (
          <ActivityRailPanel
            activePanel={props.activePanel}
            approvals={props.approvals}
            messages={props.messages}
            runtimeCapabilities={props.runtimeCapabilities}
            status={props.status}
            tools={props.tools}
            workspaceScope={props.workspaceScope}
            onPanel={props.onPanel}
          />
        )}
        {props.activeTab === 'preview' && (
          <WebPreviewView
            mode="rail"
            runtimeCapabilities={props.runtimeCapabilities}
            workspaceScope={props.workspaceScope}
          />
        )}
        {props.activeTab === 'files' && (
          <RailFilesPanel
            workspaceScope={props.workspaceScope}
            onOpenWorkspace={props.onOpenWorkspace}
          />
        )}
        {props.activeTab === 'terminal' && (
          <PtyTerminalPanel
            compact
            mode="rail"
            trustLabel={props.status.running ? t('runtimeTrustedWorkspace') : t('runtimeOffline')}
            workspaceId={props.workspaceScope.id}
          />
        )}
        {props.activeTab === 'logs' && (
          <LogsRailPanel events={props.events} status={props.status} />
        )}
        {props.activeTab === 'git' && (
          <GitRailPanel
            runtimeCapabilities={props.runtimeCapabilities}
            workspaceScope={props.workspaceScope}
            onRuntimeStateAction={props.onRuntimeStateAction}
            onSubmit={props.onSubmit}
          />
        )}
      </section>
    </aside>
  );
}

function ActivityRailPanel(props: {
  activePanel: DesktopPanel;
  approvals: ApprovalItem[];
  messages: ChatMessage[];
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  status: RuntimeStatus;
  tools: ToolItem[];
  workspaceScope: DesktopWorkspaceScope;
  onPanel(panel: DesktopPanel): void;
}) {
  const lastMessage = [...props.messages].reverse().find(message => message.content.trim());
  const summary = props.runtimeCapabilities?.capabilities?.summary;
  const capabilityLabel = summary
    ? `${summary.available || 0} available, ${summary.pending || 0} pending`
    : t('noCapabilitySnapshot');

  return (
    <div className="zvd-rail-stack">
      <RailMetric
        icon={<Core aria-hidden="true" size={16} stroke={1.8} />}
        label={t('runtime')}
        value={props.status.running ? t('runtimeReady') : t('runtimeOffline')}
        detail={props.status.message || capabilityLabel}
      />
      <RailMetric
        icon={<Folder aria-hidden="true" size={16} stroke={1.8} />}
        label={t('workspace')}
        value={props.workspaceScope.shortLabel || props.workspaceScope.label}
        detail={props.workspaceScope.path || t('chatOnlyScope')}
      />
      <RailMetric
        icon={<AppWindow aria-hidden="true" size={16} stroke={1.8} />}
        label={t('currentPanel')}
        value={props.activePanel}
        detail={`${props.approvals.length} approval(s), ${props.tools.length} tool(s)`}
      />

      <div className="zvd-rail-section">
        <div className="zvd-rail-section-header">
          <span>{t('quickActions')}</span>
        </div>
        <div className="zvd-rail-actions">
          <button onClick={() => props.onPanel('approvals')} type="button">{t('reviewApprovals')}</button>
          <button onClick={() => props.onPanel('settings')} type="button">{t('settings')}</button>
        </div>
      </div>

      <div className="zvd-rail-section">
        <div className="zvd-rail-section-header">
          <span>{t('latestMessage')}</span>
        </div>
        <p className="zvd-rail-muted">
          {lastMessage ? compactText(lastMessage.content, 240) : t('noConversationActivity')}
        </p>
      </div>
    </div>
  );
}

function RailFilesPanel(props: {
  workspaceScope: DesktopWorkspaceScope;
  onOpenWorkspace(): void | Promise<void>;
}) {
  const [tree, setTree] = useState<FileExplorerNode[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTree = useCallback(async () => {
    if (!props.workspaceScope.path) {
      setError(t('chooseWorkspaceToBrowse'));
      return;
    }
    if (!window.zavorthDesktop?.readFileTree) {
      setError('Desktop file API is not available.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await window.zavorthDesktop.readFileTree(props.workspaceScope.path);
      if (response.ok && response.tree) {
        setTree(response.tree);
      } else {
        setError(response.error || t('unableToReadWorkspaceFiles'));
      }
    } catch {
      setError(t('unableToReadWorkspaceFiles'));
    } finally {
      setLoading(false);
    }
  }, [props.workspaceScope.path]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const rows = useMemo(() => flattenFileTree(tree)
    .filter(node => !query || node.relativePath.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 120), [tree, query]);

  return (
    <div className="zvd-rail-stack">
      <div className="zvd-rail-search">
        <Search aria-hidden="true" size={14} stroke={1.8} />
        <input
          onChange={event => setQuery(event.target.value)}
          placeholder={t('searchFiles')}
          value={query}
        />
        <button aria-label={t('refreshFiles')} onClick={() => void loadTree()} type="button">
          <Refresh aria-hidden="true" size={14} stroke={1.8} />
        </button>
      </div>

      {!props.workspaceScope.path && (
        <div className="zvd-rail-empty">
          <strong>{t('noWorkspaceFolder')}</strong>
          <span>{t('chooseWorkspaceToEnableShell')}</span>
          <button onClick={() => void props.onOpenWorkspace()} type="button">{t('chooseFolder')}</button>
        </div>
      )}
      {loading && <div className="zvd-rail-muted">{t('loadingFiles')}</div>}
      {error && props.workspaceScope.path && <div className="zvd-rail-error">{error}</div>}
      {!loading && !error && rows.length === 0 && props.workspaceScope.path && (
        <div className="zvd-rail-muted">{t('noFilesMatch')}</div>
      )}
      <div className="zvd-rail-file-list">
        {rows.map(node => (
          <div className={`zvd-rail-file-row is-${node.type}`} key={node.relativePath}>
            <span style={{ paddingLeft: node.depth * 12 }}>
              {node.type === 'directory' ? t('folder') : t('file')}
            </span>
            <strong>{node.name}</strong>
            <small>{node.relativePath}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsRailPanel(props: { events: BootEvent[]; status: RuntimeStatus }) {
  return (
    <div className="zvd-rail-stack">
      <RailMetric
        icon={<Terminal aria-hidden="true" size={16} stroke={1.8} />}
        label={t('runtimeLogs')}
        value={props.status.running ? 'Streaming' : t('runtimeOffline')}
        detail={props.status.message || t('runtimeEventStream')}
      />
      <div className="zvd-rail-log-list">
        {props.events.length === 0 ? (
          <div className="zvd-rail-muted">{t('noRuntimeEventsYet')}</div>
        ) : props.events.slice(-80).reverse().map((event, index) => (
          <div className="zvd-rail-log-row" key={`${event.at}-${index}`}>
            <span>{new Date(event.at).toLocaleTimeString()}</span>
            <strong>{event.type}</strong>
            <p>{event.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GitRailPanel(props: {
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  workspaceScope: DesktopWorkspaceScope;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onSubmit(value?: string): void | Promise<void>;
}) {
  const summary = buildGitRailSummary(props.workspaceScope, props.runtimeCapabilities);
  const [snapshot, setSnapshot] = useState<GitLiteSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadGitStatus = useCallback(async () => {
    if (!props.workspaceScope.path) {
      setError(t('chooseWorkspaceFolder'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<{ snapshot?: {
        branch?: string | null;
        dirtyFiles?: number;
        summary?: string;
        statusOutput?: string;
      } }>({
        method: 'GET',
        path: '/api/web/git/status',
        query: { workspaceRoot: props.workspaceScope.path },
        timeoutMs: 12000,
      });
      if (!result.ok) {
        throw new Error(result.error || 'Could not inspect Git status.');
      }
      const branch = result.data?.snapshot?.branch || summary.branch;
      const nextSnapshot = buildGitLiteSnapshot({
        fallbackBranch: branch,
        statusOutput: result.data?.snapshot?.statusOutput || '',
      });
      setSnapshot({
        ...nextSnapshot,
        summary: result.data?.snapshot?.summary || nextSnapshot.summary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not inspect Git status.');
    } finally {
      setLoading(false);
    }
  }, [props.workspaceScope.path, summary.branch]);

  return (
    <div className="zvd-rail-stack">
      <RailMetric
        icon={<Folder aria-hidden="true" size={16} stroke={1.8} />}
        label={t('repository')}
        value={summary.workspaceLabel}
        detail={summary.workspacePath || t('noWorkspaceFolder')}
      />
      <RailMetric
        icon={<AppWindow aria-hidden="true" size={16} stroke={1.8} />}
        label={t('branch')}
        value={snapshot?.branch || summary.branch}
        detail={snapshot?.summary || summary.status}
      />
      <div className="zvd-rail-actions">
        <button
          onClick={() => void props.onRuntimeStateAction({
            domain: 'git',
            operation: 'status',
            metadata: { workspaceId: props.workspaceScope.id, workspacePath: props.workspaceScope.path || null },
          })}
          type="button"
        >
          {t('refreshGitState')}
        </button>
        <button onClick={() => void loadGitStatus()} type="button" disabled={loading}>
          {loading ? t('loading') : t('gitLite')}
        </button>
        <button onClick={() => void props.onSubmit('/git diff --stat')} type="button">{t('inspectDiff')}</button>
        <button onClick={() => void props.onSubmit('/git status')} type="button">{t('askZavorthForStatus')}</button>
      </div>
      {error && <div className="zvd-rail-error">{error}</div>}
      {snapshot && (
        <div className="zvd-rail-section">
          <div className="zvd-rail-section-header">
            <span>{t('commitSuggestions')}</span>
          </div>
          {snapshot.changedFiles.length > 0 && (
            <div className="zvd-rail-file-list">
              {snapshot.changedFiles.slice(0, 10).map(file => (
                <div className="zvd-rail-file-row is-file" key={`${file.rawStatus}-${file.path}`}>
                  <strong>{file.path}</strong>
                  <small>{file.indexStatus}/{file.worktreeStatus}</small>
                </div>
              ))}
            </div>
          )}
          <div className="zvd-rail-file-list">
            {snapshot.suggestions.map(suggestion => (
              <div className="zvd-rail-file-row is-file" key={suggestion}>
                <strong>{suggestion}</strong>
                <small>{t('readOnly')}</small>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="zvd-rail-section">
        <div className="zvd-rail-section-header">
          <span>{t('gitPro')}</span>
        </div>
        <div className="zvd-rail-actions">
          {['Stage', 'Commit', 'Push', 'PR', 'Worktree'].map(action => (
            <button disabled key={action} type="button">{action}</button>
          ))}
        </div>
      </div>
      <p className="zvd-rail-muted">
        {t('gitInspectFirst')} {t('gitProApprovalRequired')}
      </p>
    </div>
  );
}

function RailMetric(props: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="zvd-rail-metric">
      <div className="zvd-rail-metric-icon">{props.icon}</div>
      <div>
        <span>{props.label}</span>
        <strong>{props.value}</strong>
        <small>{props.detail}</small>
      </div>
    </div>
  );
}

function flattenFileTree(nodes: FileExplorerNode[], depth = 0): Array<FileExplorerNode & { depth: number }> {
  return nodes.flatMap(node => {
    const current = { ...node, depth };
    if (node.type === 'directory' && node.children?.length) {
      return [current, ...flattenFileTree(node.children, depth + 1)];
    }
    return [current];
  });
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
}
