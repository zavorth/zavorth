import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { apiRequest, type ApprovalItem, type ChatMessage, type RuntimeCapabilitiesSnapshot, type ToolItem } from '../apiClient';
import { buildGitLiteSnapshot, type GitLiteSnapshot } from '../dev/gitLite';
import type { BootEvent, FileExplorerNode, RuntimeStatus } from '../global';
import { t } from '../i18n';
import { AppWindow, Core, Folder, Plus, Refresh, Search, Terminal, X } from '../icons';
import type { DesktopPanel } from '../slashCommands';
import { WebPreviewView } from '../views/WebPreviewView';
import type { DesktopWorkspaceScope } from '../workspaceScopes';
import { PtyTerminalPanel } from './PtyTerminalPanel';
import { buildReviewRailModel, type ReviewFileRow } from './reviewRailModel';
import {
  RIGHT_RAIL_TABS,
  buildGitRailSummary,
  type RightRailTab,
} from './rightRail';
import {
  addTerminalTab,
  createTerminalTab,
  ensureDefaultTabs,
  pickActiveTab,
  removeTerminalTab,
  setAgentActivity,
  type TerminalTab,
} from './terminalTabs';

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
  recentReceiptCount?: number;
  agentBusy?: boolean;
  /** Path highlighted from chat "open file" actions */
  focusFilePath?: string | null;
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
            focusFilePath={props.focusFilePath}
            workspaceScope={props.workspaceScope}
            onOpenWorkspace={props.onOpenWorkspace}
          />
        )}
        {props.activeTab === 'terminal' && (
          <TerminalTabsPanel
            agentBusy={props.agentBusy}
            trustLabel={props.status.running ? t('runtimeTrustedWorkspace') : t('runtimeOffline')}
            workspaceId={props.workspaceScope.id}
          />
        )}
        {props.activeTab === 'logs' && (
          <LogsRailPanel events={props.events} status={props.status} />
        )}
        {props.activeTab === 'git' && (
          <GitRailPanel
            focusFilePath={props.focusFilePath}
            recentReceiptCount={props.recentReceiptCount}
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
  focusFilePath?: string | null;
  onOpenWorkspace(): void | Promise<void>;
}) {
  const [tree, setTree] = useState<FileExplorerNode[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const focusPath = props.focusFilePath?.trim() || null;

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
      {focusPath ? (
        <div className="zvd-rail-focus-banner" role="status">
          <span className="zvd-rail-focus-banner__label">{t('thread.focusFile')}</span>
          <strong className="zvd-rail-focus-banner__path" title={focusPath}>
            {focusPath}
          </strong>
        </div>
      ) : null}
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
        {rows.map(node => {
          const isFocus =
            Boolean(focusPath) &&
            (node.relativePath === focusPath ||
              node.relativePath.endsWith(`/${focusPath}`) ||
              focusPath === node.name);
          return (
            <div
              className={`zvd-rail-file-row is-${node.type}${isFocus ? ' is-focus' : ''}`}
              key={node.relativePath}
            >
              <span style={{ paddingLeft: node.depth * 12 }}>
                {node.type === 'directory' ? t('folder') : t('file')}
              </span>
              <strong>{node.name}</strong>
              <small>{node.relativePath}</small>
            </div>
          );
        })}
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

function gitLiteStatusToReview(status: string): ReviewFileRow['status'] {
  const value = String(status || '').toLowerCase();
  if (value === 'modified' || value === 'conflicted') return 'modified';
  if (value === 'added' || value === 'untracked' || value === 'copied') return 'added';
  if (value === 'deleted') return 'deleted';
  if (value === 'renamed') return 'renamed';
  return 'unknown';
}

function shipActionLabel(ship: { primaryAction: string; label: string; fileCount: number }): string {
  if (ship.primaryAction === 'clean') return t('ship.clean');
  if (ship.primaryAction === 'review') {
    return t('ship.review').replace('{count}', String(ship.fileCount));
  }
  if (ship.primaryAction === 'commit' && ship.fileCount > 0) {
    return t('ship.commit').replace('{count}', String(ship.fileCount));
  }
  if (ship.primaryAction === 'commit') return t('ship.commitChanges');
  return ship.label;
}

function GitRailPanel(props: {
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  workspaceScope: DesktopWorkspaceScope;
  recentReceiptCount?: number;
  focusFilePath?: string | null;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onSubmit(value?: string): void | Promise<void>;
}) {
  const summary = buildGitRailSummary(props.workspaceScope, props.runtimeCapabilities);
  const [snapshot, setSnapshot] = useState<GitLiteSnapshot | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const focus = props.focusFilePath?.trim();
    if (focus) {
      setSelectedPath(focus);
    }
  }, [props.focusFilePath]);

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

  const reviewModel = useMemo(() => {
    if (snapshot) {
      return buildReviewRailModel({
        branch: snapshot.branch,
        dirty: snapshot.changedFiles.length > 0,
        changedFiles: snapshot.changedFiles.map(file => ({
          path: file.path,
          status: gitLiteStatusToReview(
            file.worktreeStatus !== 'unchanged' ? file.worktreeStatus : file.indexStatus,
          ),
        })),
        recentReceiptCount: props.recentReceiptCount,
        selectedPath,
      });
    }
    return buildReviewRailModel({
      branch: summary.branch !== 'Not detected' ? summary.branch : undefined,
      dirty: summary.dirty,
      recentReceiptCount: props.recentReceiptCount,
      selectedPath,
    });
  }, [snapshot, summary.branch, summary.dirty, props.recentReceiptCount, selectedPath]);

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

      <div
        className={`zvd-review-ship-bar ${reviewModel.ship.dirty ? 'is-dirty' : 'is-clean'}`}
        data-action={reviewModel.ship.primaryAction}
      >
        <div className="zvd-review-ship-bar__meta">
          <strong>{shipActionLabel(reviewModel.ship)}</strong>
          <small>
            {reviewModel.ship.branch}
            {reviewModel.ship.dirty ? ` · ${t('ship.dirty')}` : ` · ${t('ship.cleanShort')}`}
            {typeof props.recentReceiptCount === 'number' && props.recentReceiptCount > 0
              ? ` · ${t('ship.receipts').replace('{count}', String(props.recentReceiptCount))}`
              : ''}
          </small>
        </div>
        <button
          type="button"
          className="zvd-review-ship-bar__action"
          disabled={!reviewModel.ship.canShip}
          onClick={() => {
            if (reviewModel.ship.primaryAction === 'review') {
              void props.onSubmit('/git diff --stat');
              return;
            }
            if (reviewModel.ship.primaryAction === 'commit') {
              void props.onSubmit('/git status');
            }
          }}
        >
          {shipActionLabel(reviewModel.ship)}
        </button>
      </div>

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

      <div className="zvd-rail-section">
        <div className="zvd-rail-section-header">
          <span>{t('ship.changedFiles')}</span>
          <small>{reviewModel.files.length}</small>
        </div>
        {reviewModel.files.length === 0 ? (
          <p className="zvd-rail-muted">{t('ship.noChangedFiles')}</p>
        ) : (
          <div className="zvd-rail-file-list zvd-review-file-list">
            {reviewModel.files.slice(0, 24).map(file => (
              <button
                type="button"
                className={`zvd-rail-file-row zvd-review-file-row is-file is-${file.status} ${reviewModel.selectedPath === file.path ? 'is-selected' : ''}`}
                key={file.path}
                onClick={() => setSelectedPath(file.path)}
              >
                <strong>{file.path}</strong>
                <small>{t(`ship.status.${file.status}`)}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      {snapshot && (
        <div className="zvd-rail-section">
          <div className="zvd-rail-section-header">
            <span>{t('commitSuggestions')}</span>
          </div>
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

export function TerminalTabsPanel(props: {
  workspaceId: string;
  agentBusy?: boolean;
  trustLabel?: string;
}) {
  const [tabs, setTabs] = useState<TerminalTab[]>(() => ensureDefaultTabs(props.workspaceId));
  const [activeId, setActiveId] = useState<string | null>(() => ensureDefaultTabs(props.workspaceId)[0]?.id ?? null);

  useEffect(() => {
    const defaults = ensureDefaultTabs(props.workspaceId);
    setTabs(defaults);
    setActiveId(defaults[0]?.id ?? null);
  }, [props.workspaceId]);

  useEffect(() => {
    setTabs(current => {
      const agent = current.find(tab => tab.kind === 'agent');
      if (!agent) return current;
      return setAgentActivity(current, agent.id, Boolean(props.agentBusy));
    });
  }, [props.agentBusy]);

  const activeTab = useMemo(() => pickActiveTab(tabs, activeId), [tabs, activeId]);

  const addShellTab = useCallback(() => {
    const tab = createTerminalTab({
      kind: 'shell',
      title: t('terminal.shell'),
      sessionKey: `shell:${props.workspaceId}:${Date.now().toString(36)}`,
    });
    setTabs(current => addTerminalTab(current, tab));
    setActiveId(tab.id);
  }, [props.workspaceId]);

  const closeTab = useCallback((id: string) => {
    setTabs(current => {
      const result = removeTerminalTab(current, id);
      setActiveId(result.nextActiveId);
      if (result.tabs.length === 0) {
        const defaults = ensureDefaultTabs(props.workspaceId);
        setActiveId(defaults[0]?.id ?? null);
        return defaults;
      }
      return result.tabs;
    });
  }, [props.workspaceId]);

  return (
    <div className="zvd-terminal-tabs-panel">
      <div className="zvd-term-tab-strip" role="tablist" aria-label={t('terminal.tabs')}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`zvd-term-tab ${activeTab?.id === tab.id ? 'is-active' : ''} ${tab.kind === 'agent' && tab.agentActive ? 'is-agent-busy' : ''}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab?.id === tab.id}
              className="zvd-term-tab__btn"
              onClick={() => setActiveId(tab.id)}
            >
              {tab.title}
              {tab.kind === 'agent' && tab.agentActive ? (
                <span className="zvd-term-tab__busy" aria-hidden="true" />
              ) : null}
            </button>
            {tabs.length > 1 ? (
              <button
                type="button"
                className="zvd-term-tab__close"
                aria-label={t('terminal.closeTab')}
                onClick={() => closeTab(tab.id)}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="zvd-term-tab-add"
          aria-label={t('terminal.addShell')}
          title={t('terminal.addShell')}
          onClick={addShellTab}
        >
          <Plus aria-hidden="true" size={14} stroke={2} />
        </button>
      </div>

      {activeTab?.kind === 'agent' ? (
        <div className={`zvd-agent-activity-banner ${activeTab.agentActive ? 'is-busy' : ''}`}>
          <strong>{t('terminal.agentActivity')}</strong>
          <span>
            {activeTab.agentActive ? t('terminal.agentBusy') : t('terminal.agentIdle')}
          </span>
        </div>
      ) : null}

      {activeTab?.kind === 'shell' || activeTab?.kind === 'logs' ? (
        <PtyTerminalPanel
          compact
          mode="rail"
          sessionKey={activeTab.sessionKey}
          trustLabel={props.trustLabel}
          workspaceId={props.workspaceId}
          open
        />
      ) : activeTab?.kind === 'agent' ? (
        <div className="zvd-agent-terminal-placeholder">
          <p className="zvd-rail-muted">{t('terminal.agentTabBody')}</p>
        </div>
      ) : null}
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
