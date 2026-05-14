// @ts-nocheck
import { extractFunctionBody } from './DashboardClassicScriptUtils.js';

function dashboardClassicClientOverviewMeshChannels() {
    const channelActionReceipts = {};

    async function runChannelAction(channelId, actionId) {
      try {
        const response = await fetch('/api/operations/channels/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId, actionId }),
        });
        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || 'Falha ao executar a acao do Channel Mesh.');
        }
        const normalizedChannelId = normalizeChannelId(channelId);
        if (normalizedChannelId) {
          channelActionReceipts[normalizedChannelId] = payload.result || null;
        }
        renderOperationsChannels(payload.channels || null);
        showToast(payload.result?.summary || ('Acao executada: ' + actionId + '.'));
      } catch (error) {
        showToast(error.message || 'Falha ao executar a acao do Channel Mesh.');
      }
    }

    function normalizeChannelId(value) {
      return String(value || '').trim().toLowerCase();
    }

    function toneClass(tone, fallback) {
      const normalized = String(tone || fallback || '').trim().toLowerCase();
      if (normalized === 'success' || normalized === 'ready') return 'badge-allowed';
      if (normalized === 'warning' || normalized === 'partial') return 'badge-warning';
      if (normalized === 'danger' || normalized === 'failed' || normalized === 'disabled') return 'badge-blocked';
      return 'badge-info';
    }

    function renderStatusRows(selected) {
      const rows = Array.isArray(selected?.statusRows) && selected.statusRows.length
        ? selected.statusRows
        : [
            { label: 'Readiness', value: selected?.readiness || 'n/d', tone: selected?.readiness === 'ready' ? 'success' : 'warning' },
            { label: 'Transporte', value: selected?.transport || 'n/d', tone: 'neutral' },
            { label: 'Configurado', value: selected?.configured ? 'sim' : 'nao', tone: selected?.configured ? 'success' : 'warning' },
          ];
      return '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px; margin:10px 0;">'
        + rows.slice(0, 8).map((row) =>
          '<div class="cockpit-mini-card" style="min-height:auto;">'
          + '<strong>' + escapeHtml(row.label || 'Status') + '</strong>'
          + '<div style="font-size:1rem;">' + escapeHtml(row.value || 'n/d') + '</div>'
          + '<small><span class="badge ' + toneClass(row.tone, 'neutral') + '">' + escapeHtml(row.tone || 'status') + '</span></small>'
          + '</div>'
        ).join('')
        + '</div>';
    }

    function renderChannelActions(selected) {
      const actions = Array.isArray(selected?.actions) ? selected.actions : [];
      if (!actions.length) return '';
      return '<div style="display:flex; gap:8px; flex-wrap:wrap; margin:10px 0;">'
        + actions.map((action) => {
          const actionId = String(action?.id || '').trim().split(':').pop() || action?.kind || 'inspect';
          const label = action?.label || actionId || 'Acao';
          return '<button class="btn" type="button" onclick="runChannelAction('
            + JSON.stringify(String(selected.id || '')) + ', '
            + JSON.stringify(actionId) + ')">' + escapeHtml(label) + '</button>';
        }).join('')
        + '</div>';
    }

    function renderLastAction(selected) {
      const receipt = channelActionReceipts[normalizeChannelId(selected?.id)] || null;
      if (!receipt?.summary) return '';
      const details = Array.isArray(receipt.details) ? receipt.details.slice(0, 3) : [];
      return '<div style="margin-top:10px; border-top:1px solid rgba(148,163,184,.22); padding-top:10px;">'
        + '<strong>Ultima acao</strong>'
        + '<p>' + escapeHtml(receipt.summary) + '</p>'
        + (details.length
          ? '<ul class="cockpit-list">' + details.map((detail) => '<li>' + escapeHtml(detail) + '</li>').join('') + '</ul>'
          : '')
        + '</div>';
    }

    function renderQrPanel(selected) {
      const receipt = channelActionReceipts[normalizeChannelId(selected?.id)] || null;
      const qr = receipt?.loginQr || selected?.loginQr || null;
      const supportsQr = Boolean(qr?.supported || selected?.features?.qrLogin);
      if (!supportsQr && !qr) return '';
      const state = qr?.state || (supportsQr ? 'pendente' : 'n/a');
      const nextStep = qr?.nextStep || selected?.actionHint || 'Sem proximo passo de QR.';
      const image = qr?.dataUrl
        ? '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:8px;">'
          + '<img src="' + escapeHtml(qr.dataUrl) + '" alt="QR de login do WhatsApp" style="width:164px; height:164px; border-radius:8px; border:1px solid rgba(148,163,184,.35); background:#fff; padding:8px;" />'
          + '<small>Escaneie no app autorizado. O QR nao e enviado automaticamente para canais externos.</small>'
          + '</div>'
        : '';
      return '<div style="margin-top:10px; border-top:1px solid rgba(148,163,184,.22); padding-top:10px;">'
        + '<strong>QR e pareamento</strong>'
        + '<div class="sidecar-inline-meta" style="margin:8px 0;">'
        + '<span class="badge ' + toneClass(state === 'ready' ? 'success' : state === 'error' ? 'danger' : 'warning') + '">' + escapeHtml(state) + '</span>'
        + (qr?.source ? '<span class="badge badge-info">' + escapeHtml(qr.source) + '</span>' : '')
        + '</div>'
        + '<small>' + escapeHtml(nextStep) + '</small>'
        + image
        + '</div>';
    }

    function renderOperationsChannels(channelMesh) {
      const node = document.getElementById('operations-channels');
      if (!node) return;
      if (!channelMesh || channelMesh.error) {
        node.innerHTML = '<div class="muted">Nao foi possivel carregar o Channel Mesh.</div>';
        return;
      }

      const summary = channelMesh.summary || {};
      const selected = channelMesh.selected || null;
      const entries = Array.isArray(channelMesh.entries) ? channelMesh.entries.slice(0, 5) : [];
      const entryItems = entries.length
        ? entries.map((entry) =>
            '<li><strong>' + escapeHtml(entry.label || entry.id || 'Canal') + '</strong> ['
            + escapeHtml(entry.readiness || 'n/d') + '] - '
            + escapeHtml(entry.operatorSummary || entry.summary || 'Sem resumo.') + '</li>'
          ).join('')
        : '<li>Nenhum canal registrado no mesh.</li>';
      const selectedDetails = selected
        ? '<div class="sidecar-card"><strong>' + escapeHtml(selected.label || selected.id || 'Canal selecionado') + '</strong>'
          + '<p>' + escapeHtml(selected.summary || 'Sem resumo adicional.') + '</p>'
          + '<p><strong>Proximo passo:</strong> ' + escapeHtml(selected.actionHint || 'Sem acao sugerida.') + '</p>'
          + renderStatusRows(selected)
          + renderChannelActions(selected)
          + renderQrPanel(selected)
          + renderLastAction(selected)
          + '<div class="sidecar-inline-meta">'
          + '<span class="badge ' + (selected.readiness === 'ready' ? 'badge-allowed' : (selected.readiness === 'partial' ? 'badge-warning' : 'badge-info')) + '">' + escapeHtml(selected.readiness || 'n/d') + '</span>'
          + '<span class="badge badge-info">' + escapeHtml(selected.transport || 'n/d') + '</span>'
          + (selected.provider ? '<span class="badge badge-info">' + escapeHtml(selected.provider) + '</span>' : '')
          + '</div>'
          + '</div>'
        : '<div class="sidecar-card"><strong>Sem canal selecionado</strong><small>Use /channels para aprofundar um canal especifico.</small></div>';

      node.innerHTML =
        '<div class="cockpit-card-head">'
        + '<div>'
        + '<div class="cockpit-eyebrow">Channel Mesh</div>'
        + '<div class="cockpit-headline">' + escapeHtml(channelMesh.narrative?.operatorSummary || 'Canais first-class aparecem aqui.') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/channels" target="_blank">/api/operations/channels</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">'
        + '<div class="cockpit-mini-card"><strong>Total</strong><div>' + escapeHtml(String(summary.total || 0)) + '</div><small>Canais no mesh</small></div>'
        + '<div class="cockpit-mini-card"><strong>Prontos</strong><div>' + escapeHtml(String(summary.ready || 0)) + '</div><small>Operacao imediata</small></div>'
        + '<div class="cockpit-mini-card"><strong>Parciais</strong><div>' + escapeHtml(String(summary.partial || 0)) + '</div><small>Ainda pedem ajuste</small></div>'
        + '<div class="cockpit-mini-card"><strong>Send</strong><div>' + escapeHtml(String(summary.sessionSendReady || 0)) + '</div><small>Com sessions_send</small></div>'
        + '</div>'
        + selectedDetails
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card"><strong>Catalogo resumido</strong><ul class="cockpit-list">' + entryItems + '</ul></div>'
        + '<div class="sidecar-card"><strong>Proximo passo</strong><small>Use /channels, /sessions e o gateway para entender o que cada canal ja suporta antes de ampliar rollout.</small></div>'
        + '</div>'
        + '</div>';
    }
}

export function getDashboardClassicClientOverviewMeshChannelsScript(): string {
  return extractFunctionBody(dashboardClassicClientOverviewMeshChannels);
}

