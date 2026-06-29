import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react';
import type {
  ApprovalItem,
  ChannelItem,
  ChannelSetupSnapshot,
  GatewayResilienceSnapshot,
  LearningItem,
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
  RuntimeCapabilitiesSnapshot,
  ToolItem,
} from '../apiClient';
import { connectGooglePersonalOps } from '../apiClient';
import type { BootEvent, RuntimeStatus, FileExplorerNode } from '../global';
import { asRecord, effortLabels, itemId, panelLabels, profileLabels } from '../primitives/desktopPrimitives';
import { DesktopSidebar } from '../shell/DesktopSidebar.js';
import { ProviderSettingsPanel } from '../panels/ProviderSettingsPanel.js';
import { InternalBetaDiagnosticsPanel } from '../panels/InternalBetaDiagnosticsPanel.js';
import { CockpitDashboard } from '../components/CockpitDashboard.js';
import { WebPreviewView } from './WebPreviewView';
import type { DesktopPanel } from '../slashCommands';
import type { DesktopWorkspaceScope } from '../workspaceScopes';
import { AutomationsPanel } from './panels/AutomationsPanel';
import { AgentsPanel } from './panels/AgentsPanel';
import { ProfilesPanel } from './panels/ProfilesPanel';
import UsageAnalyticsPanel from './panels/UsageAnalyticsPanel';
import PluginMarketplacePanel from './panels/PluginMarketplacePanel';
import WorkboardPanel from './panels/WorkboardPanel';
import { LemniscateLoader } from '../components/LemniscateLoader';
import type { ScheduledTask, ActiveSubagent, AgentProfile } from '../useDesktopAppState';
import { Folder, ChevronDown, ChevronRight, Refresh } from '../icons';

type WorkspaceViewProps = {
  activePanel: Exclude<DesktopPanel, 'chat'>;
  accent: 'orange' | 'purple' | 'navy';
  approvals: ApprovalItem[];
  approvalsCount?: number;
  busy: boolean;
  channels: ChannelItem[];
  channelSetup: ChannelSetupSnapshot | null;
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  events: BootEvent[];
  effort: string;
  learning: LearningItem[];
  memoryItems: MemoryItem[];
  gatewayResilience: GatewayResilienceSnapshot | null;
  nexusStatus: unknown;
  profile: string;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  status: RuntimeStatus;
  theme: 'light' | 'dark' | 'system';
  tools: ToolItem[];
  workspaceScope: DesktopWorkspaceScope;
  onAccessRepair(): void | Promise<void>;
  onAccent(value: 'orange' | 'purple' | 'navy'): void;
  onEffort(value: string): void;
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onMemoryControlAction(input: { action: 'forget' | 'updatePreference'; id: string; content?: string }): void | Promise<void>;
  onChannelSetupAction(input: {
    action: 'applyScaffold' | 'doctor' | 'testConnection';
    channelId?: string | null;
    mode?: string | null;
    extraEntries?: Array<{ key: string; value: string }>;
  }): void | Promise<void>;
  onGatewayResilienceAction(input: Record<string, unknown>): void | Promise<void>;
  onProfile(value: string): void;
  onReviewDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  onRuntimeStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
  scheduledTasks?: ScheduledTask[];
  onAddScheduledTask?: (name: string, project: string, prompt: string, intervalMinutes: number) => void;
  onDeleteScheduledTask?: (id: string) => void;
  onToggleScheduledTask?: (id: string) => void;
  onRunScheduledTask?: (id: string) => void;
  loadScheduledTaskLogs?: (sessionId: string) => Promise<any[]>;
  subagents?: ActiveSubagent[];
  onAddSubagent?: (role: string, typeName: string) => void;
  onDeleteSubagent?: (id: string) => void;
  onTriggerSubagentTask?: (id: string, task: string) => void;
  customProfiles?: AgentProfile[];
  allProfiles?: AgentProfile[];
  onAddCustomProfile?: (name: string, prompt: string, effort: any, costLimit: number) => void;
  onDeleteCustomProfile?: (id: string) => void;
};

export function DesktopWorkspaceView(props: WorkspaceViewProps) {
  if (props.activePanel === 'preview') {
    return <WebPreviewView workspaceScope={props.workspaceScope} />;
  }
  if (props.activePanel === 'files') {
    return <FilesView workspaceScope={props.workspaceScope} />;
  }

  if (props.activePanel === 'approvals') {
    return <ReviewView approvals={props.approvals} busy={props.busy} onDecision={props.onReviewDecision} />;
  }

  if (props.activePanel === 'memory') {
    return (
      <MemoryView
        busy={props.busy}
        encryptionReceipt={props.encryptionReceipt}
        encryptionStatus={props.encryptionStatus}
        items={props.memoryItems}
        learning={props.learning}
        onEncryptionAction={props.onEncryptionAction}
        onLearningDecision={props.onLearningDecision}
        onMemoryControlAction={props.onMemoryControlAction}
      />
    );
  }

  if (props.activePanel === 'skills') {
    return <SkillsView tools={props.tools} />;
  }

  if (props.activePanel === 'channels') {
    return (
      <ChannelsView
        busy={props.busy}
        channels={props.channels}
        setup={props.channelSetup}
        onSetupAction={props.onChannelSetupAction}
      />
    );
  }

  if (props.activePanel === 'automations') {
    return (
      <AutomationsPanel
        busy={props.busy}
        runtimeCapabilities={props.runtimeCapabilities}
        onRuntimeStateAction={props.onRuntimeStateAction}
        scheduledTasks={props.scheduledTasks}
        onAddScheduledTask={props.onAddScheduledTask}
        onDeleteScheduledTask={props.onDeleteScheduledTask}
        onToggleScheduledTask={props.onToggleScheduledTask}
        onRunScheduledTask={props.onRunScheduledTask}
        loadScheduledTaskLogs={props.loadScheduledTaskLogs}
      />
    );
  }

  if (props.activePanel === 'agents') {
    return (
      <AgentsPanel
        busy={props.busy}
        subagents={props.subagents}
        onAddSubagent={props.onAddSubagent}
        onDeleteSubagent={props.onDeleteSubagent}
        onTriggerSubagentTask={props.onTriggerSubagentTask}
      />
    );
  }

  if (props.activePanel === 'profiles') {
    return (
      <ProfilesPanel
        customProfiles={props.customProfiles || []}
        allProfiles={props.allProfiles || []}
        onAddCustomProfile={props.onAddCustomProfile}
        onDeleteCustomProfile={props.onDeleteCustomProfile}
      />
    );
  }

  if (props.activePanel === 'analytics') {
    return (
      <UsageAnalyticsPanel
        sessions={props.sessions || []}
        toolCalls={props.toolCalls || []}
        tokenUsage={props.tokenUsage || []}
        currentModel={props.currentModel || 'unknown'}
      />
    );
  }

  if (props.activePanel === 'marketplace') {
    return (
      <PluginMarketplacePanel
        plugins={props.marketplacePlugins || []}
        onInstall={props.onInstallPlugin}
        onUninstall={props.onUninstallPlugin}
        onUpdate={props.onUpdatePlugin}
      />
    );
  }

  if (props.activePanel === 'workboard') {
    return (
      <WorkboardPanel
        boards={props.boards || []}
        onBoardSelect={props.onBoardSelect}
        onCardMove={props.onCardMove}
        onCardCreate={props.onCardCreate}
        onCardUpdate={props.onCardUpdate}
        onCardDelete={props.onCardDelete}
      />
    );
  }

  return (
    <SettingsView
      busy={props.busy}
      effort={props.effort}
      events={props.events}
      nexusStatus={props.nexusStatus}
      profile={props.profile}
      runtimeCapabilities={props.runtimeCapabilities}
      gatewayResilience={props.gatewayResilience}
      status={props.status}
      approvalsCount={props.approvalsCount ?? props.approvals?.length ?? 0}
      theme={props.theme}
      accent={props.accent}
      onEffort={props.onEffort}
      onAccent={props.onAccent}
      onProfile={props.onProfile}
      onRepair={props.onAccessRepair}
      onGatewayResilienceAction={props.onGatewayResilienceAction}
      onStart={props.onRuntimeStart}
      onRuntimeStateAction={props.onRuntimeStateAction}
      onTheme={props.onTheme}
    />
  );
}

