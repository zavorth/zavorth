import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

declare function escapeHtml(value: unknown): string;
declare function showToast(msg: string, isError?: boolean): void;

interface MeshChannelReceipt {
  summary?: string;
  details?: string[];
  loginQr?: MeshChannelQrInfo | null;
}

interface MeshChannelQrInfo {
  supported?: boolean;
  state?: string;
  nextStep?: string;
  dataUrl?: string;
  source?: string;
}

interface MeshChannelStatusRow {
  label?: string;
  value?: string;
  tone?: string;
}

interface MeshChannelAction {
  id?: string;
  kind?: string;
  label?: string;
}

interface MeshChannelSelected {
  id?: string;
  label?: string;
  summary?: string;
  actionHint?: string;
  readiness?: string;
  transport?: string;
  configured?: boolean;
  provider?: string;
  loginQr?: MeshChannelQrInfo | null;
  features?: { qrLogin?: boolean };
  statusRows?: MeshChannelStatusRow[];
  actions?: MeshChannelAction[];
}

interface MeshChannelEntry {
  id?: string;
  label?: string;
  readiness?: string;
  summary?: string;
  operatorSummary?: string;
}

interface MeshChannelSummary {
  total?: number;
  ready?: number;
  partial?: number;
  sessionSendReady?: number;
}

interface MeshChannelMesh {
  error?: string;
  summary?: MeshChannelSummary;
  selected?: MeshChannelSelected | null;
  entries?: MeshChannelEntry[];
  narrative?: { operatorSummary?: string };
}

interface MeshChannelActionResult {
  ok?: boolean;
  error?: string;
  result?: MeshChannelReceipt;
  channels?: MeshChannelMesh | null;
}

