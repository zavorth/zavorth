import { escapeHtml } from './html-utils';
import { compactTraceText } from './trace-utils';

export function deriveApprovalCapability(approval: any = {}) {
  const capability = approval.capability || approval.tool || approval.permission || {};
  const rawTitle = String(approval.title || '');
  const rawReason = String(approval.summary || approval.reason || '');
  const inferredLabel = /shell\.exec|terminal|npm|powershell/i.test(`${rawTitle} ${rawReason}`) ? 'shell.exec'
    : /apply_patch|patch|editar|write/i.test(`${rawTitle} ${rawReason}`) ? 'apply_patch'
      : capability.label || capability.id || approval.toolName || approval.kind || 'capability';
  const kind = /shell|terminal|npm|powershell/i.test(inferredLabel) ? 'shell'
    : /apply_patch|write|edit/i.test(inferredLabel) ? 'workspace'
      : capability.kind || approval.kind || 'tool';
  const sideEffect = capability.sideEffect
    || approval.sideEffect
    || (kind === 'shell' ? 'process' : /apply_patch|write|edit/i.test(inferredLabel) ? 'write' : 'unknown');
  const scope = capability.scope || approval.scope || (sideEffect === 'write' ? 'workspace' : 'session');
  return {
    label: inferredLabel,
    kind,
    sideEffect,
    scope,
    risk: approval.risk || capability.risk || 'review',
    previewRequired: Boolean(capability.previewRequired || approval.previewRequired || sideEffect === 'process' || sideEffect === 'write'),
    reason: approval.reason || approval.summary || capability.reason || '',
    approval: 'required',
  };
}

export function approvalRiskCopy(risk: unknown, sideEffect: unknown) {
  const normalized = String(risk || '').toLowerCase();
  if (/high|critical|danger/.test(normalized)) return 'High impact. Review target, scope and rollback before allowing it.';
  if (/medium|write|process|external/.test(`${normalized} ${sideEffect}`)) return 'May change files, run tools, or touch external state. Keep the scope tight.';
  if (/low|read/.test(`${normalized} ${sideEffect}`)) return 'Read-first action. It should not mutate anything unless a later approval says so.';
  return 'Review what Zavorth will do, then allow once or narrow the scope.';
}

