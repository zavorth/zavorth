import { escapeHtml } from './html-utils';
import { hasTraceSheetQuery, traceEventClass, traceEventLabel } from './trace-utils';

function renderTraceChips(event: any = {}) {
  const chips = [];
  const capability = event.capability || null;
  if (capability?.label) chips.push(capability.label);
  if (capability?.kind) chips.push(capability.kind);
  if (capability?.sideEffect) chips.push(capability.sideEffect);
  if (capability?.risk) chips.push(`risk: ${capability.risk}`);
  if (capability?.preview) chips.push(capability.preview);
  if (capability?.approval) chips.push(`approval: ${capability.approval}`);
  if (capability?.scope) chips.push(`scope: ${capability.scope}`);
  if (!chips.length) return '';
  return `<div class="trace-sheet__chips">${chips.slice(0, 7).map((chip) => `<span class="trace-sheet__chip">${escapeHtml(chip)}</span>`).join('')}</div>`;
}

function renderTraceReceipt(event: any = {}) {
  const receipt = event.receipt || null;
  if (!receipt) return '';
  return `
    <div class="trace-sheet__receipt" aria-label="Safe receipt">
      <span>Receipt</span>
      ${receipt.id ? `<code>${escapeHtml(receipt.id)}</code>` : ''}
      ${receipt.status ? `<small>${escapeHtml(receipt.status)}</small>` : ''}
      ${receipt.summary ? `<p>${escapeHtml(receipt.summary)}</p>` : ''}
      ${receipt.artifact ? `<small>artifact: ${escapeHtml(receipt.artifact)}</small>` : ''}
      ${receipt.rollback ? `<small>rollback: ${escapeHtml(receipt.rollback)}</small>` : ''}
    </div>
  `;
}

function renderTraceReplay(event: any = {}) {
  const replay = event.replay || null;
  if (!replay) return '';
  return `
    <div class="trace-sheet__replay" aria-label="Safe replay context">
      <div class="trace-sheet__replay-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-size: 10px; text-transform: uppercase; color: var(--b-signal-muted); letter-spacing: 0.05em;">Replay context</span>
        <button class="trace-sheet__replay-btn" type="button" data-replay-run-id="${escapeHtml(replay.runId || '')}" data-replay-trace-id="${escapeHtml(replay.traceId || '')}" style="background: color-mix(in srgb, var(--b-pulse) 12%, transparent); border: 1px solid var(--b-glass-border); border-radius: 4px; padding: 2px 6px; font-family: var(--b-mono); font-size: 10px; color: var(--b-pulse); cursor: pointer; transition: all 0.15s ease;">Replay ⚡</button>
      </div>
      ${replay.runId ? `<code>run ${escapeHtml(replay.runId)}</code>` : ''}
      ${replay.traceId ? `<code>trace ${escapeHtml(replay.traceId)}</code>` : ''}
      ${replay.sessionId ? `<code>session ${escapeHtml(replay.sessionId)}</code>` : ''}
      <small style="display: block; margin-top: 4px;">${escapeHtml(replay.policy || 'receipts only')}</small>
    </div>
  `;
}

function renderTraceLifecycle(event: any = {}) {
  const lifecycle = event.lifecycle || null;
  if (!lifecycle) return '';
  const trust = lifecycle.trust || {};
  const source = lifecycle.source || {};
  return `
    <div class="trace-sheet__lifecycle" aria-label="Mnemos lifecycle">
      <span>Mnemos lifecycle</span>
      <small>${escapeHtml(source.surface || event.source || 'runtime')} ? ${escapeHtml(trust.level || 'raw')}</small>
      ${trust.receiptId ? `<code>receipt ${escapeHtml(trust.receiptId)}</code>` : ''}
      ${trust.approvalId ? `<code>approval ${escapeHtml(trust.approvalId)}</code>` : ''}
    </div>
  `;
}

function eventText(event: any = {}) {
  return `${event.type || ''} ${event.title || ''} ${event.detail || ''} ${event.meta || ''}`.toLowerCase();
}

function hasNarrativeEvent(events: any[], pattern: RegExp) {
  return events.some((event) => pattern.test(eventText(event)));
}