function zavorthControlClassicClientOverviewMeshChannels() {
  const channelActionReceipts: Record<string, MeshChannelReceipt | null> = {};

  async function runChannelAction(channelId: string, actionId: string) {
    try {
      const response = await fetch('/api/operations/channels/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, actionId }),
      });
      const payload: MeshChannelActionResult = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Failed to run Channel Mesh action.');
      }
      const normalizedChannelId = normalizeChannelId(channelId);
      if (normalizedChannelId) {
        channelActionReceipts[normalizedChannelId] = payload.result || null;
      }
      renderOperationsChannels(payload.channels || null);
      showToast(payload.result?.summary || 'Action completed: ' + actionId + '.');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      showToast(error instanceof Error ? err.message : 'Failed to run Channel Mesh action.');
    }
  }

  function normalizeChannelId(value: unknown) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  function toneClass(tone: unknown, fallback?: string) {
    const normalized = String(tone || fallback || '')
      .trim()
      .toLowerCase();
    if (normalized === 'success' || normalized === 'ready') return 'badge-allowed';
    if (normalized === 'warning' || normalized === 'partial') return 'badge-warning';
    if (normalized === 'danger' || normalized === 'failed' || normalized === 'disabled') return 'badge-blocked';
    return 'badge-info';
  }

  function renderStatusRows(selected: MeshChannelSelected) {
    const rows =
      Array.isArray(selected?.statusRows) && selected.statusRows.length
        ? selected.statusRows
        : [
            {
              label: 'Readiness',
              value: selected?.readiness || 'n/a',
              tone: selected?.readiness === 'ready' ? 'success' : 'warning',
            },
            { label: 'Transport', value: selected?.transport || 'n/a', tone: 'neutral' },
            {
              label: 'Configured',
              value: selected?.configured ? 'yes' : 'no',
              tone: selected?.configured ? 'success' : 'warning',
            },
          ];
    return (
      '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px; margin:10px 0;">' +
      rows
        .slice(0, 8)
        .map(
          (row: MeshChannelStatusRow) =>
            '<div class="cockpit-mini-card" style="min-height:auto;">' +
            '<strong>' +
            escapeHtml(row.label || 'Status') +
            '</strong>' +
            '<div style="font-size:1rem;">' +
            escapeHtml(row.value || 'n/a') +
            '</div>' +
            '<small><span class="badge ' +
            toneClass(row.tone, 'neutral') +
            '">' +
            escapeHtml(row.tone || 'status') +
            '</span></small>' +
            '</div>',
        )
        .join('') +
      '</div>'
    );
  }

  function renderChannelActions(selected: MeshChannelSelected) {
    const actions = Array.isArray(selected?.actions) ? selected.actions : [];
    if (!actions.length) return '';
    return (
      '<div style="display:flex; gap:8px; flex-wrap:wrap; margin:10px 0;">' +
      actions
        .map((action: MeshChannelAction) => {
          const actionId =
            String(action?.id || '')
              .trim()
              .split(':')
              .pop() ||
            action?.kind ||
            'inspect';
          const label = action?.label || actionId || 'Action';
          return (
            '<button class="btn" type="button" onclick="runChannelAction(' +
            JSON.stringify(String(selected.id || '')) +
            ', ' +
            JSON.stringify(actionId) +
            ')">' +
            escapeHtml(label) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderLastAction(selected: MeshChannelSelected) {
    const receipt = channelActionReceipts[normalizeChannelId(selected?.id)] || null;
    if (!receipt?.summary) return '';
    const details = Array.isArray(receipt.details) ? receipt.details.slice(0, 3) : [];
    return (
      '<div style="margin-top:10px; border-top:1px solid rgba(148,163,184,.22); padding-top:10px;">' +
      '<strong>Last action</strong>' +
      '<p>' +
      escapeHtml(receipt.summary) +
      '</p>' +
      (details.length
        ? '<ul class="cockpit-list">' +
          details.map((detail: string) => '<li>' + escapeHtml(detail) + '</li>').join('') +
          '</ul>'
        : '') +
      '</div>'
    );
  }

  function renderQrPanel(selected: MeshChannelSelected) {
    const receipt = channelActionReceipts[normalizeChannelId(selected?.id)] || null;
    const qr = receipt?.loginQr || selected?.loginQr || null;
    const supportsQr = Boolean(qr?.supported || selected?.features?.qrLogin);
    if (!supportsQr && !qr) return '';
    const state = qr?.state || (supportsQr ? 'pending' : 'n/a');
    const nextStep = qr?.nextStep || selected?.actionHint || 'No QR next step.';
    const image = qr?.dataUrl
      ? '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:8px;">' +
        '<img src="' +
        escapeHtml(qr.dataUrl) +
        '" alt="QR de login do WhatsApp" style="width:164px; height:164px; border-radius:8px; border:1px solid rgba(148,163,184,.35); background:#fff; padding:8px;" />' +
        '<small>Scan in the authorized app. The QR is not auto-sent to external channels.</small>' +
        '</div>'
      : '';
    return (
      '<div style="margin-top:10px; border-top:1px solid rgba(148,163,184,.22); padding-top:10px;">' +
      '<strong>QR e pareamento</strong>' +
      '<div class="sidecar-inline-meta" style="margin:8px 0;">' +
      '<span class="badge ' +
      toneClass(state === 'ready' ? 'success' : state === 'error' ? 'danger' : 'warning') +
      '">' +
      escapeHtml(state) +
      '</span>' +
      (qr?.source ? '<span class="badge badge-info">' + escapeHtml(qr.source) + '</span>' : '') +
      '</div>' +
      '<small>' +
      escapeHtml(nextStep) +
      '</small>' +
      image +
      '</div>'
    );
  }

  function renderOperationsChannels(channelMesh: MeshChannelMesh | null) {
    const node = document.getElementById('operations-channels');
    if (!node) return;
    if (!channelMesh || channelMesh.error) {
      node.innerHTML = '<div class="muted">Could not load Channel Mesh.</div>';
      return;
    }

    const summary = channelMesh.summary || ({} as MeshChannelSummary);
    const selected = channelMesh.selected || null;
    const entries = Array.isArray(channelMesh.entries) ? channelMesh.entries.slice(0, 5) : [];
    const entryItems = entries.length
      ? entries
          .map(
            (entry: MeshChannelEntry) =>
              '<li><strong>' +
              escapeHtml(entry.label || entry.id || 'Canal') +
              '</strong> [' +
              escapeHtml(entry.readiness || 'n/a') +
              '] - ' +
              escapeHtml(entry.operatorSummary || entry.summary || 'No summary.') +
              '</li>',
          )
          .join('')
      : '<li>No channel registered on the mesh.</li>';
    const selectedDetails = selected
      ? '<div class="sidecar-card"><strong>' +
        escapeHtml(selected.label || selected.id || 'Selected channel') +
        '</strong>' +
        '<p>' +
        escapeHtml(selected.summary || 'No additional summary.') +
        '</p>' +
        '<p><strong>Next step:</strong> ' +
        escapeHtml(selected.actionHint || 'No suggested action.') +
        '</p>' +
        renderStatusRows(selected) +
        renderChannelActions(selected) +
        renderQrPanel(selected) +
        renderLastAction(selected) +
        '<div class="sidecar-inline-meta">' +
        '<span class="badge ' +
        (selected.readiness === 'ready'
          ? 'badge-allowed'
          : selected.readiness === 'partial'
            ? 'badge-warning'
            : 'badge-info') +
        '">' +
        escapeHtml(selected.readiness || 'n/a') +
        '</span>' +
        '<span class="badge badge-info">' +
        escapeHtml(selected.transport || 'n/a') +
        '</span>' +
        (selected.provider ? '<span class="badge badge-info">' + escapeHtml(selected.provider) + '</span>' : '') +
        '</div>' +
        '</div>'
      : '<div class="sidecar-card"><strong>No channel selected</strong><small>Use /channels to drill into a specific channel.</small></div>';

    node.innerHTML =
      '<div class="cockpit-card-head">' +
      '<div>' +
      '<div class="cockpit-eyebrow">Channel Mesh</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(channelMesh.narrative?.operatorSummary || 'Canais first-class aparecem aqui.') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/channels" target="_blank">/api/operations/channels</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Total</strong><div>' +
      escapeHtml(String(summary.total || 0)) +
      '</div><small>Canais no mesh</small></div>' +
      '<div class="cockpit-mini-card"><strong>Ready</strong><div>' +
      escapeHtml(String(summary.ready || 0)) +
      '</div><small>Immediate operation</small></div>' +
      '<div class="cockpit-mini-card"><strong>Parciais</strong><div>' +
      escapeHtml(String(summary.partial || 0)) +
      '</div><small>Ainda pedem ajuste</small></div>' +
      '<div class="cockpit-mini-card"><strong>Send</strong><div>' +
      escapeHtml(String(summary.sessionSendReady || 0)) +
      '</div><small>Com sessions_send</small></div>' +
      '</div>' +
      selectedDetails +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Catalog summary</strong><ul class="cockpit-list">' +
      entryItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Next step</strong><small>Use /channels, /sessions and the gateway to see what each channel already supports before expanding rollout.</small></div>' +
      '</div>' +
      '</div>';
  }
}

export function getZavorthControlClassicClientOverviewMeshChannelsScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewMeshChannels);
}