export function approvalTtlLabel(approval: any = {}) {
  const expiresAt = approval.expiresAt || approval.expires_at || approval.ttlExpiresAt || approval.ttl_expires_at;
  const ttlMs = Number(approval.ttlMs || approval.ttl_ms || approval.ttl);
  if (expiresAt) {
    const date = new Date(String(expiresAt));
    if (Number.isFinite(date.getTime())) return `until ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (Number.isFinite(ttlMs) && ttlMs > 0) {
    const minutes = Math.max(1, Math.round(ttlMs / 60000));
    return `${minutes} min`;
  }
  return 'one decision';
}

export function approvalRollbackLabel(approval: any = {}) {
  return compactTraceText(
    approval.rollback
    || approval.rollbackInstruction
    || approval.rollback_instruction
    || approval.receipt?.rollback
    || 'receipt required after decision',
    80,
  );
}

export function buildApprovalCard(approval: any) {
  const approvalId = escapeHtml(approval.id);
  const approvalKind = escapeHtml(approval.kind);
  const runId = escapeHtml(approval.runId || approval.agentRunId || approval.correlation?.runId || '');
  const traceId = escapeHtml(approval.traceId || approval.correlation?.traceId || '');
  const sessionId = escapeHtml(approval.sessionId || approval.correlation?.sessionId || '');
  const capability = deriveApprovalCapability(approval);
  const capabilityLabel = escapeHtml(capability.label);
  const capabilityKind = escapeHtml(capability.kind);
  const sideEffect = escapeHtml(capability.sideEffect);
  const scope = escapeHtml(capability.scope);
  const previewLabel = capability.previewRequired ? 'preview required' : 'preview clean';
  const title = escapeHtml(approval.title || 'Pending action');
  const summary = escapeHtml(approval.summary || approval.reason || 'Zavorth needs your decision to continue.');
  const risk = escapeHtml(approval.risk || 'review');
  const ttl = escapeHtml(approvalTtlLabel(approval));
  const rollback = escapeHtml(approvalRollbackLabel(approval));
  const capabilityAttrs = [
    `data-capability-label="${capabilityLabel}"`,
    `data-capability-kind="${capabilityKind}"`,
    `data-capability-side-effect="${sideEffect}"`,
    `data-capability-scope="${scope}"`,
    `data-capability-risk="${risk}"`,
    `data-capability-preview="${escapeHtml(previewLabel)}"`,
    `data-capability-reason="${escapeHtml(approval.reason || approval.summary || '')}"`,
  ].join(' ');
  const traceButton = runId || traceId ? `<button class="zavorth-permission-card__btn zavorth-permission-card__btn--trace" type="button" data-zavorth-trace-action="open" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">View trace</button>`
    : '';
  return `
    <div class="zavorth-permission-card b-fade-in zavorth-approval-card" data-zavorth-approval-id="${approvalId}" data-zavorth-approval-kind="${approvalKind}" data-status="pending" data-approval-scope="once" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}" ${capabilityAttrs}>
      <div class="zavorth-permission-card__state">Waiting for user input</div>
      <div class="zavorth-permission-card__panel">
        <div class="zavorth-permission-card__request">
          <span class="zavorth-permission-card__eyebrow">Access</span>
          <span class="zavorth-permission-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.4 8.7-8 9-4.6-.3-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
          </span>
          <span class="zavorth-permission-card__target">${capabilityLabel}</span>
          <span class="zavorth-permission-card__risk">${risk}</span>
        </div>
        <div class="zavorth-permission-card__title">${title}</div>
        <div class="zavorth-permission-card__summary">${summary}</div>
        <div class="zavorth-approval-explain" aria-label="Approval explanation">
          <div><span>Will do</span><strong>${previewLabel}</strong><small>${approvalRiskCopy(risk, sideEffect)}</small></div>
          <div><span>Will not do</span><strong>Anything outside scope</strong><small>Changing the scope here updates the approval payload before Zavorth continues.</small></div>
        </div>
        <div class="zavorth-approval-scope-grid" aria-label="Approval scope">
          <span><strong>Current scope</strong><small>${scope}</small></span>
          <span><strong>Expires</strong><small>${ttl}</small></span>
          <span><strong>After decision</strong><small>${rollback}</small></span>
        </div>
        <div class="zavorth-permission-card__meta">${capabilityKind} - ${sideEffect} - ${previewLabel} - target: ${scope}</div>
        <div class="zavorth-permission-card__meta" data-zavorth-approval-scope-label>Decision scope: allow once</div>
      </div>
      <div class="zavorth-permission-card__actions b-fade-in" style="animation-delay: 120ms">
        <button class="zavorth-permission-card__btn" data-zavorth-approval-decision="reject" data-zavorth-approval-id="${approvalId}" data-zavorth-approval-kind="${approvalKind}">Deny</button>
        <button class="zavorth-permission-card__btn zavorth-permission-card__btn--primary" data-zavorth-approval-decision="approve" data-zavorth-approval-id="${approvalId}" data-zavorth-approval-kind="${approvalKind}">Allow once</button>
        <button class="zavorth-permission-card__btn" type="button" data-zavorth-approval-edit-scope data-zavorth-approval-id="${approvalId}">Edit scope</button>
        ${traceButton}
      </div>
    </div>
  `;
}

export function buildRemoteMeshApprovalCard(card: any) {
  const approvalId = escapeHtml(card.id);
  const runId = escapeHtml(card.runId || card.agentRunId || card.correlation?.runId || '');
  const traceId = escapeHtml(card.traceId || card.correlation?.traceId || '');
  const sessionId = escapeHtml(card.sessionId || card.correlation?.sessionId || '');
  const title = escapeHtml(card.title || 'Remote Mesh approval');
  const summary = escapeHtml(card.summary || 'Review the remote action before applying it through the notebook MCP.');
  const risk = escapeHtml(card.risk || 'medium');
  const targetKind = escapeHtml(card.targetKind || 'notebook');
  const targetLabel = escapeHtml(card.targetLabel || 'Notebook MCP');
  const scope = escapeHtml(card.scope || card.targetLabel || 'Notebook MCP');
  const sideEffect = escapeHtml(card.sideEffect || (card.targetKind === 'project-file' ? 'read' : 'remote'));
  const ttl = escapeHtml(approvalTtlLabel(card));
  const rollback = escapeHtml(approvalRollbackLabel(card));
  const allowLabel = escapeHtml(card.targetKind === 'project-file' ? 'Allow in Workspace' : (card.primaryActionLabel || 'Allow via MCP'));
  const capabilityAttrs = [
    `data-capability-label="${targetLabel}"`,
    `data-capability-kind="${targetKind}"`,
    `data-capability-side-effect="${sideEffect}"`,
    `data-capability-scope="${scope}"`,
    `data-capability-risk="${risk}"`,
    'data-capability-preview="server-side preview"',
    `data-capability-reason="${summary}"`,
  ].join(' ');
  const traceButton = runId || traceId ? `<button class="zavorth-permission-card__btn zavorth-permission-card__btn--trace" type="button" data-zavorth-trace-action="open" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">View trace</button>`
    : '';
  return `
    <div class="zavorth-permission-card b-fade-in zavorth-remote-mesh-card" data-zavorth-remote-mesh-approval-id="${approvalId}" data-status="pending" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}" ${capabilityAttrs}>
      <div class="zavorth-permission-card__state">Waiting for user input</div>
      <div class="zavorth-permission-card__panel">
        <div class="zavorth-permission-card__request">
          <span class="zavorth-permission-card__eyebrow">Access</span>
          <span class="zavorth-permission-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.4 8.7-8 9-4.6-.3-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
          </span>
          <span class="zavorth-permission-card__target">${targetLabel}</span>
          <span class="zavorth-permission-card__risk">${risk}</span>
        </div>
        <div class="zavorth-permission-card__title">${title}</div>
        <div class="zavorth-permission-card__summary">${summary}</div>
        <div class="zavorth-approval-explain" aria-label="Approval explanation">
          <div><span>Will do</span><strong>Use remote proxy</strong><small>${approvalRiskCopy(risk, sideEffect)}</small></div>
          <div><span>Will not do</span><strong>Bypass dashboard approval</strong><small>Token-protected actions stay behind this decision card.</small></div>
        </div>
        <div class="zavorth-approval-scope-grid" aria-label="Approval scope">
          <span><strong>Current scope</strong><small>${scope}</small></span>
          <span><strong>Expires</strong><small>${ttl}</small></span>
          <span><strong>After decision</strong><small>${rollback}</small></span>
        </div>
        <div class="zavorth-permission-card__meta">${targetKind} - ${sideEffect} - server-side proxy - token protected</div>
      </div>
      <div class="zavorth-permission-card__actions b-fade-in" style="animation-delay: 120ms">
        <button class="zavorth-permission-card__btn" data-zavorth-remote-mesh-action="deny" data-zavorth-remote-mesh-approval-id="${approvalId}">Deny</button>
        <button class="zavorth-permission-card__btn zavorth-permission-card__btn--primary" data-zavorth-remote-mesh-action="apply" data-zavorth-remote-mesh-approval-id="${approvalId}">${allowLabel}</button>
        <button class="zavorth-permission-card__btn zavorth-permission-card__btn--caret" type="button" aria-label="Permission options" disabled>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        ${traceButton}
      </div>
    </div>
  `;
}

export function buildArtifactCard(artifact: any) {
  const artifactId = escapeHtml(artifact.id);
  const runId = escapeHtml(artifact.runId || artifact.toolRunId || artifact.agentRunId || '');
  const traceId = escapeHtml(artifact.traceId || '');
  const sessionId = escapeHtml(artifact.sessionId || '');
  const title = escapeHtml(artifact.title || artifact.name || artifact.path || 'Artifact');
  const kind = escapeHtml(artifact.kind || 'file');
  const summary = escapeHtml(artifact.summary || artifact.path || 'Output generated by Zavorth.');
  return `
    <div class="logic-cell b-fade-in zavorth-artifact-card" data-zavorth-artifact-id="${artifactId}" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">
      <div class="logic-cell__header">
        <div class="logic-cell__title">
          <span class="logic-cell__icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
          ${title}
        </div>
        <span class="logic-cell__status">${kind}</span>
      </div>
      <div class="logic-cell__detail">${summary}</div>
      <div class="interactive-actions b-fade-in" style="animation-delay: 120ms">
        <button class="interactive-btn interactive-btn--primary" data-zavorth-artifact-id="${artifactId}">Open artifact</button>
        ${(runId || traceId) ? `<button class="interactive-btn interactive-btn--trace" type="button" data-zavorth-trace-action="open" data-run-id="${runId}" data-trace-id="${traceId}" data-session-id="${sessionId}">View trace</button>` : ''}
      </div>
    </div>
  `;
}

