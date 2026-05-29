type RuntimeRunReplayOptions = {
  deriveNextRunAction: (run: any) => string;
  deriveRunError: (run: any) => string;
  escapeHtml: (value: unknown) => string;
  findWorkflowJobForRun: (run: any) => any;
  formatDate: (value: unknown) => string;
  getRuns: () => any[];
  openPersistentTrace: (query: any, ui?: any) => Promise<any>;
  pendingRunApprovals: (run: any) => any[];
  statusBadge: (status: unknown, label: unknown) => string;
  text: (value: unknown, fallback?: string) => string;
};

declare global {
  interface Window {
    ZavorthControlChat?: any;
    emitSignal?: (type: string, title: string, detail: string) => void;
    openCoreModal?: (title: string, body: string) => void;
  }
}

export function createRuntimeRunReplay({
  deriveNextRunAction,
  deriveRunError,
  escapeHtml,
  findWorkflowJobForRun,
  formatDate,
  getRuns,
  openPersistentTrace,
  pendingRunApprovals,
  statusBadge,
  text,
}: RuntimeRunReplayOptions) {
  function buildRunReplayHtml(run: any) {
    const events = Array.isArray(run?.events) ? run.events : [];
    const approvals = pendingRunApprovals(run);
    const artifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
    const job = findWorkflowJobForRun(run);
    const error = deriveRunError(run);
    const replay = events.length > 0
      ? events
        .map((event, index) => {
          const line = [
            `${String(index + 1).padStart(2, '0')}.`,
            `[${formatDate(event.createdAt)}]`,
            `${event.kind || 'event'}:${event.status ? ` ${event.status}` : ''}`,
            `--- ${event.title || event.detail || 'registered event'}`,
            event.detail && event.detail !== event.title ? `\n    ${event.detail}` : '',
          ].join(' ');
          return line;
        })
        .join('\n')
      : 'No granular event has been registered for this run yet.';

    return `
      <div class="logic-cell">
        <div class="logic-cell__header">
          <div class="logic-cell__title">
            <span class="logic-cell__icon"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></svg></span>
            ${escapeHtml(text(run.title, run.id))}
          </div>
          ${statusBadge(run.status, text(run.status, 'run'))}
        </div>
        <div class="logic-cell__detail">${escapeHtml(run.summary || run.input || 'Run registered by the universal gateway.')}</div>
        <div class="logic-cell__block">
          <div class="logic-cell__block-header"><span class="logic-cell__block-label">Next action</span></div>
          <pre class="logic-cell__block-content">${escapeHtml(deriveNextRunAction(run))}</pre>
        </div>
      </div>
      ${error ? `<div class="callout info">Recorded error: ${escapeHtml(error)}</div>` : ''}
      <div class="artifact-render">${[
        `Run: ${run.id || '---'}`,
        `Session: ${run.sessionId || '-'}`,
        `Channel: ${run.channel || '-'}`,
        `Model: ${run.modelProfile?.modelLabel || 'not set'}`,
        `Pending approvals: ${approvals.length}`,
        `Artifacts: ${artifacts.length}`,
        `Workflow job: ${job?.status || '---'}`,
        `Updated: ${formatDate(run.updatedAt || run.createdAt)}`,
      ].map(escapeHtml).join('\n')}</div>
      <pre class="artifact-render"><code>${escapeHtml(replay)}</code></pre>
    `;
  }

  function openRunDetails(runId: unknown) {
    const id = String(runId || '').trim();
    const run = getRuns().find((candidate) => String(candidate?.id || '').trim() === id) || null;
    if (!run) throw new Error('Run not found in the current dashboard snapshot.');
    const html = buildRunReplayHtml(run);
    if (typeof window.openCoreModal === 'function') {
      window.openCoreModal(`Replay - ${text(run.title, run.id)}`, html);
      return run;
    }
    window.ZavorthControlChat?.openArtifactPane?.(`Replay - ${text(run.title, run.id)}`, html);
    return run;
  }

  function wireRunReplayRows() {
    if (document.body?.dataset.zavorthRunReplayWired === 'true') return;
    if (document.body) document.body.dataset.zavorthRunReplayWired = 'true';
    document.addEventListener('click', (event: any) => {
      const traceButton = event.target?.closest?.('[data-zavorth-trace-action="open"]');
      if (traceButton) {
        event.preventDefault();
        event.stopPropagation();
        openPersistentTrace({
          runId: traceButton.dataset.runId || traceButton.dataset.zavorthRunId || '',
          traceId: traceButton.dataset.traceId || traceButton.dataset.zavorthTraceId || '',
          sessionId: traceButton.dataset.sessionId || traceButton.dataset.zavorthSessionId || '',
        }, window.ZavorthControlChat || {}).catch((error) => {
          window.emitSignal?.('error', 'Trace unavailable', String(error?.message || 'Run not found.'));
        });
        return;
      }
      const row = event.target?.closest?.('[data-zavorth-run-id]');
      if (!row) return;
      const runId = row.dataset.zavorthRunId;
      try {
        openRunDetails(runId);
      } catch (error: any) {
        window.emitSignal?.('error', 'Replay unavailable', String(error?.message || 'Run not found.'));
      }
    });
  }

  return {
    buildRunReplayHtml,
    openRunDetails,
    wireRunReplayRows,
  };
}
