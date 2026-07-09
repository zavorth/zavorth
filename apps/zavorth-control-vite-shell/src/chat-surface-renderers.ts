import { buildApprovalCard, buildArtifactCard, buildRemoteMeshApprovalCard, deriveApprovalCapability } from './approval-artifact-cards';
import { buildConversationStateCard } from './chat-renderer';
import { looksLikeUnifiedDiff, setDiffReviewContent } from './diff-review-rail';

const REMOTE_MESH_DISMISSED_APPROVALS_KEY = 'zavorth.remoteMesh.dismissedApprovals.v1';

type ChatSurfaceOptions = {
  neuralFeed: HTMLElement | null;
  artifactPane: HTMLElement | null;
  artifactTitle: HTMLElement | null;
  artifactBody: HTMLElement | null;
  currentTimestamp: () => string;
  getCurrentModelLabel: () => string;
  getCurrentModelRouteLabel: () => string;
  recordTraceEvent: (event: Record<string, unknown>) => void;
  updateDashboardGlass: () => void;
  scrollFeedToEnd: () => void;
  dismissOverlays: () => void;
  sanitizeRenderedHtml: (content: string) => string;
  escapeHtml: (value: unknown) => string;
};

declare global {
  interface Window {
    Prism?: { highlightAllUnder?: (root: Element) => void };
    openCoreModal?: (title: string, body: string) => void;
  }
}

export function normalizeApprovalScopeLabel(scope: unknown, customScope = '') {
  const normalized = String(scope || 'once').trim().toLowerCase();
  const custom = String(customScope || '').trim();
  if (custom) return custom;
  if (normalized === 'session') return 'this session only';
  if (normalized === 'read-only') return 'read-only only';
  if (normalized === 'target') return 'selected target only';
  return 'allow once';
}

export function applyApprovalScope(card: HTMLElement | null, scope: unknown, customScope = '') {
  if (!card) return;
  const label = normalizeApprovalScopeLabel(scope, customScope);
  card.dataset.approvalScope = String(scope || 'once').trim() || 'once';
  card.dataset.approvalScopeNote = String(customScope || '').trim();
  const labelNode = card.querySelector('[data-zavorth-approval-scope-label]');
  if (labelNode) labelNode.textContent = `Decision scope: ${label}`;
  const approve = card.querySelector('[data-zavorth-approval-decision="approve"]');
  if (approve) approve.textContent = label === 'allow once' ? 'Allow once' : 'Allow scoped';
}

export function readDismissedRemoteMeshApprovals() {
  try {
    const raw = window.localStorage?.getItem(REMOTE_MESH_DISMISSED_APPROVALS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []);
  } catch {
    return new Set();
  }
}

export function rememberDismissedRemoteMeshApproval(id: unknown) {
  if (!id) return;
  try {
    const dismissed = readDismissedRemoteMeshApprovals();
    dismissed.add(String(id));
    window.localStorage?.setItem(REMOTE_MESH_DISMISSED_APPROVALS_KEY, JSON.stringify(Array.from(dismissed).slice(-100)));
  } catch {
    // Ignore storage failures; the current UI state is still updated.
  }
}

export function removeRemoteMeshApprovalCard(card: HTMLElement | null, updateDashboardGlass: () => void) {
  if (!card) return;
  const group = card.closest('#zavorth-remote-mesh-approvals-group');
  card.remove();
  if (group && !group.querySelector('.zavorth-remote-mesh-card')) {
    group.remove();
  }
  updateDashboardGlass();
}

function isRelevantChatArtifact(artifact: any) {
  if (!artifact || !artifact.id) return false;
  const source = String(artifact.source || '').trim().toLowerCase();
  return Boolean(
    artifact.runId
    || artifact.toolRunId
    || artifact.path
    || artifact.content
    || artifact.diff
    || ['tool-run', 'agent-run', 'file'].includes(source),
  );
}

