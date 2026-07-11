import { useEffect, useMemo, useState } from 'react';
import { IconClock, IconPlayerPlay, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import type { RuntimeCapabilitiesSnapshot } from '../../apiClient';
import type { ScheduledTask } from '../../desktop-state/useDesktopAutomations';
import { PageFrame, SearchBox } from './panelPrimitives';

function statusLabel(task: ScheduledTask): string {
  if (!task.enabled) return 'Pausada';
  if (task.status === 'running') return 'Executando';
  if (task.status === 'success') return 'Concluída';
  if (task.status === 'failed') return 'Falhou';
  return 'Agendada';
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
      setActionError(error instanceof Error ? error.message : 'Não foi possível criar a automação.');
    }
  }

  async function runTask(id: string) {
    if (!props.onRunScheduledTask) return;
    setRunningId(id);
    setActionError('');
    try { await props.onRunScheduledTask(id); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível executar a automação.'); }
    finally { setRunningId(null); }
  }

  return (
    <PageFrame
      eyebrow="OPERAÇÕES"
      title="Automações"
      description="Tarefas recorrentes do agente, com estado e histórico sem misturar controles internos do runtime."
      meta={`${activeCount} ativas`}
      actions={<button className="zvd-btn zvd-btn-primary" onClick={() => setCreateOpen(true)} type="button"><IconPlus size={15} /> Nova automação</button>}
    >
      <div className="zvd-capability-summary" aria-label="Resumo das automações">
        <div><strong>{tasks.length}</strong><span>Total</span></div>
        <div><strong>{activeCount}</strong><span>Ativas</span></div>
        <div><strong>{attentionCount}</strong><span>Precisam de atenção</span></div>
      </div>
      <div className="zvd-automation-toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Buscar automação" /></div>
      <div className="zvd-automation-layout">
        <div className="zvd-automation-list" role="listbox" aria-label="Automações agendadas">
          {visible.length ? visible.map(task => (
            <button type="button" role="option" aria-selected={selected?.id === task.id} className={`zvd-automation-row ${selected?.id === task.id ? 'is-active' : ''}`} key={task.id} onClick={() => setSelectedId(task.id)}>
              <span className="zvd-automation-row-icon"><IconClock size={15} /></span>
              <span><strong>{task.name}</strong><small>A cada {task.intervalMinutes} min · {task.project || 'Local'}</small></span>
              <em>{statusLabel(task)}</em>
            </button>
          )) : <div className="zvd-capability-empty"><strong>Nenhuma automação</strong><span>Crie uma tarefa somente quando houver algo que realmente precise se repetir.</span><button className="zvd-btn zvd-btn-secondary" onClick={() => setCreateOpen(true)} type="button">Criar automação</button></div>}
        </div>
        <aside className="zvd-automation-detail">
          {selected ? <>
            <div className="zvd-automation-detail-heading"><span>{statusLabel(selected)}</span><h2>{selected.name}</h2><p>{selected.project || 'Local'}</p></div>
            <div className="zvd-automation-prompt">{selected.prompt}</div>
            <dl className="zvd-capability-meta">
              <div><dt>Intervalo</dt><dd>A cada {selected.intervalMinutes} minutos</dd></div>
              <div><dt>Última execução</dt><dd>{selected.lastRun ? new Date(selected.lastRun).toLocaleString() : 'Ainda não executada'}</dd></div>
              <div><dt>Próxima execução</dt><dd>{selected.nextRun && selected.enabled ? new Date(selected.nextRun).toLocaleString() : 'Pausada'}</dd></div>
            </dl>
            {logCount !== null ? <p className="zvd-automation-log-count">{logCount} eventos na última sessão</p> : null}
            {actionError ? <div className="zvd-inline-alert is-error" role="alert">{actionError}</div> : null}
            <div className="zvd-automation-actions">
              <button className="zvd-btn zvd-btn-primary" disabled={props.busy || runningId === selected.id || selected.status === 'running'} onClick={() => void runTask(selected.id)} type="button"><IconPlayerPlay size={14} /> {runningId === selected.id || selected.status === 'running' ? 'Executando…' : 'Executar agora'}</button>
              {props.onToggleScheduledTask ? <button className="zvd-btn zvd-btn-secondary" onClick={() => void props.onToggleScheduledTask?.(selected.id)} type="button">{selected.enabled ? 'Pausar' : 'Ativar'}</button> : null}
              {props.onDeleteScheduledTask ? <button className="zvd-btn zvd-btn-ghost" onClick={() => void props.onDeleteScheduledTask?.(selected.id)} type="button"><IconTrash size={14} /> Remover</button> : null}
            </div>
            {selected.history?.length ? <div className="zvd-automation-history"><h3>Histórico recente</h3>{[...selected.history].reverse().slice(0, 4).map((entry, index) => <div key={`${entry.at}-${index}`}><span>{entry.ok ? 'Concluída' : 'Falhou'}</span><time>{new Date(entry.at).toLocaleString()}</time>{entry.message ? <small>{entry.message}</small> : null}</div>)}</div> : null}
          </> : <div className="zvd-capability-empty"><span>Selecione uma automação para ver os detalhes.</span></div>}
        </aside>
      </div>
      <div className="zvd-runtime-health-strip">
        <div><strong>Runtime</strong><span>{props.runtimeCapabilities?.jobs?.summary || 'Nenhuma pendência do agendador.'}</span></div>
        {props.runtimeCapabilities?.jobs?.status === 'attention' ? <button className="zvd-btn zvd-btn-secondary zvd-btn-sm" onClick={() => void props.onRuntimeStateAction({ domain: 'cron', operation: 'recover', metadata: { runtimeActionType: 'recover-scheduled-jobs', scheduledJobs: { recoverable: 1, actionIds: props.runtimeCapabilities?.jobs?.actionIds || [] } } })} type="button">Recuperar</button> : null}
      </div>

      {createOpen ? <div className="zvd-modal-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && setCreateOpen(false)}>
        <div className="zvd-modal zvd-automation-create" role="dialog" aria-modal="true" aria-labelledby="zvd-create-automation-title">
          <header><div><span>Nova automação</span><h2 id="zvd-create-automation-title">O que o Zavorth deve repetir?</h2></div><button className="zvd-icon-button" onClick={() => setCreateOpen(false)} type="button" aria-label="Fechar"><IconX size={16} /></button></header>
          <label>Nome<input value={draftName} onChange={event => setDraftName(event.target.value)} placeholder="Ex.: Resumo diário" autoFocus /></label>
          <label>Instrução<textarea value={draftPrompt} onChange={event => setDraftPrompt(event.target.value)} placeholder="Descreva o resultado esperado" rows={5} /></label>
          <label>
            Intervalo em minutos
            <input value={draftMinutes} onChange={event => setDraftMinutes(event.target.value)} inputMode="numeric" />
            <small>A primeira execução entra na fila ao criar. As próximas seguem este intervalo.</small>
          </label>
          {actionError ? <div className="zvd-inline-alert is-error">{actionError}</div> : null}
          <footer><button className="zvd-btn zvd-btn-secondary" onClick={() => setCreateOpen(false)} type="button">Cancelar</button><button className="zvd-btn zvd-btn-primary" disabled={!draftName.trim() || !draftPrompt.trim()} onClick={() => void createTask()} type="button">Criar automação</button></footer>
        </div>
      </div> : null}
    </PageFrame>
  );
}