export function renderTraceTimelineHtml(visibleEvents: any[], traceSheetQuery: any = {}) {
  if (visibleEvents.length === 0) {
    const focused = hasTraceSheetQuery(traceSheetQuery);
    return `
      <div class="trace-sheet__empty">
        <span class="trace-sheet__empty-dot"></span>
        <strong>${focused ? 'No events for this run' : 'Waiting for activity'}</strong>
        <small>${focused ? 'The observatory returned no persistent events for this filter.' : 'Send a task to inspect the runtime from inside.'}</small>
      </div>
    `;
  }

  const latestReceipt = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'receipt');
  const latestApproval = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'approval');
  const latestRequest = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'message' && String(event.type).toLowerCase() === 'request');
  const latestError = visibleEvents.slice().reverse().find((event) => traceEventClass(event.type) === 'error');
  const latestTool = visibleEvents.slice().reverse().find((event) => event.capability?.label || /tool|terminal|artifact|gateway/i.test(`${event.title} ${event.detail}`));
  const flowState: Record<string, boolean> = {
    request: Boolean(latestRequest),
    route: hasNarrativeEvent(visibleEvents, /engine|express|velocity|shield|lite|route/),
    canvas: hasNarrativeEvent(visibleEvents, /canvas|sandbox preview|attempt/),
    diff: hasNarrativeEvent(visibleEvents, /diff|patch|file:/),
    apply: hasNarrativeEvent(visibleEvents, /applied|host-direct|apply completed/),
    approval: Boolean(latestApproval),
    receipt: Boolean(latestReceipt),
  };
  const queryLine = hasTraceSheetQuery(traceSheetQuery)
    ? [
      traceSheetQuery.runId ? `run ${traceSheetQuery.runId}` : '',
      traceSheetQuery.traceId ? `trace ${traceSheetQuery.traceId}` : '',
      traceSheetQuery.sessionId ? `session ${traceSheetQuery.sessionId}` : '',
    ].filter(Boolean).join(' - ')
    : 'current session';
  const summary = `
    <div class="trace-sheet__summary">
      <strong>${latestRequest ? 'Current session history' : 'Readable run summary'}</strong>
      <span>${latestError ? `Needs attention: ${escapeHtml(latestError.title || latestError.detail)}` : 'Shows requests, tools, approvals, receipts and replay evidence. Raw model reasoning stays private.'}</span>
      <div class="trace-sheet__summary-grid">
        <small>${escapeHtml(queryLine)}</small>
        <small>${latestRequest ? `latest request: ${escapeHtml(latestRequest.detail || latestRequest.title)}` : 'no request yet'}</small>
        <small>${latestTool ? `latest tool: ${escapeHtml(latestTool.capability?.label || latestTool.title)}` : flowState.route ? 'engine route recorded' : 'no tool used yet'}</small>
        <small>${latestApproval ? `latest approval: ${escapeHtml(latestApproval.status || latestApproval.title)}` : 'no active approval'}</small>
        <small>${latestReceipt ? `latest receipt: ${escapeHtml(latestReceipt.status || latestReceipt.title)}` : 'no receipt yet'}</small>
      </div>
      <div class="trace-sheet__flow" aria-label="Run lifecycle">
        ${[
          ['request', 'Request'],
          ['route', 'Route'],
          ['canvas', 'Canvas'],
          ['diff', 'Diff'],
          ['apply', 'Apply'],
          ['approval', 'Approval'],
          ['receipt', 'Receipt'],
        ].map(([key, label]) => `<span class="${flowState[key] ? 'is-active' : ''}">${label}</span>`).join('')}
      </div>
    </div>
  `;

  return summary + visibleEvents.slice(-60).map((event) => {
    const kind = traceEventClass(event.type);
    const status = event.status ? `<span class="trace-sheet__item-status">${escapeHtml(event.status)}</span>` : '';
    const meta = event.meta ? `<div class="trace-sheet__item-meta">${escapeHtml(event.meta)}</div>` : '';
    const detail = event.detail ? `<div class="trace-sheet__item-detail">${escapeHtml(event.detail)}</div>` : '';
    const preview = event.preview ? `<div class="trace-sheet__preview"><span>Preview</span>${escapeHtml(event.preview)}</div>` : '';
    return `
      <article class="trace-sheet__item trace-sheet__item--${kind}">
        <div class="trace-sheet__item-rail"><span></span></div>
        <div class="trace-sheet__item-body">
          <div class="trace-sheet__item-top">
            <span class="trace-sheet__item-kind">${escapeHtml(traceEventLabel(event.type))}</span>
            <span class="trace-sheet__item-time">${escapeHtml(event.time)}</span>
            ${status}
          </div>
          <strong class="trace-sheet__item-title">${escapeHtml(event.title)}</strong>
          ${detail}
          ${renderTraceChips(event)}
          ${preview}
          ${event.capability?.reason ? `<div class="trace-sheet__policy"><span>Reason</span>${escapeHtml(event.capability.reason)}</div>` : ''}
          ${renderTraceLifecycle(event)}
          ${renderTraceReceipt(event)}
          ${renderTraceReplay(event)}
          ${meta}
        </div>
      </article>
    `;
  }).join('');
}
