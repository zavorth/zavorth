import type {
  ApprovalItem,
  LearningItem,
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
  ToolItem,
} from '../apiClient';
import type { BootEvent, RuntimeStatus } from '../global';
import { asRecord, EmptyPanel, itemId, panelLabels, PanelScaffold } from '../primitives/desktopPrimitives';
import type { DesktopPanel } from '../slashCommands';

export function DesktopInspector(props: {
  activePanel: DesktopPanel;
  approvals: ApprovalItem[];
  busy: boolean;
  channels: any[];
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  events: BootEvent[];
  learning: LearningItem[];
  memoryItems: MemoryItem[];
  nexusStatus: unknown;
  open: boolean;
  status: RuntimeStatus;
  tools: ToolItem[];
  onClose(): void;
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onRepair(): void | Promise<void>;
  onReviewDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  onStart(): void | Promise<void>;
}) {
  if (!props.open) {
    return null;
  }

  return (
    <aside className="zvd-inspector" aria-label={`${panelLabels[props.activePanel]} inspector`}>
      <header className="zvd-inspector-header">
        <div>
          <span>Inspector</span>
          <strong>{panelLabels[props.activePanel]}</strong>
        </div>
        <button onClick={props.onClose} aria-label="Close inspector">x</button>
      </header>
      <div className="zvd-inspector-body">
        {props.activePanel === 'approvals' && (
          <ApprovalsPanel approvals={props.approvals} busy={props.busy} onDecision={props.onReviewDecision} />
        )}
        {props.activePanel === 'memory' && (
          <MemoryPanel
            items={props.memoryItems}
            learning={props.learning}
            busy={props.busy}
            encryptionStatus={props.encryptionStatus}
            encryptionReceipt={props.encryptionReceipt}
            onLearningDecision={props.onLearningDecision}
            onEncryptionAction={props.onEncryptionAction}
          />
        )}
        {props.activePanel === 'skills' && <SkillsPanel tools={props.tools} />}
        {props.activePanel === 'channels' && <ChannelsPanel channels={props.channels} />}
        {props.activePanel === 'settings' && (
          <SettingsPanel
            status={props.status}
            events={props.events}
            nexusStatus={props.nexusStatus}
            busy={props.busy}
            onStart={props.onStart}
            onRepair={props.onRepair}
          />
        )}
      </div>
    </aside>
  );
}

function ApprovalsPanel(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  onDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
}) {
  return (
    <PanelScaffold title="Review" subtitle="Actions waiting for a decision.">
      {props.approvals.length === 0 ? <EmptyPanel text="No pending approvals." /> : props.approvals.map((approval, index) => {
        const id = itemId(approval, `approval-${index}`);
        return (
          <div className="zvd-panel-card" key={id}>
            <strong>{approval.title || approval.action || 'Pending approval'}</strong>
            <span>{approval.summary || approval.risk || approval.status || 'Review the requested action.'}</span>
            <div className="zvd-card-actions">
              <button disabled={props.busy} onClick={() => void props.onDecision(id, 'approve')}>Approve</button>
              <button disabled={props.busy} onClick={() => void props.onDecision(id, 'reject')}>Reject</button>
            </div>
          </div>
        );
      })}
    </PanelScaffold>
  );
}

