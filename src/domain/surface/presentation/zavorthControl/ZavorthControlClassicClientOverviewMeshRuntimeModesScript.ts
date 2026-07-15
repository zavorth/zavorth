import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import type { ClassicRuntimeModesDto as ZavorthRuntimeModesSnapshot } from './ZavorthControlClassicClientContracts.js';

declare function escapeHtml(value: unknown): string;

type RuntimeModesErrorPayload = { error: unknown };

function zavorthControlClassicClientOverviewMeshRuntimeModes() {
  function renderOperationsRuntimeModes(
    runtimeModes: ZavorthRuntimeModesSnapshot | RuntimeModesErrorPayload | null | undefined,
  ) {
    const node = document.getElementById('operations-runtime-modes');
    if (!node) return;
    if (!runtimeModes || 'error' in runtimeModes) {
      node.innerHTML = '<div class="muted">Could not load runtime modes.</div>';
      return;
    }

    const summary: ZavorthRuntimeModesSnapshot['summary'] =
      runtimeModes.summary || ({} as ZavorthRuntimeModesSnapshot['summary']);
    const entries = Array.isArray(runtimeModes.entries) ? runtimeModes.entries : [];
    const entryItems = entries.length
      ? entries
          .map(
            (entry) =>
              '<div class="cockpit-action-card">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">' +
              '<strong>' +
              escapeHtml(entry.label || entry.id || 'Modo') +
              '</strong>' +
              '<span class="badge ' +
              (entry.readiness === 'ready'
                ? 'badge-allowed'
                : entry.readiness === 'partial'
                  ? 'badge-warning'
                  : 'badge-info') +
              '">' +
              escapeHtml(entry.readiness || 'planned') +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(entry.operatorSummary || 'No additional summary.') +
              '</small>' +
              '<small>Melhor para: ' +
              escapeHtml(entry.recommendedFor || 'No additional recommendation.') +
              '</small>' +
              (entry.actionHint ? '<div class="cockpit-command">' + escapeHtml(entry.actionHint) + '</div>' : '') +
              '<ul class="cockpit-list">' +
              (Array.isArray(entry.details) && entry.details.length
                ? entry.details
                    .slice(0, 3)
                    .map((detail) => '<li>' + escapeHtml(detail) + '</li>')
                    .join('')
                : '<li>No additional details.</li>') +
              '</ul>' +
              '</div>',
          )
          .join('')
      : '<div class="muted">No runtime mode cataloged yet.</div>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Modos de runtime</strong>' +
      '<span class="badge badge-info">' +
      escapeHtml(String(summary.total || 0)) +
      ' modos</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(
        runtimeModes.narrative?.operatorSummary ||
          'Runtime local, container, microVM e conectores remotos em uma leitura.',
      ) +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/runtime-modes" target="_blank">/api/operations/runtime-modes</a>' +
      '</div>' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Prontos</strong><div>' +
      escapeHtml(String(summary.ready || 0)) +
      '</div><small>Ja podem operar agora</small></div>' +
      '<div class="cockpit-mini-card"><strong>Parciais</strong><div>' +
      escapeHtml(String(summary.partial || 0)) +
      '</div><small>Dependem de algum ajuste</small></div>' +
      '<div class="cockpit-mini-card"><strong>Planejados</strong><div>' +
      escapeHtml(String(summary.planned || 0)) +
      '</div><small>Pedem setup adicional</small></div>' +
      '<div class="cockpit-mini-card"><strong>Desligados</strong><div>' +
      escapeHtml(String(summary.disabled || 0)) +
      '</div><small>Fora do runtime atual</small></div>' +
      '</div>' +
      '<div class="sidecar-card"><strong>Panorama operacional</strong><div class="cockpit-action-list">' +
      entryItems +
      '</div></div>';
  }
}

export function getZavorthControlClassicClientOverviewMeshRuntimeModesScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewMeshRuntimeModes);
}
