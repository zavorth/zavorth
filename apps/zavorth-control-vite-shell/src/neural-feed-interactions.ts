import { normalizeApprovalScopeLabel, rememberDismissedRemoteMeshApproval } from './chat-surface-renderers';
import { messageFromCaughtError } from './text-utils';

type NeuralFeedInteractionsOptions = {
  appendEcho: (role: string, text: string, logicCells?: string) => void;
  artifactBody: HTMLElement | null;
  artifactPane: HTMLElement | null;
  artifactTitle: HTMLElement | null;
  capabilityFromElement: (node: Element | null) => any;
  chooseWorkspaceFolder: () => void;
  composeInput: HTMLTextAreaElement | HTMLInputElement | null;
  escapeHtml: (value: unknown) => string;
  getSelectedExperienceProfile: () => string;
  openApprovalScopeEditor: (trigger: Element | null) => void;
  openArtifactPane: (title: string, bodyHtml: string) => void;
  openTraceSheet: (query: any) => void;
  recordTraceEvent: (event: Record<string, unknown>) => void;
  removeRemoteMeshApprovalCard: (card: Element | null) => void;
  renderApprovals: (approvals: any[]) => boolean;
  renderTranscript: (messages: any[], options?: any) => boolean;
  sanitizeRenderedHtml: (content: string) => string;
  setPendingGuidedFlow: (flow: string) => void;
  setPendingWorkspaceSelection: (workspace: any) => void;
  setSelectedExperienceProfile: (profile: string) => void;
  transmitSignal: () => void;
  updateDashboardGlass: () => void;
};

declare global {
  interface Window {
    Prism?: { highlightAllUnder?: (root: Element) => void };
    ZavorthControlChat?: any;
    ZavorthRuntimeBridge?: any;
    emitSignal?: (type: string, title: string, detail: string) => void;
  }
}

