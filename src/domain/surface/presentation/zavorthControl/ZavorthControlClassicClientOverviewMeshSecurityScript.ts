import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import type { ClassicSecurityMeshDto as ZavorthSecurityMeshSnapshot } from './ZavorthControlClassicClientContracts.js';

declare function escapeHtml(value: unknown): string;

type SecurityMeshErrorPayload = { error: unknown };

function zavorthControlClassicClientOverviewMeshSecurity() {
  // Consumed at runtime via extractFunctionBody(); renders the security mesh card.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function renderOperationsSecurityMesh(
    securityMesh: ZavorthSecurityMeshSnapshot | SecurityMeshErrorPayload | null | undefined,
  ) {
    const node = document.getElementById('operations-security-mesh');
    if (!node) return;
    if (!securityMesh || 'error' in securityMesh) {
      node.innerHTML = '<div class="muted">Could not load Runtime & Security Mesh.</div>';
      return;
    }

    const summary: ZavorthSecurityMeshSnapshot['summary'] =
      securityMesh.summary || ({} as ZavorthSecurityMeshSnapshot['summary']);
    const posture: ZavorthSecurityMeshSnapshot['posture'] =
      securityMesh.posture || ({} as ZavorthSecurityMeshSnapshot['posture']);
    const coreModes = Array.isArray(securityMesh.modes?.core) ? securityMesh.modes.core : [];
    const extensionModes = Array.isArray(securityMesh.modes?.extensions) ? securityMesh.modes.extensions : [];
    const actions = Array.isArray(securityMesh.suggestedActions) ? securityMesh.suggestedActions : [];
    const policyItems = [
      ['Low risk', securityMesh.policies?.lowRiskToLocalJail ? 'local-jail' : 'n/a'],
      ['Medium risk', securityMesh.policies?.mediumRiskToContainer ? 'container' : 'n/a'],
      ['High risk', securityMesh.policies?.highRiskToMicrovm ? 'microvm' : 'n/a'],
      ['Never-downgrade', securityMesh.policies?.neverDowngrade ? 'active' : 'inactive'],
      ['gVisor', securityMesh.policies?.gvisorActive ? 'active' : 'inactive'],
      ['MicroVM', securityMesh.policies?.firecrackerReady ? 'ready' : 'em preparo'],
    ]
      .map((entry) => '<li><strong>' + escapeHtml(entry[0]) + '</strong>: ' + escapeHtml(entry[1]) + '</li>')
      .join('');
    const actionItems = actions.length
      ? actions
          .map(
            (action) =>
              '<div class="cockpit-action-card">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">' +
              '<strong>' +
              escapeHtml(action.label || action.id || 'Action') +
              '</strong>' +
              '<span class="badge ' +
              (action.severity === 'warn' ? 'badge-warning' : 'badge-info') +
              '">' +
              escapeHtml(action.severity || 'info') +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(action.reason || 'No additional reason.') +
              '</small>' +
              '<div class="cockpit-command">' +
              escapeHtml(action.command || '') +
              '</div>' +
              '</div>',
          )
          .join('')
      : '<div class="muted">No additional action suggested right now.</div>';
    const coreItems = coreModes.length
      ? coreModes
          .map(
            (entry) =>
              '<li><strong>' +
              escapeHtml(entry.label || entry.id || 'Modo') +
              '</strong> [' +
              escapeHtml(entry.readiness || 'planned') +
              ']</li>',
          )
          .join('')
      : '<li>No core tier visible.</li>';
    const extensionItems = extensionModes.length
      ? extensionModes
          .map(
            (entry) =>
              '<li><strong>' +
              escapeHtml(entry.label || entry.id || 'Modo') +
              '</strong> [' +
              escapeHtml(entry.readiness || 'planned') +
              ']</li>',
          )
          .join('')
      : '<li>No extension visible.</li>';

    node.innerHTML =
      '' +
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Runtime &amp; Security Mesh</strong>' +
      '<span class="badge ' +
      (posture.level === 'zero-trust-ready'
        ? 'badge-allowed'
        : posture.level === 'guarded'
          ? 'badge-warning'
          : 'badge-info') +
      '">' +
      escapeHtml(posture.label || posture.level || 'n/a') +
      '</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(securityMesh.narrative?.operatorSummary || posture.summary || 'Security posture unavailable.') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/security-mesh" target="_blank">/api/operations/security-mesh</a>' +
      '</div>' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Core ready</strong><div>' +
      escapeHtml(String(summary.coreReady || 0)) +
      '</div><small>local-jail, container, microVM</small></div>' +
      '<div class="cockpit-mini-card"><strong>Extensoes</strong><div>' +
      escapeHtml(String(summary.extensionsReady || 0)) +
      '</div><small>node-host e sidecar</small></div>' +
      '<div class="cockpit-mini-card"><strong>gVisor</strong><div>' +
      escapeHtml(summary.gvisorActive ? 'active' : 'inactive') +
      '</div><small>container forte</small></div>' +
      '<div class="cockpit-mini-card"><strong>Never-downgrade</strong><div>' +
      escapeHtml(summary.neverDowngrade ? 'active' : 'inactive') +
      '</div><small>alto risk no rebaixa</small></div>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Politicas oficiais</strong><ul class="cockpit-list">' +
      policyItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Trust boundary</strong><small>' +
      escapeHtml(securityMesh.narrative?.trustBoundary || 'No detailed boundary.') +
      '</small></div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Tiers core</strong><ul class="cockpit-list">' +
      coreItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Extensoes</strong><ul class="cockpit-list">' +
      extensionItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Actions sugeridas</strong><div class="cockpit-action-list">' +
      actionItems +
      '</div></div>' +
      '</div>' +
      '</div>';
  }
}

export function getZavorthControlClassicClientOverviewMeshSecurityScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewMeshSecurity);
}
