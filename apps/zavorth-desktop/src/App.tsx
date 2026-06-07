import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  loadApprovals,
  loadDesktopPanelsData,
  loadHome,
  loadRuntimeStatus,
  repairAccess,
  resolveApproval as resolveApprovalRequest,
  resolveLearning as resolveLearningRequest,
  runMemoryEncryptionMigration,
  sendExperienceMessage,
  startRuntime,
  steerActiveRun,
  type ApprovalItem,
  type ChatMessage,
  type ExperienceSnapshot,
  type LearningItem,
  type MemoryEncryptionMigrationReceipt,
  type MemoryEncryptionStatus,
  type MemoryItem,
  type ToolItem,
} from './apiClient';
import type { BootEvent, RuntimeStatus } from './global';
import { parseSlashCommand, slashCommands, type DesktopPanel } from './slashCommands';

const fallbackStatus: RuntimeStatus = {
  ok: false,
  running: false,
  baseUrl: 'http://127.0.0.1:3000',
  tokenReady: false,
  tokenSource: 'missing',
  runtimePid: null,
  message: 'Desktop bridge unavailable.',
};

const profileLabels = ['personal', 'creator', 'developer', 'business', 'power'] as const;
const effortLabels = ['low', 'medium', 'high', 'ultra'] as const;

const responseProfileByExperience: Record<string, string> = {
  personal: 'short',
  creator: 'mentor',
  developer: 'dev',
  business: 'executive',
  power: 'dev',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeMessage(raw: unknown, index: number): ChatMessage {
  const record = asRecord(raw);
  const role = String(record.role || record.kind || 'assistant');
  const normalizedRole: ChatMessage['role'] = role === 'user' || role === 'system' || role === 'tool'
    ? role
    : 'assistant';
  const content = String(record.content || record.text || record.message || record.markdown || '').trim();
  return {
    id: String(record.id || record.messageId || `message-${index}-${Date.now()}`),
    role: normalizedRole,
    content: content || '(empty message)',
    at: String(record.at || record.createdAt || record.generatedAt || new Date().toISOString()),
    title: typeof record.title === 'string' ? record.title : undefined,
  };
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeMessage).filter(message => message.content);
}

function itemId(item: ApprovalItem | LearningItem | MemoryItem | ToolItem, fallback: string): string {
  return String(item.id || ('approvalId' in item ? item.approvalId : '') || ('candidateId' in item ? item.candidateId : '') || fallback);
}

