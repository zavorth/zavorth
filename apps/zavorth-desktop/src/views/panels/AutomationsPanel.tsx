import { useEffect, useMemo, useState } from 'react';
import { IconClock, IconPlayerPlay, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import type { RuntimeCapabilitiesSnapshot } from '../../apiClient';
import type { ScheduledTask } from '../../desktop-state/useDesktopAutomations';
import { PageFrame, SearchBox } from './panelPrimitives';

function statusLabel(task: ScheduledTask): string {
  if (!task.enabled) return 'Paused';
  if (task.status === 'running') return 'Running';
  if (task.status === 'success') return 'Completed';
  if (task.status === 'failed') return 'Failed';
  return 'Scheduled';
}

export function AutomationsPanel(props: {
  busy: boolean;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  scheduledTasks?: ScheduledTask[];
  onAddScheduledTask?: (name: string, project: string, prompt: string, intervalMinutes: number) => void | Promise<unknown>;
  onDeleteScheduledTask?: (id: string) => void | Promise<unknown>;
  onToggleScheduledTask?: (id: string) => void | Promise<unknown>;
  onRunScheduledTask?: (id: string) => void | Promise<unknown>;
  loadScheduledTaskLogs?: (sessionId: string) => Promise<unknown[]>;
}) {
  const tasks = props.scheduledTasks || [];
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftMinutes, setDraftMinutes] = useState('60');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [logCount, setLogCount] = useState<number | null>(null);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(task => !q || `${task.name} ${task.project} ${task.prompt} ${statusLabel(task)}`.toLowerCase().includes(q));
  }, [query, tasks]);
  const selected = visible.find(task => task.id === selectedId) || visible[0] || null;
  const activeCount = tasks.filter(task => task.enabled).length;
  const attentionCount = tasks.filter(task => task.status === 'failed').length;

  useEffect(() => {
    let active = true;
    setLogCount(null);
    if (!selected?.lastSessionId || !props.loadScheduledTaskLogs) return;
    void props.loadScheduledTaskLogs(selected.lastSessionId).then(logs => {
      if (active) setLogCount(Array.isArray(logs) ? logs.length : 0);
    });
    return () => { active = false; };
  }, [props.loadScheduledTaskLogs, selected?.lastSessionId]);

  async function createTask() {
    if (!props.onAddScheduledTask || !draftName.trim() || !draftPrompt.trim()) return;
    setActionError('');
    try {
      await props.onAddScheduledTask(draftName.trim(), 'local', draftPrompt.trim(), Math.max(1, Number(draftMinutes) || 60));
      setDraftName('');
      setDraftPrompt('');
      setDraftMinutes('60');
      setCreateOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not create the automation.');
    }
  }

  async function runTask(id: string) {
    if (!props.onRunScheduledTask) return;
    setRunningId(id);
    setActionError('');
    try { await props.onRunScheduledTask(id); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Could not run the automation.'); }
    finally { setRunningId(null); }
  }

  return (
    <PageFrame
      eyebrow="OPERATIONS"
      title="Automations"
      description="Recurring agent tasks with state and history separated from internal runtime controls."
      meta={`${activeCount} active`}
      actions={<button className="zvd-btn zvd-btn-primary" onClick={() => setCreateOpen(true)} type="button"><IconPlus size={15} />New automation</button>}
    >
      <div className="zvd-capability-summary" aria-label="Automation summary">
        <div><strong>{tasks.length}</strong><span>Total</span></div>
        <div><strong>{activeCount}</strong><span>Active</span></div>
        <div><strong>{attentionCount}</strong><span>Need attention</span></div>
      </div>
      <div className="zvd-automation-toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Search automation" /></div>
      <div className="zvd-automation-layout">
        <div className="zvd-automation-list" role="listbox" aria-label="Scheduled automations">
          {visible.length > 0 ? visible.map(task => (
            <button type="button" role="option" aria-selected={selected?.id === task.id} className={`zvd-automation-row ${selected?.id === task.id ? 'is-active' : ''}`} key={task.id} onClick={() => setSelectedId(task.id)}>
              <span className="zvd-automation-row-icon"><IconClock size={15} /></span>
              <span><strong>{task.name}</strong><small>Every {task.intervalMinutes} min · {task.project || 'local'}</small></span>
              <em>{statusLabel(task)}</em>
            </button>
          )) : <div className="zvd-capability-empty"><strong>No automations</strong><span>Create a task only when something truly needs to repeat.</span><button className="zvd-btn zvd-btn-secondary" onClick={() => setCreateOpen(true)} type="button">Create automation</button></div>}
        </div>
        <aside className="zvd-automation-detail">
          {selected ? <>
            <div className="zvd-automation-detail-heading"><span>{statusLabel(selected)}</span><h2>{selected.name}</h2><p>{selected.project || 'local'}</p></div>
            <div className="zvd-automation-prompt">{selected.prompt}</div>
            <dl className="zvd-capability-meta">
              <div><dt>Interval</dt><dd>Every {selected.intervalMinutes} minutes</dd></div>
              <div><dt>Last run</dt><dd>{selected.lastRun ? new Date(selected.lastRun).toLocaleString() : 'Not run yet'}</dd></div>
              <div><dt>Next run</dt><dd>{selected.nextRun && selected.enabled ? new Date(selected.nextRun).toLocaleString() : 'Paused'}</dd></div>
            </dl>
            {logCount !== null ? <p className="zvd-automation-log-count">{logCount} events in the last session</p> : null}
            {actionError ? <div className="zvd-inline-alert is-error" role="alert">{actionError}</div> : null}
            <div className="zvd-automation-actions">
              <button className="zvd-btn zvd-btn-primary" disabled={props.busy || runningId === selected.id || selected.status === 'running'} onClick={() => void runTask(selected.id)} type="button"><IconPlayerPlay size={14} /> {runningId === selected.id || selected.status === 'running' ? 'Running…' : 'Run now'}</button>
              {props.onToggleScheduledTask ? <button className="zvd-btn zvd-btn-secondary" onClick={() => void props.onToggleScheduledTask?.(selected.id)} type="button">{selected.enabled ? 'Pause' : 'Enable'}</button> : null}
              {props.onDeleteScheduledTask ? <button className="zvd-btn zvd-btn-ghost" onClick={() => void props.onDeleteScheduledTask?.(selected.id)} type="button"><IconTrash size={14} /> Remove</button> : null}
            </div>
            {selected.history?.length ? <div className="zvd-automation-history"><h3>Recent history</h3>{[...selected.history].reverse().slice(0, 4).map((entry, index) => <div key={`${entry.at}-${index}`}><span>{entry.ok ? 'completed' : 'Failed'}</span><time>{new Date(entry.at).toLocaleString()}</time>{entry.message ? <small>{entry.message}</small> : null}</div>)}</div> : null}
          </> : <div className="zvd-capability-empty"><span>Select an automation to see the details.</span></div>}
        </aside>
      </div>
      <div className="zvd-runtime-health-strip">
        <div><strong>Runtime</strong><span>{props.runtimeCapabilities?.jobs?.summary || 'No scheduler pending item.'}</span></div>
        {props.runtimeCapabilities?.jobs?.status === 'attention' ? <button className="zvd-btn zvd-btn-secondary zvd-btn-sm" onClick={() => void props.onRuntimeStateAction({ domain: 'cron', operation: 'recover', metadata: { runtimeActionType: 'recover-scheduled-jobs', scheduledJobs: { recoverable: 1, actionIds: props.runtimeCapabilities?.jobs?.actionIds || [] } } })} type="button">Recover</button> : null}
      </div>

      {createOpen ? <div className="zvd-modal-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && setCreateOpen(false)}>
        <div className="zvd-modal zvd-automation-create" role="dialog" aria-modal="true" aria-labelledby="zvd-create-automation-title">
          <header><div><span>New automation</span><h2 id="zvd-create-automation-title">What should Zavorth repeat...</h2></div><button className="zvd-icon-button" onClick={() => setCreateOpen(false)} type="button" aria-label="Close"><IconX size={16} /></button></header>
          <label>Name<input value={draftName} onChange={event => setDraftName(event.target.value)} placeholder="Example: daily summary" autoFocus /></label>
          <label>Instruction<textarea value={draftPrompt} onChange={event => setDraftPrompt(event.target.value)} placeholder="Describe the expected result" rows={5} /></label>
          <label>
            Interval in minutes
            <input value={draftMinutes} onChange={event => setDraftMinutes(event.target.value)} inputMode="numeric" />
            <small>The first run is queued when created. Future runs follow this interval.</small>
          </label>
          {actionError ? <div className="zvd-inline-alert is-error">{actionError}</div> : null}
          <footer><button className="zvd-btn zvd-btn-secondary" onClick={() => setCreateOpen(false)} type="button">Cancel</button><button className="zvd-btn zvd-btn-primary" disabled={!draftName.trim() || !draftPrompt.trim()} onClick={() => void createTask()} type="button">Create automation</button></footer>
        </div>
      </div> : null}
    </PageFrame>
  );
}