function MemoryPanel(props: {
  items: MemoryItem[];
  learning: LearningItem[];
  busy: boolean;
  encryptionStatus: MemoryEncryptionStatus | null;
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
}) {
  const protectionLabel = props.encryptionStatus?.fullFileEncrypted
    ? 'Advanced memory protection'
    : props.encryptionStatus?.contentEncrypted
      ? 'Standard memory protection'
      : 'Memory protection';
  const protectionState = props.encryptionStatus
    ? props.encryptionStatus.fullFileEncrypted
      ? 'Whole memory file is sealed.'
      : props.encryptionStatus.guidance
    : 'Status unavailable.';
  const canRollback = Boolean(props.encryptionReceipt?.backupPath && props.encryptionReceipt.status === 'applied');

  return (
    <PanelScaffold title="Memory" subtitle="Learned context and reversible candidates.">
      <div className="zvd-panel-card">
        <strong>Memory protection</strong>
        <span>{protectionLabel}</span>
        <span>{protectionState}</span>
        {props.encryptionStatus?.fullFileEncryptionDriverPackage && (
          <span>Driver: {props.encryptionStatus.fullFileEncryptionDriverPackage}</span>
        )}
        {props.encryptionReceipt && (
          <span>{props.encryptionReceipt.status}: {props.encryptionReceipt.reason}</span>
        )}
        <div className="zvd-card-actions">
          <button disabled={props.busy} onClick={() => void props.onEncryptionAction('preview')}>Preview</button>
          <button disabled={props.busy || props.encryptionStatus?.fullFileEncrypted} onClick={() => void props.onEncryptionAction('apply')}>
            Enable advanced
          </button>
          <button disabled={props.busy || !canRollback} onClick={() => void props.onEncryptionAction('rollback')}>Rollback</button>
        </div>
      </div>
      {props.items.length === 0 && props.learning.length === 0 && <EmptyPanel text="No memory items are projected yet." />}
      {props.learning.map((candidate, index) => {
        const id = itemId(candidate, `learning-${index}`);
        return (
          <div className="zvd-panel-card" key={id}>
            <strong>{candidate.title || candidate.kind || 'Learning candidate'}</strong>
            <span>{candidate.summary || `${candidate.lane || 'lane'} - ${candidate.risk || 'risk unknown'}`}</span>
            <div className="zvd-card-actions">
              <button disabled={props.busy} onClick={() => void props.onLearningDecision(id, 'approve')}>Approve</button>
              <button disabled={props.busy} onClick={() => void props.onLearningDecision(id, 'reject')}>Reject</button>
              <button disabled={props.busy} onClick={() => void props.onLearningDecision(id, 'forget')}>Forget</button>
            </div>
          </div>
        );
      })}
      {props.items.map((item, index) => (
        <div className="zvd-panel-card" key={itemId(item, `memory-${index}`)}>
          <strong>{item.title || item.kind || 'Memory receipt'}</strong>
          <span>{item.summary || item.receiptId || 'Stored with provenance.'}</span>
        </div>
      ))}
    </PanelScaffold>
  );
}

function SkillsPanel(props: { tools: ToolItem[] }) {
  return (
    <PanelScaffold title="Skills" subtitle="Tools exposed by the local runtime.">
      {props.tools.length === 0 ? <EmptyPanel text="No tools are projected yet." /> : props.tools.map((tool, index) => (
        <div className="zvd-panel-card" key={itemId(tool, `tool-${index}`)}>
          <strong>{tool.title || tool.name || tool.id || 'Tool'}</strong>
          <span>{tool.description || tool.source || tool.status || 'Available through the runtime.'}</span>
        </div>
      ))}
    </PanelScaffold>
  );
}

function ChannelsPanel(props: { channels: any[] }) {
  return (
    <PanelScaffold title="Channels" subtitle="Configured routes and readiness.">
      {props.channels.length === 0 ? <EmptyPanel text="No channel readiness is projected yet." /> : props.channels.map((channel, index) => {
        const record = asRecord(channel);
        return (
          <div className="zvd-panel-card" key={String(record.id || record.channel || record.name || `channel-${index}`)}>
            <strong>{String(record.name || record.channel || record.id || 'Channel')}</strong>
            <span>
              {record.liveReady ? 'Live ready' : record.outboxOnly ? 'Outbox only' : String(record.status || record.summary || 'Needs setup')}
            </span>
          </div>
        );
      })}
    </PanelScaffold>
  );
}

function SettingsPanel(props: {
  status: RuntimeStatus;
  events: BootEvent[];
  nexusStatus: unknown;
  busy: boolean;
  onStart(): void | Promise<void>;
  onRepair(): void | Promise<void>;
}) {
  return (
    <PanelScaffold title="Settings" subtitle="Runtime, provider route and desktop access.">
      <div className="zvd-panel-card">
        <strong>Runtime</strong>
        <span>{props.status.running ? 'Reachable' : 'Not reachable yet'}</span>
        <span>{props.status.baseUrl}</span>
        <div className="zvd-card-actions">
          <button disabled={props.busy} onClick={() => void props.onStart()}>Start</button>
          <button disabled={props.busy} onClick={() => void props.onRepair()}>Repair access</button>
          <button disabled={!window.zavorthDesktop} onClick={() => void window.zavorthDesktop?.openLogs()}>Logs</button>
        </div>
      </div>
      <div className="zvd-panel-card">
        <strong>Provider route</strong>
        <span>Model control is routed through the local runtime. Use /model to open this inspector.</span>
      </div>
      <div className="zvd-panel-card">
        <strong>Nexus</strong>
        <span>{props.nexusStatus ? JSON.stringify(props.nexusStatus).slice(0, 220) : 'Status unavailable.'}</span>
      </div>
      {props.events.map(event => (
        <div className="zvd-event" key={`${event.at}-${event.message}`} data-tone={event.type}>
          <span>{event.message}</span>
          <time>{new Date(event.at).toLocaleTimeString()}</time>
        </div>
      ))}
    </PanelScaffold>
  );
}