function appendLocalMessage(setMessages: (updater: (current: ChatMessage[]) => ChatMessage[]) => void, role: ChatMessage['role'], content: string) {
  setMessages(current => [
    ...current,
    {
      id: `local-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      at: new Date().toISOString(),
    },
  ]);
}

export function App() {
  const [status, setStatus] = useState<RuntimeStatus>(fallbackStatus);
  const [snapshot, setSnapshot] = useState<ExperienceSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [learning, setLearning] = useState<LearningItem[]>([]);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [nexusStatus, setNexusStatus] = useState<unknown>(null);
  const [memoryEncryptionStatus, setMemoryEncryptionStatus] = useState<MemoryEncryptionStatus | null>(null);
  const [memoryEncryptionReceipt, setMemoryEncryptionReceipt] = useState<MemoryEncryptionMigrationReceipt | null>(null);
  const [events, setEvents] = useState<BootEvent[]>([]);
  const [activePanel, setActivePanel] = useState<DesktopPanel>('chat');
  const [experienceProfile, setExperienceProfile] = useState('personal');
  const [effort, setEffort] = useState('medium');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const bridgeReady = Boolean(window.zavorthDesktop);
  const sessionId = snapshot?.sessionId || 'desktop-main';
  const responseProfile = responseProfileByExperience[experienceProfile] || 'short';

  const refreshRuntime = useCallback(async () => {
    if (!bridgeReady) {
      return fallbackStatus;
    }
    const next = await loadRuntimeStatus();
    setStatus(next);
    return next;
  }, [bridgeReady]);

  const refreshPanels = useCallback(async () => {
    try {
      const data = await loadDesktopPanelsData();
      setApprovals(data.approvals);
      setLearning(data.learning);
      setTools(data.tools);
      setNexusStatus(data.nexusStatus);
      setMemoryEncryptionStatus(data.memoryEncryptionStatus);
    } catch {
      setApprovals([]);
      setLearning([]);
      setTools([]);
      setNexusStatus(null);
      setMemoryEncryptionStatus(null);
    }
  }, []);

  const refreshHome = useCallback(async () => {
    try {
      const home = await loadHome(sessionId, responseProfile);
      setSnapshot(home);
      const homeMessages = normalizeMessages(home.chat?.messages);
      if (homeMessages.length > 0) {
        setMessages(homeMessages);
      }
      setNotice('');
      return home;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reach the local runtime.');
      return null;
    }
  }, [responseProfile, sessionId]);

  useEffect(() => {
    if (!bridgeReady) {
      return;
    }

    let mounted = true;
    void refreshRuntime()
      .then(() => mounted ? refreshHome() : null)
      .then(() => mounted ? refreshPanels() : null)
      .catch(() => undefined);
    const off = window.zavorthDesktop!.onBootEvent(event => {
      setEvents(current => [event, ...current].slice(0, 8));
    });

    return () => {
      mounted = false;
      off();
    };
  }, [bridgeReady, refreshHome, refreshPanels, refreshRuntime]);

  const memoryItems = useMemo(() => {
    const memory = snapshot?.memory || {};
    return [
      ...((Array.isArray(memory.items) ? memory.items : []) as MemoryItem[]),
      ...((Array.isArray(memory.receipts) ? memory.receipts : []) as MemoryItem[]),
    ];
  }, [snapshot]);

  const channelItems = useMemo(() => {
    const channels = snapshot?.channels || {};
    return [
      ...((Array.isArray(channels.routes) ? channels.routes : []) as any[]),
      ...((Array.isArray(channels.readiness) ? channels.readiness : []) as any[]),
    ];
  }, [snapshot]);

  async function resolveApproval(approvalId: string, decision: 'approve' | 'reject') {
    setBusy(true);
    try {
      await resolveApprovalRequest(approvalId, decision);
      await refreshPanels();
      appendLocalMessage(setMessages, 'system', `Approval ${decision === 'approve' ? 'approved' : 'rejected'}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not resolve approval.');
    } finally {
      setBusy(false);
    }
  }

  async function resolveLearning(candidateId: string, decision: 'approve' | 'reject' | 'forget') {
    setBusy(true);
    try {
      await resolveLearningRequest(candidateId, decision);
      await refreshPanels();
      appendLocalMessage(setMessages, 'system', `Learning candidate marked as ${decision}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not resolve learning candidate.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMemoryEncryptionAction(action: 'preview' | 'apply' | 'rollback') {
    setBusy(true);
    try {
      const result = await runMemoryEncryptionMigration({
        action,
        backupPath: action === 'rollback' ? memoryEncryptionReceipt?.backupPath : null,
      });
      if (result.status) {
        setMemoryEncryptionStatus(result.status);
      }
      if (result.receipt) {
        setMemoryEncryptionReceipt(result.receipt);
        appendLocalMessage(setMessages, 'system', `Memory protection ${result.receipt.status}: ${result.receipt.reason}`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update memory protection.');
    } finally {
      setBusy(false);
      void refreshPanels();
    }
  }

  async function sendMessage(rawText = input) {
    const text = rawText.trim();
    if (!text || busy) {
      return;
    }

    const parsed = parseSlashCommand(text);
    setInput('');
    setNotice('');

    if (parsed.kind === 'help') {
      appendLocalMessage(setMessages, 'system', slashCommands.map(command => `${command.usage} - ${command.description}`).join('\n'));
      return;
    }
    if (parsed.kind === 'panel') {
      setActivePanel(parsed.panel);
      return;
    }
    if (parsed.kind === 'set-effort') {
      setEffort(parsed.effort);
      appendLocalMessage(setMessages, 'system', `Effort set to ${parsed.effort}.`);
      return;
    }
    if (parsed.kind === 'set-profile') {
      setExperienceProfile(parsed.profile);
      appendLocalMessage(setMessages, 'system', `Profile set to ${parsed.profile}.`);
      return;
    }
    if (parsed.kind === 'stop') {
      setBusy(true);
      try {
        await steerActiveRun({
          sessionId,
          message: 'Stop the current run as soon as the active executor reaches a safe cancellation point.',
        });
        appendLocalMessage(setMessages, 'system', 'Stop requested for the active run.');
      } catch {
        const result = await sendExperienceMessage({
          text: 'Stop the current run as soon as it is safe.',
          sessionId,
          responseProfile,
          effort,
          profile: experienceProfile,
        });
        setSnapshot(result.snapshot || snapshot);
        appendLocalMessage(setMessages, 'system', result.error || 'Stop request sent.');
      } finally {
        setBusy(false);
        void refreshPanels();
      }
      return;
    }

    const outbound = parsed.kind === 'send' ? parsed.text : parsed.text;
    appendLocalMessage(setMessages, 'user', outbound);
    setBusy(true);
    try {
      const result = await sendExperienceMessage({
        text: outbound,
        sessionId,
        responseProfile,
        effort,
        profile: experienceProfile,
      });
      if (result.snapshot) {
        setSnapshot(result.snapshot);
      }
      const nextMessages = normalizeMessages(result.snapshot?.chat?.messages);
      const replies = normalizeMessages(result.replies || result.messages);
      if (nextMessages.length > 0) {
        setMessages(nextMessages);
      } else if (replies.length > 0) {
        setMessages(current => [...current, ...replies]);
      } else {
        appendLocalMessage(setMessages, 'assistant', result.error || 'Zavorth received the request.');
      }
      await refreshPanels();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not send message.');
      appendLocalMessage(setMessages, 'system', 'The message could not be delivered to the local runtime.');
    } finally {
      setBusy(false);
    }
  }

  async function requestRuntimeStart() {
    setBusy(true);
    try {
      const next = await startRuntime();
      setStatus(next);
      setNotice(next.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not start runtime.');
    } finally {
      setBusy(false);
    }
  }

  async function requestAccessRepair() {
    setBusy(true);
    try {
      const next = await repairAccess();
      setStatus(next);
      setNotice(next.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not repair access.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="zvd-app">
      <aside className="zvd-rail" aria-label="Zavorth navigation">
        <div className="zvd-mark">Z</div>
        <button className={activePanel === 'chat' ? 'is-active' : ''} onClick={() => setActivePanel('chat')}>Chat</button>
        <button className={activePanel === 'approvals' ? 'is-active' : ''} onClick={() => setActivePanel('approvals')}>Review</button>
        <button className={activePanel === 'memory' ? 'is-active' : ''} onClick={() => setActivePanel('memory')}>Memory</button>
        <button className={activePanel === 'skills' ? 'is-active' : ''} onClick={() => setActivePanel('skills')}>Skills</button>
        <button className={activePanel === 'channels' ? 'is-active' : ''} onClick={() => setActivePanel('channels')}>Channels</button>
        <button className={activePanel === 'settings' ? 'is-active' : ''} onClick={() => setActivePanel('settings')}>Settings</button>
      </aside>

      <section className="zvd-shell" aria-label="Zavorth Desktop">
        <header className="zvd-topbar">
          <div>
            <strong>Zavorth</strong>
            <span>{status.running ? 'Local runtime ready' : 'Local runtime idle'}</span>
          </div>
          <div className="zvd-controls">
            <select value={experienceProfile} onChange={event => setExperienceProfile(event.target.value)} aria-label="Experience profile">
              {profileLabels.map(profile => <option key={profile} value={profile}>{profile}</option>)}
            </select>
            <select value={effort} onChange={event => setEffort(event.target.value)} aria-label="Effort">
              {effortLabels.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
            <button onClick={() => setActivePanel('settings')}>Model</button>
            <button disabled={busy} onClick={() => void refreshHome()}>Refresh</button>
          </div>
        </header>

        <div className="zvd-content">
          <section className="zvd-chat" aria-label="Chat">
            {notice && <div className="zvd-notice">{notice}</div>}
            {!status.running && (
              <div className="zvd-inline-setup">
                <span>{status.message}</span>
                <button disabled={busy} onClick={() => void requestRuntimeStart()}>Start</button>
                <button disabled={busy} onClick={() => void requestAccessRepair()}>Repair</button>
              </div>
            )}
            <div className="zvd-thread" aria-live="polite">
              {messages.length === 0 ? (
                <div className="zvd-empty-thread">
                  <strong>Ready when you are.</strong>
                  <span>Ask normally, or type /help for commands.</span>
                </div>
              ) : messages.map(message => (
                <article key={message.id} className={`zvd-message zvd-message--${message.role}`}>
                  <span>{message.role}</span>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
            <DesktopCommandBar
              busy={busy}
              value={input}
              onChange={setInput}
              onSubmit={sendMessage}
              onPanel={setActivePanel}
            />
          </section>

          <aside className={`zvd-panel ${activePanel === 'chat' ? 'zvd-panel--quiet' : ''}`}>
            {activePanel === 'approvals' && (
              <ApprovalsPanel approvals={approvals} busy={busy} onDecision={resolveApproval} />
            )}
            {activePanel === 'memory' && (
              <MemoryPanel
                items={memoryItems}
                learning={learning}
                busy={busy}
                encryptionStatus={memoryEncryptionStatus}
                encryptionReceipt={memoryEncryptionReceipt}
                onLearningDecision={resolveLearning}
                onEncryptionAction={handleMemoryEncryptionAction}
              />
            )}
            {activePanel === 'skills' && (
              <SkillsPanel tools={tools} />
            )}
            {activePanel === 'channels' && (
              <ChannelsPanel channels={channelItems} />
            )}
            {activePanel === 'settings' && (
              <SettingsPanel
                status={status}
                events={events}
                nexusStatus={nexusStatus}
                busy={busy}
                onStart={requestRuntimeStart}
                onRepair={requestAccessRepair}
              />
            )}
            {activePanel === 'chat' && (
              <div className="zvd-panel-card">
                <strong>Session</strong>
                <span>Profile: {experienceProfile}</span>
                <span>Effort: {effort}</span>
                <span>Session: {sessionId}</span>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function DesktopCommandBar(props: {
  busy: boolean;
  value: string;
  onChange(value: string): void;
  onSubmit(value?: string): void | Promise<void>;
  onPanel(panel: DesktopPanel): void;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    void props.onSubmit(props.value);
  }

  return (
    <form className="zvd-composer" onSubmit={submit}>
      <textarea
        value={props.value}
        onChange={event => props.onChange(event.target.value)}
        placeholder="Ask Zavorth"
        rows={1}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void props.onSubmit(props.value);
          }
        }}
      />
      <div className="zvd-composer-actions">
        <button type="button" onClick={() => props.onPanel('skills')}>Tools</button>
        <button type="button" onClick={() => props.onPanel('memory')}>Memory</button>
        <button type="submit" disabled={props.busy || !props.value.trim()}>
          {props.busy ? 'Working' : 'Send'}
        </button>
      </div>
    </form>
  );
}

function ApprovalsPanel(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  onDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
}) {
  return (
    <PanelScaffold title="Review" subtitle="Approvals that need an operator decision.">
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
            <span>{candidate.summary || `${candidate.lane || 'lane'} · ${candidate.risk || 'risk unknown'}`}</span>
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
    <PanelScaffold title="Settings" subtitle="Local runtime, provider route and desktop access.">
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
        <span>Model control is routed through the local runtime. Use /model to keep this panel open.</span>
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

function PanelScaffold(props: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <>
      <div className="zvd-panel-heading">
        <h2>{props.title}</h2>
        <p>{props.subtitle}</p>
      </div>
      <div className="zvd-panel-list">{props.children}</div>
    </>
  );
}

function EmptyPanel(props: { text: string }) {
  return <div className="zvd-empty-panel">{props.text}</div>;
}
