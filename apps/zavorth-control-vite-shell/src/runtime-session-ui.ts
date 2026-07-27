type RuntimeSessionUiOptions = {
  state: any;
  isTranscriptRenderSuppressed: (options?: any) => boolean;
};

function normalizeTranscriptEntry(message: any) {
  const content = String(message?.content || message?.text || message?.message || '').trim();
  if (!content) return null;
  const role = String(message?.role || message?.source || '').trim().toLowerCase();
  return {
    id: String(message?.id || message?.messageId || `${role}:${content}`).trim(),
    role: ['user', 'operator', 'human'].includes(role) ? 'user' : 'assistant',
    content,
    createdAt: message?.createdAt || message?.created_at || null,
    kind: message?.kind || null,
  };
}

function extractTranscriptMessages(payload: any) {
  const candidates = [
    payload?.snapshot?.messages,
    payload?.session?.transcript,
    payload?.gatewaySessionTools?.history?.transcript,
    payload?.session?.messages,
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    return candidate.map(normalizeTranscriptEntry).filter(Boolean);
  }
  return [];
}

function normalizeApproval(entry: any, kind: string) {
  const id = String(
    entry?.id
    || entry?.permission_id
    || entry?.task_id
    || entry?.approvalId
    || entry?.requestId
    || '',
  ).trim();
  if (!id) return null;

  const status = String(entry?.status || entry?.approval_status || 'pending').trim().toLowerCase();
  const pending = status === 'pending'
    || status === 'waiting'
    || status === 'waiting_approval'
    || status === 'requested'
    || status === 'null';
  if (!pending) return null;

  return {
    id,
    kind,
    status: 'pending',
    title: String(
      entry?.title
      || entry?.kind
      || entry?.command_type
      || (kind === 'task' ? 'Task waiting for approval' : 'Permission waiting for approval'),
    ).trim(),
    summary: String(
      entry?.reason
      || entry?.requested_value
      || entry?.raw_message
      || entry?.summary
      || 'Review before authorizing.',
    ).trim(),
    risk: String(entry?.risk_level || entry?.scope || entry?.executor || 'review').trim(),
    taskId: String(entry?.task_id || '').trim() || null,
    runId: String(entry?.runId || entry?.agentRunId || entry?.correlation?.runId || '').trim() || null,
    traceId: String(entry?.traceId || entry?.correlation?.traceId || '').trim() || null,
    sessionId: String(entry?.sessionId || entry?.correlation?.sessionId || '').trim() || null,
    capability: entry?.capability || entry?.tool || entry?.permission || null,
  };
}

function normalizeRemoteMeshApprovalCard(card: any) {
  const approval = card?.approval && typeof card.approval === 'object' ? card.approval : null;
  const approvalId = String(approval?.approvalId || '').trim();
  if (!approvalId) return null;
  const applyToolName = String(approval?.applyToolName || '').trim();
  const applyArguments = approval?.applyArguments && typeof approval.applyArguments === 'object' && !Array.isArray(approval.applyArguments)
    ? approval.applyArguments
    : null;
  if (!applyToolName || !applyArguments) return null;
  const stateValue = String(card?.state || '').trim().toLowerCase();
  if (stateValue && stateValue !== 'approval-required' && stateValue !== 'pending') return null;
  const surface = String(card?.surface || 'zavorth-control').trim().toLowerCase();
  if (surface && surface !== 'zavorth-control') return null;

  return {
    id: approvalId,
    status: 'pending',
    title: String(card?.title || 'Remote Mesh approval').trim(),
    summary: String(card?.body || 'Review the remote action before applying it through the notebook MCP.').trim(),
    risk: String(card?.riskLabel || 'medium').trim(),
    targetKind: String(card?.targetKind || 'notebook').trim(),
    targetLabel: String(card?.targetLabel || 'Notebook MCP').trim(),
    badge: String(card?.zavorthControl?.badge || 'Needs approval').trim(),
    primaryActionLabel: String(card?.zavorthControl?.primaryActionLabel || 'Apply in MCP').trim(),
    applyToolName,
    applyArguments,
    approvalPhrase: String(approval?.approvalPhrase || '').trim(),
    expiresAt: String(approval?.expiresAt || '').trim(),
  };
}

