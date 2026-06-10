import { useMemo, useState, type ReactNode } from 'react';
import type {
  ApprovalItem,
  ChannelItem,
  LearningItem,
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
  RuntimeCapabilitiesSnapshot,
  ToolItem,
} from '../apiClient';
import type { BootEvent, RuntimeStatus } from '../global';
import { asRecord, effortLabels, itemId, panelLabels, profileLabels } from '../primitives/desktopPrimitives';
import type { DesktopPanel } from '../slashCommands';

type WorkspaceViewProps = {
  activePanel: Exclude<DesktopPanel, 'chat'>;
  accent: 'orange' | 'purple' | 'navy';
  approvals: ApprovalItem[];
  busy: boolean;
  channels: ChannelItem[];
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  events: BootEvent[];
  effort: string;
  learning: LearningItem[];
  memoryItems: MemoryItem[];
  nexusStatus: unknown;
  profile: string;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  status: RuntimeStatus;
  theme: 'light' | 'dark' | 'system';
  tools: ToolItem[];
  onAccessRepair(): void | Promise<void>;
  onAccent(value: 'orange' | 'purple' | 'navy'): void;
  onEffort(value: string): void;
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onProfile(value: string): void;
  onReviewDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  onRuntimeStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
};

export function DesktopWorkspaceView(props: WorkspaceViewProps) {
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
      />
    );
  }

  if (props.activePanel === 'skills') {
    return <SkillsView tools={props.tools} />;
  }

  if (props.activePanel === 'channels') {
    return <ChannelsView channels={props.channels} />;
  }

  return (
    <SettingsView
      busy={props.busy}
      effort={props.effort}
      events={props.events}
      nexusStatus={props.nexusStatus}
      profile={props.profile}
      runtimeCapabilities={props.runtimeCapabilities}
      status={props.status}
      theme={props.theme}
      accent={props.accent}
      onEffort={props.onEffort}
      onAccent={props.onAccent}
      onProfile={props.onProfile}
      onRepair={props.onAccessRepair}
      onStart={props.onRuntimeStart}
      onRuntimeStateAction={props.onRuntimeStateAction}
      onTheme={props.onTheme}
    />
  );
}

function PageFrame(props: {
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

function ReviewView(props: {
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

function MemoryView(props: {
  busy: boolean;
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  items: MemoryItem[];
  learning: LearningItem[];
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
}) {
  const [mode, setMode] = useState<'learned' | 'candidates' | 'protection'>('learned');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const protection = props.encryptionStatus;
  const canRollback = Boolean(props.encryptionReceipt?.backupPath && props.encryptionReceipt.status === 'applied');

  const learnedRows = props.items
    .filter(item => !q || `${item.title || ''} ${item.summary || ''} ${item.kind || ''}`.toLowerCase().includes(q))
    .map((item, index) => ({
      id: itemId(item, `memory-${index}`),
      title: item.title || item.kind || 'Memory receipt',
      description: item.summary || item.receiptId || 'Stored with provenance.',
      meta: item.expiry || item.receiptId || 'local',
      tone: 'ready' as const,
    }));

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

function ChannelsView(props: { channels: ChannelItem[] }) {
  const [query, setQuery] = useState('');
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
  status: RuntimeStatus;
  theme: 'light' | 'dark' | 'system';
  onAccent(value: 'orange' | 'purple' | 'navy'): void;
  onEffort(value: string): void;
  onProfile(value: string): void;
  onRepair(): void | Promise<void>;
  onStart(): void | Promise<void>;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onTheme(value: 'light' | 'dark' | 'system'): void;
}) {
  const [runtimeMode, setRuntimeMode] = useState<'overview' | 'permissions' | 'providers' | 'mcp' | 'skills' | 'jobs' | 'personal'>('overview');
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
  const providerCount = capabilities?.providers?.connected?.length || 0;
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
  const providerRows = (capabilities?.providers?.connected || []).map(provider => ({
    id: `provider-${provider.id || provider.label}`,
    title: provider.label || provider.id || 'Provider',
    description: provider.targetHost ? `Target: ${provider.targetHost}` : 'Configured through sanitized runtime state.',
    meta: provider.status || 'configured',
    tone: provider.status === 'configured' ? 'ready' as const : 'warning' as const,
    actions: (
      <div className="zvd-row-actions">
        <button
          disabled={props.busy}
          onClick={() => void props.onRuntimeStateAction({
            domain: 'gateway',
            operation: 'sync',
            metadata: { providerId: provider.id || null },
          })}
          type="button"
        >
          Sync
        </button>
      </div>
    ),
  }));
  const mcpRows = (capabilities?.mcpTrust?.servers || []).map(server => ({
    id: `mcp-${server.id || server.label}`,
    title: server.label || server.id || 'MCP server',
    description: `${server.toolNames?.length || 0} tool(s); exposed=${server.exposedToModel ? 'yes' : 'no'}.`,
    meta: server.trustState || 'review',
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
  const skillRows = (capabilities?.skillHistory?.entries || []).map(entry => ({
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
            operation: 'sync',
            metadata: { skillId: entry.skillId || null },
          })}
          type="button"
        >
          Sync
        </button>
      </div>
    ),
  }));
  const personalRows = (capabilities?.personalOps?.connectors || []).map(connector => ({
    id: `personal-${connector.id || connector.label}`,
    title: connector.label || connector.id || 'Personal connector',
    description: `${connector.kind || 'connector'}: read=${connector.readAllowed ? 'yes' : 'no'}, draft=${connector.draftAllowed ? 'yes' : 'no'}, send requires approval.`,
    meta: connector.enabled ? 'enabled' : connector.status || 'disabled',
    tone: connector.enabled ? 'warning' as const : connector.status === 'configured' ? 'ready' as const : 'muted' as const,
  }));
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
    ? permissionRows
    : runtimeMode === 'providers'
      ? providerRows
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
              { value: 'permissions', label: 'Permissions', count: permissionRows.length },
              { value: 'providers', label: 'Providers', count: providerRows.length },
              { value: 'mcp', label: 'MCP', count: mcpRows.length },
              { value: 'skills', label: 'Skills', count: skillRows.length },
              { value: 'jobs', label: 'Jobs', count: jobRows.length },
              { value: 'personal', label: 'Personal Ops', count: personalRows.length },
            ]}
          />
          <DetailRows rows={runtimeRowsForMode} empty="No runtime status is available." />
        </section>
      </div>
    </PageFrame>
  );
}