export function createChatSurfaceRenderers({
  neuralFeed,
  artifactPane,
  artifactTitle,
  artifactBody,
  currentTimestamp,
  getCurrentModelLabel,
  getCurrentModelRouteLabel,
  recordTraceEvent,
  updateDashboardGlass,
  scrollFeedToEnd,
  dismissOverlays,
  sanitizeRenderedHtml,
  escapeHtml,
}: ChatSurfaceOptions) {
  function openApprovalScopeEditor(trigger: Element | null) {
    const card = trigger?.closest?.('.zavorth-approval-card') as HTMLElement | null;
    if (!card || typeof window.openCoreModal !== 'function') return;
    const currentScope = card.dataset.approvalScope || 'once';
    const currentNote = card.dataset.approvalScopeNote || '';
    window.openCoreModal('Edit approval scope', `
      <form id="zavorth-approval-scope-form" class="config-form" autocomplete="off">
        <div class="config-form-section">
          <span class="config-form-section__title">Decision scope</span>
          <label class="zavorth-secret-field">
            <span>Scope</span>
            <div class="zavorth-secret-field__row">
              <select id="zavorth-approval-scope" class="zavorth-scope-select">
                <option value="once"${currentScope === 'once' ? ' selected' : ''}>Allow once</option>
                <option value="session"${currentScope === 'session' ? ' selected' : ''}>This session only</option>
                <option value="target"${currentScope === 'target' ? ' selected' : ''}>Selected target only</option>
                <option value="read-only"${currentScope === 'read-only' ? ' selected' : ''}>Read-only only</option>
              </select>
            </div>
          </label>
          <label class="zavorth-secret-field">
            <span>Limit</span>
            <div class="zavorth-secret-field__row">
              <input id="zavorth-approval-scope-note" type="text" value="${escapeHtml(currentNote)}" placeholder="Example: only this folder, only this command, or read-only." />
            </div>
          </label>
          <p style="margin:0;color:var(--b-signal-muted);line-height:1.6">
            Editing the scope changes what Zavorth sends with this approval. It does not run anything until you confirm.
          </p>
        </div>
      </form>
    `);
    const cancel = document.getElementById('core-modal-cancel');
    const confirm = document.getElementById('core-modal-confirm') as HTMLButtonElement | null;
    if (cancel) {
      cancel.textContent = 'Cancel';
      (cancel as HTMLButtonElement).onclick = dismissOverlays;
    }
    if (confirm) {
      confirm.textContent = 'Save scope';
      confirm.disabled = false;
      confirm.onclick = () => {
        const scope = (document.getElementById('zavorth-approval-scope') as HTMLSelectElement | null)?.value || 'once';
        const note = (document.getElementById('zavorth-approval-scope-note') as HTMLInputElement | null)?.value || '';
        applyApprovalScope(card, scope, note);
        recordTraceEvent({
          type: 'approval',
          title: 'Approval scope edited',
          detail: normalizeApprovalScopeLabel(scope, note),
          meta: card.dataset.zavorthApprovalId || 'approval',
          status: 'scoped',
        });
        dismissOverlays();
      };
    }
    const form = document.getElementById('zavorth-approval-scope-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      confirm?.click();
    });
  }

  function renderApprovals(approvals: any[]) {
    if (!neuralFeed || !Array.isArray(approvals)) return false;
    const pending = approvals.filter((approval) => String(approval?.status || 'pending') === 'pending' && approval?.id);
    neuralFeed.querySelectorAll('#zavorth-approvals-group, .zavorth-approval-card').forEach((node) => {
      const group = node.closest('#zavorth-approvals-group');
      (group || node).remove();
    });
    if (pending.length === 0) {
      updateDashboardGlass();
      return false;
    }

    const terminalView = document.getElementById('terminal-view');
    if (terminalView) terminalView.classList.remove('is-empty');
    recordTraceEvent({
      type: 'approval',
      title: 'Pending approval',
      detail: pending.map((approval) => approval.title || approval.kind || approval.id).join(', '),
      meta: `${pending.length} item(s)`,
      status: 'waiting',
      approvalId: pending[0]?.id,
      capability: deriveApprovalCapability(pending[0]),
    });

    const cards = pending.slice(0, 4).map(buildApprovalCard).join('');
    const group = document.createElement('div');
    group.id = 'zavorth-approvals-group';
    group.className = 'echo-group core b-fade-in';
    group.innerHTML = `
      <div class="echo-avatar core">Z</div>
      <div class="echo-group__messages">
        <div class="echo-group__header">
          <span class="echo-sender">Zavorth</span>
          <span class="echo-timestamp">${currentTimestamp()}</span>
          <span class="echo-meta"><span class="echo-meta__model">${escapeHtml(getCurrentModelLabel())}</span><span class="echo-meta__cost">${escapeHtml(getCurrentModelRouteLabel())}</span></span>
        </div>
        ${buildConversationStateCard('approval', 'Decision needed', pending.length === 1
          ? 'One action is ready, but Zavorth needs your approval before it can continue.'
          : `${pending.length} actions are ready, but Zavorth needs your approval before it can continue.`, [
          'Review what will happen',
          'Approve only this scoped action or deny it',
          'A receipt will be recorded after the decision',
        ], { badge: 'approval', meta: `${pending.length} pending` })}
        <div class="artifacts-grid" style="display: grid; gap: 0.75rem; margin-top: 0.75rem;">
          ${cards}
        </div>
      </div>
    `;
    neuralFeed.appendChild(group);
    scrollFeedToEnd();
    updateDashboardGlass();
    return true;
  }

  function renderRemoteMeshApprovals(cards: any[]) {
    if (!neuralFeed || !Array.isArray(cards)) return false;
    const dismissed = readDismissedRemoteMeshApprovals();
    const pending = cards.filter((card) => String(card?.status || 'pending') === 'pending' && card?.id && !dismissed.has(String(card.id)));
    neuralFeed.querySelectorAll('#zavorth-remote-mesh-approvals-group, .zavorth-remote-mesh-card').forEach((node) => {
      const group = node.closest('#zavorth-remote-mesh-approvals-group');
      (group || node).remove();
    });
    if (pending.length === 0) {
      updateDashboardGlass();
      return false;
    }

    const terminalView = document.getElementById('terminal-view');
    if (terminalView) terminalView.classList.remove('is-empty');
    recordTraceEvent({
      type: 'remote-approval',
      title: 'Remote Mesh approval',
      detail: pending.map((card) => card.title || card.targetLabel || card.id).join(', '),
      meta: 'Notebook MCP',
      status: 'waiting',
      approvalId: pending[0]?.id,
      capability: {
        label: pending[0]?.targetLabel || 'Notebook MCP',
        kind: pending[0]?.targetKind || 'notebook',
        sideEffect: pending[0]?.sideEffect || (pending[0]?.targetKind === 'project-file' ? 'read' : 'remote'),
        risk: pending[0]?.risk || 'medium',
        scope: pending[0]?.scope || pending[0]?.targetLabel || 'Notebook MCP',
        reason: pending[0]?.summary,
        approval: 'required',
        previewRequired: true,
      },
    });

    const cardsHtml = pending.slice(0, 4).map(buildRemoteMeshApprovalCard).join('');
    const group = document.createElement('div');
    group.id = 'zavorth-remote-mesh-approvals-group';
    group.className = 'echo-group core b-fade-in';
    group.innerHTML = `
      <div class="echo-avatar core">Z</div>
      <div class="echo-group__messages">
        <div class="echo-group__header">
          <span class="echo-sender">Zavorth Remote Mesh</span>
          <span class="echo-timestamp">${currentTimestamp()}</span>
          <span class="echo-meta"><span class="echo-meta__model">Notebook MCP</span><span class="echo-meta__cost">server-side proxy</span></span>
        </div>
        ${buildConversationStateCard('approval', 'Remote action ready', pending.length === 1
          ? 'One remote action is prepared and waiting for your explicit approval.'
          : `${pending.length} remote actions are prepared and waiting for your explicit approval.`, [
          'Zavorth keeps the remote target scoped',
          'Secrets stay protected by the gateway',
          'Execution only happens after your decision',
        ], { badge: 'remote approval', meta: `${pending.length} pending` })}
        <div class="artifacts-grid" style="display: grid; gap: 0.75rem; margin-top: 0.75rem;">
          ${cardsHtml}
        </div>
      </div>
    `;
    neuralFeed.appendChild(group);
    scrollFeedToEnd();
    updateDashboardGlass();
    return true;
  }

  function renderArtifacts(artifacts: any[], context: any = {}) {
    if (!neuralFeed || !Array.isArray(artifacts)) return false;
    neuralFeed.querySelectorAll('#zavorth-artifacts-group').forEach((node) => node.remove());

    if (!context || !context.reason) {
      updateDashboardGlass();
      return false;
    }
    const visibleArtifacts = artifacts.filter(isRelevantChatArtifact);
    if (visibleArtifacts.length === 0) {
      updateDashboardGlass();
      return false;
    }

    const terminalView = document.getElementById('terminal-view');
    if (terminalView) terminalView.classList.remove('is-empty');
    recordTraceEvent({
      type: 'receipt',
      title: 'Registered artifacts',
      detail: visibleArtifacts.map((artifact) => artifact.title || artifact.name || artifact.path || artifact.id).join(', '),
      meta: `${visibleArtifacts.length} item(s)`,
      status: 'available',
      receipt: {
        id: visibleArtifacts[0]?.receiptId || visibleArtifacts[0]?.id,
        status: 'available',
        summary: visibleArtifacts[0]?.summary || visibleArtifacts[0]?.title,
        artifact: visibleArtifacts[0]?.path || visibleArtifacts[0]?.id,
      },
      replay: {
        runId: visibleArtifacts[0]?.runId || visibleArtifacts[0]?.toolRunId,
        traceId: visibleArtifacts[0]?.traceId,
        sessionId: visibleArtifacts[0]?.sessionId,
        policy: 'receipts only',
      },
    });

    const cards = visibleArtifacts.slice(0, 5).map(buildArtifactCard).join('');
    const group = document.createElement('div');
    group.id = 'zavorth-artifacts-group';
    group.className = 'echo-group core b-fade-in';
    group.innerHTML = `
      <div class="echo-avatar core">Z</div>
      <div class="echo-group__messages">
        <div class="echo-group__header">
          <span class="echo-sender">Zavorth</span>
          <span class="echo-timestamp">${currentTimestamp()}</span>
          <span class="echo-meta"><span class="echo-meta__model">Workspace</span></span>
        </div>
        ${buildConversationStateCard('receipt', 'Result recorded', visibleArtifacts.length === 1
          ? 'One output is ready for inspection.'
          : `${visibleArtifacts.length} outputs are ready for inspection.`, [
          'Open the artifact when you want details',
          'Use trace to inspect how the result was produced',
          'Receipts stay available for review and replay',
        ], { badge: 'receipt', meta: `${visibleArtifacts.length} item(s)` })}
        <div class="artifacts-grid" style="display: grid; gap: 0.75rem; margin-top: 0.75rem;">
          ${cards}
        </div>
      </div>
    `;

    neuralFeed.appendChild(group);
    const firstDiff = visibleArtifacts.find((artifact) => {
      const kind = String(artifact?.kind || '').toLowerCase();
      if (kind === 'diff' || artifact?.diff) return true;
      return typeof artifact?.content === 'string' && looksLikeUnifiedDiff(artifact.content);
    });
    if (firstDiff) maybeOpenArtifactDiffRail(firstDiff);
    scrollFeedToEnd();
    updateDashboardGlass();
    return true;
  }

  function openArtifactPane(title: string, bodyHtml: string) {
    if (!artifactPane || !artifactTitle || !artifactBody) return false;
    recordTraceEvent({
      type: 'artifact',
      title: 'Artifact opened',
      detail: title || 'Artifact',
      status: 'viewed',
    });
    artifactTitle.textContent = title || 'Artifact';
    artifactBody.innerHTML = sanitizeRenderedHtml(bodyHtml || `<div class="empty-state"><div class="empty-state__icon">Doc</div><div class="empty-state__title">Artifact without preview</div><div class="empty-state__desc">Zavorth registered this output, but it has no viewable content in this tab.</div></div>`);
    if (window.Prism) window.Prism.highlightAllUnder?.(artifactBody);
    artifactPane.classList.remove('hidden');
    updateDashboardGlass();
    return true;
  }

  /**
   * When chat surfaces a diff/patch artifact, also populate the trust rail.
   * Safe no-op when there is no unified-diff text.
   */
  function openDiffInTrustRail(diffText: string, meta: { file?: string; title?: string; runId?: string; sessionId?: string; artifactId?: string } = {}) {
    const text = String(diffText || '').trim();
    if (!text) return false;
    setDiffReviewContent(text, {
      file: meta.file,
      title: meta.title || meta.file || 'Diff review',
      runId: meta.runId,
      sessionId: meta.sessionId,
      artifactId: meta.artifactId,
    });
    if (!artifactPane?.classList.contains('hidden')) {
      // already open
    } else if (artifactPane) {
      artifactPane.classList.remove('hidden');
    }
    updateDashboardGlass();
    return true;
  }

  function maybeOpenArtifactDiffRail(artifact: any) {
    if (!artifact) return false;
    const isDiff = String(artifact.kind || '').toLowerCase() === 'diff' || Boolean(artifact.diff);
    const raw =
      (typeof artifact.diff === 'string' && artifact.diff)
      || artifact.diff?.consolidatedDiff
      || (Array.isArray(artifact.diff?.patches)
        ? artifact.diff.patches.map((entry: any) => String(entry?.diff || entry?.patch || '').trim()).filter(Boolean).join('\n\n')
        : '')
      || (typeof artifact.content === 'string' && looksLikeUnifiedDiff(artifact.content) ? artifact.content : '')
      || '';
    if (!isDiff && !looksLikeUnifiedDiff(String(raw))) return false;
    if (!String(raw).trim()) return false;
    return openDiffInTrustRail(String(raw), {
      file: artifact.path || artifact.name || artifact.title,
      title: artifact.title || artifact.name || 'Diff review',
      runId: artifact.runId || artifact.toolRunId,
      sessionId: artifact.sessionId,
      artifactId: artifact.id,
    });
  }

  return {
    openApprovalScopeEditor,
    openArtifactPane,
    openDiffInTrustRail,
    maybeOpenArtifactDiffRail,
    looksLikeUnifiedDiff,
    renderApprovals,
    renderArtifacts,
    renderRemoteMeshApprovals,
  };
}
