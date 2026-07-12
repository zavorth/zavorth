import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import type { ClassicSecurityMeshDto as ZavorthSecurityMeshSnapshot } from './ZavorthControlClassicClientContracts.js';

declare function escapeHtml(value: unknown): string;

type SecurityMeshErrorPayload = { error: unknown };

function zavorthControlClassicClientOverviewMeshSecurity() {
  function renderOperationsSecurityMesh(
    securityMesh: ZavorthSecurityMeshSnapshot | SecurityMeshErrorPayload | null | undefined,
  ) {
    const node = document.getElementById('operations-security-mesh');
    if (!node) return;
    if (!securityMesh || 'error' in securityMesh) {
      node.innerHTML = '<div class="muted">Nao foi possivel carregar o Runtime & Security Mesh.</div>';
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
      ['Low risk', securityMesh.policies?.lowRiskToLocalJail ? 'local-jail' : 'n/d'],
      ['Medium risk', securityMesh.policies?.mediumRiskToContainer ? 'container' : 'n/d'],
      ['High risk', securityMesh.policies?.highRiskToMicrovm ? 'microvm' : 'n/d'],
      ['Never-downgrade', securityMesh.policies?.neverDowngrade ? 'ativo' : 'inativo'],
      ['gVisor', securityMesh.policies?.gvisorActive ? 'ativo' : 'inativo'],
      ['MicroVM', securityMesh.policies?.firecrackerReady ? 'pronta' : 'em preparo'],
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
              escapeHtml(action.label || action.id || 'Acao') +
              '</strong>' +
              '<span class="badge ' +
              (action.severity === 'warn' ? 'badge-warning' : 'badge-info') +
              '">' +
              escapeHtml(action.severity || 'info') +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(action.reason || 'Sem motivo adicional.') +
              '</small>' +
              '<div class="cockpit-command">' +
              escapeHtml(action.command || '') +
              '</div>' +
              '</div>',
          )
          .join('')
      : '<div class="muted">Nenhuma acao adicional sugerida agora.</div>';
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
      : '<li>Nenhum tier core visivel.</li>';
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
      : '<li>Nenhuma extensao visivel.</li>';

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
      escapeHtml(posture.label || posture.level || 'n/d') +
      '</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(securityMesh.narrative?.operatorSummary || posture.summary || 'Postura de seguranca indisponivel.') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/security-mesh" target="_blank">/api/operations/security-mesh</a>' +
      '</div>' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Core pronto</strong><div>' +
      escapeHtml(String(summary.coreReady || 0)) +
      '</div><small>local-jail, container, microVM</small></div>' +
      '<div class="cockpit-mini-card"><strong>Extensoes</strong><div>' +
      escapeHtml(String(summary.extensionsReady || 0)) +
      '</div><small>node-host e sidecar</small></div>' +
      '<div class="cockpit-mini-card"><strong>gVisor</strong><div>' +
      escapeHtml(summary.gvisorActive ? 'ativo' : 'inativo') +
      '</div><small>container forte</small></div>' +
      '<div class="cockpit-mini-card"><strong>Never-downgrade</strong><div>' +
      escapeHtml(summary.neverDowngrade ? 'ativo' : 'inativo') +
      '</div><small>alto risco nao rebaixa</small></div>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Politicas oficiais</strong><ul class="cockpit-list">' +
      policyItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Trust boundary</strong><small>' +
      escapeHtml(securityMesh.narrative?.trustBoundary || 'Sem boundary detalhado.') +
      '</small></div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Tiers core</strong><ul class="cockpit-list">' +
      coreItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Extensoes</strong><ul class="cockpit-list">' +
      extensionItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Acoes sugeridas</strong><div class="cockpit-action-list">' +
      actionItems +
      '</div></div>' +
      '</div>' +
      '</div>';
  }
}

export function getZavorthControlClassicClientOverviewMeshSecurityScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewMeshSecurity);
}