export function PageFrame(props: {
  title: string;
  eyebrow?: string;
  description: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="zvd-page" aria-label={props.title}>
      <header className="zvd-page-header">
        <div>
          {props.eyebrow && <span className="zvd-page-eyebrow">{props.eyebrow}</span>}
          <h1>{props.title}</h1>
          <p>{props.description}</p>
        </div>
        <div className="zvd-page-header-side">
          {props.meta && <span className="zvd-page-meta">{props.meta}</span>}
          {props.actions}
        </div>
      </header>
      {props.children}
    </section>
  );
}

function SearchBox(props: {
  value: string;
  placeholder: string;
  onChange(value: string): void;
}) {
  return (
    <label className="zvd-page-search">
      <span>Search</span>
      <input value={props.value} onChange={event => props.onChange(event.target.value)} placeholder={props.placeholder} />
    </label>
  );
}

function TextTabs<T extends string>(props: {
  value: T;
  items: Array<{ value: T; label: string; count?: number }>;
  onChange(value: T): void;
}) {
  return (
    <div className="zvd-text-tabs" role="tablist">
      {props.items.map(item => (
        <button
          aria-selected={props.value === item.value}
          className={props.value === item.value ? 'is-active' : ''}
          key={item.value}
          onClick={() => props.onChange(item.value)}
          role="tab"
          type="button"
        >
          {item.label}
          {typeof item.count === 'number' && <span>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

function EmptyRows(props: { text: string }) {
  return <div className="zvd-empty-rows">{props.text}</div>;
}

function DetailRows(props: {
  rows: Array<{
    id: string;
    title: string;
    meta?: string;
    description?: string;
    tone?: 'ready' | 'warning' | 'danger' | 'muted';
    actions?: ReactNode;
  }>;
  empty: string;
}) {
  if (props.rows.length === 0) {
    return <EmptyRows text={props.empty} />;
  }

  return (
    <div className="zvd-detail-list">
      {props.rows.map(row => (
        <article className="zvd-detail-row" key={row.id}>
          <div className="zvd-detail-main">
            <span className={`zvd-row-dot tone-${row.tone || 'muted'}`} />
            <div>
              <strong>{row.title}</strong>
              {row.description && <p>{row.description}</p>}
            </div>
          </div>
          <div className="zvd-detail-side">
            {row.meta && <span>{row.meta}</span>}
            {row.actions}
          </div>
        </article>
      ))}
    </div>
  );
}

export function ReviewView(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  onDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.approvals
      .filter(approval => {
        const hay = `${approval.title || ''} ${approval.summary || ''} ${approval.action || ''} ${approval.risk || ''}`.toLowerCase();
        return !q || hay.includes(q);
      })
      .map((approval, index) => {
        const id = itemId(approval, `approval-${index}`);
        return {
          id,
          title: approval.title || approval.action || 'Pending approval',
          description: approval.summary || 'Review the requested action before it runs.',
          meta: approval.risk || approval.status || 'pending',
          tone: approval.risk === 'high' ? 'danger' as const : 'warning' as const,
          actions: (
            <div className="zvd-row-actions">
              <button disabled={props.busy} onClick={() => void props.onDecision(id, 'approve')} type="button">Approve</button>
              <button disabled={props.busy} onClick={() => void props.onDecision(id, 'reject')} type="button">Reject</button>
            </div>
          ),
        };
      });
  }, [props.approvals, props.busy, props.onDecision, query]);

  return (
    <PageFrame
      description="Actions that need an explicit decision before they touch files, tools, channels, or policy."
      meta={`${props.approvals.length} pending`}
      title={panelLabels.approvals}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Search approvals" />}
    >
      <DetailRows rows={rows} empty="No approvals are waiting." />
    </PageFrame>
  );
}

export function MemoryView(props: {
  busy: boolean;
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  items: MemoryItem[];
  learning: LearningItem[];
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onMemoryControlAction(input: { action: 'forget' | 'updatePreference'; id: string; content?: string }): void | Promise<void>;
}) {
  const [mode, setMode] = useState<'learned' | 'candidates' | 'protection'>('learned');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const protection = props.encryptionStatus;
  const canRollback = Boolean(props.encryptionReceipt?.backupPath && props.encryptionReceipt.status === 'applied');

  const learnedRows = props.items
    .filter(item => !q || `${item.title || ''} ${item.summary || ''} ${item.kind || ''} ${item.key || ''} ${item.content || ''} ${item.contentPreview || ''}`.toLowerCase().includes(q))
    .map((item, index) => {
      const id = item.id || itemId(item, `memory-${index}`);
      const canEdit = item.editable === true;
      return {
        id,
        title: item.title || item.key || item.kind || item.type || 'Memory receipt',
        description: item.summary || item.contentPreview || item.content || item.receiptId || 'Stored with provenance.',
        meta: canEdit ? 'editable preference' : item.type || item.expiry || item.receiptId || 'read-only',
        tone: canEdit ? 'ready' as const : 'muted' as const,
        actions: (
          <div className="zvd-row-actions">
            {canEdit && (
              <button
                disabled={props.busy}
                onClick={() => {
                  const content = window.prompt('Update preference', item.content || item.contentPreview || item.summary || '');
                  if (content !== null) {
                    void props.onMemoryControlAction({ action: 'updatePreference', id, content });
                  }
                }}
                type="button"
              >
                Edit
              </button>
            )}
            <button disabled={props.busy} onClick={() => void props.onMemoryControlAction({ action: 'forget', id })} type="button">
              Forget
            </button>
          </div>
        ),
      };
    });

  const candidateRows = props.learning
    .filter(candidate => !q || `${candidate.title || ''} ${candidate.summary || ''} ${candidate.kind || ''}`.toLowerCase().includes(q))
    .map((candidate, index) => {
      const id = itemId(candidate, `learning-${index}`);
      return {
        id,
        title: candidate.title || candidate.kind || 'Learning candidate',
        description: candidate.summary || `${candidate.lane || 'lane'} - ${candidate.risk || 'risk unknown'}`,
        meta: candidate.risk || candidate.status || 'candidate',
        tone: candidate.lane === 'green' ? 'ready' as const : 'warning' as const,
        actions: (
          <div className="zvd-row-actions">
            <button disabled={props.busy} onClick={() => void props.onLearningDecision(id, 'approve')} type="button">Approve</button>
            <button disabled={props.busy} onClick={() => void props.onLearningDecision(id, 'reject')} type="button">Reject</button>
            <button disabled={props.busy} onClick={() => void props.onLearningDecision(id, 'forget')} type="button">Forget</button>
          </div>
        ),
      };
    });

  const protectionRows = [
    {
      id: 'memory-protection',
      title: protection?.fullFileEncrypted
        ? 'Advanced protection active'
        : protection?.contentEncrypted
          ? 'Standard protection active'
          : 'Memory protection unavailable',
      description: protection?.guidance || 'Memory protection status is not available yet.',
      meta: protection?.atRestEncryptionMode || 'unknown',
      tone: protection?.safeForDailyUse ? 'ready' as const : 'warning' as const,
      actions: (
        <div className="zvd-row-actions">
          <button disabled={props.busy} onClick={() => void props.onEncryptionAction('preview')} type="button">Preview</button>
          <button disabled={props.busy || protection?.fullFileEncrypted} onClick={() => void props.onEncryptionAction('apply')} type="button">
            Enable advanced
          </button>
          <button disabled={props.busy || !canRollback} onClick={() => void props.onEncryptionAction('rollback')} type="button">Rollback</button>
        </div>
      ),
    },
  ];

  return (
    <PageFrame
      description="Learned context, reversible candidates, and local memory protection."
      meta={`${props.items.length} memories`}
      title={panelLabels.memory}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Search memory" />}
    >
      <TextTabs<'learned' | 'candidates' | 'protection'>
        value={mode}
        onChange={setMode}
        items={[
          { value: 'learned', label: 'Learned', count: props.items.length },
          { value: 'candidates', label: 'Candidates', count: props.learning.length },
          { value: 'protection', label: 'Protection' },
        ]}
      />
      {mode === 'learned' && <DetailRows rows={learnedRows} empty="No learned memories are projected yet." />}
      {mode === 'candidates' && <DetailRows rows={candidateRows} empty="No learning candidates are waiting." />}
      {mode === 'protection' && <DetailRows rows={protectionRows} empty="Memory protection status is unavailable." />}
    </PageFrame>
  );
}

function SkillsView(props: { tools: ToolItem[] }) {
  const [mode, setMode] = useState<'all' | 'ready' | 'review'>('all');
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = props.tools.filter(tool => {
      const status = String(tool.status || '').toLowerCase();
      const risk = String(tool.risk || '').toLowerCase();
      const hay = `${tool.title || ''} ${tool.name || ''} ${tool.id || ''} ${tool.description || ''} ${tool.source || ''} ${status} ${risk}`.toLowerCase();
      if (q && !hay.includes(q)) {
        return false;
      }
      if (mode === 'ready') {
        return status.includes('ready') || status.includes('trusted') || !status;
      }
      if (mode === 'review') {
        return status.includes('review') || status.includes('draft') || risk.includes('high') || risk.includes('medium');
      }
      return true;
    });

    const map = new Map<string, ToolItem[]>();
    for (const tool of filtered) {
      const source = tool.source || tool.status || 'runtime';
      map.set(source, [...(map.get(source) || []), tool]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [mode, props.tools, query]);

  const rows = groups.flatMap(([source, tools]) => [
    {
      id: `group-${source}`,
      title: source,
      description: `${tools.length} ${tools.length === 1 ? 'skill' : 'skills'}`,
      meta: 'source',
      tone: 'muted' as const,
    },
    ...tools.map((tool, index) => ({
      id: itemId(tool, `tool-${source}-${index}`),
      title: tool.title || tool.name || tool.id || 'Skill',
      description: tool.description || 'Available through the local runtime.',
      meta: tool.status || tool.risk || 'available',
      tone: (tool.risk === 'high' ? 'danger' : tool.status === 'trusted' || tool.status === 'ready' ? 'ready' : 'muted') as 'ready' | 'warning' | 'danger' | 'muted',
    })),
  ]);

  return (
    <PageFrame
      description="Runtime skills, toolsets, sources, and trust state in one workspace view."
      meta={`${props.tools.length} projected`}
      title={panelLabels.skills}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Search skills" />}
    >
      <TextTabs<'all' | 'ready' | 'review'>
        value={mode}
        onChange={setMode}
        items={[
          { value: 'all', label: 'All', count: props.tools.length },
          { value: 'ready', label: 'Ready' },
          { value: 'review', label: 'Needs review' },
        ]}
      />
      <DetailRows rows={rows} empty="No skills are projected by the runtime yet." />
    </PageFrame>
  );
}

export function ChannelsView(props: {
  busy: boolean;
  channels: ChannelItem[];
  setup: ChannelSetupSnapshot | null;
  onSetupAction(input: {
    action: 'applyScaffold' | 'doctor' | 'testConnection';
    channelId?: string | null;
    mode?: string | null;
    extraEntries?: Array<{ key: string; value: string }>;
  }): void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [configuringChannelId, setConfiguringChannelId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  
  const setupOptions = Array.isArray(props.setup?.assistant?.options) ? props.setup.assistant.options : [];
  const selected = props.setup?.assistant?.selected || setupOptions[0] || null;
  const rows = props.channels
    .filter(channel => {
      const record = asRecord(channel);
      const hay = `${record.name || ''} ${record.channel || ''} ${record.id || ''} ${record.status || ''} ${record.summary || ''}`.toLowerCase();
      return !query.trim() || hay.includes(query.trim().toLowerCase());
    })
    .map((channel, index) => {
      const record = asRecord(channel);
      const id = String(record.id || record.channel || record.name || `channel-${index}`);
      return {
        id,
        title: String(record.name || record.channel || record.id || 'Channel'),
        description: record.liveReady
          ? 'Live route is ready.'
          : record.outboxOnly
            ? 'Outbox or preview route only.'
            : String(record.summary || 'Needs setup before it can send live messages.'),
        meta: record.liveReady ? 'live' : record.outboxOnly ? 'outbox' : String(record.status || 'setup'),
        tone: record.liveReady ? 'ready' as const : record.outboxOnly ? 'warning' as const : 'muted' as const,
      };
    });

  return (
    <PageFrame
      description="Communication routes with honest readiness and delivery state."
      meta={`${props.channels.length} routes`}
      title={panelLabels.channels}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Search channels" />}
    >
      <section className="zvd-settings-section" aria-label="Channel setup wizard">
        <h2>Channel setup</h2>
        {setupOptions.length === 0 ? (
          <EmptyRows text="No channel setup options are available yet." />
        ) : (
          <div className="zvd-detail-list">
            {setupOptions.slice(0, 8).map((option: any) => {
              const channelId = String(option.channelId || option.id || '');
              const active = selected && String((selected as any).channelId || '') === channelId;
              const hasMissing = Array.isArray(option.missingEnvKeys) && option.missingEnvKeys.length > 0;
              const isConfiguring = configuringChannelId === channelId;
              
              return (
                <article className="zvd-detail-row" key={channelId || option.label}>
                  <div className="zvd-detail-main">
                    <span className={`zvd-row-dot tone-${option.configured ? 'ready' : 'warning'}`} />
                    <div style={{ width: '100%' }}>
                      <strong>{String(option.label || channelId || 'Channel')}</strong>
                      <p>{String(option.summary || option.operatorNextStep || 'Choose setup mode and validate connection.')}</p>
                      
                      {isConfiguring ? (
                        <div className="zvd-credentials-form">
                          {option.missingEnvKeys.map((key: string) => {
                            const isSensitive = /(token|secret|password|credential|authorization|api[_-]?key)/i.test(key);
                            return (
                              <div className="zvd-credentials-field" key={key}>
                                <label htmlFor={`cred-${channelId}-${key}`}>{key}</label>
                                <input
                                  id={`cred-${channelId}-${key}`}
                                  type={isSensitive ? 'password' : 'text'}
                                  value={credentials[key] ?? ''}
                                  onChange={(e) => setCredentials(prev => ({ ...prev, [key]: e.target.value }))}
                                  placeholder={`Enter ${key.toLowerCase().replace(/_/g, ' ')}`}
                                  autoComplete="off"
                                />
                              </div>
                            );
                          })}
                          <div className="zvd-credentials-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <button
                              disabled={props.busy}
                              onClick={() => {
                                const extraEntries = option.missingEnvKeys.map((key: string) => ({
                                  key,
                                  value: credentials[key] || '',
                                }));
                                void props.onSetupAction({
                                  action: 'applyScaffold',
                                  channelId,
                                  mode: String(option.setupMode || option.recommendedMode || '') || null,
                                  extraEntries,
                                });
                                setConfiguringChannelId(null);
                                setCredentials({});
                              }}
                              type="button"
                              className="zvd-btn-primary"
                            >
                              Save &amp; Connect
                            </button>
                            <button
                              disabled={props.busy}
                              onClick={() => {
                                setConfiguringChannelId(null);
                                setCredentials({});
                              }}
                              type="button"
                              className="zvd-btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {hasMissing && (
                            <p style={{ color: 'var(--zvd-text-warn, #b45309)', fontSize: '0.9em', marginTop: '4px' }}>
                              Missing: {option.missingEnvKeys.join(', ')}
                            </p>
                          )}
                        </>
                      )}
                      
                      {option.webhookUrl && <p>Webhook: {String(option.webhookUrl)}</p>}
                      {option.qrCode && <p>QR: {String(option.qrCode)}</p>}
                    </div>
                  </div>
                  <div className="zvd-detail-side">
                    <span>{active ? 'selected' : String(option.readiness || 'setup')}</span>
                    <div className="zvd-row-actions">
                      {hasMissing ? (
                        !isConfiguring && (
                          <button
                            disabled={props.busy}
                            onClick={() => {
                              setConfiguringChannelId(channelId);
                              const initial: Record<string, string> = {};
                              option.missingEnvKeys.forEach((key: string) => {
                                initial[key] = '';
                              });
                              setCredentials(initial);
                            }}
                            type="button"
                          >
                            Configure
                          </button>
                        )
                      ) : (
                        <button
                          disabled={props.busy}
                          onClick={() => void props.onSetupAction({ action: 'applyScaffold', channelId, mode: String(option.setupMode || option.recommendedMode || '') || null })}
                          type="button"
                        >
                          Apply scaffold
                        </button>
                      )}
                      <button
                        disabled={props.busy || isConfiguring}
                        onClick={() => void props.onSetupAction({ action: 'testConnection', channelId })}
                        type="button"
                      >
                        Test connection
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <DetailRows rows={rows} empty="No channel readiness is projected yet." />
    </PageFrame>
  );
}

function SettingsView(props: {
  accent: 'orange' | 'purple' | 'navy';
  busy: boolean;
  effort: string;
  events: BootEvent[];
  nexusStatus: unknown;
  profile: string;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  gatewayResilience: GatewayResilienceSnapshot | null;
  status: RuntimeStatus;
  approvalsCount: number;
  theme: 'light' | 'dark' | 'system';
  onAccent(value: 'orange' | 'purple' | 'navy'): void;
  onEffort(value: string): void;
  onProfile(value: string): void;
  onRepair(): void | Promise<void>;
  onGatewayResilienceAction(input: Record<string, unknown>): void | Promise<void>;
  onStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
}) {
  const [runtimeMode, setRuntimeMode] = useState<'overview' | 'gateway' | 'permissions' | 'providers' | 'workspace' | 'mcp' | 'skills' | 'jobs' | 'personal' | 'diagnostics'>('overview');
  const [personalConnectStatus, setPersonalConnectStatus] = useState<string | null>(null);
  const connectGoogle = async () => {
    setPersonalConnectStatus('Opening Google authorization...');
    try {
      const result = await connectGooglePersonalOps();
      if (!result.ok) {
        setPersonalConnectStatus(result.error || 'Google authorization did not complete.');
        return;
      }
      setPersonalConnectStatus(result.accountEmail
        ? `Connected ${result.accountEmail}.`
        : 'Google account connected.');
    } catch (error) {
      setPersonalConnectStatus(error instanceof Error ? error.message : 'Google authorization failed.');
    }
  };
  const experienceRows = [
    {
      id: 'experience-profile',
      title: 'Experience profile',
      description: 'Controls tone, detail, and the kind of help Zavorth suggests first.',
      meta: props.profile,
      tone: 'muted' as const,
      actions: (
        <select className="zvd-inline-select" value={props.profile} onChange={event => props.onProfile(event.target.value)} aria-label="Experience profile">
          {profileLabels.map(profile => (
            <option key={profile} value={profile}>{profile}</option>
          ))}
        </select>
      ),
    },
    {
      id: 'reasoning-effort',
      title: 'Reasoning effort',
      description: 'Balances speed and depth for everyday chat and guided work.',
      meta: props.effort,
      tone: 'muted' as const,
      actions: (
        <select className="zvd-inline-select" value={props.effort} onChange={event => props.onEffort(event.target.value)} aria-label="Reasoning effort">
          {effortLabels.map(effort => (
            <option key={effort} value={effort}>{effort}</option>
          ))}
        </select>
      ),
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Keeps the desktop comfortable across dark rooms, bright rooms, and system theme changes.',
      meta: props.theme,
      tone: 'muted' as const,
      actions: (
        <select
          className="zvd-inline-select"
          value={props.theme}
          onChange={event => props.onTheme(event.target.value as 'light' | 'dark' | 'system')}
          aria-label="Theme"
        >
          <option value="system">system</option>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      ),
    },
    {
      id: 'accent',
      title: 'Accent color',
      description: 'Controls the central glow, action color, and Zavorth visual personality.',
      meta: props.accent,
      tone: 'muted' as const,
      actions: (
        <select
          className="zvd-inline-select"
          value={props.accent}
          onChange={event => props.onAccent(event.target.value as 'orange' | 'purple' | 'navy')}
          aria-label="Accent color"
        >
          <option value="orange">orange</option>
          <option value="purple">purple</option>
          <option value="navy">dark blue</option>
        </select>
      ),
    },
  ];

  const capabilities = props.runtimeCapabilities;
  const capabilitySummary = capabilities?.capabilities?.summary;
  const selectedSpec = capabilities?.modelSpecs?.specs?.find(spec => spec.id === capabilities.modelSpecs?.selectedSpecId);
  const connectedProviders = capabilities?.providers?.connected || [];
  const configurableProviders = capabilities?.providers?.configurable || [];
  const blockedProviders = capabilities?.providers?.blocked || [];
  const providerConnections = capabilities?.providers?.all || [...connectedProviders, ...configurableProviders, ...blockedProviders];
  const providerCount = connectedProviders.length;
  const workspaceKnowledge = capabilities?.workspaceKnowledge;
  const mcpReviewCount = (capabilities?.mcpTrust?.servers || []).filter(server => server.trustState !== 'trusted').length;
  const configuredPersonalOps = (capabilities?.personalOps?.connectors || []).filter(connector => connector.status === 'configured').length;
  const permissionRows = Object.entries(capabilities?.permissions?.domains || {}).flatMap(([domain, policy]) =>
    Object.entries(policy.actions || {}).map(([action, rule]) => ({
      id: `permission-${domain}-${action}`,
      title: `${policy.label || domain}: ${action}`,
      description: rule.reason || 'Governed permission from runtime matrix.',
      meta: `${rule.default || 'review'}${rule.requiresApproval ? ' + approval' : ''}`,
      tone: rule.default === 'block' ? 'danger' as const : rule.requiresApproval ? 'warning' as const : 'ready' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'gateway',
              operation: 'set-permission',
              metadata: {
                runtimeActionType: 'set-permission',
                permission: {
                  domain,
                  action,
                  decision: rule.default || 'approval',
                  requiresApproval: rule.requiresApproval !== false,
                  scope: rule.scope || 'runtime',
                  reason: rule.reason || 'Operator reviewed permission from desktop.',
                },
              },
            })}
            type="button"
          >
            Receipt
          </button>
        </div>
      ),
    })),
  );
  const modelSpecRows = (capabilities?.modelSpecs?.specs || []).map(spec => ({
    id: `model-spec-${spec.id || spec.label}`,
    title: spec.label || spec.id || 'Model spec',
    description: `${spec.summary || 'Runtime model preset.'} Preferred: ${(spec.preferredModelIds || []).join(', ') || 'runtime choice'}.`,
    meta: spec.id === capabilities?.modelSpecs?.selectedSpecId ? 'selected' : spec.maxEffort || spec.estimatedCost || 'available',
    tone: spec.id === capabilities?.modelSpecs?.selectedSpecId ? 'ready' as const : 'muted' as const,
    actions: (
      <div className="zvd-row-actions">
        <button
          disabled={props.busy || spec.id === capabilities?.modelSpecs?.selectedSpecId}
          onClick={() => void props.onRuntimeStateAction({
            domain: 'model',
            operation: 'select-spec',
            metadata: {
              runtimeActionType: 'select-model-spec',
              modelSpec: { id: spec.id },
            },
          })}
          type="button"
        >
          Select
        </button>
      </div>
    ),
  }));
  const providerRows = [
    ...modelSpecRows,
    ...providerConnections.map(provider => ({
      id: `provider-${provider.id || provider.label}`,
      title: provider.label || provider.id || 'Provider',
      description: provider.targetHost
        ? `Target: ${provider.targetHost}; loopback=${provider.localLoopback ? 'yes' : 'no'}; default route=${provider.defaultRouteAllowed ? 'yes' : 'no'}.`
        : provider.blockReason || 'Setup is governed and does not run hidden live probes.',
      meta: provider.status || 'configured',
      tone: provider.status === 'configured' ? 'ready' as const : provider.status === 'blocked' ? 'danger' as const : 'warning' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'gateway',
              operation: provider.status === 'configured' ? 'provider-receipt' : 'setup-provider',
              metadata: {
                runtimeActionType: 'set-provider-connection',
                providerConnection: {
                  providerId: provider.id,
                  label: provider.label,
                  status: provider.status || 'needs-setup',
                  targetHost: provider.targetHost || null,
                  blockReason: provider.blockReason || null,
                },
              },
            })}
            type="button"
          >
            {provider.status === 'configured' ? 'Receipt' : 'Setup'}
          </button>
        </div>
      ),
    })),
  ];
  const workspaceRows = [
    {
      id: 'workspace-active',
      title: workspaceKnowledge?.activeWorkspaceLabel || capabilities?.workspace?.label || 'Chat',
      description: capabilities?.workspace?.path
        ? `Filesystem scope is confined to ${capabilities.workspace.path}.`
        : 'Chat mode keeps filesystem and shell out of scope.',
      meta: workspaceKnowledge?.isolation || capabilities?.workspace?.isolation || 'chat',
      tone: capabilities?.workspace?.path ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'context',
              operation: 'scope-knowledge',
              metadata: {
                runtimeActionType: 'set-workspace-knowledge',
                workspaceKnowledge: {
                  workspaceId: workspaceKnowledge?.workspaceId || capabilities?.workspace?.id || 'chat',
                  activeWorkspaceLabel: workspaceKnowledge?.activeWorkspaceLabel || capabilities?.workspace?.label || 'Chat',
                  isolation: workspaceKnowledge?.isolation || capabilities?.workspace?.isolation || 'chat',
                  trustedWorkspaceIds: workspaceKnowledge?.trustedWorkspaceIds || [],
                  allowedPaths: workspaceKnowledge?.allowedPaths || (capabilities?.workspace?.path ? [capabilities.workspace.path] : []),
                  ragSources: workspaceKnowledge?.ragSources || [],
                },
              },
            })}
            type="button"
          >
            Receipt
          </button>
        </div>
      ),
    },
    ...(workspaceKnowledge?.allowedPaths || []).map((allowedPath, index) => ({
      id: `workspace-path-${index}`,
      title: allowedPath,
      description: 'Approved filesystem, shell, RAG and skill scope path.',
      meta: 'allowed path',
      tone: 'ready' as const,
    })),
    ...(workspaceKnowledge?.ragSources || []).map(source => ({
      id: `rag-source-${source.id || source.label}`,
      title: source.label || source.id || 'Knowledge source',
      description: `${source.kind || 'source'} context is ${source.trusted ? 'trusted' : 'wrapped as untrusted'} before the model sees it.`,
      meta: source.trusted ? 'trusted' : 'untrusted',
      tone: source.trusted ? 'ready' as const : 'warning' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'context',
              operation: 'scope-knowledge',
              metadata: {
                runtimeActionType: 'set-workspace-knowledge',
                workspaceKnowledge: {
                  workspaceId: workspaceKnowledge?.workspaceId || capabilities?.workspace?.id || 'chat',
                  activeWorkspaceLabel: workspaceKnowledge?.activeWorkspaceLabel || capabilities?.workspace?.label || 'Chat',
                  isolation: workspaceKnowledge?.isolation || capabilities?.workspace?.isolation || 'chat',
                  trustedWorkspaceIds: workspaceKnowledge?.trustedWorkspaceIds || [],
                  allowedPaths: workspaceKnowledge?.allowedPaths || [],
                  ragSources: (workspaceKnowledge?.ragSources || []).map(candidate => (
                    candidate.id === source.id ? { ...candidate, trusted: true } : candidate
                  )),
                },
              },
            })}
            type="button"
          >
            Trust source
          </button>
        </div>
      ),
    })),
  ];
  const mcpRows = (capabilities?.mcpTrust?.servers || []).map(server => ({
    id: `mcp-${server.id || server.label}`,
    title: server.label || server.id || 'MCP server',
    description: `${server.toolNames?.length || 0} tool(s); network=${server.networkAccess || 'blocked'}; exposed=${server.exposedToModel ? 'yes' : 'no'}.`,
    meta: `${server.trustState || 'review'} / ${server.risk || 'risk unknown'}`,
    tone: server.trustState === 'trusted' ? 'ready' as const : server.trustState === 'blocked' ? 'danger' as const : 'warning' as const,
    actions: (
      <div className="zvd-row-actions">
        <button
          disabled={props.busy || server.trustState === 'trusted'}
          onClick={() => void props.onRuntimeStateAction({
            domain: 'skills',
            operation: 'trust-mcp',
            metadata: {
              runtimeActionType: 'set-mcp-trust',
              mcpTrust: {
                id: server.id,
                label: server.label,
                origin: server.origin || 'desktop',
                trustState: 'trusted',
                toolNames: server.toolNames || [],
              },
            },
          })}
          type="button"
        >
          Trust
        </button>
        <button
          disabled={props.busy || server.trustState === 'blocked'}
          onClick={() => void props.onRuntimeStateAction({
            domain: 'skills',
            operation: 'block-mcp',
            metadata: {
              runtimeActionType: 'set-mcp-trust',
              mcpTrust: {
                id: server.id,
                label: server.label,
                origin: server.origin || 'desktop',
                trustState: 'blocked',
                toolNames: server.toolNames || [],
              },
            },
          })}
          type="button"
        >
          Block
        </button>
      </div>
    ),
  }));
  const skillHistoryRows = (capabilities?.skillHistory?.entries || []).map(entry => ({
    id: `skill-history-${entry.id || entry.skillName}`,
    title: entry.skillName || entry.skillId || 'Skill',
    description: `Mode: ${entry.mode || 'recorded'}; source: ${entry.source || 'runtime'}.`,
    meta: entry.receiptId || entry.at || 'receipt-backed',
    tone: entry.mode === 'blocked' ? 'danger' as const : entry.mode === 'auto-selected' ? 'ready' as const : 'muted' as const,
    actions: (
      <div className="zvd-row-actions">
        <button
          disabled={props.busy}
          onClick={() => void props.onRuntimeStateAction({
            domain: 'skills',
            operation: 'execute-skill',
            metadata: {
              runtimeActionType: 'skill-lifecycle',
              skill: {
                id: entry.skillId || entry.id,
                name: entry.skillName || entry.skillId || 'Skill',
                source: entry.source || 'native',
                status: 'executing',
                lastReceiptId: entry.receiptId || null,
              },
            },
          })}
          type="button"
        >
          Execute
        </button>
      </div>
    ),
  }));
  const skillRows = skillHistoryRows.length > 0 ? skillHistoryRows : [
    {
      id: 'skill-router-default',
      title: 'Skill router',
      description: 'Natural routing can preview the best native skill before execution.',
      meta: 'approval-first',
      tone: 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'skills',
              operation: 'preview-skill',
              metadata: {
                runtimeActionType: 'skill-lifecycle',
                skill: {
                  id: 'native:skill-router',
                  name: 'Skill router',
                  source: 'native',
                  status: 'preview',
                },
              },
            })}
            type="button"
          >
            Preview route
          </button>
        </div>
      ),
    },
  ];
  const projectedPersonalRows = (capabilities?.personalOps?.connectors || []).map(connector => {
    const operations = connector.operations || [];
    const operationSummary = operations.length > 0
      ? operations.map(operation => `${operation.label || operation.id}${operation.enabled ? '' : ' (setup)'}`).join(', ')
      : `${connector.kind || 'connector'} actions wait for account setup`;
    return {
      id: `personal-${connector.id || connector.label}`,
      title: connector.label || connector.id || 'Personal connector',
      description: `${operationSummary}. Every personal operation requires approval and redacted receipts.`,
      meta: connector.enabled ? 'enabled / approval-required' : connector.status || 'disabled',
      tone: connector.enabled ? 'warning' as const : connector.status === 'configured' ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          {connector.status !== 'configured' ? (
            <button
              disabled={props.busy}
              onClick={() => void connectGoogle()}
              type="button"
            >
              Connect Google
            </button>
          ) : null}
          <button
            disabled={props.busy || connector.status === 'disabled'}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'context',
              operation: 'disable-personal-connector',
              metadata: {
                runtimeActionType: 'register-personal-connector',
                personalConnector: {
                  id: connector.id,
                  kind: connector.kind || 'email',
                  label: connector.label || connector.id,
                  status: 'disabled',
                  configured: false,
                  enabled: false,
                },
              },
            })}
            type="button"
          >
            Disable
          </button>
        </div>
      ),
    };
  });
  const personalRows = projectedPersonalRows.length > 0 ? projectedPersonalRows : [
    {
      id: 'personal-google-setup',
      title: 'Google Personal Ops',
      description: personalConnectStatus || 'Connect Gmail, Google Calendar, and Google Tasks through the governed desktop OAuth flow. Every operation still requires approval and redacted receipts.',
      meta: 'not connected',
      tone: 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void connectGoogle()}
            type="button"
          >
            Connect Google
          </button>
        </div>
      ),
    },
  ];
  const jobRows = [
    {
      id: 'runtime-jobs',
      title: 'Scheduled jobs',
      description: capabilities?.jobs?.summary || 'Scheduler recovery state is not projected yet.',
      meta: capabilities?.jobs?.status || 'unknown',
      tone: capabilities?.jobs?.status === 'attention' ? 'warning' as const : capabilities?.jobs ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'cron',
              operation: 'recover',
              metadata: {
                runtimeActionType: 'recover-scheduled-jobs',
                scheduledJobs: {
                  recoverable: capabilities?.jobs?.status === 'attention' ? 1 : 0,
                },
              },
            })}
            type="button"
          >
            Recover
          </button>
        </div>
      ),
    },
    {
      id: 'runtime-stream',
      title: 'Stream session',
      description: capabilities?.streamSession?.resumeToken
        ? `Resume token: ${capabilities.streamSession.resumeToken}`
        : 'No resumable stream token is active.',
      meta: capabilities?.streamSession?.status || 'idle',
      tone: capabilities?.streamSession?.resumable ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy || !capabilities?.streamSession?.resumeToken}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'session',
              operation: 'resume-stream',
              metadata: {
                runtimeActionType: 'resume-stream',
                streamSession: {
                  sessionId: capabilities?.streamSession?.resumeToken ? 'desktop-main' : null,
                  status: capabilities?.streamSession?.resumeToken ? 'streaming' : 'idle',
                  resumeToken: capabilities?.streamSession?.resumeToken || null,
                },
              },
            })}
            type="button"
          >
            Resume
          </button>
        </div>
      ),
    },
  ];
  const runtimeCapabilityRows = [
    {
      id: 'runtime-capabilities',
      title: 'Runtime capabilities',
      description: capabilitySummary
        ? `${capabilitySummary.available || 0} available, ${capabilitySummary.configurable || 0} configurable, ${capabilitySummary.blocked || 0} blocked.`
        : 'Capabilities API is unavailable.',
      meta: capabilities?.contractVersion || 'offline',
      tone: capabilities ? 'ready' as const : 'warning' as const,
    },
    {
      id: 'runtime-model-spec',
      title: 'Model spec',
      description: selectedSpec?.summary || capabilities?.providers?.routingReason || 'Model specs are loaded from runtime state.',
      meta: selectedSpec?.label || capabilities?.modelSpecs?.selectedSpecId || 'daily',
      tone: capabilities ? 'ready' as const : 'muted' as const,
    },
    {
      id: 'runtime-providers',
      title: 'Connected providers',
      description: providerCount > 0
        ? `${providerCount} provider connection(s) configured without exposing secrets.`
        : 'No configured provider connections are projected yet.',
      meta: `${capabilities?.providers?.selectableModelIds?.length || 0} models`,
      tone: providerCount > 0 ? 'ready' as const : 'muted' as const,
    },
    {
      id: 'runtime-trust',
      title: 'MCP and personal ops trust',
      description: `${mcpReviewCount} MCP server(s) need trust review; ${configuredPersonalOps} personal connector(s) configured but still governed.`,
      meta: 'approval-first',
      tone: mcpReviewCount > 0 || configuredPersonalOps > 0 ? 'warning' as const : 'muted' as const,
    },
  ];
  const gatewayPolicy = props.gatewayResilience?.policy || {};
  const gatewayBudget = props.gatewayResilience?.budget || {};
  const gatewayHealth = props.gatewayResilience?.health || {};
  const gatewayFallbackOrder = Array.isArray(gatewayPolicy.fallbackOrder) ? gatewayPolicy.fallbackOrder : [];
  const gatewayReceipts = Array.isArray(props.gatewayResilience?.receipts) ? props.gatewayResilience.receipts : [];
  const gatewayRows = [
    {
      id: 'gateway-primary-route',
      title: 'Primary route',
      description: `${String(gatewayPolicy.primaryProviderId || 'auto')}${gatewayPolicy.primaryModelId ? ` / ${gatewayPolicy.primaryModelId}` : ''}`,
      meta: String(gatewayHealth.status || 'unknown'),
      tone: props.gatewayResilience?.ok === false ? 'warning' as const : 'ready' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onGatewayResilienceAction({ action: 'testRoute', workspaceId: 'zavorth-desktop' })}
            type="button"
          >
            Test Route
          </button>
        </div>
      ),
    },
    {
      id: 'gateway-fallback-order',
      title: 'Fallback order',
      description: gatewayFallbackOrder.length > 0
        ? gatewayFallbackOrder.map((target: any) => target.modelId ? `${target.providerId}:${target.modelId}` : target.providerId).join(' -> ')
        : 'Fallback order is not configured yet.',
      meta: `${gatewayFallbackOrder.length} fallback(s)`,
      tone: gatewayFallbackOrder.length > 0 ? 'ready' as const : 'muted' as const,
    },
    {
      id: 'gateway-budget',
      title: 'Daily budget',
      description: String(gatewayBudget.reason || 'No budget block is active.'),
      meta: String(gatewayBudget.decision || 'allowed'),
      tone: gatewayBudget.decision === 'blocked' ? 'danger' as const : 'ready' as const,
    },
    ...gatewayReceipts.slice(0, 4).map((receipt: any, index: number) => ({
      id: String(receipt.receiptId || `gateway-receipt-${index}`),
      title: receipt.fallbackUsed ? 'Fallback used' : 'Route tested',
      description: String(receipt.receiptId || 'Routing receipt stored.'),
      meta: String(receipt.budgetDecision || 'allowed'),
      tone: receipt.fallbackUsed ? 'warning' as const : 'muted' as const,
    })),
  ];

  const runtimeRows = [
    {
      id: 'runtime',
      title: props.status.running ? 'Runtime reachable' : 'Runtime not reachable',
      description: props.status.message || props.status.baseUrl,
      meta: props.status.baseUrl,
      tone: props.status.running ? 'ready' as const : 'warning' as const,
      actions: (
        <div className="zvd-row-actions">
          <button disabled={props.busy} onClick={() => void props.onStart()} type="button">Start</button>
          <button disabled={props.busy} onClick={() => void props.onRepair()} type="button">Repair</button>
          <button disabled={!window.zavorthDesktop} onClick={() => void window.zavorthDesktop?.openLogs()} type="button">Logs</button>
        </div>
      ),
    },
    {
      id: 'nexus',
      title: 'Nexus',
      description: props.nexusStatus ? JSON.stringify(props.nexusStatus).slice(0, 220) : 'Status unavailable.',
      meta: 'local',
      tone: props.nexusStatus ? 'ready' as const : 'muted' as const,
    },
    ...runtimeCapabilityRows,
    ...props.events.map(event => ({
      id: `${event.at}-${event.message}`,
      title: event.message,
      description: event.type,
      meta: new Date(event.at).toLocaleTimeString(),
      tone: event.type === 'error' ? 'danger' as const : 'muted' as const,
    })),
  ];
  const runtimeRowsForMode = runtimeMode === 'permissions'
    ? [...providerRows, ...permissionRows]
    : runtimeMode === 'gateway'
      ? gatewayRows
      : runtimeMode === 'providers'
        ? providerRows
        : runtimeMode === 'workspace'
          ? workspaceRows
          : runtimeMode === 'mcp'
            ? mcpRows
            : runtimeMode === 'skills'
              ? skillRows
              : runtimeMode === 'jobs'
                ? jobRows
                : runtimeMode === 'personal'
                  ? personalRows
                  : runtimeRows;

  return (
    <PageFrame
      description="Experience preferences, local runtime, access repair, logs, and recent desktop events."
      meta={props.status.running ? 'ready' : 'offline'}
      title={panelLabels.settings}
    >
      <div className="zvd-settings-sections">
        <section className="zvd-settings-section" aria-label="Experience">
          <h2>Experience</h2>
          <DetailRows rows={experienceRows} empty="No experience settings are available." />
        </section>
        <section className="zvd-settings-section" aria-label="Runtime">
          <h2>Runtime</h2>
          <TextTabs<typeof runtimeMode>
            value={runtimeMode}
            onChange={setRuntimeMode}
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'gateway', label: 'Gateway', count: gatewayRows.length },
              { value: 'permissions', label: 'Permissions', count: providerRows.length + permissionRows.length },
              { value: 'providers', label: 'Providers', count: providerRows.length },
              { value: 'workspace', label: 'Workspace', count: workspaceRows.length },
              { value: 'mcp', label: 'MCP', count: mcpRows.length },
              { value: 'skills', label: 'Skills', count: skillRows.length },
              { value: 'jobs', label: 'Jobs', count: jobRows.length },
              { value: 'personal', label: 'Personal Ops', count: personalRows.length },
              { value: 'diagnostics', label: 'Beta Checklist' },
            ]}
          />
          {runtimeMode === 'providers' ? (
            <ProviderSettingsPanel />
          ) : runtimeMode === 'diagnostics' ? (
            <InternalBetaDiagnosticsPanel workspaceId={capabilities?.workspace?.id || 'chat'} />
          ) : runtimeMode === 'overview' ? (
            <CockpitDashboard
              workspaceId={capabilities?.workspace?.id || 'chat'}
              workspacePath={capabilities?.workspace?.path || null}
              runtimeCapabilities={capabilities}
              status={props.status}
              approvalsCount={props.approvalsCount}
              onStart={props.onStart}
              onRepair={props.onRepair}
            />
          ) : (
            <DetailRows rows={runtimeRowsForMode} empty="No runtime status is available." />
          )}
        </section>
      </div>
    </PageFrame>
  );
}