export function bindNeuralFeedInteractions(neuralFeed: HTMLElement | null, options: NeuralFeedInteractionsOptions) {
  if (!neuralFeed) return;
  neuralFeed.addEventListener('click', (event: any) => {
    const target = event.target;

    const echoActionButton = target.closest('.echo-action-row [data-prompt]');
    if (echoActionButton) {
      event.preventDefault();
      event.stopPropagation();
      if (options.composeInput) {
        options.composeInput.value = echoActionButton.getAttribute('data-prompt') || '';
        options.composeInput.dispatchEvent(new Event('input'));
        options.composeInput.focus();
      }
      return;
    }

    const personalFlowButton = target.closest('[data-personal-flow-action]');
    if (personalFlowButton) {
      event.preventDefault();
      event.stopPropagation();
      const action = personalFlowButton.getAttribute('data-personal-flow-action');
      const planId = personalFlowButton.getAttribute('data-personal-plan-id') || 'personal-day';
      personalFlowButton.closest('[data-personal-plan]')?.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
        button.disabled = true;
      });
      personalFlowButton.textContent = action === 'keep-plan' ? 'Plan kept' : 'Marked done';
      options.recordTraceEvent({
        type: 'receipt',
        title: action === 'keep-plan' ? 'Personal plan kept' : 'Personal plan completed',
        detail: planId,
        meta: 'personal',
        status: 'noted',
        receipt: {
          id: planId,
          status: 'noted',
          summary: 'Dashboard-only personal planning receipt. No external app was changed.',
          rollback: 'not needed; no external action executed',
        },
      });
      options.appendEcho('core', action === 'keep-plan'
        ? 'Plan kept in the conversation. I did not create reminders, edit calendars or change external apps.'
        : 'Marked as done here in the dashboard. No external app was changed.');
      return;
    }

    const developerFlowButton = target.closest('[data-developer-flow-action]');
    if (developerFlowButton) {
      event.preventDefault();
      event.stopPropagation();
      const action = developerFlowButton.getAttribute('data-developer-flow-action');
      if (action === 'select-folder') {
        options.chooseWorkspaceFolder();
        return;
      }
      if (action === 'use-current-workspace') {
        options.setPendingWorkspaceSelection({
          source: 'runtime',
          root: 'current runtime workspace',
          fileCount: 0,
          sampledFileCount: 0,
          totalBytes: 0,
          topExtensions: [],
          sampleFiles: [],
          selectedAt: new Date().toISOString(),
        });
        options.setPendingGuidedFlow('developer-review-workspace');
        if (!options.getSelectedExperienceProfile()) options.setSelectedExperienceProfile('developer');
        if (options.composeInput) {
          options.composeInput.value = 'Review this repository safely using the current runtime workspace. Read first, list risks, show patch preview, and do not edit without approval.';
          options.composeInput.dispatchEvent(new Event('input'));
        }
        options.transmitSignal();
        return;
      }
      if (action === 'deny-patch' || action === 'approve-patch') {
        const receiptId = developerFlowButton.getAttribute('data-developer-receipt-id') || 'developer-review';
        const group = developerFlowButton.closest('[data-developer-approval]');
        if (group) group.dataset.status = action === 'approve-patch' ? 'approved-preview' : 'denied';
        group?.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
          button.disabled = true;
        });
        developerFlowButton.textContent = action === 'approve-patch' ? 'Preview approved' : 'Denied';
        options.recordTraceEvent({
          type: 'approval-decision',
          title: action === 'approve-patch' ? 'Patch preview approved' : 'Patch preview denied',
          detail: receiptId,
          meta: 'developer',
          status: action === 'approve-patch' ? 'approved-preview' : 'denied',
          approvalId: receiptId,
          receipt: {
            id: receiptId,
            status: action === 'approve-patch' ? 'approved-preview' : 'denied',
            summary: action === 'approve-patch'
              ? 'Operator approved the patch proposal. File mutation still requires runtime safety approval.'
              : 'Operator denied the patch proposal. No file mutation occurred.',
            rollback: 'not needed; no file was edited in dashboard preview',
          },
        });
        options.appendEcho('core', action === 'approve-patch'
          ? 'Patch proposal approved as a preview. I still will not edit files from this dashboard preview; live execution must go through runtime safety approval with scope and rollback evidence.'
          : 'Patch proposal denied. No files were changed.');
        return;
      }
    }

    const businessFlowButton = target.closest('[data-business-flow-action]');
    if (businessFlowButton) {
      event.preventDefault();
      event.stopPropagation();
      const action = businessFlowButton.getAttribute('data-business-flow-action');
      const receiptId = businessFlowButton.getAttribute('data-business-receipt-id') || 'business-audit';
      const group = businessFlowButton.closest('[data-business-approval]');
      if (group) group.dataset.status = action === 'confirm-channel' ? 'confirmed' : 'denied';
      group?.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
        button.disabled = true;
      });
      businessFlowButton.textContent = action === 'confirm-channel' ? 'Channel confirmed' : 'Denied';
      options.recordTraceEvent({
        type: 'approval-decision',
        title: action === 'confirm-channel' ? 'Business approval channel confirmed' : 'Business approval channel denied',
        detail: receiptId,
        meta: 'business',
        status: action === 'confirm-channel' ? 'confirmed' : 'denied',
        approvalId: receiptId,
        receipt: {
          id: receiptId,
          status: action === 'confirm-channel' ? 'confirmed' : 'denied',
          summary: action === 'confirm-channel'
            ? 'Operator confirmed the dashboard as approval channel for this audit preview. No mutable action executed.'
            : 'Operator denied the approval channel for this audit preview. No mutable action executed.',
          rollback: 'not needed; no policy or channel was changed',
        },
      });
      options.appendEcho('core', action === 'confirm-channel'
        ? 'Dashboard approval channel confirmed for this audit preview. I still will not change policy, send messages or connect channels without a separate scoped approval.'
        : 'Approval channel denied for this audit preview. No business policy, channel or workspace state changed.');
      return;
    }

    const traceButton = target.closest('[data-zavorth-trace-action="open"]');
    if (traceButton) {
      event.preventDefault();
      event.stopPropagation();
      const runtimeBridge = window.ZavorthRuntimeBridge;
      const query = {
        runId: traceButton.dataset.runId || '',
        traceId: traceButton.dataset.traceId || '',
        sessionId: traceButton.dataset.sessionId || '',
      };
      if (runtimeBridge && typeof runtimeBridge.openPersistentTrace === 'function') {
        runtimeBridge.openPersistentTrace(query, window.ZavorthControlChat || {}).catch((error: unknown) => {
          window.emitSignal?.('error', 'Trace unavailable', error?.message || 'I could not open this run trace.');
        });
      } else {
        options.openTraceSheet(query);
      }
      return;
    }

    const artifactButton = target.closest('[data-zavorth-artifact-id]');
    if (artifactButton) {
      const runtimeBridge = window.ZavorthRuntimeBridge;
      const id = artifactButton.dataset.zavorthArtifactId;
      if (runtimeBridge && typeof runtimeBridge.openArtifact === 'function') {
        runtimeBridge.openArtifact(id, {
          openArtifactPane: options.openArtifactPane,
          emitSignal: window.emitSignal,
        }).catch((error: unknown) => {
          options.openArtifactPane('Artifact', `<div class="empty-state"><div class="empty-state__icon">Doc</div><div class="empty-state__title">Could not open</div><div class="empty-state__desc">${options.escapeHtml(error?.message || 'Try again.')}</div></div>`);
        });
      } else {
        options.openArtifactPane('Artifact', '<div class="empty-state"><div class="empty-state__icon">Doc</div><div class="empty-state__title">Runtime not connected</div><div class="empty-state__desc">Unlock the dashboard to read live artifacts.</div></div>');
      }
      return;
    }

    const remoteMeshButton = target.closest('[data-zavorth-remote-mesh-action]');
    if (remoteMeshButton) {
      const card = remoteMeshButton.closest('.zavorth-remote-mesh-card');
      const id = remoteMeshButton.dataset.zavorthRemoteMeshApprovalId;
      const action = String(remoteMeshButton.dataset.zavorthRemoteMeshAction || '').trim();
      const currentStatus = String(card?.dataset?.status || 'pending');
      if (currentStatus !== 'pending' && currentStatus !== 'retryable') return;
      const capability = options.capabilityFromElement(card);
      if (action === 'deny') {
        options.recordTraceEvent({ type: 'approval-decision', title: 'Remote Mesh denied', detail: id, meta: 'Notebook MCP', status: 'denied', approvalId: id, capability });
        rememberDismissedRemoteMeshApproval(id);
        if (card) card.dataset.status = 'denied';
        card?.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
          button.disabled = true;
        });
        remoteMeshButton.textContent = 'Denied';
        setTimeout(() => options.removeRemoteMeshApprovalCard(card), 220);
        return;
      }
      if (action !== 'apply') return;
      const runtimeBridge = window.ZavorthRuntimeBridge;
      if (!runtimeBridge || typeof runtimeBridge.applyRemoteMeshApproval !== 'function') return;
      options.recordTraceEvent({ type: 'approval-decision', title: 'Remote Mesh authorized', detail: id, meta: 'Notebook MCP', status: 'applying', approvalId: id, capability });
      card?.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
        button.disabled = true;
      });
      remoteMeshButton.textContent = 'Allowing...';
      runtimeBridge.applyRemoteMeshApproval({ id }, { appendEcho: options.appendEcho, emitSignal: window.emitSignal })
        .then((payload: any) => {
          if (payload?.ok) {
            rememberDismissedRemoteMeshApproval(id);
            if (card) card.dataset.status = 'applied';
            remoteMeshButton.textContent = 'Allowed';
            options.recordTraceEvent({
              type: 'remote-apply',
              title: 'MCP applied',
              detail: payload?.receipt?.summary || payload?.message || id,
              meta: 'receipt',
              status: 'success',
              approvalId: id,
              capability,
              receipt: payload?.receipt || { id: payload?.receiptId || id, status: 'success', summary: payload?.message },
              replay: { runId: payload?.runId || id, traceId: payload?.traceId, sessionId: payload?.sessionId, policy: 'receipts only' },
            });
            setTimeout(() => options.removeRemoteMeshApprovalCard(card), 520);
            return;
          }
          handleRemoteMeshFailure(
            String(payload?.error || payload?.jsonRpcError?.message || 'Check the notebook MCP server.'),
            card,
            remoteMeshButton,
            id,
            'MCP rejected the action',
            'The MCP rejected this remote action.',
          );
        })
        .catch((error: unknown) => handleRemoteMeshFailure(
          String(error?.message || 'Try again.'),
          card,
          remoteMeshButton,
          id,
          'MCP unavailable',
          'I could not call the notebook MCP.',
        ));
      return;
    }

    const editScopeButton = target.closest('[data-zavorth-approval-edit-scope]');
    if (editScopeButton) {
      event.preventDefault();
      event.stopPropagation();
      options.openApprovalScopeEditor(editScopeButton);
      return;
    }

    const approvalButton = target.closest('[data-zavorth-approval-decision]');
    if (approvalButton) {
      const runtimeBridge = window.ZavorthRuntimeBridge;
      if (!runtimeBridge || typeof runtimeBridge.decideApproval !== 'function') return;
      const card = approvalButton.closest('.zavorth-approval-card');
      const decision = approvalButton.dataset.zavorthApprovalDecision;
      const id = approvalButton.dataset.zavorthApprovalId;
      const kind = approvalButton.dataset.zavorthApprovalKind;
      const scope = card?.dataset?.approvalScope || 'once';
      const scopeNote = card?.dataset?.approvalScopeNote || '';
      const capability = options.capabilityFromElement(card);
      options.recordTraceEvent({
        type: 'approval-decision',
        title: decision === 'approve' ? 'Approval authorized' : 'Approval rejected',
        detail: id,
        meta: kind,
        status: decision,
        approvalId: id,
        capability,
        preview: capability?.preview || '',
        receipt: { id, status: decision, summary: `Decision scope: ${normalizeApprovalScopeLabel(scope, scopeNote)}` },
      });
      if (decision === 'reject') {
        if (card) card.dataset.status = 'denied';
        approvalButton.textContent = 'Denied';
      } else {
        approvalButton.textContent = 'Allowing...';
      }
      card?.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
        button.disabled = true;
      });
      runtimeBridge.decideApproval({ id, kind, decision, scope, scopeNote }, {
        appendEcho: options.appendEcho,
        renderApprovals: options.renderApprovals,
        renderTranscript: options.renderTranscript,
        emitSignal: window.emitSignal,
      }).catch((error: unknown) => {
        card?.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
          button.disabled = false;
        });
        const detail = messageFromCaughtError(error, 'Try again.');
        options.recordTraceEvent({ type: 'error', title: 'Approval failed', detail, meta: kind, status: 'failed' });
        options.appendEcho('core', `I could not resolve this approval.\n\n${detail}`);
      });
      return;
    }

    const cell = target.closest('.logic-cell');
    if (cell && options.artifactPane) {
      const name = cell.querySelector('.logic-cell__icon')?.nextSibling?.textContent?.trim();
      const output = cell.querySelector('.logic-cell__block-content');
      if (options.artifactTitle) options.artifactTitle.textContent = name || 'Artifact';
      if (options.artifactBody) {
        options.artifactBody.innerHTML = output
          ? options.sanitizeRenderedHtml(`<div class="artifact-render">${output.innerHTML}</div>`)
          : '<div class="empty-state"><div class="empty-state__icon">Doc</div><div class="empty-state__title">No artifact generated</div><div class="empty-state__desc">This operation did not produce a viewable output.</div></div>';
        if (window.Prism && output) window.Prism.highlightAllUnder?.(options.artifactBody);
      }
      options.artifactPane.classList.remove('hidden');
      options.updateDashboardGlass();
    }
  });

  function handleRemoteMeshFailure(
    failureMessage: string,
    card: any,
    button: HTMLElement,
    id: string,
    title: string,
    userMessage: string,
  ) {
    options.recordTraceEvent({ type: 'error', title: /expired|not found|already used/i.test(failureMessage) ? 'MCP approval closed' : title, detail: failureMessage, meta: id, status: 'failed' });
    const terminalApprovalFailure = /expired|not found|already used/i.test(failureMessage);
    if (terminalApprovalFailure) {
      rememberDismissedRemoteMeshApproval(id);
      if (card) card.dataset.status = 'expired';
      card?.querySelectorAll('button').forEach((child: HTMLButtonElement) => {
        child.disabled = true;
      });
      button.textContent = 'Closed';
      options.appendEcho('core', `This Remote Mesh approval is no longer active.\n\n${options.escapeHtml(failureMessage)}`);
      setTimeout(() => options.removeRemoteMeshApprovalCard(card), 1600);
      return;
    }
    if (card) card.dataset.status = 'retryable';
    card?.querySelectorAll('button').forEach((child: HTMLButtonElement) => {
      child.disabled = false;
    });
    button.textContent = 'Try again';
    options.appendEcho('core', `${userMessage}\n\n${options.escapeHtml(failureMessage)}`);
  }
}