export function createRuntimeSessionUi({
  state,
  isTranscriptRenderSuppressed,
}: RuntimeSessionUiOptions) {
  function renderMessagesFromPayload(payload: any, ui: any = {}, options: any = {}) {
    if (isTranscriptRenderSuppressed(options)) return false;
    const messages = extractTranscriptMessages(payload);
    if (messages.length === 0 || typeof ui.renderTranscript !== 'function') return false;
    return ui.renderTranscript(messages, { label: 'Live history' });
  }

  function extractApprovals(payload: any) {
    const approvals = [];
    const permissions = [
      payload?.permissions,
      payload?.snapshot?.permissions,
      payload?.session?.permissions,
      payload?.gatewaySessionTools?.history?.permissions,
    ];
    for (const candidate of permissions) {
      if (!Array.isArray(candidate)) continue;
      for (const entry of candidate) {
        const approval = normalizeApproval(entry, 'permission');
        if (approval) approvals.push(approval);
      }
    }

    const tasks = [
      payload?.snapshot?.tasks,
      payload?.session?.tasks,
      payload?.gatewaySessionTools?.history?.tasks,
    ];
    for (const candidate of tasks) {
      if (!Array.isArray(candidate)) continue;
      for (const entry of candidate) {
        const requiresApproval = entry?.requires_approval === true
          || String(entry?.approval_status || '').toLowerCase() === 'pending';
        if (!requiresApproval) continue;
        const approval = normalizeApproval({
          ...entry,
          approval_status: entry?.approval_status || 'pending',
        }, 'task');
        if (approval) approvals.push(approval);
      }
    }

    const runs = [
      payload?.snapshot?.runs,
      payload?.zavorthControl?.snapshot?.runs,
      state.zavorthControl?.snapshot?.runs,
    ];
    for (const candidate of runs) {
      if (!Array.isArray(candidate)) continue;
      for (const run of candidate) {
        const runApprovals = Array.isArray(run?.approvals) ? run.approvals : [];
        for (const approvalEntry of runApprovals) {
          const approval = normalizeApproval({
            ...approvalEntry,
            runId: approvalEntry?.runId || approvalEntry?.agentRunId || run?.id || run?.runId,
            traceId: approvalEntry?.traceId || run?.traceId,
            sessionId: approvalEntry?.sessionId || run?.sessionId,
            title: approvalEntry?.title || run?.title || 'Run waiting for approval',
            summary: approvalEntry?.summary || approvalEntry?.reason || run?.objective || run?.text,
          }, 'agent-run');
          if (approval) approvals.push(approval);
        }
      }
    }

    const byKey = new Map();
    for (const approval of approvals) byKey.set(approval.id, approval);
    return Array.from(byKey.values());
  }

  function renderApprovalsFromPayload(payload: any, ui: any = {}) {
    const approvals = extractApprovals(payload);
    if (typeof ui.renderApprovals !== 'function') return false;
    return ui.renderApprovals(approvals);
  }

  function collectRemoteMeshUxSnapshots(payload: any) {
    const snapshots = [
      payload?.remoteMeshApprovalUx,
      payload?.remoteMeshNotebookApprovalUx,
      payload?.snapshot?.remoteMeshApprovalUx,
      payload?.snapshot?.remoteMeshNotebookApprovalUx,
      payload?.zavorthControl?.remoteMeshApprovalUx,
      payload?.zavorthControl?.remoteMeshNotebookApprovalUx,
      payload?.zavorthControl?.snapshot?.remoteMeshApprovalUx,
      payload?.zavorthControl?.snapshot?.remoteMeshNotebookApprovalUx,
      payload?.snapshot?.activeRun?.metadata?.remoteMeshApprovalUx,
      payload?.snapshot?.activeRun?.metadata?.remoteMeshNotebookApprovalUx,
      payload?.activeRun?.metadata?.remoteMeshApprovalUx,
      payload?.activeRun?.metadata?.remoteMeshNotebookApprovalUx,
    ];

    const runs = [
      payload?.snapshot?.runs,
      payload?.zavorthControl?.snapshot?.runs,
      state.zavorthControl?.snapshot?.runs,
    ];
    for (const candidate of runs) {
      if (!Array.isArray(candidate)) continue;
      for (const run of candidate) {
        snapshots.push(run?.metadata?.remoteMeshApprovalUx);
        snapshots.push(run?.metadata?.remoteMeshNotebookApprovalUx);
      }
    }
    return snapshots.filter((snapshot) => snapshot && typeof snapshot === 'object');
  }

  function extractRemoteMeshApprovalCards(payload: any) {
    const cards = [];
    for (const snapshot of collectRemoteMeshUxSnapshots(payload)) {
      const rawCards = Array.isArray(snapshot?.cards) ? snapshot.cards : [];
      for (const rawCard of rawCards) {
        const card = normalizeRemoteMeshApprovalCard(rawCard);
        if (card) cards.push(card);
      }
    }
    const byId = new Map();
    for (const card of cards) byId.set(card.id, card);
    return Array.from(byId.values());
  }

  function renderRemoteMeshApprovalsFromPayload(payload: any, ui: any = {}) {
    const cards = extractRemoteMeshApprovalCards(payload);
    state.remoteMeshApprovals = cards;
    state.remoteMeshApprovalsById = new Map(cards.map((card) => [card.id, card]));
    if (typeof ui.renderRemoteMeshApprovals !== 'function') return false;
    return ui.renderRemoteMeshApprovals(cards);
  }

  return {
    extractApprovals,
    extractRemoteMeshApprovalCards,
    extractTranscriptMessages,
    renderApprovalsFromPayload,
    renderMessagesFromPayload,
    renderRemoteMeshApprovalsFromPayload,
  };
}