export function FilesView(props: { workspaceScope: DesktopWorkspaceScope }) {
  const [tree, setTree] = useState<FileExplorerNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const loadFileTree = useCallback(async () => {
    if (!props.workspaceScope.path) {
      setError('No active folder selected.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (window.zavorthDesktop?.readFileTree) {
        const res = await window.zavorthDesktop.readFileTree(props.workspaceScope.path);
        if (res.ok && res.tree) {
          setTree(res.tree);
        } else {
          setError(res.error || 'Failed to read workspace folder.');
        }
      } else {
        setError('Desktop API is not available.');
      }
    } catch {
      setError('An error occurred while reading the workspace.');
    } finally {
      setLoading(false);
    }
  }, [props.workspaceScope.path]);

  useEffect(() => {
    void loadFileTree();
  }, [loadFileTree]);

  // Recursively filters the tree based on query
  const filterTree = (nodes: FileExplorerNode[], q: string): FileExplorerNode[] => {
    if (!q) return nodes;
    return nodes
      .map(node => {
        if (node.type === 'file') {
          return node.name.toLowerCase().includes(q) ? node : null;
        }
        const filteredChildren = node.children ? filterTree(node.children, q) : [];
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
          return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter((n): n is FileExplorerNode => n !== null);
  };

  const filteredTree = useMemo(() => filterTree(tree, query.trim().toLowerCase()), [tree, query]);

  return (
    <PageFrame
      description="Navigate local files governed by Zavorth."
      meta={props.workspaceScope.path || 'No path'}
      title="Workspace Files"
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => void loadFileTree()}
            className="session-picker-btn"
            disabled={loading}
            title="Refresh"
            style={{
              padding: '6px',
              backgroundColor: 'var(--zvd-bg-subtle, #161b22)',
              border: '1px solid var(--zvd-border, #30363d)',
              borderRadius: '4px',
              color: '#c9d1d9',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            type="button"
          >
            <Refresh size={14} />
          </button>
          <SearchBox value={query} onChange={setQuery} placeholder="Filter files..." />
        </div>
      }
    >
      <div
        style={{
          padding: '16px',
          backgroundColor: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '8px',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 200px)',
          fontFamily: 'monospace',
          fontSize: '13px',
        }}
      >
        {loading && <LemniscateLoader text="Loading file structure..." />}
        {error && <div style={{ color: '#ff7b72', padding: '8px' }}>{error}</div>}
        {!loading && !error && filteredTree.length === 0 && (
          <div style={{ color: '#8b949e', padding: '8px' }}>No files found.</div>
        )}
        {!loading && !error && filteredTree.map(node => (
          <FileTreeNodeRow key={node.relativePath} node={node} depth={0} />
        ))}
      </div>
    </PageFrame>
  );
}

function FileTreeNodeRow({ node, depth }: { node: FileExplorerNode; depth: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const isDir = node.type === 'directory';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        onClick={() => isDir && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          paddingLeft: `${depth * 16 + 8}px`,
          cursor: isDir ? 'pointer' : 'default',
          borderRadius: '4px',
          userSelect: 'none',
          color: isDir ? '#e2e8f0' : '#8b949e',
          transition: 'background-color 0.15s ease',
        }}
      >
        {isDir ? (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', width: '12px' }}>
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            <Folder size={16} style={{ color: '#d29922' }} />
            <strong style={{ fontWeight: '500' }}>{node.name}</strong>
          </>
        ) : (
          <>
            <span style={{ width: '12px' }} />
            <span style={{ fontSize: '13px' }}>📄</span>
            <span>{node.name}</span>
          </>
        )}
      </div>
      {isDir && isOpen && node.children?.map(child => (
        <FileTreeNodeRow key={child.relativePath} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
