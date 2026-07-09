import { useMemo, useState } from 'react';
import type { RuntimeCapabilitiesSnapshot } from '../../apiClient';
import type { ScheduledTask } from '../../desktop-state/useDesktopAutomations';
import { EmptyState, Button, SearchField } from '../../primitives/ui';
import { t } from '../../i18n';
import { PageFrame } from './panelPrimitives';
import {
  buildRuntimeAutomationJobs,
  filterAutomationJobs,
  mapScheduledTasks,
  mergeAutomationJobs,
  selectAutomationJob,
  type AutomationJob,
} from './automationsModel';

export function AutomationsPanel(props: {
  busy: boolean;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  onRuntimeStateAction(input: {
    domain: string;
    operation: string;
    metadata?: Record<string, unknown>;
  }): void | Promise<void>;
  scheduledTasks?: ScheduledTask[];
  onAddScheduledTask?: (name: string, project: string, prompt: string, intervalMinutes: number) => void;
  onDeleteScheduledTask?: (id: string) => void;
  onToggleScheduledTask?: (id: string) => void;
  onRunScheduledTask?: (id: string) => void;
  loadScheduledTaskLogs?: (sessionId: string) => Promise<unknown[]>;
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftMinutes, setDraftMinutes] = useState('60');

  const jobs = useMemo(() => {
    const scheduled = mapScheduledTasks(props.scheduledTasks || []);
    const runtime = buildRuntimeAutomationJobs({
      jobsSummary: props.runtimeCapabilities?.jobs?.summary,
      jobsStatus: props.runtimeCapabilities?.jobs?.status,
      streamStatus: props.runtimeCapabilities?.streamSession?.status,
      streamResumable: props.runtimeCapabilities?.streamSession?.resumable,
      resumeToken: props.runtimeCapabilities?.streamSession?.resumeToken,
    });
    return filterAutomationJobs(mergeAutomationJobs(scheduled, runtime), query);
  }, [props.scheduledTasks, props.runtimeCapabilities, query]);

  const selected = selectAutomationJob(jobs, selectedId);

  function createTask() {
    const name = draftName.trim();
    const prompt = draftPrompt.trim();
    const minutes = Math.max(1, Number(draftMinutes) || 60);
    if (!name || !prompt || !props.onAddScheduledTask) return;
    props.onAddScheduledTask(name, 'local', prompt, minutes);
    setDraftName('');
    setDraftPrompt('');
  }

  function runRuntimeAction(job: AutomationJob) {
    if (job.kind === 'runtime') {
      void props.onRuntimeStateAction({
        domain: 'cron',
        operation: 'recover',
        metadata: {
          runtimeActionType: 'recover-scheduled-jobs',
          scheduledJobs: {
            recoverable: props.runtimeCapabilities?.jobs?.status === 'attention' ? 1 : 0,
            actionIds: props.runtimeCapabilities?.jobs?.actionIds || [],
          },
        },
      });
      return;
    }
    if (job.kind === 'stream') {
      void props.onRuntimeStateAction({
        domain: 'session',
        operation: 'resume-stream',
        metadata: {
          runtimeActionType: 'resume-stream',
          streamSession: {
            sessionId: 'desktop-main',
            status: props.runtimeCapabilities?.streamSession?.resumeToken ? 'streaming' : 'idle',
            resumeToken: props.runtimeCapabilities?.streamSession?.resumeToken || null,
          },
        },
      });
    }
  }

  return (
    <PageFrame
      eyebrow={t('automations.eyebrow')}
      description={t('automations.description')}
      meta={props.runtimeCapabilities?.jobs?.status || 'runtime'}
      title={t('automations.title')}
    >
      <div className="zvd-auto-layout">
        <div className="zvd-auto-master">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t('automations.search')}
            label={t('automations.search')}
          />
          <div className="zvd-auto-list" role="listbox" aria-label={t('automations.title')}>
            {jobs.length === 0 ? (
              <EmptyState
                title={t('automations.emptyTitle')}
                description={t('automations.emptyBody')}
              />
            ) : (
              jobs.map(job => (
                <button
                  key={job.id}
                  type="button"
                  role="option"
                  aria-selected={selected?.id === job.id}
                  className={`zvd-auto-row is-${job.tone} ${selected?.id === job.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(job.id)}
                >
                  <span className="zvd-auto-row-kind">{job.kind}</span>
                  <strong>{job.name}</strong>
                  <small>{job.status}</small>
                </button>
              ))
            )}
          </div>

          {props.onAddScheduledTask ? (
            <div className="zvd-auto-create">
              <h3>{t('automations.createTitle')}</h3>
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder={t('automations.namePlaceholder')}
              />
              <textarea
                value={draftPrompt}
                onChange={e => setDraftPrompt(e.target.value)}
                placeholder={t('automations.promptPlaceholder')}
                rows={3}
              />
              <div className="zvd-auto-create-row">
                <input
                  value={draftMinutes}
                  onChange={e => setDraftMinutes(e.target.value)}
                  inputMode="numeric"
                  aria-label={t('automations.interval')}
                />
                <Button
                  type="button"
                  disabled={props.busy || !draftName.trim() || !draftPrompt.trim()}
                  onClick={createTask}
                >
                  {t('automations.create')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="zvd-auto-detail">
          {selected ? (
            <>
              <p className="zvd-auto-detail-kind">{selected.kind}</p>
              <h2>{selected.name}</h2>
              <p className="zvd-auto-detail-status">{selected.status}</p>
              <p>{selected.description}</p>
              {selected.project ? <p className="zvd-muted">{selected.project}</p> : null}
              {selected.intervalMinutes ? (
                <p className="zvd-muted">
                  {t('automations.everyMinutes').replace('{n}', String(selected.intervalMinutes))}
                </p>
              ) : null}
              <div className="zvd-auto-detail-actions">
                {selected.kind === 'schedule' ? (
                  <>
                    {props.onRunScheduledTask ? (
                      <Button
                        type="button"
                        disabled={props.busy}
                        onClick={() => props.onRunScheduledTask?.(selected.id)}
                      >
                        {t('automations.runNow')}
                      </Button>
                    ) : null}
                    {props.onToggleScheduledTask ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={props.busy}
                        onClick={() => props.onToggleScheduledTask?.(selected.id)}
                      >
                        {selected.enabled === false ? t('automations.enable') : t('automations.pause')}
                      </Button>
                    ) : null}
                    {props.onDeleteScheduledTask ? (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={props.busy}
                        onClick={() => props.onDeleteScheduledTask?.(selected.id)}
                      >
                        {t('automations.delete')}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <Button type="button" disabled={props.busy} onClick={() => runRuntimeAction(selected)}>
                    {selected.kind === 'stream' ? t('automations.resumeStream') : t('automations.recoverJobs')}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <EmptyState title={t('automations.pickTitle')} description={t('automations.pickBody')} />
          )}
        </div>
      </div>
    </PageFrame>
  );
}
