export function compactTraceText(value: unknown, max = 180) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function traceEventClass(type: unknown) {
  const normalized = String(type || 'event').trim().toLowerCase();
  if (['approval', 'remote-approval', 'approval-decision'].includes(normalized)) return 'approval';
  if (['artifact', 'receipt', 'remote-apply'].includes(normalized)) return 'receipt';
  if (['error', 'failure'].includes(normalized)) return 'error';
  if (['request', 'reply'].includes(normalized)) return 'message';
  if (['thinking', 'step', 'signal', 'session'].includes(normalized)) return 'step';
  return 'event';
}

export function traceEventLabel(type: unknown) {
  const normalized = String(type || 'event').trim().toLowerCase();
  const labels: Record<string, string> = {
    request: 'Request',
    reply: 'Reply',
    thinking: 'Thinking',
    step: 'Step',
    approval: 'Approval',
    'remote-approval': 'Remote approval',
    'approval-decision': 'Decision',
    artifact: 'Artifact',
    receipt: 'Receipt',
    'remote-apply': 'MCP receipt',
    signal: 'Signal',
    session: 'Session',
    error: 'Error',
  };
  return labels[normalized] || 'Event';
}

export function traceEventTimeLabel(event: any = {}, fallbackTime: () => string) {
  const raw = event.time || event.createdAt || event.created_at || '';
  const date = new Date(String(raw || ''));
  if (Number.isFinite(date.getTime())) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return fallbackTime();
}

export function traceString(value: unknown, max = 80) {
  const cleaned = compactTraceText(value, max);
  return cleaned || '';
}

export function normalizeTraceCapability(value: any = {}) {
  if (!value || typeof value !== 'object') return null;
  const label = traceString(value.label || value.id || value.name || value.toolName || '', 64);
  const kind = traceString(value.kind || value.type || '', 36);
  const sideEffect = traceString(value.sideEffect || value.side_effect || value.effect || '', 40);
  const risk = traceString(value.risk || value.riskLevel || value.risk_level || '', 32);
  const scope = traceString(value.scope || value.allowedScope || value.allowed_scope || '', 88);
  const reason = traceString(value.reason || value.selectionReason || value.selection_reason || '', 140);
  const approval = traceString(value.approval || value.approvalRequired || value.approval_required || '', 44);
  const preview = value.previewRequired || value.preview_required || value.preview
    ? traceString(value.previewLabel || value.preview || 'preview required', 80)
    : '';
  if (!label && !kind && !sideEffect && !risk && !scope && !reason && !approval && !preview) return null;
  return { label, kind, sideEffect, risk, scope, reason, approval, preview };
}

export function normalizeTraceReceipt(value: any = {}) {
  if (!value || typeof value !== 'object') return null;
  const id = traceString(value.id || value.receiptId || value.receipt_id || '', 76);
  const status = traceString(value.status || '', 36);
  const summary = traceString(value.summary || value.message || value.detail || '', 180);
  const artifact = traceString(value.artifactId || value.artifact_id || value.artifact || value.path || '', 96);
  const rollback = traceString(value.rollback || value.rollbackInstruction || value.rollback_instruction || '', 140);
  if (!id && !status && !summary && !artifact && !rollback) return null;
  return { id, status, summary, artifact, rollback };
}

export function normalizeTraceReplay(value: any = {}) {
  if (!value || typeof value !== 'object') return null;
  const runId = traceString(value.runId || value.run_id || value.id || '', 76);
  const traceId = traceString(value.traceId || value.trace_id || '', 76);
  const sessionId = traceString(value.sessionId || value.session_id || '', 76);
  const policy = traceString(value.policy || value.mode || '', 76);
  if (!runId && !traceId && !sessionId && !policy) return null;
  return { runId, traceId, sessionId, policy };
}

export function normalizeTraceEvent(event: any = {}, fallbackTime: () => string) {
  const type = String(event.type || 'event').trim() || 'event';
  const stableId = String(event.id || '').trim();
  return {
    id: stableId || `trace:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    type,
    title: compactTraceText(event.title || traceEventLabel(type), 80),
    detail: compactTraceText(event.detail || '', 240),
    meta: compactTraceText(event.meta || '', 140),
    status: compactTraceText(event.status || '', 40),
    time: traceEventTimeLabel(event, fallbackTime),
    source: compactTraceText(event.source || '', 80),
    runId: traceString(event.runId || event.replay?.runId || '', 76),
    traceId: traceString(event.traceId || event.replay?.traceId || '', 76),
    sessionId: traceString(event.sessionId || event.replay?.sessionId || '', 76),
    capability: normalizeTraceCapability(event.capability || event.tool || event.permission || null),
    receipt: normalizeTraceReceipt(event.receipt || null),
    replay: normalizeTraceReplay(event.replay || {
      runId: event.runId,
      traceId: event.traceId,
      sessionId: event.sessionId,
    }),
    approvalId: traceString(event.approvalId || '', 76),
    preview: traceString(event.preview || event.previewSummary || '', 180),
  };
}

export function normalizeTraceSheetQuery(query: any = {}) {
  return {
    runId: traceString(query.runId || '', 76),
    traceId: traceString(query.traceId || '', 76),
    sessionId: traceString(query.sessionId || '', 76),
    source: traceString(query.source || '', 80),
  };
}

export function hasTraceSheetQuery(query: any = {}) {
  return Boolean(query?.runId || query?.traceId || query?.sessionId);
}

export function traceEventMatchesQuery(event: any = {}, query: any = {}) {
  if (!hasTraceSheetQuery(query)) return true;
  const runId = event.runId || event.replay?.runId || '';
  const traceId = event.traceId || event.replay?.traceId || '';
  const sessionId = event.sessionId || event.replay?.sessionId || '';
  if (query.runId || query.traceId) {
    return Boolean(
      (query.runId && runId === query.runId)
      || (query.traceId && traceId === query.traceId),
    );
  }
  return Boolean(query.sessionId && sessionId === query.sessionId);
}

